import { applyDecay, calculateDecayAmount } from '../services/decay.service';
import FriendModel from '@/db/models/Friend';
import { Tier } from '@/components/types';

// Helper to create a date in the past
const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

describe('Decay Service', () => {
  let mockFriend: Partial<FriendModel>;

  beforeEach(() => {
    mockFriend = {
      weaveScore: 80,
      dunbarTier: 'CloseFriends', // Tolerance window: 14 days
      resilience: 1.0,
    };
  });

  describe('calculateDecayAmount', () => {
    it('calculates decay for arbitrary days correctly', () => {
      // 10 days (within limit) 
      // 10 * 1.5 * 0.5 = 7.5
      expect(calculateDecayAmount(mockFriend as FriendModel, 10)).toBeCloseTo(7.5);
    });

    it('calculates accelerated decay correctly', () => {
      // 20 days (6 days over limit)
      // Base: 10.5, Accel: 13.5 -> 24
      expect(calculateDecayAmount(mockFriend as FriendModel, 20)).toBeCloseTo(24);
    });

    it('returns 0 for negative or zero days', () => {
      expect(calculateDecayAmount(mockFriend as FriendModel, 0)).toBe(0);
      expect(calculateDecayAmount(mockFriend as FriendModel, -5)).toBe(0);
    });
  });

  describe('applyDecay', () => {
    it('applies no decay if last update was today', () => {
      mockFriend.lastUpdated = daysAgo(0);
      const newScore = applyDecay(mockFriend as FriendModel);
      expect(newScore).toBeCloseTo(80);
    });

    it('applies minimal decay within the tolerance window', () => {
      mockFriend.lastUpdated = daysAgo(10); // 10 days ago, within 14-day window
      const newScore = applyDecay(mockFriend as FriendModel);
      // Decay rate for CloseFriends is 1.5
      // Within tolerance, decay is half: 1.5 * 0.5 = 0.75 per day
      // Total decay: 10 * 0.75 = 7.5
      // Expected score: 80 - 7.5 = 72.5
      expect(newScore).toBeCloseTo(72.5);
    });

    it('applies accelerated decay outside the tolerance window', () => {
      mockFriend.lastUpdated = daysAgo(20); // 20 days ago, 6 days past 14-day window
      const newScore = applyDecay(mockFriend as FriendModel);
      // Base decay for 14 days: 14 * (1.5 * 0.5) = 10.5
      // Accelerated decay for 6 days: 6 * (1.5 * 1.5) = 13.5
      // Total decay: 10.5 + 13.5 = 24
      // Expected score: 80 - 24 = 56
      expect(newScore).toBeCloseTo(56);
    });

    it('calculates decay correctly for InnerCircle tier', () => {
      mockFriend.dunbarTier = 'InnerCircle'; // Tolerance: 7 days, Decay Rate: 2.5
      mockFriend.lastUpdated = daysAgo(10); // 3 days past window
      const newScore = applyDecay(mockFriend as FriendModel);
      // Base decay: 7 * (2.5 * 0.5) = 8.75
      // Accelerated decay: 3 * (2.5 * 1.5) = 11.25
      // Total decay: 8.75 + 11.25 = 20
      // Expected score: 80 - 20 = 60
      expect(newScore).toBeCloseTo(60);
    });

    it('uses a learned tolerance window if available', () => {
      mockFriend.toleranceWindowDays = 30; // Custom learned pattern
      mockFriend.lastUpdated = daysAgo(20); // Still within the learned window
      const newScore = applyDecay(mockFriend as FriendModel);
      // Should use minimal decay rate
      // Total decay: 20 * (1.5 * 0.5) = 15
      // Expected score: 80 - 15 = 65
      expect(newScore).toBeCloseTo(65);
    });

    it('is mitigated by higher resilience', () => {
      mockFriend.resilience = 1.5; // High resilience
      mockFriend.lastUpdated = daysAgo(10); // Within window
      const newScore = applyDecay(mockFriend as FriendModel);
      // Base decay was 7.5, with resilience it should be 7.5 / 1.5 = 5
      // Expected score: 80 - 5 = 75
      expect(newScore).toBeCloseTo(75);
    });

    it('is amplified by lower resilience', () => {
      mockFriend.resilience = 0.8; // Low resilience
      mockFriend.lastUpdated = daysAgo(10); // Within window
      const newScore = applyDecay(mockFriend as FriendModel);
      // Base decay was 7.5, with resilience it should be 7.5 / 0.8 = 9.375
      // Expected score: 80 - 9.375 = 70.625
      expect(newScore).toBeCloseTo(70.625);
    });

    it('never drops the score below zero', () => {
      mockFriend.weaveScore = 10;
      mockFriend.lastUpdated = daysAgo(30); // High decay
      const newScore = applyDecay(mockFriend as FriendModel);
      expect(newScore).toBe(0);
    });
  });
});
