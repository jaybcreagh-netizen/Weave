import type OpportunityPoolModel from '@/db/models/OpportunityPool';
import type SurfacingLogModel from '@/db/models/SurfacingLog';
import { getOptionalQueryCollection } from '@/shared/utils/optional-query-collection';
import { Q } from '@nozbe/watermelondb';
import type {
  OpportunityPresentationCopy,
  SelectorPacingSnapshot,
  SelectorSurfaceRequestKind,
} from './types';

const DEFAULT_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 20;

type SelectorOutcome = 'acted' | 'dismissed' | 'snoozed' | 'expired' | 'unresolved';
type SelectorSurfaceSlot = 'primary' | 'secondary' | 'unknown';

interface SelectorInspectionEvent {
  opportunityPoolId: string;
  eventType: string;
  timestamp: number;
  window?: string;
  compositeScore?: number;
  scoreBreakdown: Record<string, number>;
  feedbackType?: string;
  surfaceSource?: string;
  selectionReason?: string;
  surfaceSlot?: string;
  opportunitySource?: string;
  thresholdVariant?: string;
  copyVariant?: string;
  quietReason?: string;
  surfaceRequestKind?: SelectorSurfaceRequestKind;
  pacingSnapshot?: SelectorPacingSnapshot;
  presentationCopy?: OpportunityPresentationCopy;
}

export interface SelectorInspectionItem {
  opportunityPoolId: string;
  opportunityId?: string;
  friendId?: string;
  friendName?: string;
  category?: string;
  generatorSource?: string;
  surfacedAt: number;
  window?: string;
  compositeScore?: number;
  scoreBreakdown: Record<string, number>;
  selectionReason?: string;
  surfaceSlot: SelectorSurfaceSlot;
  opportunitySource?: string;
  thresholdVariant?: string;
  copyVariant?: string;
  surfaceRequestKind?: SelectorSurfaceRequestKind;
  surfaceCount?: number;
  presentationCopy?: OpportunityPresentationCopy;
  outcome: SelectorOutcome;
  outcomeAt?: number;
  feedbackType?: string;
}

export interface SelectorQuietInspectionItem {
  opportunityPoolId: string;
  timestamp: number;
  window?: string;
  selectionReason?: string;
  quietReason?: string;
  surfaceRequestKind?: SelectorSurfaceRequestKind;
  thresholdVariant?: string;
  copyVariant?: string;
  pacingSnapshot?: SelectorPacingSnapshot;
}

export interface SelectorInspectionAggregate {
  key: string;
  surfaced: number;
  acted: number;
  negative: number;
  unresolved: number;
  actedRate: number;
}

export interface SelectorQuietAggregate {
  key: string;
  count: number;
}

export interface SelectorInspectionSummary {
  surfacedCount: number;
  actedCount: number;
  dismissedCount: number;
  snoozedCount: number;
  expiredCount: number;
  unresolvedCount: number;
  negativeCount: number;
  actedRate: number;
  negativeRate: number;
  averageCompositeScore: number;
  quietCount: number;
  byCategory: SelectorInspectionAggregate[];
  bySurfaceSlot: SelectorInspectionAggregate[];
  byThresholdVariant: SelectorInspectionAggregate[];
  byCopyVariant: SelectorInspectionAggregate[];
  byRequestKind: SelectorInspectionAggregate[];
  byQuietReason: SelectorQuietAggregate[];
  byTitle: SelectorInspectionAggregate[];
}

export interface SelectorInspectionReport {
  generatedAt: number;
  lookbackMs: number;
  limit: number;
  items: SelectorInspectionItem[];
  quietEvents: SelectorQuietInspectionItem[];
  summary: SelectorInspectionSummary;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function toSurfaceSlot(value?: string): SelectorSurfaceSlot {
  if (value === 'primary' || value === 'secondary') {
    return value;
  }

  return 'unknown';
}

function normalizeScoreBreakdown(
  scoreBreakdown?: Record<string, number>
): Record<string, number> {
  if (!scoreBreakdown) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(scoreBreakdown).filter(([, value]) => typeof value === 'number')
  );
}

function normalizeEvent(log: SurfacingLogModel): SelectorInspectionEvent {
  return {
    opportunityPoolId: log.opportunityPoolId,
    eventType: log.eventType,
    timestamp: log.timestamp,
    window: log.window,
    compositeScore: log.compositeScore,
    scoreBreakdown: normalizeScoreBreakdown(log.scoreBreakdown),
    feedbackType: log.feedbackType,
    surfaceSource: log.surfaceSource,
    selectionReason: log.selectionReason,
    surfaceSlot: log.surfaceSlot,
    opportunitySource: log.opportunitySource,
    thresholdVariant: log.thresholdVariant,
    copyVariant: log.copyVariant,
    quietReason: log.quietReason,
    surfaceRequestKind: log.surfaceRequestKind,
    pacingSnapshot: log.pacingSnapshot || undefined,
    presentationCopy: log.presentationCopy || undefined,
  };
}

