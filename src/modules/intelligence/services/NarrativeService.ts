import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendshipNarrative from '@/db/models/FriendshipNarrative';
import NarrativeMoment from '@/db/models/NarrativeMoment';
import Friend from '@/db/models/Friend';
import InteractionFriend from '@/db/models/InteractionFriend';
import Interaction from '@/db/models/Interaction';
import { oracleService } from '@/modules/oracle/services/oracle-service';
import { intelligenceCapabilitiesService } from './intelligence-capabilities.service';
// RelationshipQualityService import removed as it is not implemented yet.
// Logic simplified to use basic stats for now.

// For this implementation, I will focus on the core NarrativeService logic based on the design doc.
// If dependencies are missing, I'll create placeholders or minimal implementations.

class NarrativeService {

    /**
     * Record a narrative moment (e.g., 'first_weave', 'rekindled')
     */
    async recordMoment(
        friendId: string,
        type: string,
        context?: any
    ): Promise<void> {
        const existing = await database.get<NarrativeMoment>('narrative_moments')
            .query(
                Q.where('friend_id', friendId),
                Q.where('moment_type', type)
            ).fetch();

        // Some moments should only happen once
        const uniqueMoments = ['first_weave', 'first_deep_conversation', 'became_consistent', 'entered_inner_circle'];
        if (existing.length > 0 && uniqueMoments.includes(type)) {
            return;
        }

        await database.write(async () => {
            await database.get<NarrativeMoment>('narrative_moments').create(record => {
                record.friendId = friendId;
                record.momentType = type;
                record.occurredAt = new Date();
                record.contextJson = context ? JSON.stringify(context) : '{}';
                record.userReflection = '';
            });
        });

        // Removed chapter transition logic - simplified to just recording moment
    }

    /**
     * Get the current narrative for a friend
     */
    async getNarrative(friendId: string): Promise<FriendshipNarrative | null> {
        const narratives = await database.get<FriendshipNarrative>('friendship_narratives')
            .query(Q.where('friend_id', friendId)).fetch();
        return narratives.length > 0 ? narratives[0] : null;
    }

    /**
     * Get all moments for a friend
     */
    async getMoments(friendId: string): Promise<NarrativeMoment[]> {
        return await database.get<NarrativeMoment>('narrative_moments')
            .query(Q.where('friend_id', friendId)).fetch();
    }

    /**
     * Ensure narrative record exists (simplified - no chapter logic)
     */
    async ensureNarrative(friendId: string): Promise<FriendshipNarrative | null> {
        let narrative = await this.getNarrative(friendId);
        const friend = await database.get<Friend>('friends').find(friendId);

        // Create initial narrative if missing
        if (!narrative) {
            await database.write(async () => {
                narrative = await database.get<FriendshipNarrative>('friendship_narratives').create(record => {
                    record.friendId = friendId;
                    record.currentChapter = 'default'; // Not used in UI anymore
                    record.chapterStartedAt = new Date();
                    record.friendshipStartDate = friend.createdAt || new Date();
                    record.generatedNarrativeJson = '{}';
                });
            });
        }

        return narrative;
    }

    /**
     * Generate narrative text using Oracle
     */
    async generateNarrativeText(friendId: string): Promise<string> {
        await this.ensureNarrative(friendId);
        const narrative = await this.getNarrative(friendId);
        const moments = await this.getMoments(friendId);
        const friend = await database.get<Friend>('friends').find(friendId);
        const capabilities = await intelligenceCapabilitiesService.getCapabilitiesForCurrentProfile();

        // Fetch interaction history for pattern analysis
        const interactionFriends = await database.get<InteractionFriend>('interaction_friends')
            .query(Q.where('friend_id', friendId)).fetch();

        const interactionIds = interactionFriends.map(if_ => if_.interactionId);
        const interactions = interactionIds.length > 0
            ? await database.get<Interaction>('interactions')
                .query(Q.where('id', Q.oneOf(interactionIds)), Q.sortBy('interaction_date', Q.desc))
                .fetch()
            : [];

        // Calculate patterns from interactions
        const totalInteractions = interactions.length;
        const recentInteractions = interactions.slice(0, 10);
        const activities = recentInteractions.map(i => i.activity || 'hangout').filter(Boolean) as string[];
        const vibes = recentInteractions.map(i => i.vibe).filter(Boolean) as string[];
        // Parse duration (it's stored as string, e.g., "short", "medium", "long" or minutes)
        const durations = recentInteractions
            .map(i => typeof i.duration === 'number' ? i.duration : parseInt(i.duration || '0', 10))
            .filter(d => d > 0);
        const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;

        // Calculate cadence (days between recent interactions)
        const recentDates = recentInteractions.map(i => i.interactionDate.getTime()).sort((a, b) => b - a);
        const intervals = [];
        for (let i = 0; i < recentDates.length - 1; i++) {
            intervals.push((recentDates[i] - recentDates[i + 1]) / (1000 * 60 * 60 * 24));
        }
        const avgCadenceDays = intervals.length > 0 ? Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length) : 0;

