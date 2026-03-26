import type FriendModel from '@/db/models/Friend';
import type { Suggestion } from '@/shared/types/common';
import type { FriendContextData } from '../../suggestion-system/SuggestionDataLoader';
import {
  resolveSelectorOpportunities,
  synthesizeNativeOpportunities,
  synthesizeSelectorOpportunities,
} from '../OpportunitySynthesisService';
import { findAgingIntentionReminder } from '../../suggestion-engine/generators/intention-reminder.shared';
import { findUpcomingLifeEvent } from '../../suggestion-engine/generators/life-event.shared';
import { WeeklyReflectionGenerator } from '../../suggestion-engine/generators/WeeklyReflectionGenerator';
import { SignalDrivenGenerator } from '../../suggestion-engine/generators/SignalDrivenGenerator';
import { generateMemoryLifeEventOpportunities } from '../../suggestion-engine/generators/memory-life-event.shared';
import { OpportunityPoolService } from '../OpportunityPoolService';
import { generateProactiveSuggestions } from '@/modules/insights/services/prediction.service';
import { getArchetypePreferredCategory } from '@/shared/constants/archetype-content';

jest.mock('@/modules/intelligence/services/orchestrator.service', () => ({
  calculateCurrentScore: jest.fn((friend: { weaveScore?: number }) => friend.weaveScore || 0),
}));

jest.mock('../../suggestion-engine/generators/intention-reminder.shared', () => {
  const actual = jest.requireActual('../../suggestion-engine/generators/intention-reminder.shared');
  return {
    ...actual,
    findAgingIntentionReminder: jest.fn(),
  };
});

jest.mock('../../suggestion-engine/generators/life-event.shared', () => {
  const actual = jest.requireActual('../../suggestion-engine/generators/life-event.shared');
  return {
    ...actual,
    findUpcomingLifeEvent: jest.fn(),
  };
});

jest.mock('../../suggestion-engine/generators/SignalDrivenGenerator', () => ({
  SignalDrivenGenerator: {
    generate: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../suggestion-engine/generators/memory-life-event.shared', () => ({
  generateMemoryLifeEventOpportunities: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/modules/insights/services/prediction.service', () => {
  const actual = jest.requireActual('@/modules/insights/services/prediction.service');
  return {
    ...actual,
    generateProactiveSuggestions: jest.fn(() => []),
  };
});

jest.mock('../OpportunityPoolService', () => ({
  OpportunityPoolService: {
    getActiveOpportunities: jest.fn().mockResolvedValue([]),
  },
}));

function createSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 'suggestion-1',
    friendId: 'friend-1',
    friendName: 'Alex',
    type: 'connect',
    title: 'Check in with Alex',
    subtitle: 'It has been a while since you last spoke.',
    icon: 'MessageCircle',
    action: {
      type: 'plan',
      prefilledCategory: 'text-call',
    },
    category: 'maintain',
    urgency: 'medium',
    actionLabel: 'Plan',
    dismissible: true,
    createdAt: new Date('2026-03-20T10:00:00.000Z'),
    trackingContext: {
      friendScore: 42,
      daysSinceLastInteraction: 14,
    },
    ...overrides,
  };
}

function createContext(friendId: string, friendName: string = 'Alex'): FriendContextData {
  return {
    friend: {
      id: friendId,
      name: friendName,
      dunbarTier: 'InnerCircle',
      archetype: 'Magician',
      weaveScore: 42,
      momentumScore: 50,
      momentumLastUpdated: new Date('2026-03-20T10:00:00.000Z'),
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      birthday: undefined,
      anniversary: undefined,
      relationshipType: undefined,
    } as unknown as FriendModel,
    interactions: [],
    plannedInteractions: [],
    lastDate: null,
    count: 0,
  };
}

