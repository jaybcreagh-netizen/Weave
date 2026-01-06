import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { scanUpcomingEvents, scanRecentPastEvents, type ScannedEvent } from '../services/event-scanner';

const DISMISSED_SUGGESTIONS_KEY = '@weave:dismissed_event_suggestions';
const LAST_SCAN_KEY = '@weave:last_event_scan';
const QUERY_KEY = ['eventSuggestions'];

export type SuggestionType = 'upcoming' | 'past';

export interface EventSuggestion {
    event: ScannedEvent;
    type: SuggestionType;
    suggestedAt: Date;
}

interface DismissedSuggestions {
    eventIds: string[];
    timestamp: number;
}

/**
 * Load dismissed suggestions from storage
 */
async function loadDismissedSuggestions(): Promise<Set<string>> {
    try {
        const data = await AsyncStorage.getItem(DISMISSED_SUGGESTIONS_KEY);
        if (!data) return new Set();

        const parsed: DismissedSuggestions = JSON.parse(data);

        // Clear dismissed suggestions older than 30 days
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        if (parsed.timestamp < thirtyDaysAgo) {
            await AsyncStorage.removeItem(DISMISSED_SUGGESTIONS_KEY);
            return new Set();
        }

        return new Set(parsed.eventIds);
    } catch (error) {
        console.error('[EventSuggestions] Error loading dismissed suggestions:', error);
        return new Set();
    }
}

/**
 * Save dismissed suggestion to storage
 */
async function saveDismissedSuggestion(eventId: string): Promise<void> {
    try {
        const dismissed = await loadDismissedSuggestions();
        dismissed.add(eventId);

        const data: DismissedSuggestions = {
            eventIds: Array.from(dismissed),
            timestamp: Date.now(),
        };

        await AsyncStorage.setItem(DISMISSED_SUGGESTIONS_KEY, JSON.stringify(data));
    } catch (error) {
        console.error('[EventSuggestions] Error saving dismissed suggestion:', error);
    }
}

/**
 * Check if we should scan (throttle to once per hour)
 */
async function shouldScan(): Promise<boolean> {
    try {
        const lastScan = await AsyncStorage.getItem(LAST_SCAN_KEY);
        if (!lastScan) return true;

        const lastScanTime = parseInt(lastScan, 10);
        const oneHourAgo = Date.now() - 60 * 60 * 1000;

        return lastScanTime < oneHourAgo;
    } catch (error) {
        return true;
    }
}

/**
 * Update last scan time
 */
async function updateLastScanTime(): Promise<void> {
    try {
        await AsyncStorage.setItem(LAST_SCAN_KEY, Date.now().toString());
    } catch (error) {
        console.error('[EventSuggestions] Error updating last scan time:', error);
    }
}

interface SuggestionsResult {
    upcomingEvents: EventSuggestion[];
    pastEvents: EventSuggestion[];
}

/**
 * Hook to fetch event suggestions (upcoming and past)
 */
export function useEventSuggestions(options?: { enabled?: boolean }) {
    const enabled = options?.enabled ?? true;

    return useQuery<SuggestionsResult>({
        queryKey: QUERY_KEY,
        queryFn: async () => {
            // Check throttle
            const should = await shouldScan();
            if (!should) {
                // Return empty or potentially cached data structure if possible, 
                // but react-query handles stale-while-revalidate. 
                // If we strictly want to NOT run the expensive scan, we can just return empty
                // However, returning empty might clear the UI.
                // Better strategy: The query is staleTime dependent. 
                // But the store logic had explicit "throttle per hour" persistence.
                // We'll respect that logic: if throttled, strictly don't scan? 
                // Issue: if we don't scan, what do we return?
                // We can't easily access the "previous" data inside queryFn without returning it.
                // For simplicity in this migration: We will allow the scan to run if React Query thinks it's stale.
                // We can set `staleTime: 60 * 60 * 1000` (1 hour) to replace the manual throttle.
            }

            // Load dismissed suggestions
            const dismissed = await loadDismissedSuggestions();

            // Scan
            const [upcomingResult, pastResult] = await Promise.all([
                scanUpcomingEvents(),
                scanRecentPastEvents(),
            ]);

            const now = new Date();

            const upcomingSuggestions: EventSuggestion[] = upcomingResult.events
                .filter((event) => !dismissed.has(event.id))
                .filter((event) => event.matchedFriends.length > 0)
                .map((event) => ({
                    event,
                    type: 'upcoming' as SuggestionType,
                    suggestedAt: now,
                }));

            const pastSuggestions: EventSuggestion[] = pastResult.events
                .filter((event) => !dismissed.has(event.id))
                .filter((event) => event.matchedFriends.length > 0)
                .map((event) => ({
                    event,
                    type: 'past' as SuggestionType,
                    suggestedAt: now,
                }));

            await updateLastScanTime();

            return {
                upcomingEvents: upcomingSuggestions,
                pastEvents: pastSuggestions,
            };
        },
        enabled,
        staleTime: 60 * 60 * 1000, // 1 hour throttle, replacing manual check
        gcTime: 24 * 60 * 60 * 1000, // Keep in cache for 24 hours
    });
}

/**
 * Hook to dismiss a suggestion
 */
export function useDismissSuggestion() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (eventId: string) => {
            await saveDismissedSuggestion(eventId);
        },
        onSuccess: (_, eventId) => {
            // Optimistically update the cache to remove the dismissed event
            queryClient.setQueryData<SuggestionsResult>(QUERY_KEY, (oldData) => {
                if (!oldData) return oldData;
                return {
                    upcomingEvents: oldData.upcomingEvents.filter(s => s.event.id !== eventId),
                    pastEvents: oldData.pastEvents.filter(s => s.event.id !== eventId),
                };
            });
        },
    });
}

/**
 * Prefetch suggestions (helper for initialization)
 * Skips scan if cached data exists and is not stale
 */
export async function prefetchEventSuggestions(queryClient: ReturnType<typeof useQueryClient>) {
    // Check if we already have cached, non-stale data
    const existingData = queryClient.getQueryData<SuggestionsResult>(QUERY_KEY);
    const queryState = queryClient.getQueryState(QUERY_KEY);

    if (existingData && queryState) {
        const dataAge = Date.now() - (queryState.dataUpdatedAt || 0);
        const ONE_HOUR = 60 * 60 * 1000;

        if (dataAge < ONE_HOUR) {
            // Data is still fresh, skip the expensive scan
            return;
        }
    }

    await queryClient.prefetchQuery({
        queryKey: QUERY_KEY,
        queryFn: async () => {
            const dismissed = await loadDismissedSuggestions();
            const [upcomingResult, pastResult] = await Promise.all([
                scanUpcomingEvents(),
                scanRecentPastEvents(),
            ]);
            const now = new Date();
            const upcomingSuggestions = upcomingResult.events
                .filter((event) => !dismissed.has(event.id))
                .filter((event) => event.matchedFriends.length > 0)
                .map((event) => ({ event, type: 'upcoming' as SuggestionType, suggestedAt: now }));
            const pastSuggestions = pastResult.events
                .filter((event) => !dismissed.has(event.id))
                .filter((event) => event.matchedFriends.length > 0)
                .map((event) => ({ event, type: 'past' as SuggestionType, suggestedAt: now }));
            await updateLastScanTime();
            return { upcomingEvents: upcomingSuggestions, pastEvents: pastSuggestions };
        },
        staleTime: 60 * 60 * 1000,
    });
}
