import { useEffect, useState, useRef } from 'react';
import { Q } from '@nozbe/watermelondb';
import { useFriends } from '@/hooks/useFriends';
import { database } from '@/db';
import { generateSuggestion } from '@/modules/interactions/services/suggestion-engine.service';
import { getDismissedSuggestions, dismissSuggestion as dismissSuggestionStorage } from '@/lib/suggestion-storage';
import { Suggestion } from '@/types/suggestions';
import { calculateCurrentScore } from '@/modules/intelligence/services/orchestrator.service';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import { trackSuggestionShown, trackSuggestionDismissed } from '@/lib/suggestion-tracker';
import { filterSuggestionsByTime } from '@/lib/time-aware-filter';
import {
  generatePortfolioInsights,
  analyzeArchetypeBalance,
  type PortfolioAnalysisStats
} from '@/modules/insights';

/**
 * Selects diverse suggestions to provide a balanced "options menu" experience.
 * Ensures variety across different action types: reflect, drift/reconnect, deepen/momentum.
 */
function selectDiverseSuggestions(suggestions: Suggestion[], maxCount: number): Suggestion[] {
  if (suggestions.length === 0) return [];

  const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  // Group suggestions by their action category
  const buckets = {
    critical: suggestions.filter(s => s.urgency === 'critical'),
    reflect: suggestions.filter(s => s.category === 'reflect'),
    lifeEvent: suggestions.filter(s => s.category === 'life-event'),
    drift: suggestions.filter(s => s.category === 'drift'),
    deepen: suggestions.filter(s => s.category === 'deepen' || s.category === 'celebrate'),
    maintain: suggestions.filter(s => s.category === 'maintain'),
    insight: suggestions.filter(s => s.category === 'insight'),
    portfolio: suggestions.filter(s => s.category === 'portfolio'),
  };

  const selected: Suggestion[] = [];

  // 1. ALWAYS include critical suggestions (non-dismissible emergencies)
  selected.push(...buckets.critical);

  if (selected.length >= maxCount) {
    return selected.slice(0, maxCount);
  }

  // 2. Build a diverse set from different buckets
  // Priority order: reflect -> lifeEvent -> drift -> portfolio -> deepen -> maintain -> insight
  const bucketOrder: Array<keyof typeof buckets> = ['reflect', 'lifeEvent', 'drift', 'portfolio', 'deepen', 'maintain', 'insight'];

  // Round-robin selection: pick best from each bucket
  for (const bucketName of bucketOrder) {
    if (selected.length >= maxCount) break;

    const bucket = buckets[bucketName];
    if (bucket.length === 0) continue;

    // Sort bucket by urgency, then pick the top one
    const sorted = bucket.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
    selected.push(sorted[0]);
  }

  // 3. If we still have room, fill with highest urgency remaining
  if (selected.length < maxCount) {
    const selectedIds = new Set(selected.map(s => s.id));
    const remaining = suggestions
      .filter(s => !selectedIds.has(s.id))
      .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    while (selected.length < maxCount && remaining.length > 0) {
      selected.push(remaining.shift()!);
    }
  }

  // Final sort: critical first, then by original urgency
  return selected.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);
}

