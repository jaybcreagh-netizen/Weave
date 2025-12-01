/**
 * Journal Prompts Service
 * 
 * Generates contextual prompts for journal entries based on:
 * - Recent weaves (what just happened)
 * - Friend context (relationship history, patterns)
 * - General reflection (when no specific context)
 * 
 * Rule-based for now, designed for LLM handoff.
 */

import {
  MeaningfulWeave,
  FriendJournalContext,
} from './journal-context-engine';

// ============================================================================
// TYPES
// ============================================================================

export interface JournalPrompt {
  id: string;
  question: string;
  context: string;  // Internal reasoning (for debugging / LLM handoff)
  type: 'weave' | 'friend' | 'general' | 'reconnection' | 'milestone' | 'pattern';
  suggestedStarters?: string[];  // Optional sentence starters
  relatedWeaveId?: string;
  relatedFriendId?: string;
  relatedFriendName?: string;
}

export type PromptContext =
  | { type: 'weave'; weave: MeaningfulWeave }
  | { type: 'friend'; friendContext: FriendJournalContext }
  | { type: 'general' };

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

// After-weave prompts (specific interaction happened)
const WEAVE_PROMPTS: {
  id: string;
  condition: (weave: MeaningfulWeave) => boolean;
  generate: (weave: MeaningfulWeave) => Omit<JournalPrompt, 'id'>;
  priority: number;
}[] = [
    // Deep conversation
    {
      id: 'deep_conversation',
      priority: 100,
      condition: (weave) => {
        const category = weave.interaction.interactionCategory || '';
        return ['deep-talk', 'heart-to-heart'].some(c => category.includes(c));
      },
      generate: (weave) => ({
        question: `What came up in that conversation that's still on your mind?`,
        context: `Deep conversation detected (${weave.interaction.interactionCategory})`,
        type: 'weave',
        suggestedStarters: [
          'We talked about...',
          'I realised...',
          'Something that surprised me was...',
        ],
        relatedWeaveId: weave.interaction.id,
        relatedFriendId: weave.friends[0]?.id,
        relatedFriendName: weave.friends[0]?.name,
      }),
    },

    // Support given/received
    {
      id: 'support_moment',
      priority: 95,
      condition: (weave) => {
        const category = weave.interaction.interactionCategory || '';
        const notes = weave.interaction.note || '';
        return category.includes('support') ||
          notes.toLowerCase().includes('support') ||
          notes.toLowerCase().includes('there for');
      },
      generate: (weave) => ({
        question: `How did it feel to be there for each other?`,
        context: `Support interaction detected`,
        type: 'weave',
        suggestedStarters: [
          'They needed...',
          'I felt...',
          'It meant a lot when...',
        ],
        relatedWeaveId: weave.interaction.id,
        relatedFriendId: weave.friends[0]?.id,
        relatedFriendName: weave.friends[0]?.name,
      }),
    },

    // High vibe interaction
    {
      id: 'high_vibe',
      priority: 90,
      condition: (weave) => {
        return ['FullMoon', 'WaxingGibbous'].includes(weave.interaction.vibe || '');
      },
      generate: (weave) => ({
        question: `That sounds like a meaningful moment. What made it special?`,
        context: `High vibe interaction (${weave.interaction.vibe})`,
        type: 'weave',
        suggestedStarters: [
          'What I loved was...',
          'The best part was...',
          'I felt so...',
        ],
        relatedWeaveId: weave.interaction.id,
        relatedFriendId: weave.friends[0]?.id,
        relatedFriendName: weave.friends[0]?.name,
      }),
    },

    // Extended time together
    {
      id: 'extended_time',
      priority: 85,
      condition: (weave) => {
        return ['Extended', 'Long'].includes(weave.interaction.duration || '');
      },
      generate: (weave) => ({
        question: `What's one thing from your time together you want to remember?`,
        context: `Extended interaction (${weave.interaction.duration})`,
        type: 'weave',
        suggestedStarters: [
          'We spent time...',
          'I want to remember...',
          'It was nice to...',
        ],
        relatedWeaveId: weave.interaction.id,
        relatedFriendId: weave.friends[0]?.id,
        relatedFriendName: weave.friends[0]?.name,
      }),
    },

    // Has detailed notes (user already started capturing)
    {
      id: 'has_notes',
      priority: 80,
      condition: (weave) => (weave.interaction.note || '').length >= 30,
      generate: (weave) => ({
        question: `You captured some thoughts already. Is there more you want to explore?`,
        context: `Has substantial notes (${weave.interaction.note?.length} chars)`,
        type: 'weave',
        suggestedStarters: [
          'Going deeper on this...',
          'What I didn\'t write down was...',
          'Later I realised...',
        ],
        relatedWeaveId: weave.interaction.id,
        relatedFriendId: weave.friends[0]?.id,
        relatedFriendName: weave.friends[0]?.name,
      }),
    },

    // Default weave prompt
    {
      id: 'weave_default',
      priority: 0,
      condition: () => true,
      generate: (weave) => {
        const friendName = weave.friends[0]?.name || 'them';
        return {
          question: `What's staying with you from your time with ${friendName}?`,
          context: `Default weave prompt`,
          type: 'weave',
          relatedWeaveId: weave.interaction.id,
          relatedFriendId: weave.friends[0]?.id,
          relatedFriendName: weave.friends[0]?.name,
        };
      },
    },
  ];

