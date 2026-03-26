import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import {
  fetchSuggestionSurface,
  type SuggestionFetchResult,
} from '../services/SuggestionFacade';
import { SuggestionTrackerService } from '../services/suggestion-tracker.service';
import * as SuggestionStorageService from '../services/suggestion-storage.service';
import { useUserProfile } from '@/modules/auth';
import { useUIStore } from '@/shared/stores/uiStore';
import Logger from '@/shared/utils/Logger';
import type { Suggestion, SuggestionDismissalReason } from '@/shared/types/common';
import { getMillisecondsUntilNextTimingWindow } from '../services/opportunity-system/personal-timing';

const EMPTY_RESULT: SuggestionFetchResult = {
  suggestions: [],
  selectorSuggestions: [],
  surfaceSource: 'legacy-list',
};
const IN_APP_SUGGESTION_LIMIT = 2;

interface UseSuggestionsOptions {
  trackFetchedSuggestions?: boolean;
}

export function useSuggestions(options: UseSuggestionsOptions = {}) {
  const queryClient = useQueryClient();
  const trackedSuggestions = useRef<Set<string>>(new Set()); // Track which suggestions we've already logged as "shown"
  const [isRequestingAnotherSuggestion, setIsRequestingAnotherSuggestion] = useState(false);
  const { trackFetchedSuggestions = true } = options;

  // Get current social season from profile
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const currentSeason = profile?.currentSocialSeason || null;

  const suggestionQueryKey = [
    'suggestions',
    'all',
    currentSeason,
    profile?.suggestionFrequency ?? null,
    profile?.preferredSuggestionWindowsJSON ?? null,
    profile?.timingProfileJSON ?? null,
  ] as const;

  const {
    data: suggestionResult = EMPTY_RESULT,
    isLoading: isSuggestionsLoading,
  } = useQuery<SuggestionFetchResult>({
    queryKey: suggestionQueryKey,
    enabled: !isProfileLoading, // Avoid first-paint empties while profile state hydrates
    queryFn: async () => {
      try {
        // In-app suggestion surfaces use the selector-backed "best next move" experience.
        // Notification preference intensity should not inflate what the UI shows.
        const result = await fetchSuggestionSurface(IN_APP_SUGGESTION_LIMIT, currentSeason, undefined, {
          forceSelector: true,
          trackAnalytics: false,
        });

        return result;
      } catch (error) {
        Logger.error(`[useSuggestions] fetchSuggestions FAILED`, error);
        // Return empty result on error so UI doesn't break
        return EMPTY_RESULT;
      }
    },
    // Re-fetch when the query is invalidated or season changes
  });

  const suggestions = suggestionResult.suggestions;
  const selectorSuggestions = suggestionResult.selectorSuggestions;
  const surfaceSource = suggestionResult.surfaceSource;
  const selectionReason = suggestionResult.selectionReason;
  const selectorOpportunitySource = suggestionResult.selectorOpportunitySource;
  const selectorSuggestionMetadata = suggestionResult.selectorSuggestionMetadata;
  const pacing = suggestionResult.pacing;
  const quietReason = suggestionResult.quietReason;
  const surfaceRequestKind = suggestionResult.surfaceRequestKind;

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

  useEffect(() => {
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ['suggestions', 'all'] });
    }, getMillisecondsUntilNextTimingWindow());

    return () => clearTimeout(timer);
  }, [
    queryClient,
    currentSeason,
    profile?.preferredSuggestionWindowsJSON,
    profile?.timingProfileJSON,
  ]);

  // OPTIMIZATION: Instead of a separate observable for interactions,
  // we rely on the InteractionObservableContext's debounced updates.
  // Components using this hook should be within the InteractionObservableProvider.
  // When interactions change significantly, invalidate suggestions.
  // Note: For now we keep this as a simple timer invalidation since suggestions 
  // need to be recomputed anyway, but this reduces the observable cascade.

  // Track when suggestions are shown (only track each suggestion once)
  // Uses pre-computed trackingContext from suggestion generation to avoid duplicate DB queries
  useEffect(() => {
    if (!trackFetchedSuggestions) {
      return;
    }

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
  }, [suggestions, trackFetchedSuggestions]);

  const suggestionStatsFingerprint = suggestions
    .map(s => `${s.id}:${s.urgency ?? 'none'}:${s.priority ?? 'none'}`)
    .sort()
    .join('|');

  // Sync suggestion stats to UIStore for components that just need the count.
  // Fingerprint dependency ensures updates when urgency/composition changes even if count is unchanged.
  useEffect(() => {
    const hasCritical = suggestions.some(s => s.urgency === 'critical');
    const store = useUIStore.getState();

    // Only update if values actually changed
    if (store.suggestionCount !== suggestions.length || store.hasCriticalSuggestion !== hasCritical) {
      store.setSuggestionStats(suggestions.length, hasCritical);
    }
  }, [suggestionStatsFingerprint, suggestions.length]);



  const invalidateSuggestions = () => {
    queryClient.invalidateQueries({ queryKey: ['suggestions', 'all'] });
  };

  const requestAnotherSuggestion = async () => {
    setIsRequestingAnotherSuggestion(true);

    try {
      const result = await fetchSuggestionSurface(IN_APP_SUGGESTION_LIMIT, currentSeason, undefined, {
        forceSelector: true,
        trackAnalytics: false,
        manualPull: true,
      });

      queryClient.setQueryData(suggestionQueryKey, result);
      return result;
    } catch (error) {
      Logger.error('[useSuggestions] requestAnotherSuggestion FAILED', error);
      return EMPTY_RESULT;
    } finally {
      setIsRequestingAnotherSuggestion(false);
    }
  };

  const dismissSuggestion = async (
    id: string,
    cooldownDays: number,
    reason?: SuggestionDismissalReason
  ) => {
    // Track the dismissal
    await SuggestionTrackerService.trackSuggestionDismissed(id, reason, cooldownDays);

    // Store the dismissal
    await SuggestionStorageService.dismissSuggestion(id, cooldownDays, reason);

    invalidateSuggestions();
  };

  const hasCritical = suggestions.some(s => s.urgency === 'critical');
  const canRequestAnotherSuggestion = pacing?.allowManualMore !== false;

  return {
    suggestions,
    selectorSuggestions,
    surfaceSource,
    selectionReason,
    selectorOpportunitySource,
    selectorSuggestionMetadata,
    pacing,
    quietReason,
    surfaceRequestKind,
    canRequestAnotherSuggestion,
    isRequestingAnotherSuggestion,
    suggestionCount: suggestions.length,
    hasCritical,
    dismissSuggestion,
    isLoading: isProfileLoading || isSuggestionsLoading,
    invalidateSuggestions,
    requestAnotherSuggestion,
  };
}
