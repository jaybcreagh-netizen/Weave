// src/modules/insights/hooks/useTierFit.ts
import { useState, useEffect } from 'react';
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import { analyzeTierFit, analyzeNetworkTierHealth, shouldShowTierSuggestion } from '../services/tier-fit.service';
import type { TierFitAnalysis, NetworkTierHealth } from '../types';

/**
 * Hook to get tier fit analysis for a specific friend
 * Updates reactively when friend data changes
 *
 * @param friendId - The ID of the friend to analyze
 * @returns Tier fit analysis and loading state
 */
export function useTierFit(friendId: string) {
  const [state, setState] = useState<{
    analysis: TierFitAnalysis | null;
    isLoading: boolean;
    shouldShow: boolean;
  }>({
    analysis: null,
    isLoading: true,
    shouldShow: false,
  });

  useEffect(() => {
    let subscription: any;
    let isMounted = true;

    const loadAnalysis = async () => {
      try {
        const friend = await database.get<Friend>('friends').find(friendId);

        // Run analysis (now async)
        const tierFitAnalysis = await analyzeTierFit(friend);

        if (isMounted) {
          const show = shouldShowTierSuggestion(friend);

          setState({
            analysis: tierFitAnalysis,
            isLoading: false,
            shouldShow: show
          });
        }

        // Subscribe to friend changes
        subscription = friend.observe().subscribe(async (updatedFriend: Friend) => {
          const updatedAnalysis = await analyzeTierFit(updatedFriend);
          if (isMounted) {
            const updatedShow = shouldShowTierSuggestion(updatedFriend);
            setState({
              analysis: updatedAnalysis,
              isLoading: false,
              shouldShow: updatedShow
            });
          }
        });
      } catch (error) {
        console.error('[useTierFit] Error loading tier fit analysis:', error);
        if (isMounted) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      }
    };

    loadAnalysis();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [friendId]);

  return state;
}

/**
 * Hook to get network-wide tier health analysis
 * Updates when friends change
 *
 * @returns Network tier health and loading state
 */
export function useNetworkTierHealth() {
  const [networkHealth, setNetworkHealth] = useState<NetworkTierHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let subscription: any;

    const setupSubscription = async () => {
      try {
        // Initial load
        const initialHealth = await analyzeNetworkTierHealth();
        if (isMounted) {
          setNetworkHealth(initialHealth);
          setIsLoading(false);
        }

        // Subscribe to ANY change in the friends collection
        // This is a bit broad, but ensures we catch tier changes, new adds, etc.
        subscription = database.get<Friend>('friends')
          .query()
          .observe()
          .subscribe(async () => {
            // When friends change, re-run analysis
            // Note: analyzeNetworkTierHealth is async, so we can't just pass it to subscribe
            try {
              const updatedHealth = await analyzeNetworkTierHealth();
              if (isMounted) {
                setNetworkHealth(updatedHealth);
              }
            } catch (err) {
              console.error('[useNetworkTierHealth] Error updating network health:', err);
            }
          });

      } catch (error) {
        console.error('[useNetworkTierHealth] Error setting up subscription:', error);
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    setupSubscription();

    return () => {
      isMounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  return {
    networkHealth,
    isLoading,
  };
}
