import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import { fetchSuggestions } from '../services/suggestion-provider.service';
import { SuggestionTrackerService } from '../services/suggestion-tracker.service';
import * as SuggestionStorageService from '../services/suggestion-storage.service';
import { useUserProfile } from '@/modules/auth';
import { notificationStore } from '@/modules/notifications';
import { useUIStore } from '@/shared/stores/uiStore';
import Logger from '@/shared/utils/Logger';


export function useSuggestions() {
  const queryClient = useQueryClient();
  const trackedSuggestions = useRef<Set<string>>(new Set()); // Track which suggestions we've already logged as "shown"

  // Get current social season from profile
  const { profile } = useUserProfile();
  const currentSeason = profile?.currentSocialSeason || null;

  // Wait for profile to load to avoid double-fetching (once with null season, once with real season)
  // Profile is usually loaded very quickly, so this just prevents the initial race condition
  const isProfileLoaded = !!profile;

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', 'all', currentSeason], // Include season in query key for proper cache invalidation
    enabled: isProfileLoaded, // Only run query when we know the season
    queryFn: async () => {
      // Return empty if profile somehow isn't loaded yet (safeguard)
      if (!isProfileLoaded) return [];


      const prefs = await notificationStore.getPreferences();


      try {

        const result = await fetchSuggestions(10, currentSeason, prefs.maxDailySuggestions);

        return result;
      } catch (error) {
        Logger.error(`[useSuggestions] fetchSuggestions FAILED`, error);
        // Return empty array on error so UI doesn't break
        return [];
      }
    },
    // Re-fetch when the query is invalidated or season changes
  });

  // Observe friends table for changes (debounced to prevent thrashing during bulk updates)
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const subscription = database
      .get<FriendModel>('friends')
      .query()
      .observe()
      .subscribe(() => {
        // Debounce: coalesce rapid changes into a single invalidation
        // INCREASED: 2000ms to prevent thrashing during sync/batch updates
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['suggestions', 'all'] });
        }, 2000);
      });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // OPTIMIZATION: Instead of a separate observable for interactions,
  // we rely on the InteractionObservableContext's debounced updates.
  // Components using this hook should be within the InteractionObservableProvider.
  // When interactions change significantly, invalidate suggestions.
  // Note: For now we keep this as a simple timer invalidation since suggestions 
  // need to be recomputed anyway, but this reduces the observable cascade.

  // Track when suggestions are shown (only track each suggestion once)
  // Uses pre-computed trackingContext from suggestion generation to avoid duplicate DB queries
  useEffect(() => {
    let isMounted = true;

    const trackSuggestions = async () => {
      // Filter to suggestions with tracking context that haven't been tracked yet
      const suggestionsToTrack = suggestions.filter(
        s => s.friendId && s.trackingContext && !trackedSuggestions.current.has(s.id)
      );

      if (suggestionsToTrack.length === 0) return;

      try {
        await Promise.all(suggestionsToTrack.map(async (suggestion) => {
          if (!isMounted) return;

          // Use the pre-computed tracking context - no additional DB queries needed
          await SuggestionTrackerService.trackSuggestionShown(suggestion, suggestion.trackingContext!);
          trackedSuggestions.current.add(suggestion.id);
        }));
      } catch (error) {
        Logger.error('Error tracking suggestions:', error);
      }
    };

    trackSuggestions();

    return () => {
      isMounted = false;
    };
  }, [suggestions]);

  // Sync suggestion stats to UIStore for components that just need the count
  // Use suggestions.length as dependency to avoid reference equality issues
  // Also guard against unnecessary updates to prevent feedback loops
  useEffect(() => {
    const hasCritical = suggestions.some(s => s.urgency === 'critical');
    const store = useUIStore.getState();

    // Only update if values actually changed
    if (store.suggestionCount !== suggestions.length || store.hasCriticalSuggestion !== hasCritical) {
      store.setSuggestionStats(suggestions.length, hasCritical);
    }
  }, [suggestions.length]); // Use primitive value as dependency



  const invalidateSuggestions = () => {
    queryClient.invalidateQueries({ queryKey: ['suggestions', 'all'] });
  };

  const dismissSuggestion = async (id: string, cooldownDays: number) => {
    // Track the dismissal
    await SuggestionTrackerService.trackSuggestionDismissed(id);

    // Store the dismissal
    await SuggestionStorageService.dismissSuggestion(id, cooldownDays);

    invalidateSuggestions();
  };

  const hasCritical = suggestions.some(s => s.urgency === 'critical');

  return {
    suggestions,
    suggestionCount: suggestions.length,
    hasCritical,
    dismissSuggestion,
    invalidateSuggestions
  };
}
