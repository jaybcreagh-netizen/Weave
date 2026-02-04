/**
 * InsightOrchestratorService
 * 
 * Coordinates intelligence updates after interactions are logged.
 * Replaces the gamification badge/achievement listener with understanding-based insights.
 */

import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import Friend from '@/db/models/Friend';
import RelationshipInsight, {
    InsightType,
    InsightTone,
    InsightGrounding
} from '@/db/models/RelationshipInsight';
import { relationshipQualityService } from './RelationshipQualityService';
import { reciprocityService } from './ReciprocityService';
import { narrativeService } from './NarrativeService';

// ============================================================================
// TYPES
// ============================================================================

interface InsightCandidate {
    type: InsightType;
    tone: InsightTone;
    opener: string;
    message: string;
    friendId?: string;
    friendName?: string;
    grounding: InsightGrounding;
    priority: number;
}

// ============================================================================
// SERVICE
// ============================================================================

class InsightOrchestratorService {
    private readonly INSIGHT_RATE_LIMIT_HOURS = 24;
    private readonly INSIGHT_EXPIRY_DAYS = 7;

    /**
     * Main entry point - process after weave is logged
     * Replaces checkAndAwardFriendBadges + checkAndAwardGlobalAchievements
     */
    async processInteraction(interactionId: string): Promise<void> {
        try {
            const interaction = await database.get<Interaction>('interactions').find(interactionId);
            const friendIds = await this.getInteractionFriendIds(interactionId);

            // Update intelligence for each friend
            for (const friendId of friendIds) {
                await this.updateFriendIntelligence(friendId, interaction);
            }

            // Maybe generate an insight (rate-limited)
            await this.maybeGenerateInsight(friendIds);
        } catch (error) {
            console.error('[InsightOrchestrator] Error processing interaction:', error);
        }
    }

    /**
     * Process intelligence updates after journal activity tied to one or more friends.
     * This keeps insights responsive when users reflect without logging a new weave.
     */
    async processJournalEntry(friendIds: string[]): Promise<void> {
        try {
            const uniqueFriendIds = Array.from(new Set(friendIds)).filter(Boolean);
            if (uniqueFriendIds.length === 0) return;

            for (const friendId of uniqueFriendIds) {
                await this.updateFriendIntelligence(friendId);
            }

            await this.maybeGenerateInsight(uniqueFriendIds);
        } catch (error) {
            console.error('[InsightOrchestrator] Error processing journal entry:', error);
        }
    }

    /**
     * Update all intelligence metrics for a friend
     */
    private async updateFriendIntelligence(friendId: string, interaction?: Interaction): Promise<void> {
        try {
            // Update RQS
            await relationshipQualityService.calculateRQS(friendId);

            // Update Reciprocity
            await reciprocityService.calculateReciprocity(friendId);

            // Record narrative moments for logged interactions only
            if (interaction) {
                await this.checkNarrativeMoments(friendId, interaction);
            }
        } catch (error) {
            console.error(`[InsightOrchestrator] Error updating intelligence for ${friendId}:`, error);
        }
    }

    /**
     * Check for narrative moments triggered by this interaction
     */
    private async checkNarrativeMoments(friendId: string, interaction: Interaction): Promise<void> {
        const interactionCount = await this.countInteractions(friendId);

        // First weave with this friend
        if (interactionCount === 1) {
            await narrativeService.recordMoment(friendId, 'first_weave', {
                interactionId: interaction.id,
            });
        }

        // Deep conversation (based on note length)
        if ((interaction.note?.length || 0) > 100) {
            const hasMoment = await this.hasMomentType(friendId, 'first_deep_conversation');
            if (!hasMoment) {
                await narrativeService.recordMoment(friendId, 'first_deep_conversation', {
                    interactionId: interaction.id,
                });
            }
        }
    }

    /**
     * Conditionally generate an insight (rate-limited)
     */
    private async maybeGenerateInsight(friendIds: string[]): Promise<void> {
        // Check rate limit
        if (await this.wasInsightGeneratedRecently()) {
            return;
        }

        // Collect insight candidates
        const candidates: InsightCandidate[] = [];

        for (const friendId of friendIds) {
            const friendCandidates = await this.generateInsightCandidates(friendId);
            candidates.push(...friendCandidates);
        }

        // Pick the best candidate
        if (candidates.length === 0) return;

        const bestCandidate = candidates.sort((a, b) => b.priority - a.priority)[0];

        // Store the insight
        await this.storeInsight(bestCandidate);
    }

