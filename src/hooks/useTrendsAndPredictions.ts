import { useState, useEffect } from 'react';
import { usePortfolio } from './usePortfolio';
import { useFriends } from './useFriends';
import {
  analyzeTrends,
  getHistoricalSnapshots,
  predictFriendDrift,
  generateProactiveSuggestions,
  forecastNetworkHealth,
  analyzeInteractionPattern,
  type TrendAnalysis,
  type FriendPrediction,
  type ProactiveSuggestion,
} from '@/modules/insights';
import { database } from '../db';
import InteractionModel from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import { Q } from '@nozbe/watermelondb';

/**
 * Hook to access trend analysis for the friendship network
 */
export function useTrends(timeframe: 'week' | 'month' | '3months' = 'month') {
  const { portfolio, isLoading: portfolioLoading } = usePortfolio();
  const [trends, setTrends] = useState<TrendAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (portfolioLoading || !portfolio) {
      return;
    }

    const loadTrends = async () => {
      try {
        const trendAnalysis = await analyzeTrends(portfolio, timeframe);
        setTrends(trendAnalysis);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading trends:', error);
        setIsLoading(false);
      }
    };

    loadTrends();
  }, [portfolio, portfolioLoading, timeframe]);

  return {
    trends,
    isLoading,
  };
}

/**
 * Hook to access historical portfolio data for charting
 */
export function useHistoricalData(days: number = 90) {
  const [snapshots, setSnapshots] = useState<Awaited<ReturnType<typeof getHistoricalSnapshots>>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSnapshots = async () => {
      try {
        const data = await getHistoricalSnapshots(days);
        setSnapshots(data);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading historical snapshots:', error);
        setIsLoading(false);
      }
    };

    loadSnapshots();
  }, [days]);

  return {
    snapshots,
    isLoading,
  };
}

/**
 * Hook to get predictions for all friends
 */
export function usePredictions() {
  const friends = useFriends();
  const [predictions, setPredictions] = useState<FriendPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPredictions = async () => {
      if (friends.length === 0) {
        setIsLoading(false);
        return;
      }

      try {
        const friendPredictions: FriendPrediction[] = [];

        for (const friend of friends) {
          if (friend.isDormant) continue; // Skip dormant friends

          // Get interaction pattern
          const interactionFriends = await database
            .get('interaction_friends')
            .query(Q.where('friend_id', friend.id))
            .fetch();

          if (interactionFriends.length > 0) {
            const interactionIds = interactionFriends.map(if_ => (if_ as any).interactionId);
            const friendInteractions = await database
              .get<InteractionModel>('interactions')
              .query(
                Q.where('id', Q.oneOf(interactionIds)),
                Q.where('status', 'completed'),
                Q.sortBy('interaction_date', Q.desc)
              )
              .fetch();

            const pattern = analyzeInteractionPattern(
              friendInteractions.map(i => ({
                id: i.id,
                interactionDate: i.interactionDate,
                status: i.status,
                category: i.interactionCategory,
              }))
            );

            const prediction = predictFriendDrift(friend, pattern);
            friendPredictions.push(prediction);
          } else {
            // No interactions yet
            const prediction = predictFriendDrift(friend);
            friendPredictions.push(prediction);
          }
        }

        // Sort by urgency and days until attention needed
        friendPredictions.sort((a, b) => {
          const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
            return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
          }
          return a.daysUntilAttentionNeeded - b.daysUntilAttentionNeeded;
        });

        setPredictions(friendPredictions);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading predictions:', error);
        setIsLoading(false);
      }
    };

    loadPredictions();
  }, [friends]);

  return {
    predictions,
    isLoading,
  };
}

/**
 * Hook to get proactive suggestions based on predictions
 */
export function useProactiveSuggestions() {
  const friends = useFriends();
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSuggestions = async () => {
      if (friends.length === 0) {
        setIsLoading(false);
        return;
      }

      try {
        const allSuggestions: ProactiveSuggestion[] = [];

        for (const friend of friends) {
          if (friend.isDormant) continue;

          // Get interaction pattern
          const interactionFriends = await database
            .get('interaction_friends')
            .query(Q.where('friend_id', friend.id))
            .fetch();

          let pattern;
          if (interactionFriends.length > 0) {
            const interactionIds = interactionFriends.map(if_ => (if_ as any).interactionId);
            const friendInteractions = await database
              .get<InteractionModel>('interactions')
              .query(
                Q.where('id', Q.oneOf(interactionIds)),
                Q.where('status', 'completed'),
                Q.sortBy('interaction_date', Q.desc)
              )
              .fetch();

            pattern = analyzeInteractionPattern(
              friendInteractions.map(i => ({
                id: i.id,
                interactionDate: i.interactionDate,
                status: i.status,
                category: i.interactionCategory,
              }))
            );
          }

          const friendSuggestions = generateProactiveSuggestions(friend, pattern);
          allSuggestions.push(...friendSuggestions);
        }

        // Sort by urgency and days until
        allSuggestions.sort((a, b) => {
          const urgencyOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
            return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
          }
          return a.daysUntil - b.daysUntil;
        });

        setSuggestions(allSuggestions);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading proactive suggestions:', error);
        setIsLoading(false);
      }
    };

    loadSuggestions();
  }, [friends]);

  return {
    suggestions,
    isLoading,
  };
}

/**
 * Hook to forecast network health into the future
 */
export function useNetworkForecast(daysAhead: number = 7) {
  const friends = useFriends();
  const [forecast, setForecast] = useState<ReturnType<typeof forecastNetworkHealth> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (friends.length === 0) {
      setIsLoading(false);
      return;
    }

    try {
      const forecastData = forecastNetworkHealth(friends, daysAhead);
      setForecast(forecastData);
      setIsLoading(false);
    } catch (error) {
      console.error('Error forecasting network health:', error);
      setIsLoading(false);
    }
  }, [friends, daysAhead]);

  return {
    forecast,
    isLoading,
  };
}
