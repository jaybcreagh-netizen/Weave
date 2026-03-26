import { FocusSelectorService } from '../FocusSelectorService';
import type { Opportunity } from '../types';
import type { SelectorSignals } from '../scoring/score-types';

function createOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-1',
    friendId: 'friend-1',
    friendTier: 'CloseFriends',
    category: 'deepen',
    generatorSource: 'test',
    urgency: 65,
    confidence: 0.9,
    effortLevel: 'moderate',
    estimatedDurationMinutes: 30,
    explanation: {
      whyNow: 'Good moment',
      whyThisFriend: 'Important friend',
      whyThisAction: 'Easy next step',
    },
    timeRelevance: {
      bestWindow: 'morning',
    },
    createdAt: Date.UTC(2026, 2, 23),
    ...overrides,
  };
}

function createSignals(overrides: Partial<SelectorSignals> = {}): SelectorSignals {
  return {
    now: Date.UTC(2026, 2, 23, 9, 0, 0),
    currentWindow: 'morning',
    nextWindow: 'midday',
    quietHoursActive: false,
    calendarPermissionGranted: true,
    calendarBusyScore: 0.2,
    availableWindowMinutes: 60,
    plansThisWeekCount: 1,
    batteryPercent: 70,
    season: 'balanced',
    recentSurfaced: [],
    ...overrides,
  };
}

describe('FocusSelectorService', () => {
  it('filters suppressed opportunities before scoring and selection', () => {
    const evaluation = FocusSelectorService.evaluate(
      [
        createOpportunity({
          id: 'suppressed',
          friendId: 'friend-suppressed',
        }),
        createOpportunity({
          id: 'eligible',
          friendId: 'friend-eligible',
          intentionId: 'intent-1',
          category: 'life-event',
          urgency: 85,
          friendTier: 'InnerCircle',
          timeRelevance: {
            deadlineAt: Date.UTC(2026, 2, 25, 9, 0, 0),
            bestWindow: 'morning',
          },
        }),
      ],
      createSignals({
        plannedFriendIds: ['friend-suppressed'],
      })
    );

    expect(evaluation.suppressed).toHaveLength(2);
    expect(evaluation.suppressed.find(item => item.opportunity.id === 'suppressed')?.reasons)
      .toContain('already_planned');
    expect(evaluation.eligible.map(item => item.id)).toEqual(['eligible']);
    expect(evaluation.selection.primary?.id).toBe('eligible');
  });

  it('returns empty selection when all opportunities are suppressed', () => {
    const evaluation = FocusSelectorService.evaluate(
      [
        createOpportunity({
          id: 'suppressed-1',
          friendId: 'friend-1',
        }),
      ],
      createSignals({
        quietHoursActive: true,
      })
    );

    expect(evaluation.eligible).toEqual([]);
    expect(evaluation.selection).toEqual({
      primary: null,
      secondary: null,
      reason: 'empty',
    });
  });
});
