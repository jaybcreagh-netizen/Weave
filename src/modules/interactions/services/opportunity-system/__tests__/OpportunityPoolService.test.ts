import { database } from '@/db';
import OpportunityPoolModel from '@/db/models/OpportunityPool';
import SurfacingLogModel from '@/db/models/SurfacingLog';
import { OpportunityPoolService } from '../OpportunityPoolService';
import type { Opportunity } from '../types';

function createOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opportunity-1',
    friendId: 'friend-1',
    friendName: 'Alex',
    friendTier: 'InnerCircle',
    category: 'maintain',
    generatorSource: 'maintenance-generator',
    urgency: 50,
    confidence: 0.8,
    effortLevel: 'moderate',
    estimatedDurationMinutes: 30,
    momentumScore: 18,
    explanation: {
      whyNow: 'It has been a while.',
      whyThisFriend: 'Alex is due for a check-in.',
      whyThisAction: 'A plan keeps things warm.',
    },
    timeRelevance: {
      bestWindow: 'evening',
    },
    copyContext: {
      daysSinceLastInteraction: 12,
      recentInteractionCategory: 'text-call',
      vibeHint: 'warm',
    },
    suggestionPayload: {
      type: 'connect',
      icon: 'MessageCircle',
      dismissible: true,
      action: {
        type: 'plan',
        prefilledCategory: 'text-call',
      },
    },
    createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    ...overrides,
  };
}

