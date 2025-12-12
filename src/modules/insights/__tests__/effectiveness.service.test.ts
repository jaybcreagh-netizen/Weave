import { calculateAdaptiveLearningRate } from '../services/effectiveness.service';
import { EffectivenessLearningConfig } from '@/modules/intelligence';

// Mock database
jest.mock('@/db', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(),
  },
}));

describe('Adaptive Effectiveness Learning', () => {
  describe('calculateAdaptiveLearningRate', () => {
    it('returns initial alpha for 0 outcomes', () => {
      const alpha = calculateAdaptiveLearningRate(0);
      expect(alpha).toBe(EffectivenessLearningConfig.initialAlpha);
    });

    it('returns base alpha after fastLearningThreshold outcomes', () => {
      const alpha = calculateAdaptiveLearningRate(EffectivenessLearningConfig.fastLearningThreshold);
      expect(alpha).toBe(EffectivenessLearningConfig.baseAlpha);
    });

    it('returns base alpha for outcomes beyond threshold', () => {
      const alpha = calculateAdaptiveLearningRate(20);
      expect(alpha).toBe(EffectivenessLearningConfig.baseAlpha);
    });

    it('gradually decreases from initial to base alpha', () => {
      const alphas: number[] = [];
      for (let i = 0; i <= EffectivenessLearningConfig.fastLearningThreshold; i++) {
        alphas.push(calculateAdaptiveLearningRate(i));
      }

      // Should be monotonically decreasing
      for (let i = 1; i < alphas.length; i++) {
        expect(alphas[i]).toBeLessThanOrEqual(alphas[i - 1]);
      }

      // First should be initial, last should be base
      expect(alphas[0]).toBe(EffectivenessLearningConfig.initialAlpha);
      expect(alphas[alphas.length - 1]).toBe(EffectivenessLearningConfig.baseAlpha);
    });

    it('returns midpoint alpha at halfway through fast learning', () => {
      const halfwayPoint = EffectivenessLearningConfig.fastLearningThreshold / 2;
      const alpha = calculateAdaptiveLearningRate(halfwayPoint);

      const expectedMidpoint = (EffectivenessLearningConfig.initialAlpha + EffectivenessLearningConfig.baseAlpha) / 2;
      expect(alpha).toBeCloseTo(expectedMidpoint, 2);
    });

    it('provides meaningful speed improvement early on', () => {
      // At 3 outcomes (minimum for use), alpha should still be notably higher than base
      const earlyAlpha = calculateAdaptiveLearningRate(3);
      const improvement = earlyAlpha / EffectivenessLearningConfig.baseAlpha;

      // Should be at least 40% faster learning at 3 outcomes
      expect(improvement).toBeGreaterThan(1.4);
    });
  });

  describe('Learning Rate Impact Analysis', () => {
    it('demonstrates faster convergence with adaptive alpha', () => {
      // Simulate learning a new effectiveness value of 1.5
      const targetEffectiveness = 1.5;
      const startingEffectiveness = 1.0;

      // Simulate with fixed alpha (old behavior)
      let fixedAlphaValue = startingEffectiveness;
      const fixedAlpha = 0.2;
      for (let i = 0; i < 10; i++) {
        fixedAlphaValue = fixedAlphaValue * (1 - fixedAlpha) + targetEffectiveness * fixedAlpha;
      }

      // Simulate with adaptive alpha (new behavior)
      let adaptiveAlphaValue = startingEffectiveness;
      for (let i = 0; i < 10; i++) {
        const alpha = calculateAdaptiveLearningRate(i);
        adaptiveAlphaValue = adaptiveAlphaValue * (1 - alpha) + targetEffectiveness * alpha;
      }

      // Adaptive should be closer to target after same number of iterations
      const fixedDistance = Math.abs(targetEffectiveness - fixedAlphaValue);
      const adaptiveDistance = Math.abs(targetEffectiveness - adaptiveAlphaValue);

      expect(adaptiveDistance).toBeLessThan(fixedDistance);
    });
  });
});
