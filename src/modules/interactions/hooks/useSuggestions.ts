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

      Logger.debug(`[useSuggestions] Query starting - season: ${currentSeason}`);
      const prefs = await notificationStore.getPreferences();
      Logger.debug(`[useSuggestions] Prefs loaded - maxDaily: ${prefs.maxDailySuggestions}`);

      try {
        Logger.debug(`[useSuggestions] Calling fetchSuggestions`);
        const result = await fetchSuggestions(10, currentSeason, prefs.maxDailySuggestions);
        Logger.debug(`[useSuggestions] Complete - ${result.length} suggestions`);
        return result;
      } catch (error) {
        Logger.error(`[useSuggestions] fetchSuggestions FAILED`, error);
        // Return empty array on error so UI doesn't break
        return [];
      }
    },
    // Re-fetch when the query is invalidated or season changes
  });

  // Observe friends table for changes
  useEffect(() => {
    const subscription = database
      .get<FriendModel>('friends')
      .query()
      .observe()
      .subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['suggestions', 'all'] });
      });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Observe interactions table for changes to trigger suggestion regeneration
  useEffect(() => {
    const subscription = database
      .get<Interaction>('interactions')
      .query()
      .observe()
      .subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['suggestions', 'all'] });
      });

    return () => subscription.unsubscribe();
  }, [queryClient]);

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