describe('OpportunitySynthesisService', () => {
  const originalOpportunityPoolFlag = process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    (findAgingIntentionReminder as jest.Mock).mockResolvedValue(null);
    (findUpcomingLifeEvent as jest.Mock).mockResolvedValue(null);
    jest.spyOn(WeeklyReflectionGenerator, 'generateOpportunity').mockResolvedValue(null);
    (SignalDrivenGenerator.generate as jest.Mock).mockResolvedValue([]);
    (generateMemoryLifeEventOpportunities as jest.Mock).mockResolvedValue([]);
    (generateProactiveSuggestions as jest.Mock).mockReturnValue([]);
    delete process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED;
  });

  afterAll(() => {
    if (originalOpportunityPoolFlag === undefined) {
      delete process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED;
    } else {
      process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED = originalOpportunityPoolFlag;
    }
  });

  it('replaces an adapted legacy opportunity with native intention data when available', async () => {
    (findAgingIntentionReminder as jest.Mock).mockResolvedValue({
      id: 'intent-1',
      description: 'Plan that coffee catch-up',
      interactionCategory: 'meal-drink',
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      status: 'active',
    });

    const opportunities = await synthesizeSelectorOpportunities({
      suggestions: [
        createSuggestion({
          id: 'intention-reminder-intent-1',
          title: 'Intention for Alex',
        }),
      ],
      contextMap: new Map([
        ['friend-1', createContext('friend-1')],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    const intentionOpportunity = opportunities.find(
      opportunity => opportunity.id === 'intention-reminder-intent-1'
    );

    expect(intentionOpportunity).toBeDefined();
    expect(intentionOpportunity?.category).toBe('intention-reminder');
    expect(intentionOpportunity?.intentionId).toBe('intent-1');
    expect(intentionOpportunity?.friendName).toBe('Alex');
    expect(intentionOpportunity?.copyContext?.recentInteractionCategory).toBe('meal-drink');
  });

  it('falls back to adapted legacy suggestions when no native opportunity exists', async () => {
    const opportunities = await synthesizeSelectorOpportunities({
      suggestions: [
        createSuggestion({
          id: 'drift-1',
          category: 'drift',
          urgency: 'high',
        }),
      ],
      contextMap: new Map([
        ['friend-1', createContext('friend-1')],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    const legacyOpportunity = opportunities.find(opportunity => opportunity.id === 'drift-1');

    expect(legacyOpportunity).toBeDefined();
    expect(legacyOpportunity?.category).toBe('high-drift');
    expect(legacyOpportunity?.intentionId).toBeUndefined();
  });

  it('overlays matching persisted pool opportunities when the pool is enabled', async () => {
    process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED = 'true';
    (OpportunityPoolService.getActiveOpportunities as jest.Mock).mockResolvedValue([
      {
        id: 'drift-1',
        friendId: 'friend-1',
        friendName: 'Alex',
        friendTier: 'InnerCircle',
        category: 'high-drift',
        generatorSource: 'opportunity-pool',
        urgency: 92,
        confidence: 0.95,
        effortLevel: 'minimal',
        estimatedDurationMinutes: 10,
        explanation: {
          whyNow: 'Persisted urgency is higher.',
          whyThisFriend: 'Alex needs attention.',
          whyThisAction: 'Reach out now.',
        },
        timeRelevance: {
          bestWindow: 'afternoon',
        },
        createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
      },
    ]);

    const result = await resolveSelectorOpportunities({
      suggestions: [
        createSuggestion({
          id: 'drift-1',
          category: 'drift',
          urgency: 'high',
        }),
      ],
      friendIds: ['friend-1'],
      contextMap: new Map([
        ['friend-1', createContext('friend-1')],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    expect(OpportunityPoolService.getActiveOpportunities).toHaveBeenCalledWith(['friend-1']);
    expect(result.source).toBe('pool');
    expect(result.opportunities[0].generatorSource).toBe('opportunity-pool');
    expect(result.opportunities[0].urgency).toBe(92);
  });

  it('includes pool-only opportunities alongside synthesized selector opportunities', async () => {
    process.env.EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED = 'true';
    (OpportunityPoolService.getActiveOpportunities as jest.Mock).mockResolvedValue([
      {
        id: 'pool-only-1',
        friendId: 'friend-1',
        friendName: 'Alex',
        friendTier: 'InnerCircle',
        category: 'deepen',
        generatorSource: 'opportunity-pool',
        urgency: 88,
        confidence: 0.9,
        effortLevel: 'moderate',
        estimatedDurationMinutes: 30,
        explanation: {
          whyNow: 'The pool has an additional deepen opportunity.',
          whyThisFriend: 'Alex has room for a deeper connection.',
          whyThisAction: 'A plan would move things forward.',
        },
        timeRelevance: {
          bestWindow: 'evening',
        },
        createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
      },
    ]);

    const result = await resolveSelectorOpportunities({
      suggestions: [
        createSuggestion({
          id: 'suggestion-1',
        }),
      ],
      friendIds: ['friend-1'],
      contextMap: new Map([
        ['friend-1', createContext('friend-1')],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    expect(result.source).toBe('pool');
    expect(result.opportunities.some(opportunity => opportunity.id === 'suggestion-1')).toBe(true);
    expect(result.opportunities.some(opportunity => opportunity.id === 'pool-only-1')).toBe(true);
  });

  it('returns native opportunities without matching legacy suggestions when preferNative is enabled', async () => {
    (findAgingIntentionReminder as jest.Mock).mockResolvedValue({
      id: 'intent-1',
      description: 'Plan that coffee catch-up',
      interactionCategory: 'meal-drink',
      createdAt: new Date('2026-03-01T10:00:00.000Z'),
      status: 'active',
    });

    const opportunities = await synthesizeSelectorOpportunities({
      suggestions: [],
      contextMap: new Map([
        ['friend-1', createContext('friend-1')],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
      preferNative: true,
    });

    expect(opportunities.some(opportunity => opportunity.id === 'intention-reminder-intent-1')).toBe(true);
  });

  it('replaces adapted drift suggestions with native drift opportunities', async () => {
    const opportunities = await synthesizeSelectorOpportunities({
      suggestions: [
        createSuggestion({
          id: 'high-drift-friend-1',
          category: 'high-drift',
          urgency: 'high',
          type: 'reconnect',
        }),
      ],
      contextMap: new Map([
        ['friend-1', {
          ...createContext('friend-1'),
          friend: {
            ...createContext('friend-1').friend,
            weaveScore: 40,
          } as unknown as FriendModel,
        }],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    const driftOpportunity = opportunities.find(
      opportunity => opportunity.id === 'high-drift-friend-1'
    );

    expect(driftOpportunity).toBeDefined();
    expect(driftOpportunity?.generatorSource).toBe('drift-generator');
    expect(driftOpportunity?.explanation.whyThisFriend).toContain('Alex');
  });

  it('replaces adapted life-event suggestions with native life-event opportunities', async () => {
    (findUpcomingLifeEvent as jest.Mock).mockResolvedValue({
      id: 'life-1',
      type: 'birthday',
      daysUntil: 1,
      importance: 'high',
    });

    const opportunities = await synthesizeSelectorOpportunities({
      suggestions: [
        createSuggestion({
          id: 'life-event-life-1',
          category: 'life-event',
          title: "Alex's birthday tomorrow",
          urgency: 'critical',
        }),
      ],
      contextMap: new Map([
        ['friend-1', createContext('friend-1')],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    const lifeEventOpportunity = opportunities.find(
      opportunity => opportunity.id === 'life-event-life-1'
    );

    expect(lifeEventOpportunity).toBeDefined();
    expect(lifeEventOpportunity?.category).toBe('life-event');
    expect(lifeEventOpportunity?.generatorSource).toBe('life-event-generator');
    expect(lifeEventOpportunity?.urgency).toBe(92);
  });

  it('synthesizes planned-weave and reflection opportunities in the full native pool', async () => {
    const now = new Date('2026-03-23T10:00:00.000Z');

    const opportunities = await synthesizeNativeOpportunities({
      contextMap: new Map([
        ['friend-1', {
          ...createContext('friend-1'),
          interactions: [{
            id: 'interaction-1',
            interactionDate: new Date('2026-03-23T08:00:00.000Z'),
            interactionCategory: 'meal-drink',
            note: '',
            vibe: '',
          }] as any,
          plannedInteractions: [{
            id: 'plan-1',
            interactionDate: new Date('2026-03-23T18:00:00.000Z'),
            endDate: new Date('2026-03-23T19:00:00.000Z'),
            interactionCategory: 'hangout',
          }] as any,
          count: 1,
          lastDate: new Date('2026-03-23T08:00:00.000Z').getTime(),
        }],
      ]),
      now,
    });

    expect(opportunities.some(opportunity => opportunity.id === 'upcoming-plan-plan-1')).toBe(true);
    expect(opportunities.some(opportunity => opportunity.id === 'reflect-interaction-1')).toBe(true);
  });

  it('synthesizes momentum and deepen opportunities in the full native pool', async () => {
    const now = new Date('2026-03-23T10:00:00.000Z');

    const opportunities = await synthesizeNativeOpportunities({
      contextMap: new Map([
        ['friend-1', {
          ...createContext('friend-1'),
          friend: {
            ...createContext('friend-1').friend,
            weaveScore: 90,
            momentumScore: 22,
          } as unknown as FriendModel,
          interactions: [{
            id: 'interaction-2',
            interactionDate: new Date('2026-03-22T12:00:00.000Z'),
            interactionCategory: 'deep-talk',
            note: 'Great conversation',
            vibe: 'positive',
          }] as any,
          count: 1,
          lastDate: new Date('2026-03-22T12:00:00.000Z').getTime(),
        }],
      ]),
      now,
    });

    expect(opportunities.some(opportunity => opportunity.id === 'momentum-friend-1')).toBe(true);
    expect(opportunities.some(opportunity => opportunity.id === 'deepen-friend-1')).toBe(true);
  });

  it('synthesizes a first-weave opportunity in the full native pool', async () => {
    const now = new Date('2026-03-23T10:00:00.000Z');

    const opportunities = await synthesizeNativeOpportunities({
      contextMap: new Map([
        ['friend-1', {
          ...createContext('friend-1'),
          count: 0,
          interactions: [],
          lastDate: null,
        }],
      ]),
      now,
    });

    expect(opportunities.some(opportunity => opportunity.id === 'first-weave-friend-1')).toBe(true);
  });

  it('includes global native opportunities even without friend context', async () => {
    jest.spyOn(WeeklyReflectionGenerator, 'generateOpportunity').mockResolvedValue({
      id: 'weekly-reflection-sunday',
      category: 'daily-reflect',
      generatorSource: 'weekly-reflection-generator',
      urgency: 78,
      confidence: 0.95,
      effortLevel: 'minimal',
      estimatedDurationMinutes: 10,
      explanation: {
        whyNow: 'Take a moment to look back on your week.',
        whyThisFriend: 'A weekly reflection helps you notice what is working.',
        whyThisAction: 'A short reflection can turn the week into something you learn from.',
      },
      timeRelevance: {
        bestWindow: 'evening',
      },
      createdAt: new Date('2026-03-22T10:00:00.000Z').getTime(),
    });

    const opportunities = await synthesizeNativeOpportunities({
      now: new Date('2026-03-22T10:00:00.000Z'),
    });

    expect(opportunities.map(opportunity => opportunity.id)).toContain('weekly-reflection-sunday');
  });

  it('includes signal-driven opportunities with dedicated signal metadata', async () => {
    (SignalDrivenGenerator.generate as jest.Mock).mockResolvedValue([
      createSuggestion({
        id: 'signal-reconnect-1',
        category: 'signal-reconnect',
        urgency: 'high',
        friendId: 'friend-1',
        friendName: 'Alex',
        signalContext: {
          source: 'dynamics',
          type: 'reconnection',
        },
      }),
    ]);

    const opportunities = await synthesizeNativeOpportunities({
      contextMap: new Map([
        ['friend-1', createContext('friend-1')],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    const signalOpportunity = opportunities.find(
      opportunity => opportunity.id === 'signal-reconnect-1'
    );

    expect(signalOpportunity).toBeDefined();
    expect(signalOpportunity?.generatorSource).toBe('signal-reconnect');
    expect(signalOpportunity?.category).toBe('signal-reconnect');
    expect(signalOpportunity?.explanation.whyThisFriend).toContain('reconnection-friendly signals');
  });

  it('includes native memory life-event opportunities in synthesis', async () => {
    (generateMemoryLifeEventOpportunities as jest.Mock).mockResolvedValue([
      {
        id: 'memory-life-event-memory-1',
        friendId: 'friend-1',
        friendName: 'Alex',
        friendTier: 'InnerCircle',
        category: 'life-event',
        generatorSource: 'memory-life-event-generator',
        urgency: 76,
        confidence: 0.86,
        effortLevel: 'moderate',
        estimatedDurationMinutes: 20,
        explanation: {
          whyNow: 'You noted a milestone worth capturing.',
          whyThisFriend: 'Alex has a milestone in your notes.',
          whyThisAction: 'Save it as a life event so it stays visible.',
        },
        timeRelevance: {
          bestWindow: 'afternoon',
        },
        presentationCopy: {
          title: 'Capture a milestone for Alex',
          subtitle: 'You noted "New job". Save it as a life event so it stays visible.',
          actionLabel: 'Add Life Event',
          reason: 'You noted a milestone worth capturing.',
        },
        suggestionPayload: {
          type: 'celebrate',
          icon: 'Gift',
          dismissible: true,
          action: {
            type: 'life-event',
            lifeEventTitle: 'New job',
          },
        },
        createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
      },
    ]);

    const opportunities = await synthesizeNativeOpportunities({
      contextMap: new Map([
        ['friend-1', createContext('friend-1')],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    const memoryOpportunity = opportunities.find(
      opportunity => opportunity.id === 'memory-life-event-memory-1'
    );

    expect(memoryOpportunity).toBeDefined();
    expect(memoryOpportunity?.generatorSource).toBe('memory-life-event-generator');
    expect(memoryOpportunity?.suggestionPayload?.action?.type).toBe('life-event');
  });

  it('includes native proactive opportunities in synthesis', async () => {
    (generateProactiveSuggestions as jest.Mock).mockReturnValue([
      {
        type: 'optimal-timing',
        friendId: 'friend-1',
        friendName: 'Alex',
        title: 'Perfect time to connect with Alex',
        message: 'Your pattern says this is the ideal window.',
        daysUntil: 1,
        urgency: 'medium',
      },
    ]);

    const opportunities = await synthesizeNativeOpportunities({
      contextMap: new Map([
        ['friend-1', {
          ...createContext('friend-1'),
          interactions: [
            {
              id: 'interaction-1',
              interactionDate: new Date('2026-03-20T10:00:00.000Z'),
              interactionCategory: 'text-call',
            },
            {
              id: 'interaction-2',
              interactionDate: new Date('2026-03-10T10:00:00.000Z'),
              interactionCategory: 'text-call',
            },
          ] as any,
          count: 2,
          lastDate: new Date('2026-03-20T10:00:00.000Z').getTime(),
        }],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    const proactiveOpportunity = opportunities.find(
      opportunity => opportunity.id === 'proactive-optimal-timing-friend-1'
    );

    expect(generateProactiveSuggestions).toHaveBeenCalled();
    expect(proactiveOpportunity).toBeDefined();
    expect(proactiveOpportunity?.generatorSource).toBe('proactive-optimal-timing');
    expect(proactiveOpportunity?.category).toBe('maintain');
    expect(proactiveOpportunity?.explanation.whyNow).toBe('Your pattern says this is the ideal window.');
  });

  it('includes native portfolio opportunities in synthesis', async () => {
    const opportunities = await synthesizeNativeOpportunities({
      contextMap: new Map([
        ['inner-1', {
          ...createContext('inner-1', 'Ava'),
          friend: {
            ...createContext('inner-1', 'Ava').friend,
            dunbarTier: 'InnerCircle',
            weaveScore: 82,
          } as unknown as FriendModel,
        }],
        ['close-1', {
          ...createContext('close-1', 'Ben'),
          friend: {
            ...createContext('close-1', 'Ben').friend,
            dunbarTier: 'CloseFriends',
            weaveScore: 30,
          } as unknown as FriendModel,
        }],
        ['close-2', {
          ...createContext('close-2', 'Cara'),
          friend: {
            ...createContext('close-2', 'Cara').friend,
            dunbarTier: 'CloseFriends',
            weaveScore: 35,
          } as unknown as FriendModel,
        }],
        ['close-3', {
          ...createContext('close-3', 'Dee'),
          friend: {
            ...createContext('close-3', 'Dee').friend,
            dunbarTier: 'CloseFriends',
            weaveScore: 40,
          } as unknown as FriendModel,
        }],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    const portfolioOpportunity = opportunities.find(
      opportunity => opportunity.id === 'portfolio-tier-imbalance'
    );

    expect(portfolioOpportunity).toBeDefined();
    expect(portfolioOpportunity?.generatorSource).toBe('portfolio-tier-imbalance');
    expect(portfolioOpportunity?.category).toBe('portfolio');
    expect(portfolioOpportunity?.explanation.whyNow).toContain('Close Friends');
  });

  it('includes native reciprocity opportunities in synthesis', async () => {
    const opportunities = await synthesizeNativeOpportunities({
      contextMap: new Map([
        ['friend-1', {
          ...createContext('friend-1'),
          friend: {
            ...createContext('friend-1').friend,
            initiationRatio: 0.85,
            consecutiveUserInitiations: 4,
            totalUserInitiations: 5,
            totalFriendInitiations: 1,
          } as unknown as FriendModel,
        }],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    const reciprocityOpportunity = opportunities.find(
      opportunity => opportunity.id === 'reciprocity-imbalance-friend-1'
    );

    expect(reciprocityOpportunity).toBeDefined();
    expect(reciprocityOpportunity?.generatorSource).toBe('reciprocity-imbalance');
    expect(reciprocityOpportunity?.category).toBe('insight');
    expect(reciprocityOpportunity?.explanation.whyNow).toContain("You've initiated 4 times in a row");
  });

  it('includes native insight opportunities in synthesis', async () => {
    const baseContext = createContext('friend-1');
    const preferredCategory = getArchetypePreferredCategory(baseContext.friend.archetype);
    const alternateCategory = preferredCategory === 'text-call' ? 'hangout' : 'text-call';

    const opportunities = await synthesizeNativeOpportunities({
      contextMap: new Map([
        ['friend-1', {
          ...baseContext,
          interactions: [
            {
              id: 'interaction-1',
              interactionDate: new Date('2026-03-22T10:00:00.000Z'),
              interactionCategory: alternateCategory,
            },
            {
              id: 'interaction-2',
              interactionDate: new Date('2026-03-16T10:00:00.000Z'),
              interactionCategory: alternateCategory,
            },
            {
              id: 'interaction-3',
              interactionDate: new Date('2026-03-09T10:00:00.000Z'),
              interactionCategory: alternateCategory,
            },
          ] as any,
          count: 3,
          lastDate: new Date('2026-03-22T10:00:00.000Z').getTime(),
        }],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    const insightOpportunity = opportunities.find(
      opportunity => opportunity.id === 'archetype-mismatch-friend-1'
    );

    expect(insightOpportunity).toBeDefined();
    expect(insightOpportunity?.generatorSource).toBe('archetype-mismatch');
    expect(insightOpportunity?.category).toBe('archetype-mismatch');
    expect(insightOpportunity?.copyContext?.recentInteractionCategory).toBe(preferredCategory);
  });

  it('includes native optimization opportunities in synthesis', async () => {
    const opportunities = await synthesizeNativeOpportunities({
      contextMap: new Map([
        ['friend-1', {
          ...createContext('friend-1'),
          friend: {
            ...createContext('friend-1').friend,
            weaveScore: 92,
          } as unknown as FriendModel,
          interactions: [
            {
              id: 'interaction-1',
              interactionDate: new Date('2026-03-20T10:00:00.000Z'),
              interactionCategory: 'hangout',
            },
            {
              id: 'interaction-2',
              interactionDate: new Date('2026-03-12T10:00:00.000Z'),
              interactionCategory: 'activity-hobby',
            },
          ] as any,
          count: 2,
          lastDate: new Date('2026-03-20T10:00:00.000Z').getTime(),
        }],
      ]),
      now: new Date('2026-03-23T10:00:00.000Z'),
    });

    const optimizationOpportunity = opportunities.find(
      opportunity => opportunity.id === 'optimization-novelty-friend-1'
    );

    expect(optimizationOpportunity).toBeDefined();
    expect(optimizationOpportunity?.generatorSource).toBe('optimization-novelty');
    expect(optimizationOpportunity?.category).toBe('variety');
    expect(optimizationOpportunity?.copyContext?.recentInteractionCategory).toBeDefined();
  });

  it('includes native holiday opportunities in synthesis', async () => {
    const opportunities = await synthesizeNativeOpportunities({
      contextMap: new Map([
        ['friend-1', {
          ...createContext('friend-1'),
          friend: {
            ...createContext('friend-1').friend,
            weaveScore: 92,
          } as unknown as FriendModel,
        }],
      ]),
      now: new Date('2026-12-24T10:00:00.000Z'),
    });

    const holidayOpportunity = opportunities.find(
      opportunity => opportunity.id.startsWith('holiday-')
    );

    expect(holidayOpportunity).toBeDefined();
    expect(holidayOpportunity?.generatorSource.startsWith('holiday-')).toBe(true);
    expect(['celebrate', 'maintain']).toContain(holidayOpportunity?.category);
    expect(holidayOpportunity?.copyContext?.vibeHint).toBeDefined();
  });

  it('suppresses holiday opportunities for lower-health relationships', async () => {
    const opportunities = await synthesizeNativeOpportunities({
      contextMap: new Map([
        ['friend-1', createContext('friend-1')],
      ]),
      now: new Date('2026-12-24T10:00:00.000Z'),
    });

    const holidayOpportunity = opportunities.find(
      opportunity => opportunity.id.startsWith('holiday-')
    );

    expect(holidayOpportunity).toBeUndefined();
  });
});
