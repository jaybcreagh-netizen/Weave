/**
 * RelationshipQualityService
 * 
 * Calculates a holistic quality score for each friendship.
 * RQS is never shown as a number - it produces human-readable texture and trajectory.
 * 
 * Components:
 * - Depth: Reflection quality, vulnerability signals
 * - Consistency: Regular contact pattern vs tier expectation
 * - Reciprocity: Balance of initiation
 * - Growth: Score trajectory over 90 days
 * - Resilience: Already calculated by ResilienceService
 */

import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Friend from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import JournalEntry from '@/db/models/JournalEntry';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import RelationshipQualitySnapshot, { RelationshipTexture } from '@/db/models/RelationshipQualitySnapshot';

// ============================================================================
// TYPES
// ============================================================================

export interface RQSComponents {
    depth: number;        // 0-100
    consistency: number;  // 0-100
    reciprocity: number;  // 0-1 (0.5 = balanced)
    growth: number;       // 0-100
    resilience: number;   // 0-100
}

export interface RelationshipQualityScore {
    friendId: string;
    calculatedAt: Date;
    components: RQSComponents;
    composite: number;
    texture: RelationshipTexture;
    trajectory: 'strengthening' | 'stable' | 'fading' | 'new';
    notablePatterns: string[];
}

// Tier expectations for consistency calculation
const TIER_EXPECTED_DAYS_BETWEEN: Record<string, number> = {
    'InnerCircle': 7,    // Weekly
    'CloseCircle': 14,   // Bi-weekly
    'Community': 30,     // Monthly
};

// ============================================================================
// SERVICE
// ============================================================================

class RelationshipQualityService {

    /**
     * Calculate RQS for a single friend
     */
    async calculateRQS(friendId: string): Promise<RelationshipQualityScore> {
        const friend = await database.get<Friend>('friends').find(friendId);
        const interactions = await this.getRecentInteractions(friendId, 90);
        const reflections = await this.getRecentJournalEntries(friendId, 90);
        const previousSnapshot = await this.getPreviousSnapshot(friendId);

        const components: RQSComponents = {
            depth: this.calculateDepth(interactions, reflections),
            consistency: this.calculateConsistency(interactions, friend.tier),
            reciprocity: this.calculateReciprocity(interactions),
            growth: this.calculateGrowth(friend, previousSnapshot),
            resilience: friend.resilience || 50,
        };

        const composite = this.calculateComposite(components);
        const texture = this.deriveTexture(components, interactions);
        const trajectory = this.determineTrajectory(previousSnapshot, composite);
        const patterns = this.detectPatterns(interactions);

        // Save snapshot
        await this.saveSnapshot(friendId, components, composite, texture, trajectory, patterns);

        return {
            friendId,
            calculatedAt: new Date(),
            components,
            composite,
            texture,
            trajectory,
            notablePatterns: patterns,
        };
    }

    /**
     * Get recent interactions for a friend
     */
    private async getRecentInteractions(friendId: string, days: number): Promise<Interaction[]> {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

        // Two-step query (per GEMINI.md guidance on many-to-many)
        const interactionFriends = await database.get<InteractionFriend>('interaction_friends')
            .query(Q.where('friend_id', friendId)).fetch();

        const interactionIds = interactionFriends.map(if_ => if_.interactionId);
        if (interactionIds.length === 0) return [];

        return database.get<Interaction>('interactions')
            .query(
                Q.where('id', Q.oneOf(interactionIds)),
                Q.where('interaction_date', Q.gte(cutoff)),
                Q.where('status', 'completed')
            ).fetch();
    }

    /**
     * Get recent journal entries mentioning this friend
     */
    private async getRecentJournalEntries(friendId: string, days: number): Promise<JournalEntry[]> {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

        const journalLinks = await database.get<JournalEntryFriend>('journal_entry_friends')
            .query(Q.where('friend_id', friendId)).fetch();

        const journalIds = journalLinks.map(jef => jef.journalEntryId);
        if (journalIds.length === 0) return [];

        return database.get<JournalEntry>('journal_entries')
            .query(
                Q.where('id', Q.oneOf(journalIds)),
                Q.where('created_at', Q.gte(cutoff))
            ).fetch();
    }

    /**
     * Get previous RQS snapshot
     */
    private async getPreviousSnapshot(friendId: string): Promise<RelationshipQualitySnapshot | null> {
        const snapshots = await database.get<RelationshipQualitySnapshot>('relationship_quality_snapshots')
            .query(
                Q.where('friend_id', friendId),
                Q.sortBy('calculated_at', Q.desc),
                Q.take(1)
            ).fetch();

        return snapshots[0] || null;
    }

