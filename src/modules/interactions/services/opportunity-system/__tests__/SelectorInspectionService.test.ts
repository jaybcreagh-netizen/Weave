jest.mock('uuid', () => ({
  v4: () => `test-uuid-${Math.random()}`,
}));

import { database } from '@/db';
import { OpportunityPoolService } from '../OpportunityPoolService';
import { SelectorInspectionService } from '../SelectorInspectionService';
import type { Opportunity } from '../types';

function createOpportunity(
  id: string,
  overrides: Partial<Opportunity> = {}
): Opportunity {
  return {
    id,
    friendId: `${id}-friend`,
    friendName: `Friend ${id}`,
    friendTier: 'InnerCircle',
    category: 'maintain',
    generatorSource: 'maintenance-generator',
    urgency: 55,
    confidence: 0.82,
    effortLevel: 'moderate',
    estimatedDurationMinutes: 30,
    momentumScore: 18,
    explanation: {
      whyNow: 'It has been a while.',
      whyThisFriend: 'They matter.',
      whyThisAction: 'A quick plan keeps momentum.',
    },
    timeRelevance: {
      bestWindow: 'evening',
    },
    copyContext: {
      daysSinceLastInteraction: 12,
      recentInteractionCategory: 'text-call',
      vibeHint: 'warm',
    },
    createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    ...overrides,
  };
}

