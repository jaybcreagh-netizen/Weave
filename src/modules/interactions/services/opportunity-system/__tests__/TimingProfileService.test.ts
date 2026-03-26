import {
  deriveTimingProfile,
  trimAppOpenTelemetry,
} from '../TimingProfileService';

describe('TimingProfileService', () => {
  it('trims app-open telemetry to the rolling lookback window', () => {
    const now = Date.UTC(2026, 2, 23, 12, 0, 0);
    const fortyDaysAgo = now - (40 * 24 * 60 * 60 * 1000);
    const tenDaysAgo = now - (10 * 24 * 60 * 60 * 1000);

    expect(trimAppOpenTelemetry([fortyDaysAgo, tenDaysAgo], now)).toEqual([tenDaysAgo]);
  });

  it('derives peak windows and dead zones from app opens and surfacing telemetry', () => {
    const now = Date.UTC(2026, 2, 23, 20, 0, 0);
    const eveningOne = Date.UTC(2026, 2, 20, 18, 30, 0);
    const eveningTwo = Date.UTC(2026, 2, 21, 19, 0, 0);
    const morningOne = Date.UTC(2026, 2, 20, 8, 0, 0);
    const morningTwo = Date.UTC(2026, 2, 21, 8, 30, 0);

    const profile = deriveTimingProfile({
      appOpenTimestamps: [eveningOne, eveningTwo, morningOne, morningTwo],
      surfacingEvents: [
        { eventType: 'surfaced', timestamp: eveningOne, window: 'evening' },
        { eventType: 'acted', timestamp: eveningOne + 15 * 60 * 1000, window: 'evening' },
        { eventType: 'surfaced', timestamp: eveningTwo, window: 'evening' },
        { eventType: 'acted', timestamp: eveningTwo + 20 * 60 * 1000, window: 'evening' },
        { eventType: 'surfaced', timestamp: morningOne, window: 'morning' },
        { eventType: 'dismissed', timestamp: morningOne + 10 * 60 * 1000, window: 'morning' },
        { eventType: 'surfaced', timestamp: morningTwo, window: 'morning' },
        { eventType: 'dismissed', timestamp: morningTwo + 10 * 60 * 1000, window: 'morning' },
        { eventType: 'surfaced', timestamp: morningTwo + 60 * 60 * 1000, window: 'morning' },
        { eventType: 'dismissed', timestamp: morningTwo + 70 * 60 * 1000, window: 'morning' },
      ],
      now,
    });

    expect(profile.preferredWindows).toContain('evening');
    expect(profile.bestResponseWindow).toBe('evening');
    expect(profile.deadZones).toContain('morning');
    expect(profile.windowStats?.evening.acted).toBe(2);
    expect(profile.windowStats?.morning.dismissed).toBe(3);
    expect(profile.sampleSize).toBe(14);
  });
});