// Friend-focused prompts (reflecting on a relationship)
const FRIEND_PROMPTS: {
  id: string;
  condition: (ctx: FriendJournalContext) => boolean;
  generate: (ctx: FriendJournalContext) => Omit<JournalPrompt, 'id'>;
  priority: number;
}[] = [
    // Frequent recent contact
    {
      id: 'frequent_contact',
      priority: 100,
      condition: (ctx) => ctx.thisMonthWeaves >= 5,
      generate: (ctx) => ({
        question: `You've seen ${ctx.friend.name} ${ctx.thisMonthWeaves} times this month. What's drawing you together right now?`,
        context: `High frequency this month (${ctx.thisMonthWeaves} weaves)`,
        type: 'friend',
        suggestedStarters: [
          `${ctx.friend.name} and I have been...`,
          'I think we\'ve been close lately because...',
          'What I appreciate about this season is...',
        ],
        relatedFriendId: ctx.friend.id,
        relatedFriendName: ctx.friend.name,
      }),
    },

    // Recent reconnection after gap
    {
      id: 'recent_reconnection',
      priority: 95,
      condition: (ctx) => ctx.daysSinceLastWeave <= 7 && ctx.recentWeaves.length === 1,
      generate: (ctx) => ({
        question: `You recently reconnected with ${ctx.friend.name}. How was it to see them again?`,
        context: `Recent reconnection detected`,
        type: 'reconnection',
        suggestedStarters: [
          'It had been a while since...',
          'Seeing them again felt...',
          'What I noticed was...',
        ],
        relatedFriendId: ctx.friend.id,
        relatedFriendName: ctx.friend.name,
      }),
    },

    // Long friendship
    {
      id: 'long_friendship',
      priority: 85,
      condition: (ctx) => ctx.friendshipDurationMonths >= 24,
      generate: (ctx) => ({
        question: `How has your friendship with ${ctx.friend.name} evolved over the past ${ctx.friendshipDuration}?`,
        context: `Long friendship (${ctx.friendshipDuration})`,
        type: 'milestone',
        suggestedStarters: [
          'When we first met...',
          'Over time we\'ve...',
          'What\'s changed is...',
        ],
        relatedFriendId: ctx.friend.id,
        relatedFriendName: ctx.friend.name,
      }),
    },

    // High weave count
    {
      id: 'many_weaves',
      priority: 80,
      condition: (ctx) => ctx.totalWeaves >= 20,
      generate: (ctx) => ({
        question: `You've connected with ${ctx.friend.name} ${ctx.totalWeaves} times. What do you value most about this friendship?`,
        context: `High total weaves (${ctx.totalWeaves})`,
        type: 'friend',
        suggestedStarters: [
          `${ctx.friend.name} is someone who...`,
          'What I value most is...',
          'They make me feel...',
        ],
        relatedFriendId: ctx.friend.id,
        relatedFriendName: ctx.friend.name,
      }),
    },

    // Has detected themes
    {
      id: 'recurring_themes',
      priority: 75,
      condition: (ctx) => ctx.detectedThemes.length >= 2,
      generate: (ctx) => {
        const themes = ctx.detectedThemes.slice(0, 2).join(' and ');
        return {
          question: `You often write about ${themes} when reflecting on ${ctx.friend.name}. What patterns are you noticing?`,
          context: `Recurring themes: ${ctx.detectedThemes.join(', ')}`,
          type: 'pattern',
          suggestedStarters: [
            'I\'ve noticed that...',
            'With them, I tend to...',
            'A pattern I see is...',
          ],
          relatedFriendId: ctx.friend.id,
          relatedFriendName: ctx.friend.name,
        };
      },
    },

    // No previous entries (first journal entry about them)
    {
      id: 'first_entry',
      priority: 70,
      condition: (ctx) => ctx.totalJournalEntries === 0 && ctx.totalWeaves >= 3,
      generate: (ctx) => ({
        question: `You've never written about ${ctx.friend.name} before. What would you want to remember about this friendship?`,
        context: `First journal entry for this friend (${ctx.totalWeaves} weaves, 0 entries)`,
        type: 'milestone',
        suggestedStarters: [
          `${ctx.friend.name} is...`,
          'How we met...',
          'What I appreciate about them...',
        ],
        relatedFriendId: ctx.friend.id,
        relatedFriendName: ctx.friend.name,
      }),
    },

    // Default friend prompt
    {
      id: 'friend_default',
      priority: 0,
      condition: () => true,
      generate: (ctx) => ({
        question: `What's on your mind about ${ctx.friend.name}?`,
        context: `Default friend prompt`,
        type: 'friend',
        relatedFriendId: ctx.friend.id,
        relatedFriendName: ctx.friend.name,
      }),
    },
  ];

