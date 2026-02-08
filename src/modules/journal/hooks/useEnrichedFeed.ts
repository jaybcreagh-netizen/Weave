import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import JournalSignals from '@/db/models/JournalSignals';
import ConversationThread from '@/db/models/ConversationThread';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { PerfLogger } from '@/shared/utils/performance-logger';
import { useJournalFeed, JournalFeedItem } from './useJournalFeed';
import { backfillEntryTitles } from '../utils/title-utils';

export interface EnrichedFeedItem {
    type: 'entry';
    id: string;
    entry: JournalEntry | WeeklyReflection;
    signals: JournalSignals | null;
    threads: ConversationThread[];
    friendNames: string[];
}

export interface ArcSummaryItem {
    type: 'arc_summary';
    id: string;
    summaryType: 'sentiment_shift' | 'thread_highlight';
    title: string;
    description: string;
}

export interface DateSectionHeader {
    type: 'date_section';
    id: string;
    label: string;
}

export type FeedItem = EnrichedFeedItem | ArcSummaryItem | DateSectionHeader;

// ============================================================================
// DATE SECTION HELPERS
// ============================================================================

function getDateSectionLabel(date: Date): string {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    if (date >= today) return 'Today';
    if (date >= yesterday) return 'Yesterday';
    if (date >= weekAgo) return 'This Week';

    // Same month as current
    if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()) {
        return 'Earlier This Month';
    }

    // Named month + year
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function getEntryDate(entry: JournalEntry | WeeklyReflection): Date {
    if ('entryDate' in entry) {
        return new Date((entry as JournalEntry).entryDate);
    }
    return new Date((entry as WeeklyReflection).weekStartDate);
}

// ============================================================================
// HOOK
// ============================================================================

export function useEnrichedFeed() {
    const { data: baseFeedData, loadMore, isLoading, refetch, invalidate } = useJournalFeed();
    const queryClient = useQueryClient();

    // One-time backfill: persist heuristic titles for legacy entries
    useEffect(() => {
        backfillEntryTitles().then(() => {
            // Refresh feed to pick up newly persisted titles
            invalidate();
        });
    }, []);

    const query = useQuery({
        queryKey: ['enriched-feed', baseFeedData?.items.map(i => i.id).join(',')],
        queryFn: async (): Promise<FeedItem[]> => {
            if (!baseFeedData?.items) return [];

            const start = Date.now();

            // Get all JournalEntry IDs (skip WeeklyReflections for signals)
            const entries = baseFeedData.items;
            const journalEntryIds = entries
                .filter(e => 'entryDate' in e)
                .map(e => e.id);

            // Batch-fetch signals, threads, and friend links in parallel
            const [signals, activeThreads, entryFriendLinks] = await Promise.all([
                journalEntryIds.length > 0
                    ? database.get<JournalSignals>('journal_signals')
                        .query(Q.where('journal_entry_id', Q.oneOf(journalEntryIds)))
                        .fetch()
                    : Promise.resolve([]),

                database.get<ConversationThread>('conversation_threads')
                    .query(Q.where('status', 'active'))
                    .fetch(),

                journalEntryIds.length > 0
                    ? database.get<JournalEntryFriend>('journal_entry_friends')
                        .query(Q.where('journal_entry_id', Q.oneOf(journalEntryIds)))
                        .fetch()
                    : Promise.resolve([]),
            ]);

            const signalsMap = new Map(signals.map(s => [s.journalEntryId, s]));

            // Batch-fetch friend models for name resolution
            const allFriendIds = [...new Set(entryFriendLinks.map(l => l.friendId))];
            const friends = allFriendIds.length > 0
                ? await database.get<FriendModel>('friends')
                    .query(Q.where('id', Q.oneOf(allFriendIds)))
                    .fetch()
                : [];

            const friendNameMap = new Map(friends.map(f => [f.id, f.name]));
            const entryFriendsMap = new Map<string, string[]>();
            for (const link of entryFriendLinks) {
                const names = entryFriendsMap.get(link.journalEntryId) || [];
                const name = friendNameMap.get(link.friendId);
                if (name && !names.includes(name)) names.push(name);
                entryFriendsMap.set(link.journalEntryId, names);
            }

            // Build enriched items
            const enrichedItems: EnrichedFeedItem[] = entries.map(entry => {
                if ('weekStartDate' in entry) {
                    return {
                        type: 'entry',
                        id: entry.id,
                        entry,
                        signals: null,
                        threads: [],
                        friendNames: [],
                    };
                }

                const entrySignals = signalsMap.get(entry.id);
                const relevantThreads = activeThreads.filter(t =>
                    t.sourceEntryIds.includes(entry.id)
                );

                return {
                    type: 'entry',
                    id: entry.id,
                    entry,
                    signals: entrySignals || null,
                    threads: relevantThreads,
                    friendNames: entryFriendsMap.get(entry.id) || [],
                };
            });

            // INJECT DATE SECTION HEADERS
            let lastSectionLabel = '';
            const withSections: FeedItem[] = [];

            for (const item of enrichedItems) {
                const itemDate = getEntryDate(item.entry);
                const sectionLabel = getDateSectionLabel(itemDate);

                if (sectionLabel !== lastSectionLabel) {
                    withSections.push({
                        type: 'date_section',
                        id: `section-${sectionLabel}`,
                        label: sectionLabel,
                    });
                    lastSectionLabel = sectionLabel;
                }

                withSections.push(item);
            }

            // INJECT ARC SUMMARIES
            const finalFeed: FeedItem[] = [];

            for (let i = 0; i < withSections.length; i++) {
                finalFeed.push(withSections[i]);

                // Check for sentiment shift between first two entry items
                if (withSections[i].type === 'entry' && enrichedItems.length > 3) {
                    const entryIndex = enrichedItems.indexOf(withSections[i] as EnrichedFeedItem);

                    if (entryIndex === 1) {
                        const current = enrichedItems[0];
                        const previous = enrichedItems[1];

                        if (current.signals && previous.signals) {
                            const currLabel = current.signals.sentimentLabel;
                            const prevLabel = previous.signals.sentimentLabel;

                            if ((prevLabel === 'concerned' || prevLabel === 'tense') &&
                                (currLabel === 'positive' || currLabel === 'grateful')) {
                                finalFeed.push({
                                    type: 'arc_summary',
                                    id: `summary-shift-${current.id}`,
                                    summaryType: 'sentiment_shift',
                                    title: 'Perspective Shift',
                                    description: `Your reflections shifted from ${prevLabel} to ${currLabel} recently.`
                                });
                            }
                        }
                    }
                }
            }

            PerfLogger.log('useEnrichedFeed', `Enriched ${entries.length} items => ${finalFeed.length} feed items in ${Date.now() - start}ms`);
            return finalFeed;
        },
        enabled: !!baseFeedData?.items,
        staleTime: 5 * 60 * 1000 // Keep enriched data for 5 mins
    });

    return {
        items: query.data || [],
        isLoading: isLoading || query.isLoading,
        loadMore,
        hasMore: !!baseFeedData?.hasMore,
        refetch,
        invalidate
    };
}