function resolveOutcome(
  followUps: SelectorInspectionEvent[]
): Pick<SelectorInspectionItem, 'outcome' | 'outcomeAt' | 'feedbackType'> {
  const acted = followUps.find(event => event.eventType === 'acted');
  if (acted) {
    return {
      outcome: 'acted',
      outcomeAt: acted.timestamp,
    };
  }

  const negative = followUps.find(event =>
    event.eventType === 'dismissed'
    || event.eventType === 'snoozed'
    || event.eventType === 'expired'
  );
  if (negative) {
    return {
      outcome: negative.eventType as Exclude<SelectorOutcome, 'acted' | 'unresolved'>,
      outcomeAt: negative.timestamp,
      feedbackType: negative.feedbackType,
    };
  }

  return {
    outcome: 'unresolved',
  };
}

function buildAggregate(
  items: SelectorInspectionItem[],
  keyBuilder: (item: SelectorInspectionItem) => string | undefined
): SelectorInspectionAggregate[] {
  const totals = new Map<string, SelectorInspectionAggregate>();

  for (const item of items) {
    const key = keyBuilder(item) || 'unknown';
    if (!totals.has(key)) {
      totals.set(key, {
        key,
        surfaced: 0,
        acted: 0,
        negative: 0,
        unresolved: 0,
        actedRate: 0,
      });
    }

    const aggregate = totals.get(key)!;
    aggregate.surfaced += 1;
    if (item.outcome === 'acted') {
      aggregate.acted += 1;
    } else if (item.outcome === 'unresolved') {
      aggregate.unresolved += 1;
    } else {
      aggregate.negative += 1;
    }
  }

  return [...totals.values()]
    .map(aggregate => ({
      ...aggregate,
      actedRate: aggregate.surfaced > 0
        ? round(aggregate.acted / aggregate.surfaced)
        : 0,
    }))
    .sort((left, right) =>
      right.surfaced - left.surfaced
      || right.acted - left.acted
      || left.key.localeCompare(right.key)
    );
}

