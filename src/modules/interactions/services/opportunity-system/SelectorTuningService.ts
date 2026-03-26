import type SurfacingLogModel from '@/db/models/SurfacingLog';
import { getOptionalQueryCollection } from '@/shared/utils/optional-query-collection';
import { Q } from '@nozbe/watermelondb';
import type { FocusSelectorOptions } from './FocusSelectorService';
import type { OpportunityPresentationCopy, SelectorSurfaceRequestKind } from './types';
import {
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_SELECTION_CONFIG,
  type ScoringWeights,
  type SelectionConfig,
} from './scoring/score-types';

const LOOKBACK_MS = 45 * 24 * 60 * 60 * 1000;
const CACHE_MS = 15 * 60 * 1000;
const MIN_SURFACED_SAMPLES = 12;
const MIN_RESOLVED_SAMPLES = 8;
const MIN_OUTCOME_POLARITY_SAMPLES = 3;
const MIN_THRESHOLD_PRIMARY_SAMPLES = 6;
const MAX_WEIGHT_DELTA_RATIO = 0.15;
const MAX_THRESHOLD_DELTA = 5;

type ScoreDimension = keyof ScoringWeights;
type SelectorTuningEventType = 'surfaced' | 'acted' | 'dismissed' | 'snoozed' | 'expired';
type SelectorOutcome = 'acted' | 'negative' | 'unresolved';

export interface SelectorTuningEvent {
  opportunityPoolId: string;
  eventType: SelectorTuningEventType;
  timestamp: number;
  compositeScore?: number;
  scoreBreakdown?: Record<string, number>;
  surfaceSource?: string;
  surfaceSlot?: string;
  surfaceRequestKind?: SelectorSurfaceRequestKind;
  presentationCopy?: OpportunityPresentationCopy;
}

interface SelectorOutcomeSample {
  compositeScore: number;
  scoreBreakdown: Record<string, number>;
  surfaceSlot: 'primary' | 'secondary';
  outcome: SelectorOutcome;
}

export interface SelectorTuningResult {
  weights: ScoringWeights;
  selectionConfig: SelectionConfig;
  source: 'default' | 'telemetry';
  sampleSize: number;
  resolvedSampleSize: number;
  actedSampleSize: number;
  negativeSampleSize: number;
  updatedAt: number;
}

let cachedResult:
  | {
    cachedAt: number;
    result: SelectorTuningResult;
  }
  | null = null;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildDefaultResult(
  now: number,
  sampleSize: number = 0,
  resolvedSampleSize: number = 0,
  actedSampleSize: number = 0,
  negativeSampleSize: number = 0
): SelectorTuningResult {
  return {
    weights: { ...DEFAULT_SCORING_WEIGHTS },
    selectionConfig: { ...DEFAULT_SELECTION_CONFIG },
    source: 'default',
    sampleSize,
    resolvedSampleSize,
    actedSampleSize,
    negativeSampleSize,
    updatedAt: now,
  };
}

function toSurfaceSlot(surfaceSlot?: string): 'primary' | 'secondary' | null {
  if (surfaceSlot === 'primary' || surfaceSlot === 'secondary') {
    return surfaceSlot;
  }

  return null;
}

function normalizeBreakdown(scoreBreakdown?: Record<string, number>): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const dimension of Object.keys(DEFAULT_SCORING_WEIGHTS) as ScoreDimension[]) {
    normalized[dimension] = typeof scoreBreakdown?.[dimension] === 'number'
      ? scoreBreakdown[dimension]
      : 0;
  }
  return normalized;
}

