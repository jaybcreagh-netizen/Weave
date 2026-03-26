import { Q } from '@nozbe/watermelondb';
import OpportunityPoolModel from '@/db/models/OpportunityPool';
import SurfacingLogModel from '@/db/models/SurfacingLog';
import { database } from '@/db';
import { getTimeOfDay } from '@/shared/utils/time-aware-filter';
import type {
  Opportunity,
  OpportunityPresentationCopy,
  SelectorPacingSnapshot,
  SelectorSurfaceRequestKind,
} from './types';
import { buildOpportunityContextHash } from './context-hash';
import { opportunityToSuggestion } from './OpportunityAdapter';
import type {
  CopyExperimentVariant,
  ThresholdExperimentVariant,
} from './SelectorExperimentService';

const DEFAULT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const REFLECTION_EXPIRY_MS = 24 * 60 * 60 * 1000;
const PLAN_EXPIRY_MS = 48 * 60 * 60 * 1000;
const SELECTOR_SYSTEM_EVENT_ID = 'system:selector';

function getOpportunityExpiry(opportunity: Opportunity): number {
  if (opportunity.timeRelevance.expiresAt) {
    return opportunity.timeRelevance.expiresAt;
  }

  if (opportunity.timeRelevance.deadlineAt) {
    return opportunity.timeRelevance.deadlineAt;
  }

  if (opportunity.category === 'reflect') {
    return opportunity.createdAt + REFLECTION_EXPIRY_MS;
  }

  if (opportunity.generatorSource === 'planned-weave-generator') {
    return opportunity.createdAt + PLAN_EXPIRY_MS;
  }

  return opportunity.createdAt + DEFAULT_EXPIRY_MS;
}

function toPoolOpportunity(record: OpportunityPoolModel): Opportunity | null {
  const explanation = record.explanation;
  const timeRelevance = record.timeRelevance;
  if (!explanation || !timeRelevance) {
    return null;
  }

  return {
    id: record.opportunityId,
    friendId: record.friendId || undefined,
    friendName: record.friendName || undefined,
    friendTier: record.friendTier as Opportunity['friendTier'] | undefined,
    category: record.category as Opportunity['category'],
    generatorSource: record.generatorSource,
    urgency: record.urgency,
    confidence: record.confidence,
    effortLevel: record.effortLevel as Opportunity['effortLevel'],
    estimatedDurationMinutes: record.estimatedDuration,
    momentumScore: record.momentumScore,
    explanation,
    timeRelevance,
    intentionId: record.intentionId || undefined,
    intentionBoost: record.intentionBoost,
    copyContext: record.copyContext || undefined,
    suggestionPayload: record.suggestionPayload || undefined,
    presentationCopy: record.presentationCopy || undefined,
    createdAt: record.createdAt.getTime(),
  };
}

function buildPresentationCopy(opportunity: Opportunity) {
  if (opportunity.presentationCopy) {
    return opportunity.presentationCopy;
  }

  const suggestion = opportunityToSuggestion(opportunity);
  return {
    title: suggestion.title,
    subtitle: suggestion.subtitle,
    contextSnippet: suggestion.contextSnippet,
    actionLabel: suggestion.actionLabel,
    reason: suggestion.reason,
    aiEnriched: suggestion.aiEnriched,
  };
}

async function getRowsByOpportunityIds(opportunityIds: string[]): Promise<OpportunityPoolModel[]> {
  if (opportunityIds.length === 0) {
    return [];
  }

  return database.get<OpportunityPoolModel>('opportunity_pool')
    .query(Q.where('opportunity_id', Q.oneOf(opportunityIds)))
    .fetch();
}

export interface OpportunityLogOptions {
  compositeScore?: number;
  scoreBreakdown?: Record<string, number>;
  feedbackType?: string;
  window?: string;
  surfaceSource?: 'legacy-list' | 'selector';
  selectionReason?: 'selected' | 'below_threshold' | 'empty';
  surfaceSlot?: 'primary' | 'secondary';
  opportunitySource?: 'synthesized' | 'pool';
  presentationCopy?: OpportunityPresentationCopy;
  thresholdVariant?: ThresholdExperimentVariant;
  copyVariant?: CopyExperimentVariant;
  quietReason?: string;
  surfaceRequestKind?: SelectorSurfaceRequestKind;
  pacingSnapshot?: SelectorPacingSnapshot;
}

export interface OpportunityUpsertStats {
  createdCount: number;
  updatedCount: number;
  reactivatedCount: number;
  unchangedCount: number;
  deactivatedCount: number;
}

