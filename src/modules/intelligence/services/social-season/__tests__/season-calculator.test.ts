import { calculateSeasonScore } from '../season-calculator';
import { SeasonCalculationInput } from '../season-types';

describe('season-calculator', () => {
    const baseInput: SeasonCalculationInput = {
        weavesLast7Days: 10, // High activity (should result in high score normally)
        weavesLast30Days: 20,
        avgScoreAllFriends: 80,
        avgScoreInnerCircle: 90,
        momentumCount: 5,
        batteryLast7DaysAvg: 4, // High battery
        batteryTrend: 'stable',
    };

    it('should calculate high score for high activity and high battery', () => {
        const score = calculateSeasonScore(baseInput);
        expect(score).toBeGreaterThan(80); // Should be Blooming
    });

    it('should cap at Balanced (75) when battery is < 2.5 (Pre-Burnout)', () => {
        const input = {
            ...baseInput,
            batteryLast7DaysAvg: 2.4, // Pre-burnout
        };
        const score = calculateSeasonScore(input);
        expect(score).toBeLessThanOrEqual(75);
    });

    it('should force score to 0 (Deep Resting) when battery is < 1.8 (Critical Burnout)', () => {
        const input = {
            ...baseInput,
            batteryLast7DaysAvg: 1.7, // Critical burnout
        };
        const score = calculateSeasonScore(input);
        expect(score).toBe(0);
    });

    it('should not affect score if battery is null', () => {
        const input = {
            ...baseInput,
            batteryLast7DaysAvg: null,
        };
        const score = calculateSeasonScore(input);
        // Should use default battery score (60)
        // Activity score is maxed (High inputs): ~40 + 20 + 30 + 10 = ~100 capped
        // Battery score default is 60.
        // Final: 100 * 0.6 + 60 * 0.4 = 60 + 24 = 84.
        expect(score).toBeGreaterThan(80);
    });
});
