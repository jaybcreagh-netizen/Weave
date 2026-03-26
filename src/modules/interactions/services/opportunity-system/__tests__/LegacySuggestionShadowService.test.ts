import type FriendModel from '@/db/models/Friend';
import type Interaction from '@/db/models/Interaction';
import type { Suggestion } from '@/shared/types/common';
import type { FriendContextData } from '../../suggestion-system/SuggestionDataLoader';
import type { Opportunity } from '../types';
import {
  buildLegacySelectorSignals,
  evaluateLegacySuggestionShadow,
} from '../LegacySuggestionShadowService';

function createSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 'suggestion-1',
    friendId: 'friend-1',
    friendName: 'Jordan',
    type: 'connect',
    title: 'Reach out to Jordan',
    subtitle: 'They have been on your mind lately.',
    icon: 'MessageCircle',
    action: {
      type: 'log',
      prefilledCategory: 'text-call',
    },
    category: 'maintain',
    urgency: 'medium',
    actionLabel: 'Reach out',
    dismissible: true,
    createdAt: new Date('2026-03-20T10:00:00.000Z'),
    ...overrides,
  };
}

function createContext(
  friendId: string,
  overrides: Partial<FriendContextData> = {}
): FriendContextData {
  return {
    friend: {
      id: friendId,
      dunbarTier: 'InnerCircle',
    } as FriendModel,
    interactions: [],
    plannedInteractions: [],
    lastDate: null,
    count: 0,
    ...overrides,
  };
}

