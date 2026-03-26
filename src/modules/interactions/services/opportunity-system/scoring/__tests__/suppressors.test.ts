import type { Opportunity } from '../../types';
import {
  evaluateOpportunitySuppressors,
  getSuppressionReasons,
  isOpportunitySuppressed,
} from '../suppressors';
import type { SelectorSignals } from '../score-types';

function createOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'opp-1',
    friendId: 'friend-1',
    friendTier: 'InnerCircle',
    category: 'high-drift',
    generatorSource: 'test',
    urgency: 70,
    confidence: 0.8,
    effortLevel: 'moderate',
    explanation: {
      whyNow: 'Test timing',
      whyThisFriend: 'Test friend',
      whyThisAction: 'Test action',
    },
    timeRelevance: {},
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
    plansThisWeekCount: 1,
    ...overrides,
  };
}

describe('opportunity suppressors', () => {
  it('returns all applicable suppression reasons', () => {
    const opportunity = createOpportunity({
      timeRelevance: { expiresAt: Date.UTC(2026, 2, 23, 8, 0, 0) },
    });
    const signals = createSignals({
      quietHoursActive: true,
      plannedFriendIds: ['friend-1'],
      recentlyInteractedFriendIds: ['friend-1'],
      snoozedOpportunityIds: ['opp-1'],
      suppressedFriendIds: ['friend-1'],
    });

    expect(getSuppressionReasons(opportunity, signals)).toEqual([
      'already_planned',
      'just_interacted',
      'dismissed_or_snoozed',
      'expired',
      'quiet_hours',
      'suppressed_friend',
    ]);
  });

  it('allows critical-override urgency to bypass recent interaction and suppressed-friend gates', () => {
    const opportunity = createOpportunity({ urgency: 90 });
    const signals = createSignals({
      recentlyInteractedFriendIds: ['friend-1'],
      suppressedFriendIds: ['friend-1'],
    });

    expect(isOpportunitySuppressed(opportunity, signals)).toBe(false);
  });

  it('evaluates batches without dropping reason detail', () => {
    const results = evaluateOpportunitySuppressors(
      [createOpportunity(), createOpportunity({ id: 'opp-2', friendId: 'friend-2' })],
      createSignals({ plannedFriendIds: ['friend-1'] })
    );

    expect(results).toHaveLength(2);
    expect(results[0].reasons).toContain('already_planned');
    expect(results[1].reasons).toEqual([]);
  });
});
