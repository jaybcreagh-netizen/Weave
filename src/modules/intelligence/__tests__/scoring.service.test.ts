import { calculatePointsForWeave, calculateGroupDilution, calculateEventMultiplier } from '../services/scoring.service';
import FriendModel from '@/db/models/Friend';
import { InteractionFormData } from '@/stores/interactionStore';
import { Archetype, Duration, Vibe, InteractionCategory } from '@/components/types';
import * as qualityService from '../services/quality.service';

// Mock the quality service to isolate scoring logic
jest.mock('../services/quality.service', () => ({
  calculateInteractionQuality: jest.fn(),
}));

// Mock the insights module to prevent DB initialization issues
jest.mock('@/modules/insights', () => ({
  getLearnedEffectiveness: jest.fn().mockReturnValue(1.0),
}));

describe('Scoring Service', () => {
  let mockFriend: FriendModel;

  beforeEach(() => {
    // Reset mock before each test
    (qualityService.calculateInteractionQuality as jest.Mock).mockReturnValue({ overallQuality: 3 }); // Neutral quality

    mockFriend = {
      archetype: 'Emperor',
      momentumScore: 0,
      momentumLastUpdated: new Date(0), // A long time ago
      outcomeCount: 0, // No learned effectiveness by default
    } as FriendModel;
  });

  describe('calculatePointsForWeave', () => {
    it('calculates a baseline score correctly with neutral modifiers', () => {
      const interactionData = {
        category: 'meal-drink',
        duration: 'Standard',
        vibe: 'WaxingCrescent',
        groupSize: 1,
      } as InteractionFormData;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      expect(points).toBeCloseTo(25.652);
    });

    it('applies a positive vibe multiplier correctly', () => {
      const interactionData = {
        category: 'meal-drink',
        duration: 'Standard',
        vibe: 'FullMoon', // 1.3x multiplier
        groupSize: 1,
      } as InteractionFormData;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      expect(points).toBeCloseTo(33.3476);
    });

    it('applies a duration modifier correctly', () => {
      const interactionData = {
        category: 'meal-drink',
        duration: 'Extended', // 1.2x modifier
        vibe: 'WaxingCrescent',
        groupSize: 1,
      } as InteractionFormData;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      expect(points).toBeCloseTo(30.7824);
    });

    it('applies a different archetype multiplier correctly', () => {
      mockFriend.archetype = 'Fool';
      const interactionData = {
        category: 'meal-drink',
        duration: 'Standard',
        vibe: 'WaxingCrescent',
        groupSize: 1,
      } as InteractionFormData;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      expect(points).toBeCloseTo(23.32);
    });

    it('applies group dilution correctly', () => {
      const interactionData = {
        category: 'meal-drink',
        duration: 'Standard',
        vibe: 'WaxingCrescent',
        groupSize: 4, // 0.7x dilution
      } as InteractionFormData;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      expect(points).toBeCloseTo(17.9564);
    });

    it('applies an event multiplier for celebrations', () => {
      const interactionData = {
        category: 'celebration',
        duration: 'Standard',
        vibe: 'WaxingCrescent',
        groupSize: 1,
        eventImportance: 'high', // 1.3x multiplier
      } as InteractionFormData;
      mockFriend.archetype = 'Sun';

      const points = calculatePointsForWeave(mockFriend, interactionData);
      expect(points).toBeCloseTo(57.3248);
    });

    it('applies a quality multiplier', () => {
      (qualityService.calculateInteractionQuality as jest.Mock).mockReturnValue({ overallQuality: 5 }); // High quality -> 1.3x multiplier

      const interactionData = {
        category: 'meal-drink',
        duration: 'Standard',
        vibe: 'WaxingCrescent',
        groupSize: 1,
      } as InteractionFormData;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      expect(points).toBeCloseTo(31.46);
    });

    it('restores some points from group dilution with high quality', () => {
      (qualityService.calculateInteractionQuality as jest.Mock).mockReturnValue({ overallQuality: 4 }); // High quality

      const interactionData = {
        category: 'meal-drink',
        duration: 'Standard',
        vibe: 'WaxingCrescent',
        groupSize: 4, // 0.7x dilution
      } as InteractionFormData;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      expect(points).toBeCloseTo(21.70256);
    });
  });

  describe('calculateGroupDilution', () => {
    it('returns 1.0 for a group of 1', () => expect(calculateGroupDilution(1)).toBe(1.0));
    it('returns 0.9 for a group of 2', () => expect(calculateGroupDilution(2)).toBe(0.9));
    it('returns 0.7 for a group of 4', () => expect(calculateGroupDilution(4)).toBe(0.7));
    it('returns 0.5 for a group of 7', () => expect(calculateGroupDilution(7)).toBe(0.5));
    it('returns 0.3 for a group of 8 or more', () => expect(calculateGroupDilution(8)).toBe(0.3));
  });

  describe('calculateEventMultiplier', () => {
    it('returns 1.0 for a standard interaction', () => {
      expect(calculateEventMultiplier('meal-drink', 'medium')).toBe(1.0);
    });
    it('returns 1.5 for a critical celebration', () => {
      expect(calculateEventMultiplier('celebration', 'critical')).toBe(1.5);
    });
    it('returns 1.4 for critical support', () => {
      expect(calculateEventMultiplier('favor-support', 'critical')).toBe(1.4);
    });
    it('returns 1.2 for a deep talk during a high-importance event', () => {
      expect(calculateEventMultiplier('deep-talk', 'high')).toBe(1.2);
    });
  });
});
