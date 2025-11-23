import { useState, useEffect } from 'react';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import InteractionOutcome from '@/db/models/InteractionOutcome';
import { Q } from '@nozbe/watermelondb';
import {
  getAllLearnedEffectiveness,
  analyzeEffectiveness,
  type EffectivenessInsights,
} from '@/modules/insights';
import { InteractionCategory } from '@/types/suggestions';

/**
 * Hook to get learned effectiveness data for a friend
 */
export function useFriendEffectiveness(friendId: string) {
  const [friend, setFriend] = useState<FriendModel | null>(null);
  const [effectiveness, setEffectiveness] = useState<Record<InteractionCategory, number> | null>(null);
  const [insights, setInsights] = useState<EffectivenessInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadEffectiveness = async () => {
      try {
        const friendRecord = await database.get<FriendModel>('friends').find(friendId);
        const effectivenessData = getAllLearnedEffectiveness(friendRecord);
        const insightsData = analyzeEffectiveness(friendRecord);

        setFriend(friendRecord);
        setEffectiveness(effectivenessData);
        setInsights(insightsData);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading effectiveness:', error);
        setIsLoading(false);
      }
    };

    loadEffectiveness();

    // Subscribe to friend changes
    const subscription = database
      .get<FriendModel>('friends')
      .findAndObserve(friendId)
      .subscribe(updatedFriend => {
        const updatedEffectiveness = getAllLearnedEffectiveness(updatedFriend);
        const updatedInsights = analyzeEffectiveness(updatedFriend);

        setFriend(updatedFriend);
        setEffectiveness(updatedEffectiveness);
        setInsights(updatedInsights);
      });

    return () => subscription.unsubscribe();
  }, [friendId]);

  return {
    effectiveness,
    insights,
    isLoading,
    sampleSize: friend?.outcomeCount || 0,
    hasLearned: (friend?.outcomeCount || 0) >= 3,
  };
}

/**
 * Hook to get all interaction outcomes for analysis
 */
export function useInteractionOutcomes(friendId?: string) {
  const [outcomes, setOutcomes] = useState<InteractionOutcome[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOutcomes = async () => {
      try {
        let query = database.get<InteractionOutcome>('interaction_outcomes').query();

        if (friendId) {
          query = query.extend(Q.where('friend_id', friendId));
        }

        query = query.extend(
          Q.where('actual_impact', Q.notEq(0)), // Only measured outcomes
          Q.sortBy('measured_at', Q.desc)
        );

        const outcomesList = await query.fetch();
        setOutcomes(outcomesList);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading outcomes:', error);
        setIsLoading(false);
      }
    };

    loadOutcomes();

    // Subscribe to outcomes changes
    let query = database.get<InteractionOutcome>('interaction_outcomes').query();

    if (friendId) {
      query = query.extend(Q.where('friend_id', friendId));
    }

    const subscription = query
      .observe()
      .subscribe(updatedOutcomes => {
        setOutcomes(updatedOutcomes);
      });

    return () => subscription.unsubscribe();
  }, [friendId]);

  return {
    outcomes,
    isLoading,
  };
}

/**
 * Hook to get effectiveness statistics across all friends
 */
export function useGlobalEffectiveness() {
  const [stats, setStats] = useState<{
    totalOutcomes: number;
    averageEffectiveness: number;
    bestCategory: { category: string; ratio: number } | null;
    worstCategory: { category: string; ratio: number } | null;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const outcomes = await database
          .get<InteractionOutcome>('interaction_outcomes')
          .query(Q.where('actual_impact', Q.notEq(0)))
          .fetch();

        if (outcomes.length === 0) {
          setStats({
            totalOutcomes: 0,
            averageEffectiveness: 1.0,
            bestCategory: null,
            worstCategory: null,
          });
          setIsLoading(false);
          return;
        }

        // Calculate average effectiveness
        const avgEffectiveness =
          outcomes.reduce((sum, o) => sum + o.effectivenessRatio, 0) / outcomes.length;

        // Find best and worst categories
        const categoryStats = new Map<string, { sum: number; count: number }>();

        outcomes.forEach(outcome => {
          const stats = categoryStats.get(outcome.category) || { sum: 0, count: 0 };
          stats.sum += outcome.effectivenessRatio;
          stats.count += 1;
          categoryStats.set(outcome.category, stats);
        });

        const categoryAverages = Array.from(categoryStats.entries())
          .map(([category, stats]) => ({
            category,
            ratio: stats.sum / stats.count,
          }))
          .filter(c => c.ratio !== 1.0); // Filter out neutral

        const sorted = categoryAverages.sort((a, b) => b.ratio - a.ratio);

        setStats({
          totalOutcomes: outcomes.length,
          averageEffectiveness: avgEffectiveness,
          bestCategory: sorted[0] || null,
          worstCategory: sorted[sorted.length - 1] || null,
        });

        setIsLoading(false);
      } catch (error) {
        console.error('Error loading global effectiveness:', error);
        setIsLoading(false);
      }
    };

    loadStats();

    // Subscribe to outcomes changes
    const subscription = database
      .get<InteractionOutcome>('interaction_outcomes')
      .query()
      .observe()
      .subscribe(() => {
        loadStats(); // Recalculate when outcomes change
      });

    return () => subscription.unsubscribe();
  }, []);

  return {
    stats,
    isLoading,
  };
}

/**
 * Hook to check if feedback system is ready (has enough data)
 */
export function useFeedbackReadiness() {
  const [isReady, setIsReady] = useState(false);
  const [measuredCount, setMeasuredCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const checkReadiness = async () => {
      const measured = await database
        .get<InteractionOutcome>('interaction_outcomes')
        .query(Q.where('actual_impact', Q.notEq(0)))
        .fetchCount();

      const pending = await database
        .get<InteractionOutcome>('interaction_outcomes')
        .query(Q.where('actual_impact', 0))
        .fetchCount();

      setMeasuredCount(measured);
      setPendingCount(pending);
      setIsReady(measured >= 5); // Ready after 5+ measured outcomes
    };

    checkReadiness();

    // Re-check periodically
    const interval = setInterval(checkReadiness, 60000); // Every minute

    return () => clearInterval(interval);
  }, []);

  return {
    isReady,
    measuredCount,
    pendingCount,
    message: isReady
      ? `Learning from ${measuredCount} interactions`
      : `Collecting data (${measuredCount}/5 needed)`,
  };
}
