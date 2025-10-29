import { useMemo } from 'react';
import { Interaction } from '../db/models/Interaction';
import Friend from '../db/models/Friend';
import { generateSuggestion } from '../lib/suggestion-engine';
import { calculateCurrentScore } from '../lib/weave-engine';
import { Suggestion } from '../types/suggestions';

export function useFriendActionState(
  friend: Friend,
  interactions: Interaction[]
): Suggestion | null {
  return useMemo(() => {
    const sortedInteractions = [...interactions].sort(
      (a, b) => b.interactionDate.getTime() - a.interactionDate.getTime()
    );

    const currentScore = calculateCurrentScore(friend);

    // Calculate current momentum score (decays over time)
    const daysSinceMomentumUpdate = (Date.now() - friend.momentumLastUpdated.getTime()) / 86400000;
    const momentumScore = Math.max(0, friend.momentumScore - daysSinceMomentumUpdate);

    const lastInteraction = sortedInteractions[0];

    return generateSuggestion({
      friend: {
        id: friend.id,
        name: friend.name,
        archetype: friend.archetype,
        dunbarTier: friend.dunbarTier,
        createdAt: friend.createdAt,
      },
      currentScore,
      lastInteractionDate: lastInteraction?.interactionDate,
      interactionCount: sortedInteractions.length,
      momentumScore,
      recentInteractions: sortedInteractions.slice(0, 5).map(i => ({
        id: i.id,
        category: i.category as any,
        interactionDate: i.interactionDate,
        vibe: i.vibe,
        notes: i.notes,
      })),
    });
  }, [friend, interactions]);
}
