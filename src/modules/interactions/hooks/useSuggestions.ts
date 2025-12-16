import { useEffect, useState, useRef } from 'react';
import { Q } from '@nozbe/watermelondb';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { fetchSuggestions } from '../services/suggestion-provider.service';
import { calculateCurrentScore } from '@/modules/intelligence';
import { SuggestionTrackerService } from '../services/suggestion-tracker.service';
import * as SuggestionStorageService from '../services/suggestion-storage.service';
import { useUserProfile } from '@/modules/auth';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';

export function useSuggestions() {
  const queryClient = useQueryClient();
  const trackedSuggestions = useRef<Set<string>>(new Set()); // Track which suggestions we've already logged as "shown"

  // Get current social season from profile
  const { profile } = useUserProfile();
  const currentSeason = profile?.currentSocialSeason || null;

  const { data: suggestions = [] } = useQuery({
    queryKey: ['suggestions', 'all', currentSeason], // Include season in query key for proper cache invalidation
    queryFn: () => fetchSuggestions(3, currentSeason),
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
  useEffect(() => {
    let isMounted = true;

    const trackSuggestions = async () => {
      const suggestionsToTrack = suggestions.filter(s => !trackedSuggestions.current.has(s.id));

      if (suggestionsToTrack.length === 0) return;

      try {
        await Promise.all(suggestionsToTrack.map(async (suggestion) => {
          if (!isMounted) return;

          if (!suggestion.friendId) return; // Portfolio insights might not have friendId

          // Find the friend to get context
          const friend = await database.get<FriendModel>('friends').find(suggestion.friendId).catch(() => null);

          if (friend) {
            const currentScore = calculateCurrentScore(friend);

            // Calculate days since last interaction
            const interactionFriends = await database
              .get<InteractionFriend>('interaction_friends')
              .query(Q.where('friend_id', friend.id))
              .fetch();

            if (!isMounted) return;

            const interactionIds = interactionFriends.map(ifriend => ifriend.interactionId);
            let daysSinceLastInteraction = 999;

            if (interactionIds.length > 0) {
              const friendInteractions = await database
                .get<Interaction>('interactions')
                .query(
                  Q.where('id', Q.oneOf(interactionIds)),
                  Q.where('status', 'completed') // Only include completed interactions
                )
                .fetch();

              if (!isMounted) return;

              const sortedInteractions = friendInteractions.sort(
                (a, b) => {
                  const timeA = a.interactionDate instanceof Date ? a.interactionDate.getTime() : new Date(a.interactionDate || 0).getTime();
                  const timeB = b.interactionDate instanceof Date ? b.interactionDate.getTime() : new Date(b.interactionDate || 0).getTime();
                  return timeB - timeA;
                }
              );

              if (sortedInteractions.length > 0 && sortedInteractions[0].interactionDate) {
                const date = sortedInteractions[0].interactionDate;
                const time = date instanceof Date ? date.getTime() : new Date(date).getTime();
                daysSinceLastInteraction = (Date.now() - time) / 86400000;
              }
            }

            // Track this suggestion as shown
            if (isMounted) {
              await SuggestionTrackerService.trackSuggestionShown(suggestion, {
                friendScore: currentScore,
                daysSinceLastInteraction: Math.round(daysSinceLastInteraction),
              });

              trackedSuggestions.current.add(suggestion.id);
            }
          }
        }));
      } catch (error) {
        console.error('Error tracking suggestions:', error);
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