function buildQuietAggregate(
  events: SelectorQuietInspectionItem[],
  keyBuilder: (item: SelectorQuietInspectionItem) => string | undefined
): SelectorQuietAggregate[] {
  const totals = new Map<string, number>();

  for (const event of events) {
    const key = keyBuilder(event) || 'unknown';
    totals.set(key, (totals.get(key) || 0) + 1);
  }

  return [...totals.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

function buildSummary(
  items: SelectorInspectionItem[],
  quietEvents: SelectorQuietInspectionItem[]
): SelectorInspectionSummary {
  const surfacedCount = items.length;
  const actedCount = items.filter(item => item.outcome === 'acted').length;
  const dismissedCount = items.filter(item => item.outcome === 'dismissed').length;
  const snoozedCount = items.filter(item => item.outcome === 'snoozed').length;
  const expiredCount = items.filter(item => item.outcome === 'expired').length;
  const unresolvedCount = items.filter(item => item.outcome === 'unresolved').length;
  const negativeCount = dismissedCount + snoozedCount + expiredCount;
  const scoredItems = items.filter(item => typeof item.compositeScore === 'number');
  const averageCompositeScore = scoredItems.length > 0
    ? round(scoredItems.reduce((sum, item) => sum + (item.compositeScore || 0), 0) / scoredItems.length)
    : 0;
  const quietCount = quietEvents.length;

  return {
    surfacedCount,
    actedCount,
    dismissedCount,
    snoozedCount,
    expiredCount,
    unresolvedCount,
    negativeCount,
    actedRate: surfacedCount > 0 ? round(actedCount / surfacedCount) : 0,
    negativeRate: surfacedCount > 0 ? round(negativeCount / surfacedCount) : 0,
    averageCompositeScore,
    quietCount,
    byCategory: buildAggregate(items, item => item.category),
    bySurfaceSlot: buildAggregate(items, item => item.surfaceSlot),
    byThresholdVariant: buildAggregate(items, item => item.thresholdVariant),
    byCopyVariant: buildAggregate(items, item => item.copyVariant),
    byRequestKind: buildAggregate(items, item => item.surfaceRequestKind),
    byQuietReason: buildQuietAggregate(quietEvents, item => item.quietReason),
    byTitle: buildAggregate(items, item => item.presentationCopy?.title),
  };
}

function buildInspectionItems(
  events: SelectorInspectionEvent[],
  poolRowsById: Map<string, OpportunityPoolModel>
): SelectorInspectionItem[] {
  const eventsByOpportunity = new Map<string, SelectorInspectionEvent[]>();

  for (const event of events) {
    if (!eventsByOpportunity.has(event.opportunityPoolId)) {
      eventsByOpportunity.set(event.opportunityPoolId, []);
    }
    eventsByOpportunity.get(event.opportunityPoolId)?.push(event);
  }

  const items: SelectorInspectionItem[] = [];

  for (const [opportunityPoolId, opportunityEvents] of eventsByOpportunity.entries()) {
    const ordered = [...opportunityEvents].sort((left, right) => left.timestamp - right.timestamp);
    const poolRow = poolRowsById.get(opportunityPoolId);

    for (let index = 0; index < ordered.length; index += 1) {
      const surfaced = ordered[index];
      if (surfaced.eventType !== 'surfaced' || surfaced.surfaceSource !== 'selector') {
        continue;
      }

      const nextSurfacedTimestamp = ordered
        .slice(index + 1)
        .find(event => event.eventType === 'surfaced')
        ?.timestamp ?? Number.POSITIVE_INFINITY;
      const followUps = ordered
        .slice(index + 1)
        .filter(event => event.timestamp < nextSurfacedTimestamp);
      const outcome = resolveOutcome(followUps);

      items.push({
        opportunityPoolId,
        opportunityId: poolRow?.opportunityId,
        friendId: poolRow?.friendId,
        friendName: poolRow?.friendName,
        category: poolRow?.category,
        generatorSource: poolRow?.generatorSource,
        surfacedAt: surfaced.timestamp,
        window: surfaced.window,
        compositeScore: surfaced.compositeScore,
        scoreBreakdown: surfaced.scoreBreakdown,
        selectionReason: surfaced.selectionReason,
        surfaceSlot: toSurfaceSlot(surfaced.surfaceSlot),
        opportunitySource: surfaced.opportunitySource,
        thresholdVariant: surfaced.thresholdVariant,
        copyVariant: surfaced.copyVariant,
        surfaceRequestKind: surfaced.surfaceRequestKind,
        surfaceCount: poolRow?.surfaceCount,
        presentationCopy: surfaced.presentationCopy || poolRow?.presentationCopy || undefined,
        ...outcome,
      });
    }
  }

  return items.sort((left, right) => right.surfacedAt - left.surfacedAt);
}

function buildQuietInspectionItems(
  events: SelectorInspectionEvent[]
): SelectorQuietInspectionItem[] {
  return events
    .filter(event => event.eventType === 'quiet' && event.surfaceSource === 'selector')
    .map(event => ({
      opportunityPoolId: event.opportunityPoolId,
      timestamp: event.timestamp,
      window: event.window,
      selectionReason: event.selectionReason,
      quietReason: event.quietReason,
      surfaceRequestKind: event.surfaceRequestKind,
      thresholdVariant: event.thresholdVariant,
      copyVariant: event.copyVariant,
      pacingSnapshot: event.pacingSnapshot,
    }))
    .sort((left, right) => right.timestamp - left.timestamp);
}

async function getInspectionEvents(
  lookbackMs: number,
  now: number
): Promise<SelectorInspectionEvent[]> {
  const surfacingCollection = getOptionalQueryCollection<SurfacingLogModel>('surfacing_log');
  if (!surfacingCollection) {
    return [];
  }

  const cutoff = now - lookbackMs;
  const rows = await surfacingCollection
    .query(Q.where('timestamp', Q.gte(cutoff)), Q.sortBy('timestamp', Q.asc))
    .fetch();

  return rows.map(normalizeEvent);
}

async function getPoolRowMap(opportunityPoolIds: string[]): Promise<Map<string, OpportunityPoolModel>> {
  if (opportunityPoolIds.length === 0) {
    return new Map();
  }

  const poolCollection = getOptionalQueryCollection<OpportunityPoolModel>('opportunity_pool');
  if (!poolCollection) {
    return new Map();
  }

  const rows = await poolCollection
    .query(Q.where('id', Q.oneOf(opportunityPoolIds)))
    .fetch();

  return new Map(rows.map(row => [row.id, row]));
}

export const SelectorInspectionService = {
  async getInspectionReport(options: {
    limit?: number;
    lookbackMs?: number;
    now?: number;
  } = {}): Promise<SelectorInspectionReport> {
    const now = options.now ?? Date.now();
    const lookbackMs = options.lookbackMs ?? DEFAULT_LOOKBACK_MS;
    const limit = options.limit ?? DEFAULT_LIMIT;

    const events = await getInspectionEvents(lookbackMs, now);
    const uniqueOpportunityPoolIds = [...new Set(events.map(event => event.opportunityPoolId))];
    const poolRowsById = await getPoolRowMap(uniqueOpportunityPoolIds);
    const items = buildInspectionItems(events, poolRowsById);
    const quietEvents = buildQuietInspectionItems(events);

    return {
      generatedAt: now,
      lookbackMs,
      limit,
      items: items.slice(0, limit),
      quietEvents: quietEvents.slice(0, limit),
      summary: buildSummary(items, quietEvents),
    };
  },
};
