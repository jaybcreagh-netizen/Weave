import { useState, useEffect } from 'react';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import {
  analyzeReciprocity,
  detectImbalance,
  getReciprocityDescription,
  calculateReciprocityScore,
  type ReciprocityAnalysis,
  type ImbalanceLevel,
} from '../services/reciprocity.service';

/**
 * Hook to get reciprocity analysis for a specific friend
 */
export function useReciprocityAnalysis(friendId: string) {
  const [analysis, setAnalysis] = useState<ReciprocityAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let subscription: any;

    const fetchAndObserve = async () => {
      try {
        const friend = await database.get<FriendModel>('friends').find(friendId);

        subscription = friend.observe().subscribe((updatedFriend: FriendModel) => {
          const reciprocityAnalysis = analyzeReciprocity(updatedFriend);
          setAnalysis(reciprocityAnalysis);
          setIsLoading(false);
        });
      } catch (error) {
        console.error('Error fetching friend for reciprocity analysis:', error);
        setIsLoading(false);
      }
    };

    fetchAndObserve();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [friendId]);

  return { analysis, isLoading };
}

/**
 * Hook to get reciprocity warnings for all friends with imbalanced relationships
 */
export function useReciprocityWarnings() {
  const [warnings, setWarnings] = useState<Array<{ friend: FriendModel; level: ImbalanceLevel; analysis: ReciprocityAnalysis }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let subscription: any;

    const fetchAndObserve = async () => {
      try {
        const friends = database.get<FriendModel>('friends').query(
          Q.where('is_dormant', false) // Only active friends
        );

        subscription = friends.observe().subscribe((activeFriends: FriendModel[]) => {
          const imbalancedFriends = activeFriends
            .map(friend => ({
              friend,
              level: detectImbalance(friend),
              analysis: analyzeReciprocity(friend),
            }))
            .filter(item => item.level !== 'none')
            .sort((a, b) => {
              // Sort by severity: severe > moderate > mild
              const severityOrder = { severe: 3, moderate: 2, mild: 1, none: 0 };
              return severityOrder[b.level] - severityOrder[a.level];
            });

          setWarnings(imbalancedFriends);
          setIsLoading(false);
        });
      } catch (error) {
        console.error('Error fetching reciprocity warnings:', error);
        setIsLoading(false);
      }
    };

    fetchAndObserve();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  return { warnings, isLoading };
}

/**
 * Hook to get portfolio-wide reciprocity metrics
 */
export function usePortfolioReciprocity() {
  const [metrics, setMetrics] = useState<{
    averageBalance: number; // 0-1, where 1 = perfectly balanced
    imbalancedCount: number;
    severeCount: number;
    totalFriends: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let subscription: any;

    const fetchAndObserve = async () => {
      try {
        const friends = database.get<FriendModel>('friends').query(
          Q.where('is_dormant', false)
        );

        subscription = friends.observe().subscribe((activeFriends: FriendModel[]) => {
          if (activeFriends.length === 0) {
            setMetrics({
              averageBalance: 1.0,
              imbalancedCount: 0,
              severeCount: 0,
              totalFriends: 0,
            });
            setIsLoading(false);
            return;
          }

          const reciprocityScores = activeFriends.map(friend => calculateReciprocityScore(friend));
          const averageBalance = reciprocityScores.reduce((sum, score) => sum + score, 0) / reciprocityScores.length;

          const imbalancedCount = activeFriends.filter(friend => detectImbalance(friend) !== 'none').length;
          const severeCount = activeFriends.filter(friend => detectImbalance(friend) === 'severe').length;

          setMetrics({
            averageBalance,
            imbalancedCount,
            severeCount,
            totalFriends: activeFriends.length,
          });
          setIsLoading(false);
        });
      } catch (error) {
        console.error('Error fetching portfolio reciprocity:', error);
        setIsLoading(false);
      }
    };

    fetchAndObserve();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  return { metrics, isLoading };
}

/**
 * Hook to get a human-readable reciprocity description for a friend
 */
export function useReciprocityDescription(friendId: string) {
  const { analysis, isLoading } = useReciprocityAnalysis(friendId);

  const description = analysis ? getReciprocityDescription(analysis) : '';

  return { description, analysis, isLoading };
}
