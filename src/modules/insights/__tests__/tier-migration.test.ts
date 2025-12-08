import { TierMigrationConfig, EffectivenessLearningConfig } from '@/modules/intelligence/constants';

// Mock database
jest.mock('@/db', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(),
  },
}));

describe('Tier Migration Configuration', () => {
  describe('TierMigrationConfig', () => {
    it('has reasonable soft suggestion threshold', () => {
      // Soft suggestions should appear after a reasonable period
      expect(TierMigrationConfig.daysForSoftSuggestion).toBeGreaterThanOrEqual(14);
      expect(TierMigrationConfig.daysForSoftSuggestion).toBeLessThanOrEqual(60);
    });

    it('has strong suggestion threshold longer than soft', () => {
      expect(TierMigrationConfig.daysForStrongSuggestion).toBeGreaterThan(
        TierMigrationConfig.daysForSoftSuggestion
      );
    });

    it('has valid mismatch threshold', () => {
      // Mismatch threshold should be between 0 and 1
      expect(TierMigrationConfig.mismatchThreshold).toBeGreaterThan(0);
      expect(TierMigrationConfig.mismatchThreshold).toBeLessThan(1);
    });

    it('has reasonable migration ratios', () => {
      // Upward migration: connecting significantly more frequently
      expect(TierMigrationConfig.upwardMigrationRatio).toBeLessThan(1);
      expect(TierMigrationConfig.upwardMigrationRatio).toBeGreaterThan(0);

      // Downward migration: connecting significantly less frequently
      expect(TierMigrationConfig.downwardMigrationRatio).toBeGreaterThan(1);
    });

    it('has sufficient cooldown period', () => {
      // Cooldown should prevent suggestion fatigue
      expect(TierMigrationConfig.dismissalCooldownDays).toBeGreaterThanOrEqual(30);
    });
  });

  describe('Migration Direction Logic', () => {
    it('correctly identifies upward migration scenarios', () => {
      const { upwardMigrationRatio } = TierMigrationConfig;

      // Community friend connecting every 10 days (expected 28)
      const communityRatio = 10 / 28; // ~0.36
      expect(communityRatio).toBeLessThan(upwardMigrationRatio);

      // Close Friends connecting every 5 days (expected 14)
      const closeFriendsRatio = 5 / 14; // ~0.36
      expect(closeFriendsRatio).toBeLessThan(upwardMigrationRatio);
    });

    it('correctly identifies downward migration scenarios', () => {
      const { downwardMigrationRatio } = TierMigrationConfig;

      // Inner Circle friend connecting every 20 days (expected 7)
      const innerCircleRatio = 20 / 7; // ~2.86
      expect(innerCircleRatio).toBeGreaterThan(downwardMigrationRatio);

      // Close Friends connecting every 35 days (expected 14)
      const closeFriendsRatio = 35 / 14; // 2.5
      expect(closeFriendsRatio).toBeGreaterThan(downwardMigrationRatio);
    });

    it('correctly identifies stable scenarios (no migration needed)', () => {
      const { upwardMigrationRatio, downwardMigrationRatio } = TierMigrationConfig;

      // Inner Circle friend connecting every 7 days (expected 7) - perfect
      const perfectRatio = 7 / 7; // 1.0
      expect(perfectRatio).toBeGreaterThanOrEqual(upwardMigrationRatio);
      expect(perfectRatio).toBeLessThanOrEqual(downwardMigrationRatio);

      // Slightly off but within tolerance
      const slightlyOffRatio = 10 / 7; // ~1.43
      expect(slightlyOffRatio).toBeGreaterThanOrEqual(upwardMigrationRatio);
      expect(slightlyOffRatio).toBeLessThanOrEqual(downwardMigrationRatio);
    });
  });
});

describe('Effectiveness Learning Configuration', () => {
  it('has initial alpha higher than base alpha', () => {
    expect(EffectivenessLearningConfig.initialAlpha).toBeGreaterThan(
      EffectivenessLearningConfig.baseAlpha
    );
  });

  it('has reasonable fast learning threshold', () => {
    expect(EffectivenessLearningConfig.fastLearningThreshold).toBeGreaterThanOrEqual(5);
    expect(EffectivenessLearningConfig.fastLearningThreshold).toBeLessThanOrEqual(20);
  });

  it('has reasonable effectiveness bounds', () => {
    // Floor and ceiling should be symmetric around 1.0
    expect(EffectivenessLearningConfig.effectivenessFloor).toBeLessThan(1);
    expect(EffectivenessLearningConfig.effectivenessCeiling).toBeGreaterThan(1);

    // Should allow meaningful variation
    expect(EffectivenessLearningConfig.effectivenessCeiling - EffectivenessLearningConfig.effectivenessFloor).toBeGreaterThan(0.5);
  });

  it('has minimum outcomes before use', () => {
    expect(EffectivenessLearningConfig.minOutcomesForUse).toBeGreaterThanOrEqual(2);
    expect(EffectivenessLearningConfig.minOutcomesForUse).toBeLessThan(
      EffectivenessLearningConfig.fastLearningThreshold
    );
  });
});