    // ============================================================================
    // COMPONENT CALCULATIONS
    // ============================================================================

    /**
     * Calculate depth score
     * Based on reflection quality and vulnerability signals
     */
    private calculateDepth(interactions: Interaction[], reflections: JournalEntry[]): number {
        if (interactions.length === 0 && reflections.length === 0) return 0;

        // Count interactions with meaningful notes
        const withNotes = interactions.filter(i => (i.note?.length || 0) > 50);
        const noteRatio = withNotes.length / Math.max(interactions.length, 1);

        // Count journal entries with deep vibes
        const deepVibes = ['deep', 'vulnerable', 'meaningful', 'important'];
        const deepReflections = reflections.filter(r => {
            const content = r.content?.toLowerCase() || '';
            return deepVibes.some(v => content.includes(v));
        });

        // Weighted calculation
        const score = (
            noteRatio * 40 +
            Math.min(deepReflections.length * 15, 30) +
            Math.min(reflections.length * 5, 30)
        );

        return Math.min(Math.round(score), 100);
    }

    /**
     * Calculate consistency score
     * Based on regularity vs tier expectation
     */
    private calculateConsistency(interactions: Interaction[], tier: string): number {
        if (interactions.length < 2) return interactions.length > 0 ? 30 : 0;

        // Calculate average days between interactions
        const dates = interactions
            .map(i => i.interactionDate.getTime())
            .sort((a, b) => b - a);

        const gaps: number[] = [];
        for (let i = 0; i < dates.length - 1; i++) {
            gaps.push((dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24));
        }

        const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
        const expectedGap = TIER_EXPECTED_DAYS_BETWEEN[tier] || 21;

        // Score based on how close to expectation
        // Perfect = meeting expectation, worse = larger gaps
        const ratio = expectedGap / avgGap;
        const score = Math.min(ratio * 100, 100);

        return Math.round(score);
    }

    /**
     * Calculate reciprocity score
     * 0 = they always initiate, 1 = you always initiate, 0.5 = balanced
     */
    private calculateReciprocity(interactions: Interaction[]): number {
        const withInitiator = interactions.filter(i => i.initiator);
        if (withInitiator.length === 0) return 0.5; // Assume balanced if no data

        const userInitiated = withInitiator.filter(i => i.initiator === 'user').length;
        return userInitiated / withInitiator.length;
    }

    /**
     * Calculate growth score
     * Based on score trajectory over time
     */
    private calculateGrowth(friend: Friend, previousSnapshot: RelationshipQualitySnapshot | null): number {
        if (!previousSnapshot) return 50; // Neutral for new

        const currentScore = friend.weaveScore || 0;
        const previousComposite = previousSnapshot.compositeScore;

        const change = currentScore - previousComposite;
        // Map change to 0-100 scale (±20 points = 0 or 100)
        return Math.max(0, Math.min(100, 50 + change * 2.5));
    }

    /**
     * Calculate weighted composite score
     */
    private calculateComposite(components: RQSComponents): number {
        // Normalize reciprocity (0.5 = 100, 0 or 1 = 0)
        const reciprocityScore = 100 - Math.abs(components.reciprocity - 0.5) * 200;

        const weighted = (
            components.depth * 0.25 +
            components.consistency * 0.20 +
            reciprocityScore * 0.20 +
            components.growth * 0.15 +
            components.resilience * 0.20
        );

        return Math.round(weighted);
    }

    // ============================================================================
    // TEXTURE & TRAJECTORY
    // ============================================================================

    /**
     * Derive human-readable texture from components
     */
    private deriveTexture(components: RQSComponents, interactions: Interaction[]): RelationshipTexture {
        const depth: RelationshipTexture['depth'] =
            components.depth > 70 ? 'profound' :
                components.depth > 50 ? 'meaningful' :
                    components.depth > 30 ? 'friendly' : 'acquaintance';

        const avgDaysBetween = this.calculateAverageGap(interactions);
        const rhythm: RelationshipTexture['rhythm'] =
            avgDaysBetween < 7 ? 'frequent' :
                avgDaysBetween < 21 ? 'regular' :
                    avgDaysBetween < 45 ? 'occasional' : 'sporadic';

        const balance: RelationshipTexture['balance'] =
            components.reciprocity > 0.65 ? 'you_carry' :
                components.reciprocity < 0.35 ? 'they_carry' : 'balanced';

        const summary = this.generateTextureSummary(depth, rhythm, balance);

        return { depth, rhythm, balance, summary };
    }

