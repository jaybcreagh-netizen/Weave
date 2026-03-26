import type { Suggestion } from '@/shared/types/common';
import {
  opportunityToSuggestion,
  adaptSelectionToSuggestions,
  adaptSuggestionsToOpportunities,
  suggestionToOpportunity,
} from '../OpportunityAdapter';
import type { Opportunity, SelectionResult } from '../types';

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
    category: 'drift',
    urgency: 'high',
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

describe('OpportunityAdapter', () => {
  it('maps a legacy suggestion into a normalized opportunity', () => {
    const opportunity = suggestionToOpportunity(createSuggestion(), {
      friendTier: 'InnerCircle',
    });

    expect(opportunity.category).toBe('high-drift');
    expect(opportunity.friendTier).toBe('InnerCircle');
    expect(opportunity.urgency).toBe(75);
    expect(opportunity.effortLevel).toBe('moderate');
    expect(opportunity.timeRelevance.bestWindow).toBe('morning');
    expect(opportunity.copyContext?.daysSinceLastInteraction).toBe(14);
  });

  it('falls back to suggestion type when category is missing', () => {
    const opportunity = suggestionToOpportunity(
      createSuggestion({
        category: undefined,
        type: 'celebrate',
        action: { type: 'life-event' },
      })
    );

    expect(opportunity.category).toBe('celebrate');
    expect(opportunity.effortLevel).toBe('high');
  });

  it('maps selection results back to the original legacy suggestions', () => {
    const suggestions = [
      createSuggestion(),
      createSuggestion({
        id: 'suggestion-2',
        friendId: 'friend-2',
        friendName: 'Sam',
      }),
    ];
    const opportunities = adaptSuggestionsToOpportunities(suggestions);
    const selection: SelectionResult = {
      primary: { ...opportunities[0], scoreBreakdown: {} as any, totalScore: 50 },
      secondary: { ...opportunities[1], scoreBreakdown: {} as any, totalScore: 45 },
      reason: 'selected',
    };

    const adapted = adaptSelectionToSuggestions(selection, suggestions);

    expect(adapted.primary?.id).toBe('suggestion-1');
    expect(adapted.secondary?.id).toBe('suggestion-2');
    expect(adapted.reason).toBe('selected');
  });

  it('renders proactive native opportunities with native-specific titles and icons', () => {
    const proactiveOpportunity: Opportunity = {
      id: 'proactive-optimal-timing-friend-1',
      friendId: 'friend-1',
      friendName: 'Alex',
      friendTier: 'InnerCircle',
      category: 'maintain',
      generatorSource: 'proactive-optimal-timing',
      urgency: 56,
      confidence: 0.74,
      effortLevel: 'moderate',
      estimatedDurationMinutes: 30,
      explanation: {
        whyNow: 'Your pattern says this is the ideal window.',
        whyThisFriend: 'Alex is in a natural rhythm window.',
        whyThisAction: 'Planning now makes follow-through easier.',
      },
      timeRelevance: {
        bestWindow: 'midday',
      },
      createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    };

    const suggestion = opportunityToSuggestion(proactiveOpportunity);

    expect(suggestion.title).toBe('Perfect time to connect with Alex');
    expect(suggestion.icon).toBe('Clock');
    expect(suggestion.actionLabel).toBe('Plan');
    expect(suggestion.action.type).toBe('plan');
  });

  it('renders portfolio native opportunities as review prompts', () => {
    const portfolioOpportunity: Opportunity = {
      id: 'portfolio-inner-crisis',
      category: 'portfolio',
      generatorSource: 'portfolio-inner-crisis',
      urgency: 88,
      confidence: 0.9,
      effortLevel: 'high',
      estimatedDurationMinutes: 45,
      explanation: {
        whyNow: '2 of your closest connections are drifting.',
        whyThisFriend: 'This is a network-level relationship opportunity.',
        whyThisAction: 'Protect your core relationships first.',
      },
      timeRelevance: {
        bestWindow: 'morning',
      },
      createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    };

    const suggestion = opportunityToSuggestion(portfolioOpportunity);

    expect(suggestion.title).toBe('Inner Circle needs care');
    expect(suggestion.icon).toBe('AlertTriangle');
    expect(suggestion.actionLabel).toBe('Review');
    expect(suggestion.action.type).toBe('plan');
    expect(suggestion.type).toBe('deepen');
  });

  it('renders reciprocity imbalance opportunities as reflective wait prompts', () => {
    const reciprocityOpportunity: Opportunity = {
      id: 'reciprocity-imbalance-friend-1',
      friendId: 'friend-1',
      friendName: 'Alex',
      friendTier: 'InnerCircle',
      category: 'insight',
      generatorSource: 'reciprocity-imbalance',
      urgency: 50,
      confidence: 0.8,
      effortLevel: 'minimal',
      estimatedDurationMinutes: 10,
      explanation: {
        whyNow: "You've initiated 4 times in a row. Give Alex space to reach out.",
        whyThisFriend: 'Alex has had a lopsided initiation pattern recently.',
        whyThisAction: 'A brief pause gives the relationship room to rebalance naturally.',
      },
      timeRelevance: {
        bestWindow: 'evening',
      },
      createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    };

    const suggestion = opportunityToSuggestion(reciprocityOpportunity);

    expect(suggestion.title).toBe('Rebalance with Alex');
    expect(suggestion.icon).toBe('Scale');
    expect(suggestion.actionLabel).toBe('Pause & Wait');
    expect(suggestion.action.type).toBe('reflect');
    expect(suggestion.type).toBe('reflect');
  });

  it('renders tier mismatch opportunities as tier review prompts', () => {
    const tierOpportunity: Opportunity = {
      id: 'tier-mismatch-friend-1',
      friendId: 'friend-1',
      friendName: 'Alex',
      friendTier: 'Community',
      category: 'insight',
      generatorSource: 'tier-mismatch',
      urgency: 28,
      confidence: 0.78,
      effortLevel: 'minimal',
      estimatedDurationMinutes: 10,
      explanation: {
        whyNow: 'Your interaction pattern with Alex suggests Close Friends might fit better than Community.',
        whyThisFriend: "Alex's observed interaction rhythm is mismatched with their current tier.",
        whyThisAction: 'A tier review can make your expectations match the relationship you actually have.',
      },
      timeRelevance: {
        bestWindow: 'morning',
      },
      createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    };

    const suggestion = opportunityToSuggestion(tierOpportunity);

    expect(suggestion.title).toBe('Tier check: Alex');
    expect(suggestion.icon).toBe('Layers');
    expect(suggestion.actionLabel).toBe('Review Tier');
    expect(suggestion.action.type).toBe('tier-review');
    expect(suggestion.type).toBe('reflect');
  });

  it('renders holiday opportunities with holiday-aware titles', () => {
    const holidayOpportunity: Opportunity = {
      id: 'holiday-christmas-friend-1',
      friendId: 'friend-1',
      friendName: 'Alex',
      friendTier: 'InnerCircle',
      category: 'celebrate',
      generatorSource: 'holiday-christmas',
      urgency: 72,
      confidence: 0.78,
      effortLevel: 'minimal',
      estimatedDurationMinutes: 10,
      explanation: {
        whyNow: 'Create something special together for Christmas',
        whyThisFriend: 'Alex is a good fit for this Christmas moment based on your relationship and timing.',
        whyThisAction: 'A quick same-day reach-out is the highest-value move for this holiday moment.',
      },
      timeRelevance: {
        bestWindow: 'midday',
      },
      copyContext: {
        recentInteractionCategory: 'celebration',
        vibeHint: 'Christmas',
      },
      createdAt: new Date('2026-12-24T10:00:00.000Z').getTime(),
    };

    const suggestion = opportunityToSuggestion(holidayOpportunity);

    expect(suggestion.title).toBe('Christmas connection with Alex');
    expect(suggestion.icon).toBe('Gift');
    expect(suggestion.action.type).toBe('log');
    expect(suggestion.actionLabel).toBe('Reach Out');
  });

  it('renders signal-driven native opportunities with their specific titles and actions', () => {
    const signalOpportunity: Opportunity = {
      id: 'signal-followup-friend-1',
      friendId: 'friend-1',
      friendName: 'Alex',
      friendTier: 'InnerCircle',
      category: 'signal-followup',
      generatorSource: 'signal-followup',
      urgency: 64,
      confidence: 0.84,
      effortLevel: 'minimal',
      estimatedDurationMinutes: 10,
      explanation: {
        whyNow: 'You mentioned "job change" a few weeks ago. How is it going?',
        whyThisFriend: 'Alex has an active thread around "job change" that is ready for a follow-up.',
        whyThisAction: 'A light check-in is the easiest way to act while this thread is still warm.',
      },
      timeRelevance: {
        bestWindow: 'evening',
      },
      copyContext: {
        vibeHint: 'job change',
      },
      createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    };

    const suggestion = opportunityToSuggestion(signalOpportunity);

    expect(suggestion.title).toBe('Follow up with Alex on job change');
    expect(suggestion.icon).toBe('MessageCircle');
    expect(suggestion.type).toBe('connect');
    expect(suggestion.action.type).toBe('log');
    expect(suggestion.action.prefilledCategory).toBe('text-call');
    expect(suggestion.actionLabel).toBe('Follow Up');
    expect(suggestion.contextSnippet).toContain('job change');
  });

  it('supports copy experiment variants when adapting native opportunities', () => {
    const opportunity: Opportunity = {
      id: 'signal-followup-friend-2',
      friendId: 'friend-2',
      friendName: 'Blair',
      friendTier: 'InnerCircle',
      category: 'signal-followup',
      generatorSource: 'signal-followup',
      urgency: 62,
      confidence: 0.82,
      effortLevel: 'minimal',
      estimatedDurationMinutes: 10,
      explanation: {
        whyNow: 'The holiday chat is still fresh enough to revisit.',
        whyThisFriend: 'Blair has an active holiday thread worth following up on.',
        whyThisAction: 'A quick message keeps the thread moving while it is warm.',
      },
      timeRelevance: {
        bestWindow: 'evening',
      },
      copyContext: {
        vibeHint: 'holiday plans',
      },
      createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    };

    const conciseSuggestion = opportunityToSuggestion(opportunity, null, {
      copyVariant: 'concise',
    });
    const whyNowSuggestion = opportunityToSuggestion(opportunity, null, {
      copyVariant: 'why-now',
    });

    expect(conciseSuggestion.subtitle).toBe('The holiday chat is still fresh enough to revisit.');
    expect(conciseSuggestion.contextSnippet).toBe('A quick message keeps the thread moving while it is warm.');
    expect(whyNowSuggestion.contextSnippet).toContain('The holiday chat is still fresh enough');
    expect(whyNowSuggestion.contextSnippet).toContain('quick message keeps the thread moving');
  });

  it('enriches matched legacy suggestions while preserving their subtitle and action payload', () => {
    const opportunity: Opportunity = {
      id: 'intention-reminder-1',
      friendId: 'friend-1',
      friendName: 'Alex',
      friendTier: 'InnerCircle',
      category: 'intention-reminder',
      generatorSource: 'intention-generator',
      urgency: 70,
      confidence: 0.88,
      effortLevel: 'moderate',
      estimatedDurationMinutes: 30,
      explanation: {
        whyNow: 'This intention has been waiting for 12 days.',
        whyThisFriend: 'Alex already has an active intention waiting for follow-through.',
        whyThisAction: 'Schedule a meal so this intention turns into action.',
      },
      timeRelevance: {
        bestWindow: 'morning',
      },
      copyContext: {
        daysSinceLastInteraction: 12,
        recentInteractionCategory: 'meal-drink',
      },
      createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    };

    const legacySuggestion = createSuggestion({
      id: 'intention-reminder-1',
      title: 'Intention for Alex',
      subtitle: '"Grab lunch sometime"',
      actionLabel: 'Schedule',
      action: {
        type: 'plan',
        prefilledCategory: 'meal-drink',
      },
      category: 'maintain',
    });

    const suggestion = opportunityToSuggestion(opportunity, legacySuggestion);

    expect(suggestion.title).toBe('Plan that meal with Alex');
    expect(suggestion.subtitle).toBe('"Grab lunch sometime"');
    expect(suggestion.action).toEqual(legacySuggestion.action);
    expect(suggestion.actionLabel).toBe('Make a Plan');
    expect(suggestion.contextSnippet).toContain('meal');
    expect(suggestion.aiEnriched).toBe(true);
  });

  it('enriches drift opportunities with elapsed-time context', () => {
    const driftOpportunity: Opportunity = {
      id: 'high-drift-friend-1',
      friendId: 'friend-1',
      friendName: 'Alex',
      friendTier: 'InnerCircle',
      category: 'high-drift',
      generatorSource: 'drift-generator',
      urgency: 76,
      confidence: 0.82,
      effortLevel: 'moderate',
      estimatedDurationMinutes: 30,
      explanation: {
        whyNow: 'The rhythm with Alex has started to slip.',
        whyThisFriend: 'Alex is drifting relative to their relationship tier.',
        whyThisAction: 'A concrete plan is the best way to stop further drift.',
      },
      timeRelevance: {
        bestWindow: 'morning',
      },
      copyContext: {
        daysSinceLastInteraction: 18,
        recentInteractionCategory: 'text-call',
      },
      createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    };

    const suggestion = opportunityToSuggestion(driftOpportunity);

    expect(suggestion.title).toBe('Reconnect with Alex before more drift');
    expect(suggestion.contextSnippet).toContain('18 days');
    expect(suggestion.actionLabel).toBe('Plan');
  });

  it('preserves custom suggestion payloads for native edge-case opportunities', () => {
    const opportunity: Opportunity = {
      id: 'memory-life-event-1',
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
          prefillPrompt: 'Help me add a life event for Alex.',
          lifeEventTitle: 'New job',
        },
      },
      createdAt: new Date('2026-03-23T10:00:00.000Z').getTime(),
    };

    const suggestion = opportunityToSuggestion(opportunity);

    expect(suggestion.type).toBe('celebrate');
    expect(suggestion.icon).toBe('Gift');
    expect(suggestion.action.type).toBe('life-event');
    expect(suggestion.action.lifeEventTitle).toBe('New job');
    expect(suggestion.actionLabel).toBe('Add Life Event');
  });
});
