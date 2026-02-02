import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendshipNarrative from '@/db/models/FriendshipNarrative';
import NarrativeMoment from '@/db/models/NarrativeMoment';
import Friend from '@/db/models/Friend';
import InteractionFriend from '@/db/models/InteractionFriend';
import Interaction from '@/db/models/Interaction';
import { oracleService } from '@/modules/oracle/services/oracle-service';
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

        // Fetch interaction history for pattern analysis
        const interactionFriends = await database.get<InteractionFriend>('interaction_friends')
            .query(Q.where('friend_id', friendId)).fetch();

        const interactionIds = interactionFriends.map(if_ => if_.interactionId);
        const interactions = await database.get<Interaction>('interactions')
            .query(Q.where('id', Q.oneOf(interactionIds)), Q.sortBy('interaction_date', Q.desc))
            .fetch();

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

        // Call Oracle Service with rich context
        const text = await oracleService.generateFriendshipNarrative({
            friendName: friend.name,
            currentChapter: narrative?.currentChapter || 'default',
            moments: moments.map(m => m.momentType),
            yearsKnown,
            // Interaction patterns
            totalInteractions,
            recentActivities: activities.slice(0, 5),
            commonVibes: vibes.slice(0, 5),
            avgDurationMinutes: Math.round(avgDuration),
            avgCadenceDays,
            // Metadata
            tier: friend.tier,
            archetype: friend.archetype,
            // Journal context
            journalSnippets
        });

        // Save to DB
        if (narrative) {
            await database.write(async () => {
                await narrative.update(record => {
                    record.generatedNarrativeJson = JSON.stringify({ text, generatedAt: new Date() });
                });
            });
        }

        return text;
    }
}

export const narrativeService = new NarrativeService();