    private calculateAverageGap(interactions: Interaction[]): number {
        if (interactions.length < 2) return 999;

        const dates = interactions
            .map(i => i.interactionDate.getTime())
            .sort((a, b) => b - a);

        let totalGap = 0;
        for (let i = 0; i < dates.length - 1; i++) {
            totalGap += (dates[i] - dates[i + 1]) / (1000 * 60 * 60 * 24);
        }

        return totalGap / (dates.length - 1);
    }

    private generateTextureSummary(
        depth: RelationshipTexture['depth'],
        rhythm: RelationshipTexture['rhythm'],
        balance: RelationshipTexture['balance']
    ): string {
        const depthPhrase = {
            profound: 'A deeply meaningful friendship',
            meaningful: 'A meaningful friendship',
            friendly: 'A comfortable friendship',
            acquaintance: 'A casual connection',
        }[depth];

        const rhythmPhrase = {
            frequent: 'with frequent contact',
            regular: 'with regular contact',
            occasional: 'with occasional contact',
            sporadic: 'with sporadic contact',
        }[rhythm];

        const balancePhrase = {
            you_carry: 'You tend to initiate, but they show up when it counts.',
            they_carry: 'They often reach out first, keeping the connection alive.',
            balanced: 'You both invest in keeping this connection strong.',
        }[balance];

        return `${depthPhrase} ${rhythmPhrase}. ${balancePhrase}`;
    }

    /**
     * Determine trajectory based on previous snapshot
     */
    private determineTrajectory(
        previousSnapshot: RelationshipQualitySnapshot | null,
        currentComposite: number
    ): 'strengthening' | 'stable' | 'fading' | 'new' {
        if (!previousSnapshot) return 'new';

        const previousComposite = previousSnapshot.compositeScore;
        const change = currentComposite - previousComposite;

        if (change > 10) return 'strengthening';
        if (change < -10) return 'fading';
        return 'stable';
    }

    // ============================================================================
    // PATTERN DETECTION
    // ============================================================================

    /**
     * Detect notable patterns in interactions
     */
    private detectPatterns(interactions: Interaction[]): string[] {
        const patterns: string[] = [];

        if (interactions.length < 3) return patterns;

        // Activity patterns
        const activityCounts: Record<string, number> = {};
        interactions.forEach(i => {
            const activity = i.activity || 'hangout';
            activityCounts[activity] = (activityCounts[activity] || 0) + 1;
        });

        const topActivity = Object.entries(activityCounts)
            .sort((a, b) => b[1] - a[1])[0];

        if (topActivity && topActivity[1] >= 3) {
            patterns.push(`${topActivity[0]} buddy`);
        }

        // Time-of-day patterns (would need more interaction metadata)
        // Place patterns (would need location data)

        return patterns;
    }

    // ============================================================================
    // PERSISTENCE
    // ============================================================================

    /**
     * Save RQS snapshot to database
     */
    private async saveSnapshot(
        friendId: string,
        components: RQSComponents,
        composite: number,
        texture: RelationshipTexture,
        trajectory: string,
        patterns: string[]
    ): Promise<void> {
        await database.write(async () => {
            await database.get<RelationshipQualitySnapshot>('relationship_quality_snapshots').create((record: any) => {
                record._raw.friend_id = friendId;
                record._raw.calculated_at = Date.now();
                record._raw.depth_score = components.depth;
                record._raw.consistency_score = components.consistency;
                record._raw.reciprocity_score = components.reciprocity;
                record._raw.growth_score = components.growth;
                record._raw.resilience_score = components.resilience;
                record._raw.composite_score = composite;
                record._raw.texture_json = JSON.stringify(texture);
                record._raw.trajectory = trajectory;
                record._raw.notable_patterns_json = JSON.stringify(patterns);
            });
        });
    }

    /**
     * Get latest RQS for a friend
     */
    async getLatestRQS(friendId: string): Promise<RelationshipQualityScore | null> {
        const snapshot = await this.getPreviousSnapshot(friendId);
        if (!snapshot) return null;

        return {
            friendId,
            calculatedAt: new Date(snapshot.calculatedAt),
            components: {
                depth: snapshot.depthScore,
                consistency: snapshot.consistencyScore,
                reciprocity: snapshot.reciprocityScore,
                growth: snapshot.growthScore,
                resilience: snapshot.resilienceScore,
            },
            composite: snapshot.compositeScore,
            texture: snapshot.texture!,
            trajectory: snapshot.trajectory as 'strengthening' | 'stable' | 'fading' | 'new',
            notablePatterns: snapshot.notablePatterns,
        };
    }
}

export const relationshipQualityService = new RelationshipQualityService();
