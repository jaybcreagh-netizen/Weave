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
  const [analysis, setAnalysis] = useState<TierFitAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    let subscription: any;
    let isMounted = true;

    const loadAnalysis = async () => {
      try {
        const friend = await database.get<Friend>('friends').find(friendId);

        // Run analysis (now async)
        const tierFitAnalysis = await analyzeTierFit(friend);
        if (isMounted) {
          setAnalysis(tierFitAnalysis);

          // Check if suggestion should be shown
          const show = shouldShowTierSuggestion(friend);
          setShouldShow(show);

          setIsLoading(false);
        }

        // Subscribe to friend changes
        subscription = friend.observe().subscribe(async (updatedFriend: Friend) => {
          const updatedAnalysis = await analyzeTierFit(updatedFriend);
          if (isMounted) {
            setAnalysis(updatedAnalysis);

            const updatedShow = shouldShowTierSuggestion(updatedFriend);
            setShouldShow(updatedShow);
          }
        });
      } catch (error) {
        console.error('[useTierFit] Error loading tier fit analysis:', error);
        if (isMounted) {
          setIsLoading(false);
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

  return {
    analysis,
    isLoading,
    shouldShow, // Whether to show the suggestion (not recently dismissed)
  };
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
    const loadNetworkHealth = async () => {
      try {
        const health = await analyzeNetworkTierHealth();
        setNetworkHealth(health);
        setIsLoading(false);
      } catch (error) {
        console.error('[useNetworkTierHealth] Error loading network health:', error);
        setIsLoading(false);
      }
    };

    loadNetworkHealth();

    // Re-calculate periodically (every 5 minutes) or when app resumes
    const interval = setInterval(loadNetworkHealth, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return {
    networkHealth,
    isLoading,
  };
}
