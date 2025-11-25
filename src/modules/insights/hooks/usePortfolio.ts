import { useState, useEffect } from 'react';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { Q } from '@nozbe/watermelondb';
import {
  analyzePortfolioAsync,
  getPortfolioHealthSummary,
  getWeeklyFocusRecommendation,
} from '../services/portfolio.service';
import { type FriendshipPortfolio } from '../types';
import { generatePortfolioSuggestions } from '@/modules/interactions';
import { type Suggestion } from '@/shared/types/common';

/**
 * Hook to access portfolio-level friendship network analytics
 * Provides holistic view of relationship health across all friends
 */
export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<FriendshipPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPortfolio = async () => {
      try {
        // Get all friends
        const friends = await database.get<FriendModel>('friends').query().fetch();

        // Get recent interactions (last 90 days for comprehensive analysis)
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const recentInteractions = await database
          .get<InteractionModel>('interactions')
          .query(
            Q.where('interaction_date', Q.gte(ninetyDaysAgo)),
            Q.where('status', 'completed')
          )
          .fetch();

        // Get interaction-friend relationships to map interactions to friends
        const interactionIds = recentInteractions.map(i => i.id);

        // Batch queries to avoid SQLite 999 parameter limit
        const BATCH_SIZE = 500;
        const chunks = [];
        for (let i = 0; i < interactionIds.length; i += BATCH_SIZE) {
          chunks.push(interactionIds.slice(i, i + BATCH_SIZE));
        }

        const interactionFriendLinksResults = await Promise.all(
          chunks.map(chunk =>
            database
              .get('interaction_friends')
              .query(Q.where('interaction_id', Q.oneOf(chunk)))
              .fetch()
          )
        );

        const interactionFriendLinks = interactionFriendLinksResults.flat();

        // Create a map for O(1) lookups of friends per interaction
        const interactionFriendMap = new Map<string, string[]>();
        interactionFriendLinks.forEach(link => {
          const { interactionId, friendId } = link as any;
          if (!interactionFriendMap.has(interactionId)) {
            interactionFriendMap.set(interactionId, []);
          }
          interactionFriendMap.get(interactionId)?.push(friendId);
        });

        // Build interaction data with friend IDs
        const interactionData = recentInteractions.map(interaction => {
          const friendIds = interactionFriendMap.get(interaction.id) || [];

          return {
            interactionDate: interaction.interactionDate,
            category: interaction.interactionCategory,
            friendIds,
          };
        });

        // Analyze portfolio
        const portfolioData = await analyzePortfolioAsync({
          friends,
          recentInteractions: interactionData,
        });

        setPortfolio(portfolioData);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading portfolio:', error);
        setIsLoading(false);
      }
    };

    // Initial load
    loadPortfolio();

    // Subscribe to friends changes
    const friendsSubscription = database
      .get<FriendModel>('friends')
      .query()
      .observe()
      .subscribe(() => {
        loadPortfolio(); // Recalculate when friends change
      });

    // Subscribe to interactions changes
    const interactionsSubscription = database
      .get<InteractionModel>('interactions')
      .query()
      .observe()
      .subscribe(() => {
        loadPortfolio(); // Recalculate when interactions change
      });

    return () => {
      friendsSubscription?.unsubscribe();
      interactionsSubscription?.unsubscribe();
    };
  }, []);

  return {
    portfolio,
    isLoading,
  };
}

/**
 * Hook to get portfolio-level suggestions
 * Returns network-wide insights and recommendations
 */
export function usePortfolioSuggestions(): {
  suggestions: Suggestion[];
  isLoading: boolean;
} {
  const { portfolio, isLoading } = usePortfolio();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (portfolio) {
      const portfolioSuggestions = generatePortfolioSuggestions(portfolio);
      setSuggestions(portfolioSuggestions);
    }
  }, [portfolio]);

  return {
    suggestions,
    isLoading,
  };
}

/**
 * Hook to get a human-readable portfolio summary
 */
export function usePortfolioSummary(): {
  summary: string;
  healthScore: number;
  weeklyFocus: ReturnType<typeof getWeeklyFocusRecommendation> | null;
  isLoading: boolean;
} {
  const { portfolio, isLoading } = usePortfolio();

  if (isLoading || !portfolio) {
    return {
      summary: 'Loading your network...',
      healthScore: 0,
      weeklyFocus: null,
      isLoading: true,
    };
  }

  return {
    summary: getPortfolioHealthSummary(portfolio),
    healthScore: portfolio.overallHealthScore,
    weeklyFocus: getWeeklyFocusRecommendation(portfolio),
    isLoading: false,
  };
}