describe('SelectorInspectionService', () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  });

  it('builds a selector inspection report with outcomes, metadata, and summary rollups', async () => {
    const opportunities = [
      createOpportunity('opportunity-1', {
        friendId: 'friend-1',
        friendName: 'Alex',
        category: 'maintain',
      }),
      createOpportunity('opportunity-2', {
        friendId: 'friend-2',
        friendName: 'Blair',
        category: 'signal-repair',
      }),
      createOpportunity('opportunity-3', {
        friendId: 'friend-3',
        friendName: 'Casey',
        category: 'maintain',
      }),
      createOpportunity('opportunity-legacy', {
        friendId: 'friend-4',
        friendName: 'Drew',
        category: 'maintain',
      }),
    ];

    await OpportunityPoolService.upsertRefreshedFriendSet(
      ['friend-1', 'friend-2', 'friend-3', 'friend-4'],
      opportunities
    );

    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 24, 9, 0, 1));
    await OpportunityPoolService.recordOpportunityEventByIds(['opportunity-1'], 'surfaced', {
      compositeScore: 78,
      scoreBreakdown: { urgency: 22, scheduleFit: 18 },
      surfaceSource: 'selector',
      selectionReason: 'selected',
      surfaceSlot: 'primary',
      opportunitySource: 'pool',
      surfaceRequestKind: 'automatic',
    });

    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 24, 9, 0, 2));
    await OpportunityPoolService.recordOpportunityEventByIds(['opportunity-1'], 'acted');

    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 24, 9, 0, 3));
    await OpportunityPoolService.recordOpportunityEventByIds(['opportunity-2'], 'surfaced', {
      compositeScore: 43,
      scoreBreakdown: { urgency: 19, confidence: 4 },
      surfaceSource: 'selector',
      selectionReason: 'selected',
      surfaceSlot: 'secondary',
      opportunitySource: 'pool',
      surfaceRequestKind: 'manual_pull',
    });

    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 24, 9, 0, 4));
    await OpportunityPoolService.recordOpportunityEventByIds(['opportunity-2'], 'dismissed', {
      feedbackType: 'not_now',
    });

    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 24, 9, 0, 5));
    await OpportunityPoolService.recordOpportunityEventByIds(['opportunity-3'], 'surfaced', {
      compositeScore: 39,
      scoreBreakdown: { urgency: 14, scheduleFit: 8 },
      surfaceSource: 'selector',
      selectionReason: 'selected',
      surfaceSlot: 'primary',
      opportunitySource: 'pool',
      surfaceRequestKind: 'automatic',
    });

    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 24, 9, 0, 5, 500));
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

    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 24, 9, 0, 6));
    await OpportunityPoolService.recordOpportunityEventByIds(['opportunity-legacy'], 'surfaced', {
      compositeScore: 61,
      surfaceSource: 'legacy-list',
      selectionReason: 'selected',
      surfaceSlot: 'primary',
      opportunitySource: 'pool',
    });

    const report = await SelectorInspectionService.getInspectionReport({
      limit: 10,
      lookbackMs: 24 * 60 * 60 * 1000,
      now: Date.UTC(2026, 2, 24, 9, 5, 0),
    });

    expect(report.items).toHaveLength(3);
    expect(report.items.map(item => [item.opportunityId, item.outcome])).toEqual([
      ['opportunity-3', 'unresolved'],
      ['opportunity-2', 'dismissed'],
      ['opportunity-1', 'acted'],
    ]);
    expect(report.items[0]).toMatchObject({
      friendName: 'Casey',
      category: 'maintain',
      surfaceSlot: 'primary',
      selectionReason: 'selected',
      opportunitySource: 'pool',
      surfaceRequestKind: 'automatic',
    });
    expect(report.items[1].feedbackType).toBe('not_now');
    expect(report.items[2].presentationCopy).toMatchObject({
      title: 'Make time for Alex around warm',
      actionLabel: 'Plan',
      aiEnriched: true,
    });

    expect(report.summary).toMatchObject({
      surfacedCount: 3,
      actedCount: 1,
      dismissedCount: 1,
      snoozedCount: 0,
      expiredCount: 0,
      unresolvedCount: 1,
      negativeCount: 1,
      actedRate: 0.33,
      negativeRate: 0.33,
      averageCompositeScore: 53.33,
      quietCount: 1,
    });
    expect(report.summary.byRequestKind).toEqual([
      {
        key: 'automatic',
        surfaced: 2,
        acted: 1,
        negative: 0,
        unresolved: 1,
        actedRate: 0.5,
      },
      {
        key: 'manual_pull',
        surfaced: 1,
        acted: 0,
        negative: 1,
        unresolved: 0,
        actedRate: 0,
      },
    ]);
    expect(report.summary.byQuietReason).toEqual([
      {
        key: 'recently_handled',
        count: 1,
      },
    ]);
    expect(report.quietEvents).toEqual([
      expect.objectContaining({
        quietReason: 'recently_handled',
        surfaceRequestKind: 'automatic',
        selectionReason: 'empty',
        pacingSnapshot: expect.objectContaining({
          season: 'balanced',
          dailyFreshBudget: 1,
          budgetRemaining: 0,
        }),
      }),
    ]);
    expect(report.summary.byCategory).toEqual([
      {
        key: 'maintain',
        surfaced: 2,
        acted: 1,
        negative: 0,
        unresolved: 1,
        actedRate: 0.5,
      },
      {
        key: 'signal-repair',
        surfaced: 1,
        acted: 0,
        negative: 1,
        unresolved: 0,
        actedRate: 0,
      },
    ]);
    expect(report.summary.bySurfaceSlot).toEqual([
      {
        key: 'primary',
        surfaced: 2,
        acted: 1,
        negative: 0,
        unresolved: 1,
        actedRate: 0.5,
      },
      {
        key: 'secondary',
        surfaced: 1,
        acted: 0,
        negative: 1,
        unresolved: 0,
        actedRate: 0,
      },
    ]);
    expect(report.summary.byTitle).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'Make time for Alex around warm',
        surfaced: 1,
        acted: 1,
      }),
      expect.objectContaining({
        key: 'Repair the thread with Blair',
        surfaced: 1,
        negative: 1,
      }),
    ]));
  });

  it('applies the item limit without truncating the summary counts', async () => {
    await OpportunityPoolService.upsertRefreshedFriendSet(
      ['friend-1', 'friend-2'],
      [
        createOpportunity('opportunity-1', { friendId: 'friend-1', friendName: 'Alex' }),
        createOpportunity('opportunity-2', { friendId: 'friend-2', friendName: 'Blair' }),
      ]
    );

    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 24, 12, 0, 1));
    await OpportunityPoolService.recordOpportunityEventByIds(['opportunity-1'], 'surfaced', {
      compositeScore: 65,
      surfaceSource: 'selector',
      selectionReason: 'selected',
      surfaceSlot: 'primary',
      opportunitySource: 'pool',
    });

    jest.spyOn(Date, 'now').mockReturnValue(Date.UTC(2026, 2, 24, 12, 0, 2));
    await OpportunityPoolService.recordOpportunityEventByIds(['opportunity-2'], 'surfaced', {
      compositeScore: 45,
      surfaceSource: 'selector',
      selectionReason: 'selected',
      surfaceSlot: 'secondary',
      opportunitySource: 'pool',
    });

    const report = await SelectorInspectionService.getInspectionReport({
      limit: 1,
      now: Date.UTC(2026, 2, 24, 12, 5, 0),
    });

    expect(report.items).toHaveLength(1);
    expect(report.summary.surfacedCount).toBe(2);
  });
});
