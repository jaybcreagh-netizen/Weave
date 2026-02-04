import FriendModel from '@/db/models/Friend';
import {
  getTierAwareHealthStatus,
  rankFriendsByNeedsAttention,
} from '../friend-priority.service';

function makeFriend(
  id: string,
  name: string,
  weaveScore: number,
  dunbarTier: 'InnerCircle' | 'CloseFriends' | 'Community',
  lastUpdated: string = '2026-02-04T00:00:00.000Z'
): FriendModel {
  return {
    id,
    name,
    weaveScore,
    dunbarTier,
    archetype: 'Unknown',
    lastUpdated: new Date(lastUpdated),
    momentumScore: 0,
    momentumLastUpdated: new Date(lastUpdated),
    outcomeCount: 0,
  } as FriendModel;
}

describe('friend-priority.service', () => {
  it('classifies the same score differently by tier (tier-aware health)', () => {
    // Score 45 is drifting for Inner Circle (<50), but stable for Close Friends.
    expect(getTierAwareHealthStatus(45, 'InnerCircle')).toBe('drifting');
    expect(getTierAwareHealthStatus(45, 'CloseFriends')).toBe('stable');
  });

  it('uses calmer tier bands for Inner Circle (60 stable, 75 thriving)', () => {
    expect(getTierAwareHealthStatus(59, 'InnerCircle')).toBe('attention');
    expect(getTierAwareHealthStatus(60, 'InnerCircle')).toBe('stable');
    expect(getTierAwareHealthStatus(75, 'InnerCircle')).toBe('thriving');
  });

  it('prioritizes needs-attention first within a tier', () => {
    const innerFriends = [
      makeFriend('a', 'Ari', 88, 'InnerCircle'),
      makeFriend('b', 'Bo', 87, 'InnerCircle'),
      makeFriend('c', 'Cy', 86, 'InnerCircle'),
      makeFriend('d', 'Dee', 85, 'InnerCircle'),
      makeFriend('e', 'Eli', 60, 'InnerCircle'),
    ];

    const ranked = rankFriendsByNeedsAttention(innerFriends);

    // "Yellow" style friend in Inner Circle (score 60) rises above greener friends.
    expect(ranked[0].id).toBe('e');
  });

  it('uses oldest lastUpdated as tie-breaker when severity and score match', () => {
    const sameScore = [
      makeFriend('newer', 'Newer', 28, 'Community', '2026-02-03T00:00:00.000Z'),
      makeFriend('older', 'Older', 28, 'Community', '2026-01-20T00:00:00.000Z'),
    ];

    const ranked = rankFriendsByNeedsAttention(sameScore);

    expect(ranked[0].id).toBe('older');
    expect(ranked[1].id).toBe('newer');
  });
});
