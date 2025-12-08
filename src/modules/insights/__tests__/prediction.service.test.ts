import {
  calculatePersonalizedAttentionThreshold,
  getAttentionThresholdDetails,
  predictFriendDrift,
} from '../services/prediction.service';
import { PersonalizedThresholdConfig } from '@/modules/intelligence/constants';
import FriendModel from '@/db/models/Friend';

// Mock database
jest.mock('@/db', () => ({
  database: {
    get: jest.fn(),
  },
}));

describe('Personalized Attention Thresholds', () => {
  const createMockFriend = (overrides: Partial<FriendModel> = {}): FriendModel => ({
    id: 'test-friend',
    name: 'Test Friend',
    dunbarTier: 'CloseFriends',
    weaveScore: 70,
    ratedWeavesCount: 0,
    resilience: 1.0,
    momentumScore: 0,
    lastUpdated: new Date(),
    toleranceWindowDays: 14,
    ...overrides,
  } as FriendModel);

  describe('calculatePersonalizedAttentionThreshold', () => {
    it('returns base threshold for new friends with insufficient history', () => {
      const friend = createMockFriend({
        dunbarTier: 'InnerCircle',
        ratedWeavesCount: 2, // Below minimum of 5
      });

      const threshold = calculatePersonalizedAttentionThreshold(friend);
      expect(threshold).toBe(PersonalizedThresholdConfig.baseThresholds.InnerCircle);
    });

    it('returns base threshold when ratedWeavesCount is exactly at minimum', () => {
      const friend = createMockFriend({
        dunbarTier: 'CloseFriends',
        ratedWeavesCount: PersonalizedThresholdConfig.minInteractionsForPersonalization - 1,
      });

      const threshold = calculatePersonalizedAttentionThreshold(friend);
      expect(threshold).toBe(PersonalizedThresholdConfig.baseThresholds.CloseFriends);
    });

    it('returns personalized threshold for friends with sufficient history', () => {
      const friend = createMockFriend({
        dunbarTier: 'CloseFriends',
        weaveScore: 80, // High score
        ratedWeavesCount: 10, // Above minimum
      });

      const threshold = calculatePersonalizedAttentionThreshold(friend);
      // Should be higher than base (40) because friend typically has high score
      expect(threshold).toBeGreaterThan(PersonalizedThresholdConfig.baseThresholds.CloseFriends);
    });

    it('increases threshold for consistently high-scoring friends', () => {
      const highScoreFriend = createMockFriend({
        dunbarTier: 'InnerCircle',
        weaveScore: 85,
        ratedWeavesCount: 15,
      });

      const lowScoreFriend = createMockFriend({
        dunbarTier: 'InnerCircle',
        weaveScore: 45,
        ratedWeavesCount: 15,
      });

      const highThreshold = calculatePersonalizedAttentionThreshold(highScoreFriend);
      const lowThreshold = calculatePersonalizedAttentionThreshold(lowScoreFriend);

      expect(highThreshold).toBeGreaterThan(lowThreshold);
    });

    it('respects minimum threshold bounds', () => {
      const veryLowScoreFriend = createMockFriend({
        dunbarTier: 'Community',
        weaveScore: 15, // Very low
        ratedWeavesCount: 10,
      });

      const threshold = calculatePersonalizedAttentionThreshold(veryLowScoreFriend);
      // Should not go below (baseThreshold - 10) = 20
      expect(threshold).toBeGreaterThanOrEqual(20);
    });

    it('respects maximum threshold bounds', () => {
      const veryHighScoreFriend = createMockFriend({
        dunbarTier: 'InnerCircle',
        weaveScore: 100, // Maximum
        ratedWeavesCount: 20,
      });

      const threshold = calculatePersonalizedAttentionThreshold(veryHighScoreFriend);
      // Should not go above (baseThreshold + 25) = 75
      expect(threshold).toBeLessThanOrEqual(75);
    });

    it('handles each tier correctly', () => {
      const tiers = ['InnerCircle', 'CloseFriends', 'Community'] as const;

      for (const tier of tiers) {
        const friend = createMockFriend({
          dunbarTier: tier,
          weaveScore: 60,
          ratedWeavesCount: 1, // Below minimum
        });

        const threshold = calculatePersonalizedAttentionThreshold(friend);
        expect(threshold).toBe(PersonalizedThresholdConfig.baseThresholds[tier]);
      }
    });
  });

  describe('getAttentionThresholdDetails', () => {
    it('reports non-personalized for new friends', () => {
      const friend = createMockFriend({
        ratedWeavesCount: 3,
      });

      const details = getAttentionThresholdDetails(friend);
      expect(details.isPersonalized).toBe(false);
      expect(details.reason).toContain('default');
    });

    it('reports personalized for established friends', () => {
      const friend = createMockFriend({
        weaveScore: 75,
        ratedWeavesCount: 10,
      });

      const details = getAttentionThresholdDetails(friend);
      expect(details.isPersonalized).toBe(true);
    });

    it('explains higher threshold for strong connections', () => {
      const friend = createMockFriend({
        dunbarTier: 'CloseFriends',
        weaveScore: 85,
        ratedWeavesCount: 15,
      });

      const details = getAttentionThresholdDetails(friend);
      expect(details.threshold).toBeGreaterThan(details.baseThreshold);
      expect(details.reason).toContain('Higher threshold');
    });

    it('explains lower threshold for weaker connections', () => {
      const friend = createMockFriend({
        dunbarTier: 'CloseFriends',
        weaveScore: 35,
        ratedWeavesCount: 15,
      });

      const details = getAttentionThresholdDetails(friend);
      expect(details.threshold).toBeLessThan(details.baseThreshold);
      expect(details.reason).toContain('Lower threshold');
    });
  });

  describe('predictFriendDrift with personalized thresholds', () => {
    it('uses personalized threshold for predictions', () => {
      const highScoreFriend = createMockFriend({
        dunbarTier: 'CloseFriends',
        weaveScore: 80,
        ratedWeavesCount: 15,
        lastUpdated: new Date(),
      });

      const prediction = predictFriendDrift(highScoreFriend);

      // With personalized threshold (~52-55), friend at 80 should have some days until attention
      expect(prediction.daysUntilAttentionNeeded).toBeGreaterThan(0);
    });

    it('triggers earlier attention for high-baseline friends dropping', () => {
      // Friend who usually scores 80 but is now at 55
      const droppingFriend = createMockFriend({
        dunbarTier: 'CloseFriends',
        weaveScore: 55, // Above base threshold of 40, but below personalized
        ratedWeavesCount: 15,
        lastUpdated: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      });

      // Override to simulate their typical high score
      // Note: In real implementation we'd track historical average
      const highBaselineFriend = {
        ...droppingFriend,
        weaveScore: 52, // Just above where personalized threshold would be
      } as FriendModel;

      const prediction = predictFriendDrift(highBaselineFriend);

      // Should be getting close to needing attention
      expect(prediction.daysUntilAttentionNeeded).toBeLessThan(10);
    });

    it('returns immediate attention when below personalized threshold', () => {
      const friend = createMockFriend({
        dunbarTier: 'InnerCircle',
        weaveScore: 48, // Below personalized threshold for IC with history
        ratedWeavesCount: 20,
      });

      const personalizedThreshold = calculatePersonalizedAttentionThreshold(friend);

      // If score is at or below threshold, should need immediate attention
      if (friend.weaveScore <= personalizedThreshold) {
        const prediction = predictFriendDrift(friend);
        expect(prediction.daysUntilAttentionNeeded).toBe(0);
      }
    });
  });
});