export const OpportunityPoolService = {
  async getActiveOpportunities(friendIds?: string[]): Promise<Opportunity[]> {
    const now = Date.now();
    const clauses = [Q.where('is_active', true), Q.where('expires_at', Q.gt(now))];
    if (friendIds && friendIds.length > 0) {
      clauses.push(Q.where('friend_id', Q.oneOf(friendIds)));
    }

    const rows = await database.get<OpportunityPoolModel>('opportunity_pool')
      .query(...clauses)
      .fetch();

    return rows
      .map(toPoolOpportunity)
      .filter((opportunity): opportunity is Opportunity => !!opportunity);
  },

  async upsertRefreshedFriendSet(
    friendIds: string[],
    opportunities: Opportunity[]
  ): Promise<OpportunityUpsertStats> {
    const stats: OpportunityUpsertStats = {
      createdCount: 0,
      updatedCount: 0,
      reactivatedCount: 0,
      unchangedCount: 0,
      deactivatedCount: 0,
    };

    if (friendIds.length === 0) {
      return stats;
    }

    const collection = database.get<OpportunityPoolModel>('opportunity_pool');
    const existingRows = await collection
      .query(Q.where('friend_id', Q.oneOf(friendIds)))
      .fetch();
    const existingByOpportunityId = new Map(existingRows.map(row => [row.opportunityId, row]));
    const nextIds = new Set(opportunities.map(opportunity => opportunity.id));
    const opportunitiesWithHash = await Promise.all(opportunities.map(async opportunity => ({
      opportunity,
      contextHash: await buildOpportunityContextHash(opportunity),
      presentationCopy: buildPresentationCopy(opportunity),
    })));
    const now = Date.now();

    await database.write(async () => {
      for (const { opportunity, contextHash, presentationCopy } of opportunitiesWithHash) {
        const existing = existingByOpportunityId.get(opportunity.id);
        const expiresAt = getOpportunityExpiry(opportunity);

        if (existing) {
          const wasActive = existing.isActive;
          const shouldRewrite =
            existing.contextHash !== contextHash
            || existing.expiresAt !== expiresAt
            || !wasActive;

          if (!shouldRewrite) {
            stats.unchangedCount += 1;
            continue;
          }

          await existing.update(row => {
            row.friendId = opportunity.friendId;
            row.friendName = opportunity.friendName;
            row.friendTier = opportunity.friendTier;
            row.category = opportunity.category;
            row.generatorSource = opportunity.generatorSource;
            row.urgency = opportunity.urgency;
            row.confidence = opportunity.confidence;
            row.effortLevel = opportunity.effortLevel;
            row.estimatedDuration = opportunity.estimatedDurationMinutes;
            row.momentumScore = opportunity.momentumScore;
            row.intentionId = opportunity.intentionId;
            row.intentionBoost = opportunity.intentionBoost;
            row.contextHash = contextHash;
            row.explanationJson = JSON.stringify(opportunity.explanation);
            row.timeRelevanceJson = JSON.stringify(opportunity.timeRelevance);
            row.copyContextJson = opportunity.copyContext
              ? JSON.stringify(opportunity.copyContext)
              : undefined;
            row.suggestionPayloadJson = opportunity.suggestionPayload
              ? JSON.stringify(opportunity.suggestionPayload)
              : undefined;
            row.presentationCopyJson = JSON.stringify(presentationCopy);
            row.updatedAt = new Date(now);
            row.expiresAt = expiresAt;
            row.isActive = true;
          });

          if (wasActive) {
            stats.updatedCount += 1;
          } else {
            stats.reactivatedCount += 1;
          }
        } else {
          await collection.create(row => {
            row.opportunityId = opportunity.id;
            row.friendId = opportunity.friendId;
            row.friendName = opportunity.friendName;
            row.friendTier = opportunity.friendTier;
            row.category = opportunity.category;
            row.generatorSource = opportunity.generatorSource;
            row.urgency = opportunity.urgency;
            row.confidence = opportunity.confidence;
            row.effortLevel = opportunity.effortLevel;
            row.estimatedDuration = opportunity.estimatedDurationMinutes;
            row.momentumScore = opportunity.momentumScore;
            row.intentionId = opportunity.intentionId;
            row.intentionBoost = opportunity.intentionBoost;
            row.contextHash = contextHash;
            row.explanationJson = JSON.stringify(opportunity.explanation);
            row.timeRelevanceJson = JSON.stringify(opportunity.timeRelevance);
            row.copyContextJson = opportunity.copyContext
              ? JSON.stringify(opportunity.copyContext)
              : undefined;
            row.suggestionPayloadJson = opportunity.suggestionPayload
              ? JSON.stringify(opportunity.suggestionPayload)
              : undefined;
            row.presentationCopyJson = JSON.stringify(presentationCopy);
            row.updatedAt = new Date(now);
            row.expiresAt = expiresAt;
            row.surfaceCount = 0;
            row.isActive = true;
          });
          stats.createdCount += 1;
        }
      }

      for (const row of existingRows) {
        if (!nextIds.has(row.opportunityId) && row.isActive) {
          await row.update(record => {
            record.isActive = false;
            record.updatedAt = new Date(now);
          });
          stats.deactivatedCount += 1;
        }
      }
    });

    return stats;
  },

  async deactivateRowsOutsideFriendIds(friendIds: string[]): Promise<number> {
    const activeRows = await database.get<OpportunityPoolModel>('opportunity_pool')
      .query(Q.where('is_active', true))
      .fetch();
    const allowedFriendIds = new Set(friendIds);
    const rowsToDeactivate = activeRows.filter(row => row.friendId && !allowedFriendIds.has(row.friendId));

    if (rowsToDeactivate.length === 0) {
      return 0;
    }

    const now = Date.now();
    await database.write(async () => {
      for (const row of rowsToDeactivate) {
        await row.update(record => {
          record.isActive = false;
          record.updatedAt = new Date(now);
        });
      }
    });

    return rowsToDeactivate.length;
  },

  async cleanupExpiredRows(now: number = Date.now()): Promise<number> {
    const expiredRows = await database.get<OpportunityPoolModel>('opportunity_pool')
      .query(Q.where('is_active', true), Q.where('expires_at', Q.lte(now)))
      .fetch();

    if (expiredRows.length === 0) {
      return 0;
    }

    await database.write(async () => {
      for (const row of expiredRows) {
        await row.update(record => {
          record.isActive = false;
          record.updatedAt = new Date(now);
        });
      }
    });

    return expiredRows.length;
  },

  async recordOpportunityEventByIds(
    opportunityIds: string[],
    eventType: 'surfaced' | 'acted' | 'snoozed' | 'dismissed' | 'expired',
    options: OpportunityLogOptions = {}
  ): Promise<void> {
    const rows = await getRowsByOpportunityIds(opportunityIds);
    if (rows.length === 0) {
      return;
    }

    const timestamp = Date.now();
    const window = options.window || getTimeOfDay(new Date(timestamp));
    const surfacingCollection = database.get<SurfacingLogModel>('surfacing_log');

    await database.write(async () => {
      for (const row of rows) {
        if (eventType === 'surfaced') {
          await row.update(record => {
            record.surfacedAt = timestamp;
            record.surfaceCount = (record.surfaceCount || 0) + 1;
            if (typeof options.compositeScore === 'number') {
              record.lastScore = options.compositeScore;
            }
            record.updatedAt = new Date(timestamp);
          });
        }

        await surfacingCollection.create(log => {
          log.opportunityPoolId = row.id;
          log.eventType = eventType;
          log.timestamp = timestamp;
          log.window = window;
          log.compositeScore = options.compositeScore ?? row.lastScore;
          log.scoreBreakdownJson = JSON.stringify(options.scoreBreakdown || {});
          log.feedbackType = options.feedbackType;
          log.surfaceSource = options.surfaceSource;
          log.selectionReason = options.selectionReason;
          log.surfaceSlot = options.surfaceSlot;
          log.opportunitySource = options.opportunitySource;
          log.thresholdVariant = options.thresholdVariant;
          log.copyVariant = options.copyVariant;
          log.quietReason = options.quietReason;
          log.surfaceRequestKind = options.surfaceRequestKind;
          log.pacingSnapshotJson = options.pacingSnapshot
            ? JSON.stringify(options.pacingSnapshot)
            : undefined;
          log.presentationCopyJson = options.presentationCopy
            ? JSON.stringify(options.presentationCopy)
            : row.presentationCopy
              ? JSON.stringify(row.presentationCopy)
              : undefined;
        });
      }
    });
  },

  async recordSelectorSystemEvent(
    eventType: 'quiet',
    options: OpportunityLogOptions = {}
  ): Promise<void> {
    const timestamp = Date.now();
    const window = options.window || getTimeOfDay(new Date(timestamp));
    const surfacingCollection = database.get<SurfacingLogModel>('surfacing_log');

    await database.write(async () => {
      await surfacingCollection.create(log => {
        log.opportunityPoolId = SELECTOR_SYSTEM_EVENT_ID;
        log.eventType = eventType;
        log.timestamp = timestamp;
        log.window = window;
        log.compositeScore = options.compositeScore;
        log.scoreBreakdownJson = JSON.stringify(options.scoreBreakdown || {});
        log.feedbackType = options.feedbackType;
        log.surfaceSource = options.surfaceSource || 'selector';
        log.selectionReason = options.selectionReason;
        log.surfaceSlot = options.surfaceSlot;
        log.opportunitySource = options.opportunitySource;
        log.thresholdVariant = options.thresholdVariant;
        log.copyVariant = options.copyVariant;
        log.quietReason = options.quietReason;
        log.surfaceRequestKind = options.surfaceRequestKind;
        log.pacingSnapshotJson = options.pacingSnapshot
          ? JSON.stringify(options.pacingSnapshot)
          : undefined;
      });
    });
  },
};