describe('LegacySuggestionShadowService', () => {
  it('builds selector signals from legacy context', () => {
    const now = new Date('2026-03-23T10:00:00.000Z').getTime();
    const plannedInteraction = {
      interactionDate: new Date('2026-03-25T18:00:00.000Z'),
    } as Interaction;
    const contextMap = new Map<string, FriendContextData>([
      [
        'friend-1',
        createContext('friend-1', {
          plannedInteractions: [plannedInteraction],
          lastDate: now - (24 * 60 * 60 * 1000),
        }),
      ],
    ]);

    const signals = buildLegacySelectorSignals(contextMap, 'balanced', now);

    expect(signals.currentWindow).toBe('morning');
    expect(signals.nextWindow).toBe('midday');
    expect(Array.from(signals.plannedFriendIds || [])).toEqual(['friend-1']);
    expect(Array.from(signals.recentlyInteractedFriendIds || [])).toEqual(['friend-1']);
    expect(signals.plansThisWeekCount).toBe(1);
    expect(signals.season).toBe('balanced');
  });

  it('lets selector signal overrides flow through legacy signal building', () => {
    const now = new Date('2026-03-23T10:00:00.000Z').getTime();

    const signals = buildLegacySelectorSignals(
      new Map([
        ['friend-1', createContext('friend-1')],
      ]),
      'balanced',
      now,
      {
        calendarPermissionGranted: true,
        batteryPercent: 25,
        preferredWindows: ['evening'],
      }
    );

    expect(signals.calendarPermissionGranted).toBe(true);
    expect(signals.batteryPercent).toBe(25);
    expect(signals.preferredWindows).toEqual(['evening']);
  });

  it('uses selector suppressors and returns the adapted legacy winners', () => {
    const now = new Date('2026-03-23T12:00:00.000Z').getTime();
    const contextMap = new Map<string, FriendContextData>([
      [
        'friend-1',
        createContext('friend-1', {
          lastDate: now - (24 * 60 * 60 * 1000),
        }),
      ],
      ['friend-2', createContext('friend-2', { friend: { id: 'friend-2', dunbarTier: 'CloseFriends' } as FriendModel })],
    ]);

    const result = evaluateLegacySuggestionShadow({
      now,
      contextMap,
      suggestions: [
        createSuggestion({
          id: 'suggestion-recent',
          friendId: 'friend-1',
          friendName: 'Jordan',
          urgency: 'medium',
        }),
        createSuggestion({
          id: 'suggestion-open',
          friendId: 'friend-2',
          friendName: 'Casey',
          urgency: 'high',
          category: 'deepen',
          type: 'deepen',
          action: { type: 'plan' },
        }),
      ],
    });

    const suppressed = result.evaluation.suppressed.find(
      entry => entry.opportunity.id === 'suggestion-recent'
    );

    expect(suppressed?.reasons).toContain('just_interacted');
    expect(result.selectedSuggestions.primary?.id).toBe('suggestion-open');
    expect(result.selectedSuggestions.reason).toBe('selected');
  });

  it('uses provided native opportunities when available and still maps winners back to legacy suggestions', () => {
    const now = new Date('2026-03-23T09:00:00.000Z').getTime();
    const suggestion = createSuggestion({
      id: 'intention-reminder-intent-1',
      title: 'Intention for Jordan',
      action: { type: 'plan', prefilledCategory: 'meal-drink' },
    });
    const nativeOpportunity: Opportunity = {
      id: 'intention-reminder-intent-1',
      friendId: 'friend-1',
      friendName: 'Jordan',
      friendTier: 'InnerCircle',
      category: 'intention-reminder',
      generatorSource: 'intention-generator',
      urgency: 84,
      confidence: 0.9,
      effortLevel: 'moderate',
      estimatedDurationMinutes: 30,
      explanation: {
        whyNow: 'This intention has been waiting for a while.',
        whyThisFriend: 'Jordan has an active intention attached.',
        whyThisAction: 'Turn it into a real plan.',
      },
      timeRelevance: {
        bestWindow: 'morning',
      },
      intentionId: 'intent-1',
      createdAt: now,
    };

    const result = evaluateLegacySuggestionShadow({
      now,
      suggestions: [suggestion],
      opportunities: [nativeOpportunity],
      contextMap: new Map([
        ['friend-1', createContext('friend-1')],
      ]),
    });

    expect(result.opportunities[0].category).toBe('intention-reminder');
    expect(result.opportunities[0].intentionId).toBe('intent-1');
    expect(result.selectedSuggestions.primary?.id).toBe('intention-reminder-intent-1');
  });

  it('can surface a pool-only native opportunity even when no legacy suggestion matches it', () => {
    const now = new Date('2026-03-23T09:00:00.000Z').getTime();
    const nativeOpportunity: Opportunity = {
      id: 'pool-only-1',
      friendId: 'friend-1',
      friendName: 'Jordan',
      friendTier: 'InnerCircle',
      category: 'critical-drift',
      generatorSource: 'opportunity-pool',
      urgency: 96,
      confidence: 0.95,
      effortLevel: 'minimal',
      estimatedDurationMinutes: 10,
      explanation: {
        whyNow: 'This persisted opportunity is urgent.',
        whyThisFriend: 'Jordan is drifting quickly.',
        whyThisAction: 'A lightweight reach-out is the best next move.',
      },
      timeRelevance: {
        bestWindow: 'midday',
      },
      createdAt: now,
    };

    const result = evaluateLegacySuggestionShadow({
      now,
      suggestions: [],
      opportunities: [nativeOpportunity],
      contextMap: new Map([
        ['friend-1', createContext('friend-1')],
      ]),
    });

    expect(result.selectedSuggestions.primary?.id).toBe('pool-only-1');
    expect(result.selectedSuggestions.primary?.type).toBe('reconnect');
    expect(result.selectedSuggestions.primary?.action.type).toBe('log');
    expect(result.selectedSuggestions.primary?.title).toBe('Reconnect with Jordan');
  });

  it('triages selector opportunities when too many critical drifts would overwhelm the user', () => {
    const now = new Date('2026-03-23T09:00:00.000Z').getTime();
    const opportunities: Opportunity[] = Array.from({ length: 5 }, (_, index) => ({
      id: `critical-drift-friend-${index + 1}`,
      friendId: `friend-${index + 1}`,
      friendName: `Friend ${index + 1}`,
      friendTier: 'InnerCircle',
      category: 'critical-drift',
      generatorSource: 'drift-generator',
      urgency: 95,
      confidence: 0.9,
      effortLevel: 'minimal',
      estimatedDurationMinutes: 10,
      explanation: {
        whyNow: 'This relationship needs attention now.',
        whyThisFriend: 'This friend is drifting quickly.',
        whyThisAction: 'A lightweight reach-out is the safest next move.',
      },
      timeRelevance: {
        bestWindow: 'midday',
      },
      createdAt: now,
    }));

    const result = evaluateLegacySuggestionShadow({
      now,
      suggestions: [],
      opportunities,
      contextMap: new Map(opportunities.map(opportunity => [
        opportunity.friendId!,
        createContext(opportunity.friendId!, {
          friend: {
            id: opportunity.friendId!,
            dunbarTier: 'InnerCircle',
          } as FriendModel,
        }),
      ])),
    });

    expect(result.opportunities[0].id).toBe('dormant-triage-info');
    expect(result.opportunities.filter(opportunity => opportunity.category === 'critical-drift')).toHaveLength(3);
    expect(result.selectedSuggestions.primary?.id).toBe('critical-drift-friend-1');
    expect(result.selectedSuggestions.primary?.title).toBe('Reconnect with Friend 1');
  });

  it('passes selector tuning options through to the selector evaluation', () => {
    const now = new Date('2026-03-23T09:00:00.000Z').getTime();
    const suggestion = createSuggestion({
      id: 'threshold-sensitive',
      category: 'maintain',
      urgency: 'medium',
    });

    const result = evaluateLegacySuggestionShadow({
      now,
      suggestions: [suggestion],
      contextMap: new Map([
        ['friend-1', createContext('friend-1')],
      ]),
      selectorOptions: {
        selectionConfig: {
          minThreshold: 999,
          secondaryRatio: 0.6,
        },
      },
    });

    expect(result.selectedSuggestions.primary).toBeNull();
    expect(result.selectedSuggestions.reason).toBe('below_threshold');
  });
});