export function useSuggestions() {
  const friends = useFriends();
  const [dismissedMap, setDismissedMap] = useState<Map<string, any>>(new Map());
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [interactionTrigger, setInteractionTrigger] = useState(0); // Trigger for interaction changes
  const trackedSuggestions = useRef<Set<string>>(new Set()); // Track which suggestions we've already logged as "shown"

  // Load dismissed suggestions on mount
  useEffect(() => {
    getDismissedSuggestions().then(setDismissedMap);
  }, []);

  // Observe interactions table for changes to trigger suggestion regeneration
  useEffect(() => {
    const subscription = database
      .get<Interaction>('interactions')
      .query()
      .observe()
      .subscribe(() => {
        // Trigger regeneration when interactions change
        setInteractionTrigger(prev => prev + 1);
      });

    return () => subscription.unsubscribe();
  }, []);

  // Track when suggestions are shown (only track each suggestion once)
  useEffect(() => {
    suggestions.forEach(async (suggestion) => {
      if (!trackedSuggestions.current.has(suggestion.id)) {
        // Find the friend to get context
        const friend = friends.find(f => f.id === suggestion.friendId);
        if (friend) {
          const currentScore = calculateCurrentScore(friend);

          // Calculate days since last interaction
          const interactionFriends = await database
            .get<InteractionFriend>('interaction_friends')
            .query(Q.where('friend_id', friend.id))
            .fetch();

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

            const sortedInteractions = friendInteractions.sort(
              (a, b) => b.interactionDate.getTime() - a.interactionDate.getTime()
            );

            if (sortedInteractions.length > 0) {
              daysSinceLastInteraction = (Date.now() - sortedInteractions[0].interactionDate.getTime()) / 86400000;
            }
          }

          // Track this suggestion as shown
          await trackSuggestionShown(suggestion, {
            friendScore: currentScore,
            daysSinceLastInteraction: Math.round(daysSinceLastInteraction),
          });

          trackedSuggestions.current.add(suggestion.id);
        }
      }
    });
  }, [suggestions, friends]);

  // Generate suggestions when friends, dismissedMap, or interactions change
  useEffect(() => {
    const generateAllSuggestions = async () => {
      // Clear tracked suggestions when regenerating
      trackedSuggestions.current.clear();

      const allSuggestions: Suggestion[] = [];
      const friendStats: PortfolioAnalysisStats['friends'] = [];

      for (const friend of friends) {
        // Query friend's interactions through the junction table
        const interactionFriends = await database
          .get<InteractionFriend>('interaction_friends')
          .query(Q.where('friend_id', friend.id))
          .fetch();

        const interactionIds = interactionFriends.map(ifriend => ifriend.interactionId);

        let sortedInteractions: Interaction[] = [];
        if (interactionIds.length > 0) {
          const friendInteractions = await database
            .get<Interaction>('interactions')
            .query(
              Q.where('id', Q.oneOf(interactionIds)),
              Q.where('status', 'completed') // Only include completed interactions
            )
            .fetch();

          sortedInteractions = friendInteractions.sort(
            (a, b) => b.interactionDate.getTime() - a.interactionDate.getTime()
          );
        }

        const lastInteraction = sortedInteractions[0];
        const currentScore = calculateCurrentScore(friend);

        // Calculate current momentum score (decays over time)
        const daysSinceMomentumUpdate = (Date.now() - friend.momentumLastUpdated.getTime()) / 86400000;
        const momentumScore = Math.max(0, friend.momentumScore - daysSinceMomentumUpdate);

        // Calculate days since last interaction
        const daysSinceInteraction = lastInteraction
          ? (Date.now() - lastInteraction.interactionDate.getTime()) / 86400000
          : 999;

        // Collect stats for portfolio analysis
        friendStats.push({
          id: friend.id,
          name: friend.name,
          tier: friend.dunbarTier,
          archetype: friend.archetype,
          score: currentScore,
          daysSinceInteraction: Math.round(daysSinceInteraction),
        });

        const suggestion = await generateSuggestion({
          friend: {
            id: friend.id,
            name: friend.name,
            archetype: friend.archetype,
            dunbarTier: friend.dunbarTier,
            createdAt: friend.createdAt,
            birthday: friend.birthday,
            anniversary: friend.anniversary,
            relationshipType: friend.relationshipType,
          },
          currentScore,
          lastInteractionDate: lastInteraction?.interactionDate,
          interactionCount: sortedInteractions.length,
          momentumScore,
          recentInteractions: sortedInteractions.slice(0, 5).map(i => ({
            id: i.id,
            category: i.interactionCategory as any,
            interactionDate: i.interactionDate,
            vibe: i.vibe,
            notes: i.note,
          })),
        });

        if (suggestion) {
          allSuggestions.push(suggestion);
        }
      }

      // Generate portfolio-level insights
      // Deduplicate friend stats by ID (in case of duplicates in DB)
      const uniqueFriendStats = Array.from(
        new Map(friendStats.map(f => [f.id, f])).values()
      );

      if (uniqueFriendStats.length >= 3) {
        const tierScores = {
          inner: {
            avg: uniqueFriendStats.filter(f => f.tier === 'InnerCircle').reduce((sum, f, _, arr) => sum + f.score / arr.length, 0) || 0,
            count: uniqueFriendStats.filter(f => f.tier === 'InnerCircle').length,
            drifting: uniqueFriendStats.filter(f => f.tier === 'InnerCircle' && f.score < 50).length,
          },
          close: {
            avg: uniqueFriendStats.filter(f => f.tier === 'CloseFriends').reduce((sum, f, _, arr) => sum + f.score / arr.length, 0) || 0,
            count: uniqueFriendStats.filter(f => f.tier === 'CloseFriends').length,
            drifting: uniqueFriendStats.filter(f => f.tier === 'CloseFriends' && f.score < 40).length,
          },
          community: {
            avg: uniqueFriendStats.filter(f => f.tier === 'Community').reduce((sum, f, _, arr) => sum + f.score / arr.length, 0) || 0,
            count: uniqueFriendStats.filter(f => f.tier === 'Community').length,
            drifting: uniqueFriendStats.filter(f => f.tier === 'Community' && f.score < 30).length,
          },
        };

        console.log('📊 Portfolio Analysis:', {
          friendCount: uniqueFriendStats.length,
          tierScores,
          friends: uniqueFriendStats.map(f => ({ name: f.name, tier: f.tier, score: f.score }))
        });

        const portfolioAnalysis: PortfolioAnalysisStats = {
          friends: uniqueFriendStats,
          tierScores,
          archetypeBalance: analyzeArchetypeBalance(uniqueFriendStats),
        };

        const portfolioInsight = generatePortfolioInsights(portfolioAnalysis);
        console.log('📊 Portfolio Insight Generated:', portfolioInsight?.title || 'None');

        if (portfolioInsight) {
          allSuggestions.push(portfolioInsight);
        }
      }

      // Filter out dismissed (unless critical)
      const active = allSuggestions.filter(s => {
        if (s.urgency === 'critical') return true; // Critical always shows
        return !dismissedMap.has(s.id);
      });

      // Apply time-based filtering (e.g., don't show "plan dinner" at 11pm)
      const timeAppropriate = filterSuggestionsByTime(active);

      // Diversify suggestions to provide balanced "options menu" experience
      const topSuggestions = selectDiverseSuggestions(timeAppropriate, 3);

      setSuggestions(topSuggestions);
    };

    generateAllSuggestions();
  }, [friends, dismissedMap, interactionTrigger]);

  const dismissSuggestion = async (id: string, cooldownDays: number) => {
    // Track the dismissal
    await trackSuggestionDismissed(id);

    // Store the dismissal
    await dismissSuggestionStorage(id, cooldownDays);
    const updated = await getDismissedSuggestions();
    setDismissedMap(updated);
  };

  const hasCritical = suggestions.some(s => s.urgency === 'critical');

  return {
    suggestions,
    suggestionCount: suggestions.length,
    hasCritical,
    dismissSuggestion,
  };
}