// General prompts (no specific context)
const GENERAL_PROMPTS: JournalPrompt[] = [
  {
    id: 'general_moment',
    question: 'What\'s one friendship moment from today you want to remember?',
    context: 'General prompt - recent moment',
    type: 'general',
  },
  {
    id: 'general_thought',
    question: 'Is there something you\'ve been meaning to say to someone?',
    context: 'General prompt - unsaid words',
    type: 'general',
  },
  {
    id: 'general_patterns',
    question: 'What patterns are you noticing in your friendships lately?',
    context: 'General prompt - pattern awareness',
    type: 'general',
  },
  {
    id: 'general_gratitude',
    question: 'Who are you grateful for today, and why?',
    context: 'General prompt - gratitude',
    type: 'general',
  },
  {
    id: 'general_change',
    question: 'How have your friendships changed over the past year?',
    context: 'General prompt - reflection on change',
    type: 'general',
  },
  {
    id: 'general_energy',
    question: 'Which friendships give you energy? Which ones take it?',
    context: 'General prompt - energy audit',
    type: 'general',
  },
  {
    id: 'general_support',
    question: 'When was the last time a friend really showed up for you?',
    context: 'General prompt - support received',
    type: 'general',
  },
  {
    id: 'general_show_up',
    question: 'When was the last time you really showed up for a friend?',
    context: 'General prompt - support given',
    type: 'general',
  },
];

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Generate prompts based on provided context.
 * Returns 1-3 prompts, with the first being the "best" match.
 */
export function generateJournalPrompts(context: PromptContext): JournalPrompt[] {
  switch (context.type) {
    case 'weave':
      return generateWeavePrompts(context.weave);
    case 'friend':
      return generateFriendPrompts(context.friendContext);
    case 'general':
      return generateGeneralPrompts();
  }
}

/**
 * Generate prompts for a specific weave.
 */
function generateWeavePrompts(weave: MeaningfulWeave): JournalPrompt[] {
  const sorted = [...WEAVE_PROMPTS].sort((a, b) => b.priority - a.priority);
  const prompts: JournalPrompt[] = [];

  for (const template of sorted) {
    if (template.condition(weave)) {
      const generated = template.generate(weave);
      prompts.push({
        id: template.id,
        ...generated,
      });

      if (prompts.length >= 2) break;  // Max 2 prompts for weave context
    }
  }

  return prompts;
}

/**
 * Generate prompts for a specific friend.
 */
function generateFriendPrompts(ctx: FriendJournalContext): JournalPrompt[] {
  const sorted = [...FRIEND_PROMPTS].sort((a, b) => b.priority - a.priority);
  const prompts: JournalPrompt[] = [];

  for (const template of sorted) {
    if (template.condition(ctx)) {
      const generated = template.generate(ctx);
      prompts.push({
        id: template.id,
        ...generated,
      });

      if (prompts.length >= 3) break;  // Max 3 prompts for friend context
    }
  }

  return prompts;
}

/**
 * Generate general prompts (no specific context).
 * Returns 3 random prompts.
 */
function generateGeneralPrompts(): JournalPrompt[] {
  // Shuffle and take 3
  const shuffled = [...GENERAL_PROMPTS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

/**
 * Get a single "best" prompt for given context.
 */
export function getBestPrompt(context: PromptContext): JournalPrompt {
  const prompts = generateJournalPrompts(context);
  return prompts[0] || GENERAL_PROMPTS[0];
}

/**
 * Get prompts specifically designed for post-weave reflection.
 * Called from the weave logger's "Reflect deeper" flow.
 */
export function getPostWeavePrompts(weave: MeaningfulWeave): JournalPrompt[] {
  return generateWeavePrompts(weave);
}

// ============================================================================
// FUTURE LLM INTEGRATION
// ============================================================================

/**
 * Interface for LLM-powered prompt generation.
 * Replace generateJournalPrompts when ready to use LLM.
 */
export interface LLMPromptRequest {
  context: PromptContext;
  previousEntries?: string[];  // Recent entry excerpts for context
  userWritingStyle?: string;   // Detected style preferences
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
}

export interface LLMPromptResponse {
  prompts: JournalPrompt[];
  reasoning: string;  // Why these prompts were chosen
}

/**
 * Placeholder for LLM prompt generation.
 * Implement when ready to integrate with API.
 */
export async function generatePromptsWithLLM(
  _request: LLMPromptRequest
): Promise<LLMPromptResponse> {
  // TODO: Implement LLM call
  throw new Error('LLM integration not yet implemented');
}