function buildOutcomeSamples(events: SelectorTuningEvent[]): SelectorOutcomeSample[] {
  const eventsByOpportunity = new Map<string, SelectorTuningEvent[]>();
  for (const event of events) {
    if (!eventsByOpportunity.has(event.opportunityPoolId)) {
      eventsByOpportunity.set(event.opportunityPoolId, []);
    }
    eventsByOpportunity.get(event.opportunityPoolId)?.push(event);
  }

  const samples: SelectorOutcomeSample[] = [];

  for (const opportunityEvents of eventsByOpportunity.values()) {
    const ordered = [...opportunityEvents].sort((a, b) => a.timestamp - b.timestamp);

    for (let index = 0; index < ordered.length; index += 1) {
      const event = ordered[index];
      const surfaceSlot = toSurfaceSlot(event.surfaceSlot);

      if (
        event.eventType !== 'surfaced'
        || event.surfaceSource !== 'selector'
        || event.surfaceRequestKind === 'manual_pull'
        || surfaceSlot === null
        || typeof event.compositeScore !== 'number'
      ) {
        continue;
      }

      const nextSurfacedTimestamp = ordered
        .slice(index + 1)
        .find(candidate => candidate.eventType === 'surfaced')
        ?.timestamp ?? Number.POSITIVE_INFINITY;
      const followUps = ordered.slice(index + 1)
        .filter(candidate => candidate.timestamp < nextSurfacedTimestamp);

      let outcome: SelectorOutcome = 'unresolved';
      if (followUps.some(candidate => candidate.eventType === 'acted')) {
        outcome = 'acted';
      } else if (
        followUps.some(candidate =>
          candidate.eventType === 'dismissed'
          || candidate.eventType === 'snoozed'
          || candidate.eventType === 'expired'
        )
      ) {
        outcome = 'negative';
      }

      samples.push({
        compositeScore: event.compositeScore,
        scoreBreakdown: normalizeBreakdown(event.scoreBreakdown),
        surfaceSlot,
        outcome,
      });
    }
  }

  return samples;
}

function deriveWeightsFromSamples(
  resolvedSamples: SelectorOutcomeSample[]
): ScoringWeights {
  const positiveSamples = resolvedSamples.filter(sample => sample.outcome === 'acted');
  const negativeSamples = resolvedSamples.filter(sample => sample.outcome === 'negative');

  if (
    positiveSamples.length < MIN_OUTCOME_POLARITY_SAMPLES
    || negativeSamples.length < MIN_OUTCOME_POLARITY_SAMPLES
  ) {
    return { ...DEFAULT_SCORING_WEIGHTS };
  }

  const adjustedEntries = (Object.keys(DEFAULT_SCORING_WEIGHTS) as ScoreDimension[]).map(dimension => {
    const defaultWeight = DEFAULT_SCORING_WEIGHTS[dimension];
    const positiveAverage = positiveSamples.reduce((sum, sample) => (
      sum + clamp(sample.scoreBreakdown[dimension] / defaultWeight, 0, 1)
    ), 0) / positiveSamples.length;
    const negativeAverage = negativeSamples.reduce((sum, sample) => (
      sum + clamp(sample.scoreBreakdown[dimension] / defaultWeight, 0, 1)
    ), 0) / negativeSamples.length;
    const signalDelta = positiveAverage - negativeAverage;
    const multiplier = 1 + clamp(signalDelta * 0.35, -MAX_WEIGHT_DELTA_RATIO, MAX_WEIGHT_DELTA_RATIO);

    return [dimension, defaultWeight * multiplier] as const;
  });

  const totalDefaultWeight = Object.values(DEFAULT_SCORING_WEIGHTS)
    .reduce((sum, value) => sum + value, 0);
  const totalAdjustedWeight = adjustedEntries
    .reduce((sum, [, value]) => sum + value, 0);
  const normalizationRatio = totalAdjustedWeight > 0
    ? totalDefaultWeight / totalAdjustedWeight
    : 1;

  return adjustedEntries.reduce((result, [dimension, value]) => {
    result[dimension] = round(value * normalizationRatio);
    return result;
  }, {} as ScoringWeights);
}

