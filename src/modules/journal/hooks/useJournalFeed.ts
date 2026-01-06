import { useQuery, useQueryClient } from '@tanstack/react-query';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { Q } from '@nozbe/watermelondb';
import { PerfLogger } from '@/shared/utils/performance-logger';

const ENTRIES_PAGE_SIZE = 15;
const REFLECTIONS_LIMIT = 5;

export type JournalFeedItem = JournalEntry | WeeklyReflection;

export interface JournalFeedData {
    items: JournalFeedItem[];
    hasMore: boolean;
}

async function fetchJournalFeed(offset: number = 0): Promise<JournalFeedData> {
    const start = Date.now();
    PerfLogger.log('useJournalFeed', `Fetching entries offset=${offset}`);

    // Run both queries in parallel
    const [journalEntries, reflections] = await Promise.all([
        database
            .get<JournalEntry>('journal_entries')
            .query(
                Q.sortBy('entry_date', Q.desc),
                Q.skip(offset),
                Q.take(ENTRIES_PAGE_SIZE)
            )
            .fetch(),
        // Only fetch reflections on initial load (offset === 0)
        offset === 0
            ? database
                .get<WeeklyReflection>('weekly_reflections')
                .query(Q.sortBy('week_start_date', Q.desc), Q.take(REFLECTIONS_LIMIT))
                .fetch()
            : Promise.resolve([] as WeeklyReflection[])
    ]);

    const duration = Date.now() - start;
    PerfLogger.log('useJournalFeed', `Fetched ${journalEntries.length} entries + ${reflections.length} reflections in ${duration}ms`);

    // Combine and sort by date
    const items: JournalFeedItem[] = [...journalEntries, ...reflections];
    items.sort((a, b) => {
        const dateA = 'entryDate' in a ? a.entryDate : a.weekStartDate;
        const dateB = 'entryDate' in b ? b.entryDate : b.weekStartDate;
        return dateB - dateA; // Descending
    });

    return {
        items,
        hasMore: journalEntries.length === ENTRIES_PAGE_SIZE
    };
}

export function useJournalFeed() {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: ['journal-feed'],
        queryFn: () => fetchJournalFeed(0),
        staleTime: 2 * 60 * 1000, // 2 minutes - show cached data immediately
        gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    });

    const loadMore = async (currentLength: number) => {
        const moreData = await fetchJournalFeed(currentLength);

        // Append to existing data
        queryClient.setQueryData<JournalFeedData>(['journal-feed'], (old) => {
            if (!old) return moreData;
            return {
                items: [...old.items, ...moreData.items],
                hasMore: moreData.hasMore
            };
        });

        return moreData;
    };

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['journal-feed'] });
    };

    return {
        data: query.data,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        refetch: query.refetch,
        loadMore,
        invalidate
    };
}
