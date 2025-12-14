import { calculatePointsForWeave, calculateGroupDilution, calculateEventMultiplier } from '../services/scoring.service';
import { MAX_INTERACTION_SCORE, GROUP_DILUTION_RATE, GROUP_DILUTION_FLOOR } from '../constants';
import FriendModel from '@/db/models/Friend';
import { InteractionFormData } from '@/shared/types/scoring.types';
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

// Mock the database initialization
jest.mock('@/db', () => ({
  database: {
    get: jest.fn(),
  },
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
      } as any;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      expect(points).toBeCloseTo(25.652);
    });

    it('applies a positive vibe multiplier correctly', () => {
      const interactionData = {
        category: 'meal-drink',
        duration: 'Standard',
        vibe: 'FullMoon', // 1.5x multiplier
        groupSize: 1,
      } as any;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      expect(points).toBeCloseTo(38.478);
    });

    it('applies a duration modifier correctly', () => {
      const interactionData = {
        category: 'meal-drink',
        duration: 'Extended', // 1.2x modifier
        vibe: 'WaxingCrescent',
        groupSize: 1,
      } as any;

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
      } as any;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      expect(points).toBeCloseTo(23.32);
    });

    it('applies group dilution correctly with smooth curve', () => {
      const interactionData = {
        category: 'meal-drink',
        duration: 'Standard',
        vibe: 'WaxingCrescent',
        groupSize: 4, // Smooth dilution: ~0.74x
      } as any;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      // With smooth curve: base ~25.65 * 0.74 dilution = ~19.0
      expect(points).toBeGreaterThan(17);
      expect(points).toBeLessThan(21);
    });

    it('applies an event multiplier for celebrations', () => {
      const interactionData = {
        category: 'celebration',
        duration: 'Standard',
        vibe: 'WaxingCrescent',
        groupSize: 1,
        eventImportance: 'high', // 1.3x multiplier
      } as any;
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
      } as any;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      expect(points).toBeCloseTo(31.46);
    });

    it('restores some points from group dilution with high quality', () => {
      (qualityService.calculateInteractionQuality as jest.Mock).mockReturnValue({ overallQuality: 4 }); // High quality

      const interactionData = {
        category: 'meal-drink',
        duration: 'Standard',
        vibe: 'WaxingCrescent',
        groupSize: 4, // Smooth dilution with restoration
      } as any;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      // High quality should restore some dilution points
      // Should be higher than non-quality-restored diluted score
      expect(points).toBeGreaterThan(19);
      expect(points).toBeLessThan(26);
    });

    it('caps extremely high scores to MAX_INTERACTION_SCORE', () => {
      (qualityService.calculateInteractionQuality as jest.Mock).mockReturnValue({ overallQuality: 5 }); // Max quality

      // Set up friend with momentum for maximum possible score
      mockFriend.momentumScore = 15;
      mockFriend.momentumLastUpdated = new Date();
      mockFriend.archetype = 'Sun'; // High multiplier for celebrations

      const interactionData = {
        category: 'celebration', // Highest base score (32)
        duration: 'Extended',    // 1.2x
        vibe: 'FullMoon',        // 1.5x
        groupSize: 1,
        eventImportance: 'critical', // 1.5x
        interactionHistoryCount: 10, // 1.15x affinity
      } as any;

      const points = calculatePointsForWeave(mockFriend, interactionData);
      // Without cap this would be ~120+ points, but should be capped at MAX_INTERACTION_SCORE
      expect(points).toBeLessThanOrEqual(MAX_INTERACTION_SCORE);
      expect(points).toBe(MAX_INTERACTION_SCORE);
    });
  });

  describe('calculateGroupDilution (smooth curve)', () => {
    it('returns 1.0 for a group of 1', () => {
      expect(calculateGroupDilution(1)).toBe(1.0);
    });

    it('returns ~0.87 for a group of 2 (smooth decay)', () => {
      const dilution = calculateGroupDilution(2);
      expect(dilution).toBeGreaterThan(0.85);
      expect(dilution).toBeLessThan(0.90);
    });

    it('returns ~0.74 for a group of 4 (gradual transition from 3)', () => {
      const dilution3 = calculateGroupDilution(3);
      const dilution4 = calculateGroupDilution(4);
      // Group of 4 should have slightly more dilution than group of 3
      expect(dilution4).toBeLessThan(dilution3);
      expect(dilution4).toBeGreaterThan(0.70);
      expect(dilution4).toBeLessThan(0.78);
    });

    it('returns ~0.58 for a group of 8 (continuous curve)', () => {
      const dilution = calculateGroupDilution(8);
      expect(dilution).toBeGreaterThan(0.55);
      expect(dilution).toBeLessThan(0.62);
    });

    it('has continuous values between group sizes (no discrete jumps)', () => {
      // Verify smooth curve - each increment should produce slightly lower value
      const dilutions = [1, 2, 3, 4, 5, 6, 7, 8].map(calculateGroupDilution);
      for (let i = 1; i < dilutions.length; i++) {
        // Each larger group should have slightly more dilution (lower factor)
        expect(dilutions[i]).toBeLessThan(dilutions[i - 1]);
        // But the difference should be gradual, not a sharp jump
        const diff = dilutions[i - 1] - dilutions[i];
        expect(diff).toBeLessThan(0.15); // No jump greater than 15%
      }
    });

    it('respects GROUP_DILUTION_FLOOR for very large groups', () => {
      expect(calculateGroupDilution(50)).toBeGreaterThanOrEqual(GROUP_DILUTION_FLOOR);
      expect(calculateGroupDilution(100)).toBeGreaterThanOrEqual(GROUP_DILUTION_FLOOR);
    });

    it('handles edge cases (0 or negative)', () => {
      expect(calculateGroupDilution(0)).toBe(1.0);
      expect(calculateGroupDilution(-1)).toBe(1.0);
    });
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