function deriveSelectionConfigFromSamples(
  resolvedSamples: SelectorOutcomeSample[]
): SelectionConfig {
  const primarySamples = resolvedSamples.filter(sample => sample.surfaceSlot === 'primary');
  if (primarySamples.length < MIN_THRESHOLD_PRIMARY_SAMPLES) {
    return { ...DEFAULT_SELECTION_CONFIG };
  }

  const lowBandSamples = primarySamples.filter(sample =>
    sample.compositeScore < DEFAULT_SELECTION_CONFIG.minThreshold + 10
  );
  if (lowBandSamples.length < MIN_THRESHOLD_PRIMARY_SAMPLES) {
    return { ...DEFAULT_SELECTION_CONFIG };
  }

  const actedRate = lowBandSamples.filter(sample => sample.outcome === 'acted').length / lowBandSamples.length;
  const negativeRate = lowBandSamples.filter(sample => sample.outcome === 'negative').length / lowBandSamples.length;
  const thresholdShift = clamp(
    Math.round((negativeRate - actedRate) * 10),
    -MAX_THRESHOLD_DELTA,
    MAX_THRESHOLD_DELTA
  );

  return {
    minThreshold: DEFAULT_SELECTION_CONFIG.minThreshold + thresholdShift,
    secondaryRatio: DEFAULT_SELECTION_CONFIG.secondaryRatio,
  };
}

export function deriveSelectorTuningFromEvents(
  events: SelectorTuningEvent[],
  now: number = Date.now()
): SelectorTuningResult {
  const surfaceSamples = buildOutcomeSamples(events);
  const resolvedSamples = surfaceSamples.filter(sample => sample.outcome !== 'unresolved');
  const actedSampleSize = resolvedSamples.filter(sample => sample.outcome === 'acted').length;
  const negativeSampleSize = resolvedSamples.filter(sample => sample.outcome === 'negative').length;

  if (
    surfaceSamples.length < MIN_SURFACED_SAMPLES
    || resolvedSamples.length < MIN_RESOLVED_SAMPLES
  ) {
    return buildDefaultResult(
      now,
      surfaceSamples.length,
      resolvedSamples.length,
      actedSampleSize,
      negativeSampleSize
    );
  }

  const weights = deriveWeightsFromSamples(resolvedSamples);
  const selectionConfig = deriveSelectionConfigFromSamples(resolvedSamples);
  const changedWeights = JSON.stringify(weights) !== JSON.stringify(DEFAULT_SCORING_WEIGHTS);
  const changedSelectionConfig = JSON.stringify(selectionConfig) !== JSON.stringify(DEFAULT_SELECTION_CONFIG);

  return {
    weights,
    selectionConfig,
    source: changedWeights || changedSelectionConfig ? 'telemetry' : 'default',
    sampleSize: surfaceSamples.length,
    resolvedSampleSize: resolvedSamples.length,
    actedSampleSize,
    negativeSampleSize,
    updatedAt: now,
  };
}

function parseLogRow(row: SurfacingLogModel): SelectorTuningEvent {
  return {
    opportunityPoolId: row.opportunityPoolId,
    eventType: row.eventType as SelectorTuningEventType,
    timestamp: row.timestamp,
    compositeScore: typeof row.compositeScore === 'number' ? row.compositeScore : undefined,
    scoreBreakdown: row.scoreBreakdown,
    surfaceSource: row.surfaceSource,
    surfaceSlot: row.surfaceSlot,
    surfaceRequestKind: row.surfaceRequestKind,
    presentationCopy: row.presentationCopy || undefined,
  };
}

async function loadRecentTuningEvents(now: number): Promise<SelectorTuningEvent[]> {
  const collection = getOptionalQueryCollection<SurfacingLogModel>('surfacing_log');
  if (!collection) {
    return [];
  }

  const rows = await collection
    .query(Q.where('timestamp', Q.gte(now - LOOKBACK_MS)))
    .fetch();

  return rows.map(parseLogRow);
}

export function clearSelectorTuningCache(): void {
  cachedResult = null;
}

export const SelectorTuningService = {
  async getTuningResult(now: number = Date.now()): Promise<SelectorTuningResult> {
    if (cachedResult && now - cachedResult.cachedAt <= CACHE_MS) {
      return cachedResult.result;
    }

    const events = await loadRecentTuningEvents(now);
    const result = deriveSelectorTuningFromEvents(events, now);
    cachedResult = {
      cachedAt: now,
      result,
    };
    return result;
  },

  async getSelectorOptions(now: number = Date.now()): Promise<FocusSelectorOptions> {
    const result = await this.getTuningResult(now);
    return {
      weights: result.weights,
      selectionConfig: result.selectionConfig,
    };
  },

  clearCache(): void {
    clearSelectorTuningCache();
  },
};
