import { applyDecay, calculateDecayAmount } from '../services/decay.service';
import FriendModel from '@/db/models/Friend';
import { Tier } from '@/shared/types/legacy-types';

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
      dunbarTier: 'CloseFriends', // Base rate 1.5
      resilience: 1.0,
      archetype: 'Unknown', // Grace period 7 days, mod 1.0
      lastUpdated: daysAgo(0),
    };
  });

  describe('calculateDecayAmount', () => {
    it('uses the provided days argument for grace checks (backfill-safe)', () => {
      // lastUpdated is very old, but calculation should respect passed `days`
      // so this remains in grace period (Unknown grace = 7 days).
      mockFriend.lastUpdated = daysAgo(100);
      expect(calculateDecayAmount(mockFriend as FriendModel, 3)).toBe(0);
    });

    it('applies season decay multipliers when provided', () => {
      mockFriend.lastUpdated = daysAgo(10);

      const balancedDecay = calculateDecayAmount(
        mockFriend as FriendModel,
        10,
        'balanced',
        true,
        'balanced'
      );
      const restingDecay = calculateDecayAmount(
        mockFriend as FriendModel,
        10,
        'balanced',
        true,
        'resting'
      );

      expect(restingDecay).toBeLessThan(balancedDecay);
      expect(restingDecay).toBeCloseTo(11.25);
      expect(balancedDecay).toBeCloseTo(15);
    });

    it('calculates full decay when outside grace period', () => {
      // 10 days (outside grace of 7)
      // Rate: 1.5 (CloseFriends) * 1.0 (Archetype) * 1.0 (Zone) = 1.5
      // Amount: 10 * 1.5 = 15
      mockFriend.lastUpdated = daysAgo(10);
      expect(calculateDecayAmount(mockFriend as FriendModel, 10)).toBeCloseTo(15);
    });

    it('returns 0 when inside grace period', () => {
      // 5 days (inside grace of 7)
      mockFriend.lastUpdated = daysAgo(5);
      expect(calculateDecayAmount(mockFriend as FriendModel, 5)).toBe(0);
    });

    it('calculates accelerated decay correctly (standard rate, no special accel anymore)', () => {
      // 20 days
      // Rate 1.5 -> 30
      mockFriend.lastUpdated = daysAgo(20);
      expect(calculateDecayAmount(mockFriend as FriendModel, 20)).toBeCloseTo(30);
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

    it('applies 0 decay within the grace period', () => {
      mockFriend.lastUpdated = daysAgo(5); // 5 days ago, within 7-day grace
      const newScore = applyDecay(mockFriend as FriendModel);
      expect(newScore).toBe(80);
    });

    it('applies full decay outside the grace period', () => {
      mockFriend.lastUpdated = daysAgo(10); // 10 days ago, past 7-day grace
      const newScore = applyDecay(mockFriend as FriendModel);
      // 10 * 1.5 = 15
      // 80 - 15 = 65
      expect(newScore).toBeCloseTo(65);
    });

    it('calculates decay correctly for InnerCircle tier', () => {
      mockFriend.dunbarTier = 'InnerCircle'; // Rate 2.5
      mockFriend.lastUpdated = daysAgo(10); // Past grace
      const newScore = applyDecay(mockFriend as FriendModel);
      // 10 * 2.5 = 25
      // 80 - 25 = 55
      expect(newScore).toBeCloseTo(55);
    });

    it('is mitigated by higher resilience', () => {
      mockFriend.resilience = 1.5; // High resilience should slow decay
      mockFriend.lastUpdated = daysAgo(10);
      const newScore = applyDecay(mockFriend as FriendModel);
      // 10 days * 1.5 base * (1 / 1.5 resilience modifier) = 10 decay
      // 80 - 10 = 70
      expect(newScore).toBeCloseTo(70);
    });

    it('never drops the score below zero', () => {
      mockFriend.weaveScore = 10;
      mockFriend.lastUpdated = daysAgo(100); // High decay (100 days ensures even slow decay reaches 0)
      const newScore = applyDecay(mockFriend as FriendModel);
      expect(newScore).toBe(0);
    });
  });
});
