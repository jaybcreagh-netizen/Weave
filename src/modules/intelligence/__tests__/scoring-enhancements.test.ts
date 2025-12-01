import { calculatePointsForWeave } from '../services/scoring.service';
import FriendModel from '@/db/models/Friend';
import { VibeMultipliers } from '../constants';
import { getLearnedEffectiveness } from '@/modules/insights';

jest.mock('@/modules/insights', () => ({
    getLearnedEffectiveness: jest.fn().mockReturnValue(1.0),
}));

// Mock FriendModel
const mockFriend = {
    id: 'test-friend',
    archetype: 'Sun',
    momentumScore: 0,
    momentumLastUpdated: new Date(),
    outcomeCount: 0,
} as unknown as FriendModel;

describe('Scoring Enhancements', () => {
    describe('Vibe Multipliers', () => {
        it('should apply higher multiplier for FullMoon (5/5) vibe', () => {
            const points = calculatePointsForWeave(mockFriend, {
                category: 'text-call',
                duration: 'Standard',
                vibe: 'FullMoon',
                interactionHistoryCount: 0,
            });

            // Base: 10 (text-call) * 1.0 (Sun archetype) * 1.0 (Standard duration) = 10
            // Multiplier: 1.5 (FullMoon)
            // Expected: 15
            // Quality multiplier (default neutral): 1.0
            // Total: 15

            // Note: There might be slight variations due to quality calculation defaults, 
            // but we expect it to be significantly higher than the old 1.3x (which would be 13)
            expect(points).toBeGreaterThan(14);
        });

        it('should apply lower multiplier for NewMoon (1/5) vibe', () => {
            const points = calculatePointsForWeave(mockFriend, {
                category: 'text-call',
                duration: 'Standard',
                vibe: 'NewMoon',
                interactionHistoryCount: 0,
            });

            // Base: 10
            // Multiplier: 0.8 (NewMoon)
            // Expected: 8
            expect(points).toBeLessThan(9);
        });
    });

    describe('Affinity Bonus', () => {
        it('should apply 1.15x bonus when interaction history count is >= 5', () => {
            const pointsNormal = calculatePointsForWeave(mockFriend, {
                category: 'text-call',
                duration: 'Standard',
                vibe: 'WaxingCrescent', // 1.0 multiplier
                interactionHistoryCount: 4,
            });

            const pointsBonus = calculatePointsForWeave(mockFriend, {
                category: 'text-call',
                duration: 'Standard',
                vibe: 'WaxingCrescent', // 1.0 multiplier
                interactionHistoryCount: 5,
            });

            // pointsBonus should be approx 1.15x of pointsNormal
            const ratio = pointsBonus / pointsNormal;
            expect(ratio).toBeCloseTo(1.15, 1);
        });

        it('should not apply bonus when interaction history count is < 5', () => {
            const pointsLowHistory = calculatePointsForWeave(mockFriend, {
                category: 'text-call',
                duration: 'Standard',
                vibe: 'WaxingCrescent',
                interactionHistoryCount: 1,
            });

            const pointsThreshold = calculatePointsForWeave(mockFriend, {
                category: 'text-call',
                duration: 'Standard',
                vibe: 'WaxingCrescent',
                interactionHistoryCount: 4,
            });

            // Should be equal as neither gets bonus
            expect(pointsLowHistory).toBeCloseTo(pointsThreshold, 1);
        });
    });
});
