/**
 * SignalDrivenGenerator
 * 
 * Generates contextual suggestions based on relationship signals from:
 * - ConversationThread (active concerns, topics)
 * - JournalSignals (sentiment, themes, dynamics)
 * - ValueAlignment (shared values with friends)
 * 
 * This produces "relationship moment" suggestions that tell users
 * not just WHO to reach out to, but WHY NOW and ABOUT WHAT.
 */

import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import ConversationThread from '@/db/models/ConversationThread';
import JournalSignals from '@/db/models/JournalSignals';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import { Suggestion, SuggestionSignalContext } from '@/shared/types/common';
import { valueAlignment } from '@/modules/intelligence/services/value-alignment.service';
import Logger from '@/shared/utils/Logger';
import { FriendContextData } from '../../suggestion-system/SuggestionDataLoader';

const MAX_SIGNAL_SUGGESTIONS = 2;
const CONCERN_THREAD_MIN_DAYS = 7;  // Minimum days before suggesting follow-up
const CONFLICT_LOOKBACK_DAYS = 30;   // How far back to check for conflict signals

interface SignalGeneratorOptions {
    maxSuggestions?: number;
    batteryLevel?: number;
}

/**
 * Signal-Driven Suggestion Generator
 * 
 * Queries signal data and produces high-context suggestions.
 */