        // Fetch journal entries that mention this friend
        const JournalEntry = database.get('journal_entries');
        const JournalEntryFriend = database.get('journal_entry_friends');
        const journalLinks = await JournalEntryFriend.query(Q.where('friend_id', friendId)).fetch();
        const journalIds = journalLinks.map((jef: any) => jef.journalEntryId);
        const journalEntries = journalIds.length > 0
            ? await JournalEntry.query(Q.where('id', Q.oneOf(journalIds)), Q.sortBy('created_at', Q.desc), Q.take(5)).fetch()
            : [];

        const journalSnippets = journalEntries.map((je: any) => je.content?.substring(0, 150) || '').filter(Boolean);

        // Calculate time patterns
        const yearsKnown = friend.createdAt
            ? (Date.now() - friend.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365)
            : 0.1;

        const narrativeInput = {
            friendName: friend.name,
            currentChapter: narrative?.currentChapter || 'default',
            moments: moments.map(m => m.momentType),
            yearsKnown,
            totalInteractions,
            recentActivities: activities.slice(0, 5),
            commonVibes: vibes.slice(0, 5),
            avgDurationMinutes: Math.round(avgDuration),
            avgCadenceDays,
            tier: friend.tier,
            archetype: friend.archetype,
            journalSnippets,
        };

        let text: string;
        let source: 'local' | 'oracle' = 'local';

        if (capabilities.oracleChatEnabled) {
            try {
                text = await oracleService.generateFriendshipNarrative(narrativeInput);
                source = 'oracle';
            } catch (error) {
                text = this.generateLocalNarrativeText(friend.name, {
                    totalInteractions,
                    recentActivities: activities.slice(0, 5),
                    avgCadenceDays,
                    journalSnippets,
                    momentTypes: moments.map(m => m.momentType),
                });
            }
        } else {
            text = this.generateLocalNarrativeText(friend.name, {
                totalInteractions,
                recentActivities: activities.slice(0, 5),
                avgCadenceDays,
                journalSnippets,
                momentTypes: moments.map(m => m.momentType),
            });
        }

        // Save to DB
        if (narrative) {
            await database.write(async () => {
                await narrative.update(record => {
                    record.generatedNarrativeJson = JSON.stringify({ text, generatedAt: new Date(), source });
                });
            });
        }

        return text;
    }

    private generateLocalNarrativeText(
        friendName: string,
        input: {
            totalInteractions: number;
            recentActivities: string[];
            avgCadenceDays: number;
            journalSnippets: string[];
            momentTypes: string[];
        }
    ): string {
        const parts: string[] = [];

        if (input.totalInteractions === 0 && input.journalSnippets.length === 0) {
            return `Your story with ${friendName} is still waiting to be written in Weave. One shared moment or one honest note could be the start of it.`;
        }

        if (input.totalInteractions <= 2) {
            parts.push(`This connection with ${friendName} is still taking shape, but even a few moments can reveal what feels easy to return to.`)
        } else if (input.avgCadenceDays > 0 && input.avgCadenceDays <= 14) {
            parts.push(`You and ${friendName} have built a fairly steady rhythm, with contact roughly every ${input.avgCadenceDays} days.`)
        } else if (input.totalInteractions >= 6) {
            parts.push(`${friendName} has been a meaningful thread in your life, with ${input.totalInteractions} shared moments captured in Weave so far.`)
        } else {
            parts.push(`Your friendship with ${friendName} seems to move in a gentle, evolving rhythm rather than one fixed pattern.`)
        }

        const recentActivities = this.unique(input.recentActivities).slice(0, 2);
        if (recentActivities.length > 0) {
            parts.push(`Lately, the connection seems to open most naturally through ${this.formatList(recentActivities.map(activity => this.humanize(activity)))}.`)
        } else if (input.journalSnippets.length > 0) {
            parts.push(`You keep returning to this friendship in your journal, which suggests it carries real emotional weight for you.`)
        } else if (input.momentTypes.length > 0) {
            parts.push(`A few moments already stand out in the story: ${this.formatList(input.momentTypes.slice(0, 2).map(moment => this.humanize(moment)))}.`)
        } else {
            parts.push('There is enough here to keep noticing what feels reciprocal, easy, and worth returning to.')
        }

        return parts.slice(0, 2).join(' ');
    }

    private unique(values: string[]): string[] {
        return Array.from(new Set(values.filter(Boolean)));
    }

    private formatList(values: string[]): string {
        if (values.length <= 1) {
            return values[0] || ''
        }

        if (values.length === 2) {
            return `${values[0]} and ${values[1]}`
        }

        return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`
    }

    private humanize(value: string): string {
        return value
            .replace(/_/g, ' ')
            .replace(/\b\w/g, letter => letter.toUpperCase())
    }
}

export const narrativeService = new NarrativeService();
