import { calculateMomentumBonus, updateMomentum } from '../services/momentum.service';
import FriendModel from '@/db/models/Friend';

const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

describe('Momentum Service', () => {
  let mockFriend: Partial<FriendModel>;

  beforeEach(() => {
    mockFriend = {
      momentumScore: 15,
    };
  });

  describe('calculateMomentumBonus', () => {
    it('returns a 1.15x bonus if momentum is active', () => {
      mockFriend.momentumLastUpdated = daysAgo(5); // 5 days ago, momentum = 15 - 5 = 10 (active)
      const bonus = calculateMomentumBonus(mockFriend as FriendModel);
      expect(bonus).toBe(1.15);
    });

    it('returns a 1.0x bonus if momentum has fully decayed', () => {
      mockFriend.momentumLastUpdated = daysAgo(20); // 20 days ago, momentum = 15 - 20 = -5 (inactive)
      const bonus = calculateMomentumBonus(mockFriend as FriendModel);
      expect(bonus).toBe(1.0);
    });

    it('returns a 1.0x bonus if momentum last update is missing', () => {
      mockFriend.momentumLastUpdated = undefined;
      const bonus = calculateMomentumBonus(mockFriend as FriendModel);
      expect(bonus).toBe(1.0);
    });

    it('returns a 1.15x bonus on the last day of momentum', () => {
      mockFriend.momentumLastUpdated = daysAgo(14); // 14 days ago, momentum = 15 - 14 = 1 (still active)
      const bonus = calculateMomentumBonus(mockFriend as FriendModel);
      expect(bonus).toBe(1.15);
    });

    it('returns a 1.0x bonus the day after momentum expires', () => {
      mockFriend.momentumLastUpdated = daysAgo(15); // 15 days ago, momentum = 15 - 15 = 0 (inactive)
      const bonus = calculateMomentumBonus(mockFriend as FriendModel);
      expect(bonus).toBe(1.0);
    });
  });

  describe('updateMomentum', () => {
    it('resets the momentum score to 15', () => {
      const { momentumScore } = updateMomentum(mockFriend as FriendModel);
      expect(momentumScore).toBe(15);
    });

    it('updates the momentumLastUpdated timestamp to the current date', () => {
      const before = new Date();
      const { momentumLastUpdated } = updateMomentum(mockFriend as FriendModel);
      const after = new Date();
      // Check if the timestamp is between the time before and after the call
      expect(momentumLastUpdated.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(momentumLastUpdated.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