export const SignalDrivenGenerator = {
    /**
     * Generate signal-driven suggestions for a set of friends
     */
    async generate(
        friends: FriendModel[],
        contextMap: Map<string, FriendContextData>,
        options: SignalGeneratorOptions = {}
    ): Promise<Suggestion[]> {
        const { maxSuggestions = MAX_SIGNAL_SUGGESTIONS, batteryLevel } = options;
        const suggestions: Suggestion[] = [];
        const now = new Date();

        try {
            // 1. Check for active concern threads that need follow-up
            const concernSuggestions = await this.generateConcernFollowUps(friends, now);
            suggestions.push(...concernSuggestions);

            // 2. Check for recent conflict signals that might need repair
            if (suggestions.length < maxSuggestions) {
                const repairSuggestions = await this.generateRepairSuggestions(friends, now);
                suggestions.push(...repairSuggestions.slice(0, maxSuggestions - suggestions.length));
            }

            // 3. Check for value alignment matches (only if battery isn't low)
            if (suggestions.length < maxSuggestions && (!batteryLevel || batteryLevel >= 3)) {
                const valueSuggestions = await this.generateValueMatchSuggestions(friends, now);
                suggestions.push(...valueSuggestions.slice(0, maxSuggestions - suggestions.length));
            }

            // 4. Check for reconnection dynamics
            if (suggestions.length < maxSuggestions) {
                const reconnectSuggestions = await this.generateReconnectionSuggestions(friends, now);
                suggestions.push(...reconnectSuggestions.slice(0, maxSuggestions - suggestions.length));
            }

            Logger.info('[SignalDrivenGenerator]', `Generated ${suggestions.length} signal-driven suggestions`);

        } catch (error) {
            Logger.error('[SignalDrivenGenerator]', 'Error generating signal-driven suggestions', error);
        }

        return suggestions.slice(0, maxSuggestions);
    },

    /**
     * Generate follow-up suggestions for active concern threads
     */
    async generateConcernFollowUps(friends: FriendModel[], now: Date): Promise<Suggestion[]> {
        const suggestions: Suggestion[] = [];

        try {
            const friendIds = friends.map(f => f.id);
            if (friendIds.length === 0) return [];

            // Find active concern threads that are old enough for follow-up
            const minAgeTimestamp = now.getTime() - (CONCERN_THREAD_MIN_DAYS * 24 * 60 * 60 * 1000);

            const threads = await database.get<ConversationThread>('conversation_threads')
                .query(
                    Q.where('friend_id', Q.oneOf(friendIds)),
                    Q.where('status', 'active'),
                    Q.where('sentiment', 'concern'),
                    Q.where('last_mentioned', Q.lt(minAgeTimestamp)),
                    Q.sortBy('last_mentioned', Q.asc),
                    Q.take(3) // Get a few to choose from
                )
                .fetch();

            for (const thread of threads) {
                const friend = friends.find(f => f.id === thread.friendId);
                if (!friend) continue;

                const daysSince = thread.daysSinceLastMention;
                const signalContext: SuggestionSignalContext = {
                    source: 'thread',
                    type: 'follow-up',
                    topic: thread.topic,
                    daysSinceSignal: daysSince,
                };

                suggestions.push({
                    id: `signal-followup-${thread.id}`,
                    friendId: friend.id,
                    friendName: friend.name,
                    type: 'connect',
                    urgency: daysSince > 21 ? 'high' : 'medium',
                    category: 'signal-followup',
                    title: `Check in on ${friend.name}`,
                    subtitle: `You mentioned "${thread.topic}" ${this.formatDaysAgo(daysSince)}. How's it going?`,
                    contextSnippet: `Based on your journal from ${this.formatDaysAgo(daysSince)}`,
                    actionLabel: 'Reach Out',
                    icon: 'MessageCircle',
                    action: {
                        type: 'log',
                        prefilledCategory: 'text-call',
                    },
                    dismissible: true,
                    createdAt: now,
                    signalContext,
                });
            }
        } catch (error) {
            Logger.error('[SignalDrivenGenerator]', 'Error generating concern follow-ups', error);
        }

        return suggestions;
    },

    /**
     * Generate repair suggestions for friends with recent conflict signals
     */
    async generateRepairSuggestions(friends: FriendModel[], now: Date): Promise<Suggestion[]> {
        const suggestions: Suggestion[] = [];

        try {
            const lookbackTimestamp = now.getTime() - (CONFLICT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
            const friendIds = friends.map(f => f.id);
            if (friendIds.length === 0) return [];

            // Find journal entries with conflict themes linked to our friends
            // Step 1: Get friend links from recent entries
            const entryLinks = await database.get<JournalEntryFriend>('journal_entry_friends')
                .query(Q.where('friend_id', Q.oneOf(friendIds)))
                .fetch();

            const entryIdToFriendId = new Map<string, string>();
            entryLinks.forEach(link => entryIdToFriendId.set(link.journalEntryId, link.friendId));

            const entryIds = [...new Set(entryLinks.map(link => link.journalEntryId))];
            if (entryIds.length === 0) return [];

            // Step 2: Find signals with conflict theme
            const conflictSignals = await database.get<JournalSignals>('journal_signals')
                .query(
                    Q.where('journal_entry_id', Q.oneOf(entryIds)),
                    Q.where('extracted_at', Q.gte(lookbackTimestamp)),
                    Q.sortBy('extracted_at', Q.desc)
                )
                .fetch();

            // Filter to those with conflict theme
            const conflictFriendIds = new Set<string>();
            const conflictDetails = new Map<string, { sentiment: number; daysSince: number }>();

            for (const signal of conflictSignals) {
                const themes = signal.coreThemes;
                if (themes.includes('conflict')) {
                    const friendId = entryIdToFriendId.get(signal.journalEntryId);
                    if (friendId && !conflictFriendIds.has(friendId)) {
                        conflictFriendIds.add(friendId);
                        const daysSince = Math.floor((now.getTime() - signal.extractedAt) / (24 * 60 * 60 * 1000));
                        conflictDetails.set(friendId, {
                            sentiment: signal.sentiment,
                            daysSince,
                        });
                    }
                }
            }

            // Generate repair suggestions (only if conflict is not too fresh - give space)
            for (const friendId of conflictFriendIds) {
                const friend = friends.find(f => f.id === friendId);
                const details = conflictDetails.get(friendId);
                if (!friend || !details) continue;

                // Don't suggest immediate repair - need some cool-off time
                if (details.daysSince < 3) continue;

                const signalContext: SuggestionSignalContext = {
                    source: 'journal',
                    type: 'repair',
                    daysSinceSignal: details.daysSince,
                };

                suggestions.push({
                    id: `signal-repair-${friend.id}`,
                    friendId: friend.id,
                    friendName: friend.name,
                    type: 'reconnect',
                    urgency: 'medium',
                    category: 'signal-repair',
                    title: `Reconnect with ${friend.name}`,
                    subtitle: `Consider reaching out after the tension you noted recently.`,
                    contextSnippet: `From your journal reflections`,
                    actionLabel: 'Reach Out',
                    icon: 'Heart',
                    action: { type: 'log' },
                    dismissible: true,
                    createdAt: now,
                    signalContext,
                });
            }
        } catch (error) {
            Logger.error('[SignalDrivenGenerator]', 'Error generating repair suggestions', error);
        }

        return suggestions;
    },

    /**
     * Generate suggestions based on value alignment with friends
     */
    async generateValueMatchSuggestions(friends: FriendModel[], now: Date): Promise<Suggestion[]> {
        const suggestions: Suggestion[] = [];

        try {
            // Get user's current top values
            const userValues = await valueAlignment.getUserTopValues(3);
            if (userValues.length === 0) return [];

            // Check alignment for each friend (limit to avoid too many checks)
            const checksLimit = Math.min(friends.length, 10);
            const friendsToCheck = friends.slice(0, checksLimit);

            for (const friend of friendsToCheck) {
                const alignment = await valueAlignment.calculateAlignment(friend.id);

                // High alignment score = good match for quality time
                if (alignment.alignmentScore >= 0.6 && alignment.primaryMatch) {
                    const signalContext: SuggestionSignalContext = {
                        source: 'values',
                        type: 'values-match',
                        topic: alignment.primaryMatch,
                    };

                    suggestions.push({
                        id: `signal-values-${friend.id}`,
                        friendId: friend.id,
                        friendName: friend.name,
                        type: 'deepen',
                        urgency: 'low',
                        category: 'signal-values',
                        title: `Quality time with ${friend.name}`,
                        subtitle: `You both value "${alignment.primaryMatch}" right now.`,
                        contextSnippet: `Based on your shared focus`,
                        actionLabel: 'Plan',
                        icon: 'Sparkles',
                        action: {
                            type: 'plan',
                            prefilledCategory: 'deep-talk',
                        },
                        dismissible: true,
                        createdAt: now,
                        signalContext,
                    });

                    // Only generate one values suggestion per run
                    break;
                }
            }
        } catch (error) {
            Logger.error('[SignalDrivenGenerator]', 'Error generating value match suggestions', error);
        }

        return suggestions;
    },

    /**
     * Generate reconnection suggestions based on dynamics signals
     */
    async generateReconnectionSuggestions(friends: FriendModel[], now: Date): Promise<Suggestion[]> {
        const suggestions: Suggestion[] = [];

        try {
            const friendIds = friends.map(f => f.id);
            if (friendIds.length === 0) return [];

            // Find entries with reconnection dynamics
            const entryLinks = await database.get<JournalEntryFriend>('journal_entry_friends')
                .query(Q.where('friend_id', Q.oneOf(friendIds)))
                .fetch();

            const entryIdToFriendId = new Map<string, string>();
            entryLinks.forEach(link => entryIdToFriendId.set(link.journalEntryId, link.friendId));

            const entryIds = [...new Set(entryLinks.map(link => link.journalEntryId))];
            if (entryIds.length === 0) return [];

            // Recent signals with reconnection theme
            const thirtyDaysAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);
            const signals = await database.get<JournalSignals>('journal_signals')
                .query(
                    Q.where('journal_entry_id', Q.oneOf(entryIds)),
                    Q.where('extracted_at', Q.gte(thirtyDaysAgo))
                )
                .fetch();

            const reconnectionFriendIds = new Set<string>();

            for (const signal of signals) {
                const dynamics = signal.dynamics;
                const themes = signal.coreThemes;

                if (dynamics.reconnectionRelevant || themes.includes('reconnection')) {
                    const friendId = entryIdToFriendId.get(signal.journalEntryId);
                    if (friendId) {
                        reconnectionFriendIds.add(friendId);
                    }
                }
            }

            for (const friendId of reconnectionFriendIds) {
                const friend = friends.find(f => f.id === friendId);
                if (!friend) continue;

                const signalContext: SuggestionSignalContext = {
                    source: 'dynamics',
                    type: 'reconnection',
                };

                suggestions.push({
                    id: `signal-reconnect-${friend.id}`,
                    friendId: friend.id,
                    friendName: friend.name,
                    type: 'reconnect',
                    urgency: 'medium',
                    category: 'signal-reconnect',
                    title: `Perfect timing for ${friend.name}`,
                    subtitle: `Your recent reflections suggest this is a good moment to reconnect.`,
                    contextSnippet: `From your journal patterns`,
                    actionLabel: 'Reach Out',
                    icon: 'RefreshCw',
                    action: { type: 'log' },
                    dismissible: true,
                    createdAt: now,
                    signalContext,
                });

                // Only one reconnection suggestion
                break;
            }
        } catch (error) {
            Logger.error('[SignalDrivenGenerator]', 'Error generating reconnection suggestions', error);
        }

        return suggestions;
    },

    /**
     * Format days ago as human-readable string
     */
    formatDaysAgo(days: number): string {
        if (days === 0) return 'today';
        if (days === 1) return 'yesterday';
        if (days < 7) return `${days} days ago`;
        if (days < 14) return 'about a week ago';
        if (days < 30) return 'a few weeks ago';
        return 'about a month ago';
    },
};
