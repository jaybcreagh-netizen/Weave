import {
  deriveSelectorTuningFromEvents,
  clearSelectorTuningCache,
  type SelectorTuningEvent,
} from '../SelectorTuningService';

function createSurfacedEvent(
  opportunityPoolId: string,
  timestamp: number,
  overrides: Partial<SelectorTuningEvent> = {}
): SelectorTuningEvent {
  return {
    opportunityPoolId,
    eventType: 'surfaced',
    timestamp,
    compositeScore: 42,
    scoreBreakdown: {
      urgency: 18,
      scheduleFit: 10,
      batterySeasonFit: 5,
      intentionAlignment: 3,
      whyNowStrength: 2,
      noveltyDiversity: 2,
      confidence: 2,
    },
    surfaceSource: 'selector',
    surfaceSlot: 'primary',
    ...overrides,
  };
}

function createOutcomeEvent(
  opportunityPoolId: string,
  timestamp: number,
  eventType: SelectorTuningEvent['eventType']
): SelectorTuningEvent {
  return {
    opportunityPoolId,
    eventType,
    timestamp,
  };
}

describe('SelectorTuningService', () => {
  afterEach(() => {
    clearSelectorTuningCache();
  });

  it('falls back to default selector config when telemetry is too sparse', () => {
    const now = Date.UTC(2026, 2, 24, 12, 0, 0);
    const result = deriveSelectorTuningFromEvents([
      createSurfacedEvent('opp-1', now - 1000),
      createOutcomeEvent('opp-1', now - 500, 'acted'),
    ], now);

    expect(result.source).toBe('default');
    expect(result.selectionConfig.minThreshold).toBe(35);
    expect(result.weights.urgency).toBe(30);
  });

  it('raises the threshold and rebalances weights when low-score selector outcomes trend negative', () => {
    const now = Date.UTC(2026, 2, 24, 12, 0, 0);
    const events: SelectorTuningEvent[] = [];

    for (let index = 0; index < 8; index += 1) {
      events.push(createSurfacedEvent(
        `acted-${index}`,
        now - ((index + 1) * 10_000),
        {
          compositeScore: 52,
          scoreBreakdown: {
            urgency: 14,
            scheduleFit: 18,
            batterySeasonFit: 10,
            intentionAlignment: 11,
            whyNowStrength: 7,
            noveltyDiversity: 2,
            confidence: 4,
          },
        }
      ));
      events.push(createOutcomeEvent(`acted-${index}`, now - ((index + 1) * 10_000) + 1000, 'acted'));
    }

    for (let index = 0; index < 8; index += 1) {
      events.push(createSurfacedEvent(
        `dismissed-${index}`,
        now - ((index + 20) * 10_000),
        {
          compositeScore: 37,
          scoreBreakdown: {
            urgency: 20,
            scheduleFit: 4,
            batterySeasonFit: 3,
            intentionAlignment: 1,
            whyNowStrength: 1,
            noveltyDiversity: 4,
            confidence: 1,
          },
        }
      ));
      events.push(createOutcomeEvent(`dismissed-${index}`, now - ((index + 20) * 10_000) + 1000, 'dismissed'));
    }

    const result = deriveSelectorTuningFromEvents(events, now);

    expect(result.source).toBe('telemetry');
    expect(result.selectionConfig.minThreshold).toBeGreaterThan(35);
    expect(result.weights.scheduleFit).toBeGreaterThan(20);
    expect(result.weights.intentionAlignment).toBeGreaterThan(15);
    expect(result.weights.urgency).toBeLessThan(30);
  });

  it('ignores manual-pull surfaces when deriving automatic selector tuning', () => {
    const now = Date.UTC(2026, 2, 24, 12, 0, 0);
    const events: SelectorTuningEvent[] = [];

    for (let index = 0; index < 8; index += 1) {
      events.push(createSurfacedEvent(
        `auto-acted-${index}`,
        now - ((index + 1) * 10_000),
        {
          compositeScore: 55,
          scoreBreakdown: {
            urgency: 12,
            scheduleFit: 18,
            batterySeasonFit: 9,
            intentionAlignment: 12,
            whyNowStrength: 8,
            noveltyDiversity: 3,
            confidence: 5,
          },
          surfaceRequestKind: 'automatic',
        }
      ));
      events.push(createOutcomeEvent(`auto-acted-${index}`, now - ((index + 1) * 10_000) + 1000, 'acted'));
    }

    for (let index = 0; index < 8; index += 1) {
      events.push(createSurfacedEvent(
        `manual-dismissed-${index}`,
        now - ((index + 20) * 10_000),
        {
          compositeScore: 36,
          scoreBreakdown: {
            urgency: 22,
            scheduleFit: 3,
            batterySeasonFit: 2,
            intentionAlignment: 1,
            whyNowStrength: 1,
            noveltyDiversity: 4,
            confidence: 1,
          },
          surfaceRequestKind: 'manual_pull',
        }
      ));
      events.push(createOutcomeEvent(`manual-dismissed-${index}`, now - ((index + 20) * 10_000) + 1000, 'dismissed'));
    }

    const result = deriveSelectorTuningFromEvents(events, now);

    expect(result.source).toBe('default');
    expect(result.selectionConfig.minThreshold).toBe(35);
    expect(result.sampleSize).toBe(8);
    expect(result.resolvedSampleSize).toBe(8);
    expect(result.actedSampleSize).toBe(8);
    expect(result.negativeSampleSize).toBe(0);
  });
});