    /**
     * Generate insight candidates for a friend based on their metrics
     */
    private async generateInsightCandidates(friendId: string): Promise<InsightCandidate[]> {
        const candidates: InsightCandidate[] = [];
        const friend = await database.get<Friend>('friends').find(friendId);

        // Get latest RQS
        const rqs = await relationshipQualityService.getLatestRQS(friendId);
        const reciprocity = await reciprocityService.getLatestReciprocity(friendId);

        if (!rqs && !reciprocity) return candidates;

        // Check for trajectory insights
        if (rqs?.trajectory === 'strengthening') {
            candidates.push({
                type: 'observation',
                tone: 'affirming',
                opener: 'Something I noticed...',
                message: `Your connection with ${friend.name} has been growing stronger lately. The investment is showing.`,
                friendId,
                friendName: friend.name,
                grounding: {
                    signals: ['trajectory_strengthening'],
                    dataPoints: { trajectory: rqs.trajectory, composite: rqs.composite },
                    confidence: 0.8,
                },
                priority: 7,
            });
        }

        if (rqs?.trajectory === 'fading') {
            candidates.push({
                type: 'gentle_nudge',
                tone: 'gentle',
                opener: 'A thought...',
                message: `It's been a while since you and ${friend.name} connected. Life gets busy — but maybe it's worth reaching out?`,
                friendId,
                friendName: friend.name,
                grounding: {
                    signals: ['trajectory_fading'],
                    dataPoints: { trajectory: rqs.trajectory, composite: rqs.composite },
                    confidence: 0.7,
                },
                priority: 5,
            });
        }

        // Check for reciprocity insights
        if (reciprocity?.flags.onePersonCarrying) {
            const summary = reciprocityService.generateSummary(reciprocity);
            candidates.push({
                type: 'observation',
                tone: 'curious',
                opener: 'I noticed...',
                message: summary,
                friendId,
                friendName: friend.name,
                grounding: {
                    signals: ['reciprocity_imbalance'],
                    dataPoints: { ratio: reciprocity.initiationRatio, flags: reciprocity.flags },
                    confidence: 0.75,
                },
                priority: 4,
            });
        }

        if (reciprocity?.trend === 'improving' && !reciprocity.flags.healthyBalance) {
            candidates.push({
                type: 'celebration',
                tone: 'celebratory',
                opener: 'Something to feel good about...',
                message: `The balance with ${friend.name} has been improving. You're finding your rhythm together.`,
                friendId,
                friendName: friend.name,
                grounding: {
                    signals: ['reciprocity_improving'],
                    dataPoints: { trend: reciprocity.trend, ratio: reciprocity.initiationRatio },
                    confidence: 0.8,
                },
                priority: 6,
            });
        }

        // Texture-based insights
        if (rqs?.texture.depth === 'profound') {
            candidates.push({
                type: 'celebration',
                tone: 'affirming',
                opener: 'Something special...',
                message: `${friend.name} is one of your most meaningful connections. ${rqs.texture.summary}`,
                friendId,
                friendName: friend.name,
                grounding: {
                    signals: ['texture_profound'],
                    dataPoints: { texture: rqs.texture },
                    confidence: 0.9,
                },
                priority: 8,
            });
        }

        return candidates;
    }

    /**
     * Store an insight to the database
     */
    private async storeInsight(candidate: InsightCandidate): Promise<void> {
        const now = Date.now();
        const expiresAt = now + (this.INSIGHT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        await database.write(async () => {
            await database.get<RelationshipInsight>('relationship_insights').create((record: any) => {
                record._raw.insight_type = candidate.type;
                record._raw.tone = candidate.tone;
                record._raw.opener = candidate.opener;
                record._raw.message = candidate.message;
                record._raw.friend_id = candidate.friendId || null;
                record._raw.friend_name = candidate.friendName || null;
                record._raw.grounding_json = JSON.stringify(candidate.grounding);
                record._raw.status = 'active';
                record._raw.generated_at = now;
                record._raw.expires_at = expiresAt;
            });
        });
    }

    /**
     * Get active insights for display
     */
    async getActiveInsights(): Promise<RelationshipInsight[]> {
        const now = Date.now();
        return database.get<RelationshipInsight>('relationship_insights')
            .query(
                Q.where('status', 'active'),
                Q.where('expires_at', Q.gt(now)),
                Q.sortBy('generated_at', Q.desc),
                Q.take(3)
            ).fetch();
    }

    /**
     * Mark an insight as viewed
     */
    async markInsightViewed(insightId: string): Promise<void> {
        const insight = await database.get<RelationshipInsight>('relationship_insights').find(insightId);
        await database.write(async () => {
            await insight.update((record: any) => {
                record._raw.status = 'viewed';
                record._raw.viewed_at = Date.now();
            });
        });
    }

    /**
     * Dismiss an insight
     */
    async dismissInsight(insightId: string): Promise<void> {
        const insight = await database.get<RelationshipInsight>('relationship_insights').find(insightId);
        await database.write(async () => {
            await insight.update((record: any) => {
                record._raw.status = 'dismissed';
            });
        });
    }

    // ============================================================================
    // HELPERS
    // ============================================================================

    private async getInteractionFriendIds(interactionId: string): Promise<string[]> {
        const links = await database.get<InteractionFriend>('interaction_friends')
            .query(Q.where('interaction_id', interactionId)).fetch();
        return links.map(l => l.friendId);
    }

    private async countInteractions(friendId: string): Promise<number> {
        const links = await database.get<InteractionFriend>('interaction_friends')
            .query(Q.where('friend_id', friendId)).fetch();
        return links.length;
    }

    private async hasMomentType(friendId: string, momentType: string): Promise<boolean> {
        const count = await database.get('narrative_moments')
            .query(
                Q.where('friend_id', friendId),
                Q.where('moment_type', momentType)
            ).fetchCount();
        return count > 0;
    }

    private async wasInsightGeneratedRecently(): Promise<boolean> {
        const cutoff = Date.now() - (this.INSIGHT_RATE_LIMIT_HOURS * 60 * 60 * 1000);
        const count = await database.get<RelationshipInsight>('relationship_insights')
            .query(Q.where('generated_at', Q.gt(cutoff)))
            .fetchCount();
        return count > 0;
    }
}

export const insightOrchestratorService = new InsightOrchestratorService();
