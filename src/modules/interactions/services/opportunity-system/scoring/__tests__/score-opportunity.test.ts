import type { Opportunity } from '../../types';
import {
  scoreOpportunity,
  scoreOpportunities,
  selectOpportunities,
} from '../score-opportunity';
import type { SelectorSignals } from '../score-types';

function createOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-1',
    friendId: 'friend-1',
    friendTier: 'CloseFriends',
    category: 'deepen',
    generatorSource: 'test',
    urgency: 60,
    confidence: 0.9,
    effortLevel: 'moderate',
    estimatedDurationMinutes: 30,
    momentumScore: 5,
    explanation: {
      whyNow: 'Good timing',
      whyThisFriend: 'Important relationship',
      whyThisAction: 'Concrete next step',
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
    recentSurfaced: [
      {
        opportunityId: 'recent-1',
        friendId: 'friend-3',
        friendTier: 'InnerCircle',
        category: 'high-drift',
        surfacedAt: Date.UTC(2026, 2, 22, 12, 0, 0),
      },
    ],
    ...overrides,
  };
}

describe('opportunity scoring', () => {
  it('lets intention alignment overcome a higher-urgency but poorly timed option', () => {
    const anna = createOpportunity({
      id: 'anna',
      friendId: 'anna',
      intentionId: 'intent-1',
      friendTier: 'Community',
    });
    const marcus = createOpportunity({
      id: 'marcus',
      friendId: 'marcus',
      category: 'high-drift',
      urgency: 80,
      effortLevel: 'high',
      confidence: 0.9,
      friendTier: 'InnerCircle',
      timeRelevance: { bestWindow: 'night' },
    });

    const annaScore = scoreOpportunity(anna, createSignals());
    const marcusScore = scoreOpportunity(marcus, createSignals({
      calendarBusyScore: 0.9,
      batteryPercent: 40,
      recentSurfaced: [
        {
          opportunityId: 'recent-2',
          friendId: 'other-marcus',
          friendTier: 'InnerCircle',
          category: 'high-drift',
          surfacedAt: Date.UTC(2026, 2, 23, 7, 0, 0),
        },
      ],
    }));

    expect(annaScore.totalScore).toBeGreaterThan(marcusScore.totalScore);
    expect(annaScore.scoreBreakdown.intentionAlignment).toBe(15);
  });

  it('heavily penalizes resting-season nonessential opportunities', () => {
    const maintain = createOpportunity({
      category: 'maintain',
      effortLevel: 'high',
    });
    const lifeEvent = createOpportunity({
      category: 'life-event',
      urgency: 90,
    });

    const restingSignals = createSignals({
      season: 'resting',
      batteryPercent: 20,
    });

    const maintainScore = scoreOpportunity(maintain, restingSignals);
    const lifeEventScore = scoreOpportunity(lifeEvent, restingSignals);

    expect(maintainScore.scoreBreakdown.batterySeasonFit).toBeLessThan(
      lifeEventScore.scoreBreakdown.batterySeasonFit
    );
    expect(maintainScore.scoreBreakdown.seasonAdjustment).toBeLessThan(0);
    expect(lifeEventScore.scoreBreakdown.seasonAdjustment).toBe(0);
  });

  it('boosts noncritical opportunities a bit more in blooming season', () => {
    const opportunity = createOpportunity({
      category: 'maintain',
      urgency: 55,
    });

    const balancedScore = scoreOpportunity(
      opportunity,
      createSignals({ season: 'balanced' })
    );
    const bloomingScore = scoreOpportunity(
      opportunity,
      createSignals({ season: 'blooming' })
    );

    expect(balancedScore.scoreBreakdown.seasonAdjustment).toBe(0);
    expect(bloomingScore.scoreBreakdown.seasonAdjustment).toBeGreaterThan(0);
    expect(bloomingScore.totalScore).toBeGreaterThan(balancedScore.totalScore);
  });

  it('reduces schedule fit outside the user preferred windows', () => {
    const preferredWindowScore = scoreOpportunity(
      createOpportunity(),
      createSignals({
        preferredWindows: ['morning', 'evening'],
      })
    );

    const outsidePreferredWindowScore = scoreOpportunity(
      createOpportunity(),
      createSignals({
        currentWindow: 'afternoon',
        nextWindow: 'evening',
        preferredWindows: ['morning', 'evening'],
      })
    );

    expect(outsidePreferredWindowScore.scoreBreakdown.scheduleFit).toBeLessThan(
      preferredWindowScore.scoreBreakdown.scheduleFit
    );
    expect(outsidePreferredWindowScore.scoreBreakdown.whyNowStrength).toBeLessThan(
      preferredWindowScore.scoreBreakdown.whyNowStrength
    );
  });

  it('selects a diverse secondary above the configured ratio', () => {
    const scored = scoreOpportunities(
      [
        createOpportunity({
          id: 'primary',
          friendId: 'friend-primary',
          category: 'deepen',
          friendTier: 'CloseFriends',
          intentionId: 'intent-1',
        }),
        createOpportunity({
          id: 'secondary',
          friendId: 'friend-secondary',
          category: 'life-event',
          friendTier: 'InnerCircle',
          urgency: 88,
          timeRelevance: {
            deadlineAt: Date.UTC(2026, 2, 25, 9, 0, 0),
            bestWindow: 'morning',
          },
        }),
        createOpportunity({
          id: 'too-low',
          friendId: 'friend-low',
          category: 'deepen',
          friendTier: 'CloseFriends',
          urgency: 10,
          confidence: 0.2,
        }),
      ],
      createSignals()
    );

    const selection = selectOpportunities(scored, {
      minThreshold: 35,
      secondaryRatio: 0.6,
    });

    expect(selection.reason).toBe('selected');
    expect(selection.primary?.id).toBe('primary');
    expect(selection.secondary?.id).toBe('secondary');
  });

  it('returns below-threshold when nothing is compelling enough', () => {
    const lowScored = scoreOpportunities(
      [
        createOpportunity({
          urgency: 5,
          confidence: 0.1,
          effortLevel: 'high',
          category: 'maintain',
          timeRelevance: { bestWindow: 'night' },
        }),
      ],
      createSignals({
        calendarBusyScore: 1,
        batteryPercent: 10,
        season: 'resting',
      })
    );

    expect(selectOpportunities(lowScored, {
      minThreshold: 35,
      secondaryRatio: 0.6,
    })).toEqual({
      primary: null,
      secondary: null,
      reason: 'below_threshold',
    });
  });
});
