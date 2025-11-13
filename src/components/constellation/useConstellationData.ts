/**
 * Hook to convert Friend models to ConstellationFriend format
 */

import { useMemo } from 'react';
import { ConstellationFriend } from './types';
import FriendModel from '../../db/models/Friend';
import { calculateCurrentScore } from '../../lib/weave-engine';

/**
 * Convert WatermelonDB Friend models to ConstellationFriend format
 */
export function useConstellationData(friends: FriendModel[]): ConstellationFriend[] {
  return useMemo(() => {
    return friends.map(friend => ({
      id: friend.id,
      name: friend.name,
      avatar: friend.profilePicture || undefined,
      dunbarTier: friend.dunbarTier,
      archetype: friend.archetype,
      weaveScore: calculateCurrentScore(friend),
      hasMomentum: friend.momentumScore > 10 &&
                   friend.momentumLastUpdated > Date.now() - 24 * 60 * 60 * 1000,
      lastInteractionDate: friend.lastUpdated || undefined,
    }));
  }, [friends]);
}

/**
 * Get constellation statistics for display
 */
export function useConstellationStats(constellationFriends: ConstellationFriend[]) {
  return useMemo(() => {
    const byTier = {
      InnerCircle: constellationFriends.filter(f => f.dunbarTier === 'InnerCircle'),
      CloseFriends: constellationFriends.filter(f => f.dunbarTier === 'CloseFriends'),
      Community: constellationFriends.filter(f => f.dunbarTier === 'Community'),
    };

    const fadingFriends = constellationFriends.filter(f => f.weaveScore < 40);
    const thrivingFriends = constellationFriends.filter(f => f.weaveScore >= 70);
    const momentumFriends = constellationFriends.filter(f => f.hasMomentum);

    return {
      total: constellationFriends.length,
      byTier: {
        InnerCircle: byTier.InnerCircle.length,
        CloseFriends: byTier.CloseFriends.length,
        Community: byTier.Community.length,
      },
      health: {
        thriving: thrivingFriends.length,
        fading: fadingFriends.length,
        momentum: momentumFriends.length,
      },
    };
  }, [constellationFriends]);
}