describe('OpportunityPoolService', () => {
  beforeEach(async () => {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  });

  it('upserts active opportunities and deactivates removed rows for refreshed friends', async () => {
    const initialStats = await OpportunityPoolService.upsertRefreshedFriendSet(
      ['friend-1'],
      [createOpportunity()]
    );

    let activeRows = await database.get<OpportunityPoolModel>('opportunity_pool')
      .query()
      .fetch();
    expect(initialStats).toMatchObject({
      createdCount: 1,
      updatedCount: 0,
      reactivatedCount: 0,
      unchangedCount: 0,
      deactivatedCount: 0,
    });
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0].isActive).toBe(true);

    const removalStats = await OpportunityPoolService.upsertRefreshedFriendSet(['friend-1'], []);

    activeRows = await database.get<OpportunityPoolModel>('opportunity_pool')
      .query()
      .fetch();
    expect(removalStats).toMatchObject({
      createdCount: 0,
      updatedCount: 0,
      reactivatedCount: 0,
      unchangedCount: 0,
      deactivatedCount: 1,
    });
    expect(activeRows).toHaveLength(1);
    expect(activeRows[0].isActive).toBe(false);
  });

  it('uses context hashes to avoid rewriting unchanged active opportunities', async () => {
    await OpportunityPoolService.upsertRefreshedFriendSet(
      ['friend-1'],
      [createOpportunity()]
    );

    const firstRow = (
      await database.get<OpportunityPoolModel>('opportunity_pool').query().fetch()
    )[0];
    const firstUpdatedAt = firstRow.updatedAt.getTime();
    const firstContextHash = firstRow.contextHash;

    const unchangedStats = await OpportunityPoolService.upsertRefreshedFriendSet(
      ['friend-1'],
      [createOpportunity()]
    );

    const secondRow = (
      await database.get<OpportunityPoolModel>('opportunity_pool').query().fetch()
    )[0];

    expect(unchangedStats).toMatchObject({
      createdCount: 0,
      updatedCount: 0,
      reactivatedCount: 0,
      unchangedCount: 1,
      deactivatedCount: 0,
    });
    expect(secondRow.contextHash).toBe(firstContextHash);
    expect(secondRow.updatedAt.getTime()).toBe(firstUpdatedAt);
  });

  it('round-trips persisted opportunities without dropping selector context', async () => {
    await OpportunityPoolService.upsertRefreshedFriendSet(
      ['friend-1'],
      [createOpportunity()]
    );

    const [rehydrated] = await OpportunityPoolService.getActiveOpportunities(['friend-1']);

    expect(rehydrated.friendTier).toBe('InnerCircle');
    expect(rehydrated.momentumScore).toBe(18);
    expect(rehydrated.copyContext).toEqual({
      daysSinceLastInteraction: 12,
      recentInteractionCategory: 'text-call',
      vibeHint: 'warm',
    });
    expect(rehydrated.suggestionPayload).toMatchObject({
      type: 'connect',
      icon: 'MessageCircle',
      action: {
        type: 'plan',
        prefilledCategory: 'text-call',
      },
    });
    expect(rehydrated.presentationCopy).toMatchObject({
      title: 'Make time for Alex around warm',
      actionLabel: 'Plan',
      aiEnriched: true,
    });
  });

  it('records surfaced events into surfacing_log and increments pool counters', async () => {
    await OpportunityPoolService.upsertRefreshedFriendSet(
      ['friend-1'],
      [createOpportunity()]
    );

    await OpportunityPoolService.recordOpportunityEventByIds(['opportunity-1'], 'surfaced', {
      compositeScore: 71,
      scoreBreakdown: { urgency: 20, confidence: 10 },
      surfaceSource: 'selector',
      selectionReason: 'selected',
      surfaceSlot: 'primary',
      opportunitySource: 'pool',
      surfaceRequestKind: 'manual_pull',
      thresholdVariant: 'strict',
      copyVariant: 'why-now',
    });

    const rows = await database.get<OpportunityPoolModel>('opportunity_pool').query().fetch();
    const logs = await database.get<SurfacingLogModel>('surfacing_log').query().fetch();

    expect(rows[0].surfaceCount).toBe(1);
    expect(typeof rows[0].surfacedAt).toBe('number');
    expect(logs).toHaveLength(1);
    expect(logs[0].eventType).toBe('surfaced');
    expect(logs[0].compositeScore).toBe(71);
    expect(logs[0].surfaceSource).toBe('selector');
    expect(logs[0].selectionReason).toBe('selected');
    expect(logs[0].surfaceSlot).toBe('primary');
    expect(logs[0].opportunitySource).toBe('pool');
    expect(logs[0].surfaceRequestKind).toBe('manual_pull');
    expect(logs[0].thresholdVariant).toBe('strict');
    expect(logs[0].copyVariant).toBe('why-now');
    expect(logs[0].presentationCopy).toMatchObject({
      title: 'Make time for Alex around warm',
      actionLabel: 'Plan',
      aiEnriched: true,
    });
  });

  it('records selector quiet events for pacing inspection', async () => {
    await OpportunityPoolService.recordSelectorSystemEvent('quiet', {
      surfaceSource: 'selector',
      selectionReason: 'empty',
      quietReason: 'recently_handled',
      surfaceRequestKind: 'automatic',
      pacingSnapshot: {
        season: 'balanced',
        dailyFreshBudget: 1,
        budgetRemaining: 0,
      },
    });

    const logs = await database.get<SurfacingLogModel>('surfacing_log').query().fetch();

    expect(logs).toHaveLength(1);
    expect(logs[0].opportunityPoolId).toBe('system:selector');
    expect(logs[0].eventType).toBe('quiet');
    expect(logs[0].quietReason).toBe('recently_handled');
    expect(logs[0].surfaceRequestKind).toBe('automatic');
    expect(logs[0].pacingSnapshot).toMatchObject({
      season: 'balanced',
      dailyFreshBudget: 1,
      budgetRemaining: 0,
    });
  });

  it('deactivates expired rows during cleanup', async () => {
    await OpportunityPoolService.upsertRefreshedFriendSet(
      ['friend-1'],
      [createOpportunity({
        timeRelevance: {
          expiresAt: new Date('2026-03-23T11:00:00.000Z').getTime(),
        },
      })]
    );

    const expiredCount = await OpportunityPoolService.cleanupExpiredRows(
      new Date('2026-03-23T12:00:00.000Z').getTime()
    );
    const rows = await database.get<OpportunityPoolModel>('opportunity_pool').query().fetch();

    expect(expiredCount).toBe(1);
    expect(rows[0].isActive).toBe(false);
  });
});
