/**
 * Reflection Prompt Engine
 * 
 * Generates contextual prompts for weekly reflections based on week's data.
 * Designed for future LLM handoff — rule-based for now, but interface supports
 * swapping in AI-generated prompts later.
 */

import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import PortfolioSnapshot from '@/db/models/PortfolioSnapshot';
import { STORY_CHIPS, StoryChip } from './story-chips.service';

// ============================================================================
// TYPES
// ============================================================================

export interface ReflectionPrompt {
  id: string;
  question: string;
  context: string;  // Internal reasoning (for debugging / future LLM handoff)
  promptType: 'highlight' | 'gratitude' | 'intention' | 'reconnect' | 'quiet' | 'celebration';
  suggestedChipIds?: string[];  // Max 2, contextually relevant
  mentionedFriendId?: string;
  mentionedFriendName?: string;
}

export interface PromptEngineInput {
  totalWeaves: number;
  friendsContacted: number;
  topFriend?: { id: string; name: string; weaveCount: number };
  reconnectedFriend?: { id: string; name: string; daysSinceLastContact: number };
  topActivity?: string;
  topActivityCount?: number;
  isQuietWeek: boolean;  // < 2 weaves
  previousWeekWeaves?: number;
  weekStreak: number;
  averageWeeklyWeaves?: number;
}

export interface InsightLine {
  text: string;
  tone: 'celebration' | 'neutral' | 'gentle';
}

export interface DetectedChip {
  chipId: string;
  chip: StoryChip;
  confidence: number;  // 0-1, how confident we are this matches
}

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================

interface PromptTemplate {
  id: string;
  type: ReflectionPrompt['promptType'];
  condition: (input: PromptEngineInput) => boolean;
  priority: number;  // Higher = checked first
  generate: (input: PromptEngineInput) => Omit<ReflectionPrompt, 'id'>;
}

const PROMPT_TEMPLATES: PromptTemplate[] = [
  // High engagement with specific friend
  {
    id: 'top_friend_highlight',
    type: 'highlight',
    priority: 100,
    condition: (input) => !!input.topFriend && input.topFriend.weaveCount >= 3,
    generate: (input) => ({
      question: `You connected with ${input.topFriend!.name} ${input.topFriend!.weaveCount} times this week. What made those moments stand out?`,
      context: `Top friend ${input.topFriend!.name} had ${input.topFriend!.weaveCount} weaves — unusually high frequency suggests meaningful connection`,
      promptType: 'highlight',
      suggestedChipIds: ['feeling_connected', 'moment_lost-track-time'],
      mentionedFriendId: input.topFriend!.id,
      mentionedFriendName: input.topFriend!.name,
    }),
  },

  // Reconnected with someone after a gap
  {
    id: 'reconnection',
    type: 'reconnect',
    priority: 95,
    condition: (input) => !!input.reconnectedFriend && input.reconnectedFriend.daysSinceLastContact >= 14,
    generate: (input) => ({
      question: `You reached out to ${input.reconnectedFriend!.name} after ${input.reconnectedFriend!.daysSinceLastContact} days. How did it feel to reconnect?`,
      context: `Reconnection after ${input.reconnectedFriend!.daysSinceLastContact} days — worth reflecting on`,
      promptType: 'reconnect',
      suggestedChipIds: ['dynamic_picked-up', 'feeling_closer'],
      mentionedFriendId: input.reconnectedFriend!.id,
      mentionedFriendName: input.reconnectedFriend!.name,
    }),
  },

  // Big increase from last week
  {
    id: 'momentum_surge',
    type: 'celebration',
    priority: 90,
    condition: (input) => {
      if (!input.previousWeekWeaves) return false;
      return input.totalWeaves >= input.previousWeekWeaves * 1.5 && input.totalWeaves >= 5;
    },
    generate: (input) => ({
      question: `A fuller week than usual — ${input.totalWeaves} connections. Which one surprised you?`,
      context: `50%+ increase from last week (${input.previousWeekWeaves} → ${input.totalWeaves})`,
      promptType: 'celebration',
      suggestedChipIds: ['surprise_deeper-than-expected', 'feeling_energized'],
    }),
  },

  // Above average week
  {
    id: 'above_average',
    type: 'celebration',
    priority: 85,
    condition: (input) => {
      if (!input.averageWeeklyWeaves) return false;
      return input.totalWeaves > input.averageWeeklyWeaves * 1.2 && input.totalWeaves >= 5;
    },
    generate: (input) => ({
      question: `You showed up for ${input.friendsContacted} friends this week. Who left you feeling most energised?`,
      context: `Above average week (${input.totalWeaves} vs avg ${input.averageWeeklyWeaves?.toFixed(1)})`,
      promptType: 'gratitude',
      suggestedChipIds: ['feeling_energized', 'feeling_grateful'],
    }),
  },

  // Good variety of friends
  {
    id: 'friend_variety',
    type: 'gratitude',
    priority: 80,
    condition: (input) => input.friendsContacted >= 5,
    generate: (input) => ({
      question: `You connected with ${input.friendsContacted} different friends. Who are you most grateful for this week?`,
      context: `High friend diversity (${input.friendsContacted} unique friends)`,
      promptType: 'gratitude',
      suggestedChipIds: ['feeling_grateful', 'feeling_connected'],
    }),
  },

  // Consistent activity with top friend
  {
    id: 'top_friend_regular',
    type: 'highlight',
    priority: 75,
    condition: (input) => !!input.topFriend && input.topFriend.weaveCount === 2,
    generate: (input) => ({
      question: `You and ${input.topFriend!.name} connected twice this week. What do you value most about that friendship?`,
      context: `Regular contact with ${input.topFriend!.name} (2 weaves)`,
      promptType: 'highlight',
      suggestedChipIds: ['feeling_comfortable', 'dynamic_flowed-naturally'],
      mentionedFriendId: input.topFriend!.id,
      mentionedFriendName: input.topFriend!.name,
    }),
  },

  // Had a specific top activity
  {
    id: 'top_activity',
    type: 'gratitude',
    priority: 70,
    condition: (input) => !!input.topActivity && (input.topActivityCount ?? 0) >= 2,
    generate: (input) => ({
      question: `${input.topActivity} ${input.topActivityCount}× this week. What made those moments special?`,
      context: `Repeated activity pattern: ${input.topActivity} (${input.topActivityCount}×)`,
      promptType: 'gratitude',
      suggestedChipIds: ['feeling_nourished', 'moment_laughed'],
    }),
  },

  // Moderate week
  {
    id: 'moderate_week',
    type: 'gratitude',
    priority: 60,
    condition: (input) => input.totalWeaves >= 3 && input.totalWeaves <= 6,
    generate: (input) => ({
      question: `What's one moment of connection from this week you want to hold onto?`,
      context: `Moderate activity week (${input.totalWeaves} weaves)`,
      promptType: 'gratitude',
      suggestedChipIds: ['feeling_connected', 'moment_they-got-me'],
    }),
  },

  // Had some activity (1-2 weaves)
  {
    id: 'light_week',
    type: 'gratitude',
    priority: 50,
    condition: (input) => input.totalWeaves >= 1 && input.totalWeaves <= 2,
    generate: (input) => ({
      question: `Even a small moment matters. What are you grateful for from this week?`,
      context: `Light activity week (${input.totalWeaves} weave${input.totalWeaves > 1 ? 's' : ''})`,
      promptType: 'gratitude',
      suggestedChipIds: ['feeling_grateful', 'feeling_comfortable'],
    }),
  },

  // Quiet week but had streak
  {
    id: 'quiet_with_streak',
    type: 'gentle',
    priority: 45,
    condition: (input) => input.isQuietWeek && input.weekStreak > 0,
    generate: (input) => ({
      question: `A quieter week. Is there one small moment you're grateful for?`,
      context: `Quiet week but maintaining streak (${input.weekStreak} weeks)`,
      promptType: 'quiet',
      suggestedChipIds: ['feeling_grateful'],
    }),
  },

  // Quiet week, no streak
  {
    id: 'quiet_fresh_start',
    type: 'intention',
    priority: 40,
    condition: (input) => input.isQuietWeek && input.weekStreak === 0,
    generate: (input) => ({
      question: `Who's been on your mind lately?`,
      context: `Quiet week, no active streak — intention-focused prompt`,
      promptType: 'intention',
      suggestedChipIds: [],
    }),
  },

  // Default fallback
  {
    id: 'default',
    type: 'gratitude',
    priority: 0,
    condition: () => true,
    generate: (input) => ({
      question: `What's one moment of connection you want to remember from this week?`,
      context: `Default prompt — no specific patterns detected`,
      promptType: 'gratitude',
      suggestedChipIds: ['feeling_connected', 'feeling_grateful'],
    }),
  },
];

// ============================================================================
// INSIGHT LINE TEMPLATES
// ============================================================================

interface InsightTemplate {
  condition: (input: PromptEngineInput) => boolean;
  priority: number;
  generate: (input: PromptEngineInput) => InsightLine;
}

const INSIGHT_TEMPLATES: InsightTemplate[] = [
  // Strong streak
  {
    priority: 100,
    condition: (input) => input.weekStreak >= 4,
    generate: (input) => ({
      text: `${input.weekStreak} weeks of showing up. That's a practice.`,
      tone: 'celebration',
    }),
  },

  // Most active week (vs average)
  {
    priority: 95,
    condition: (input) => {
      if (!input.averageWeeklyWeaves) return false;
      return input.totalWeaves > input.averageWeeklyWeaves * 1.3;
    },
    generate: () => ({
      text: `Your most active week in a while — nice rhythm.`,
      tone: 'celebration',
    }),
  },

  // Big increase from last week
  {
    priority: 90,
    condition: (input) => {
      if (!input.previousWeekWeaves || input.previousWeekWeaves === 0) return false;
      return input.totalWeaves >= input.previousWeekWeaves * 1.5;
    },
    generate: (input) => ({
      text: `Up from ${input.previousWeekWeaves} last week. Building momentum.`,
      tone: 'celebration',
    }),
  },

  // Consistent with last week
  {
    priority: 80,
    condition: (input) => {
      if (!input.previousWeekWeaves) return false;
      const diff = Math.abs(input.totalWeaves - input.previousWeekWeaves);
      return diff <= 1 && input.totalWeaves >= 3;
    },
    generate: () => ({
      text: `Consistent with last week. Steady rhythm.`,
      tone: 'neutral',
    }),
  },

  // Good friend variety
  {
    priority: 75,
    condition: (input) => input.friendsContacted >= 5,
    generate: (input) => ({
      text: `${input.friendsContacted} friends this week. Your network is alive.`,
      tone: 'celebration',
    }),
  },

  // Drop from last week (but still active)
  {
    priority: 70,
    condition: (input) => {
      if (!input.previousWeekWeaves || input.previousWeekWeaves < 3) return false;
      return input.totalWeaves < input.previousWeekWeaves * 0.6 && input.totalWeaves >= 2;
    },
    generate: () => ({
      text: `A slower week — that's okay.`,
      tone: 'gentle',
    }),
  },

  // Standard summary
  {
    priority: 50,
    condition: (input) => input.totalWeaves >= 1,
    generate: (input) => ({
      text: `${input.totalWeaves} weave${input.totalWeaves !== 1 ? 's' : ''} across ${input.friendsContacted} friend${input.friendsContacted !== 1 ? 's' : ''}.`,
      tone: 'neutral',
    }),
  },

  // Quiet week
  {
    priority: 10,
    condition: (input) => input.isQuietWeek,
    generate: () => ({
      text: `A quiet week. Rest is part of the rhythm.`,
      tone: 'gentle',
    }),
  },

  // Fallback
  {
    priority: 0,
    condition: () => true,
    generate: () => ({
      text: `Every connection matters.`,
      tone: 'neutral',
    }),
  },
];

// ============================================================================
// KEYWORD DETECTION
// ============================================================================

/**
 * Maps keywords/phrases to chip IDs
 * Focused on feeling and moment chips for weekly reflection context
 */
const KEYWORD_TO_CHIPS: Record<string, string[]> = {
  // Positive feelings
  'grateful': ['feeling_grateful'],
  'thankful': ['feeling_grateful'],
  'appreciate': ['feeling_grateful'],
  'happy': ['feeling_joyful'],
  'joy': ['feeling_joyful'],
  'joyful': ['feeling_joyful'],
  'connected': ['feeling_connected'],
  'close': ['feeling_connected', 'feeling_closer'],
  'understood': ['feeling_understood'],
  'seen': ['feeling_understood'],
  'heard': ['feeling_understood'],
  'comfortable': ['feeling_comfortable'],
  'easy': ['feeling_comfortable'],
  'natural': ['feeling_comfortable', 'dynamic_flowed-naturally'],
  'energised': ['feeling_energized'],
  'energized': ['feeling_energized'],
  'inspired': ['feeling_inspired'],
  'motivated': ['feeling_inspired'],
  'nourished': ['feeling_nourished'],
  'warm': ['feeling_nourished'],

  // Mixed/complex feelings
  'bittersweet': ['feeling_bittersweet'],
  'exhausted': ['feeling_exhausted-good'],
  'drained': ['feeling_exhausted-good'],
  'awkward': ['feeling_awkward-worth-it'],

  // Moments
  'laughed': ['moment_laughed'],
  'laugh': ['moment_laughed'],
  'funny': ['moment_laughed'],
  'hilarious': ['moment_laughed'],
  'silence': ['moment_silence'],
  'quiet': ['moment_silence'],
  'breakthrough': ['moment_breakthrough'],
  'realisation': ['moment_breakthrough'],
  'realization': ['moment_breakthrough'],
  'aha': ['moment_breakthrough'],
  'lost track': ['moment_lost-track-time'],
  'hours flew': ['moment_lost-track-time'],
  'got me': ['moment_they-got-me'],
  'understands me': ['moment_they-got-me'],
  'shared something': ['moment_shared-something', 'moment_they-shared'],
  'opened up': ['moment_shared-something', 'dynamic_i-opened-up'],
  'vulnerable': ['moment_they-shared'],
  'disagreement': ['moment_disagreement'],
  'argument': ['moment_disagreement'],
  'worked through': ['moment_worked-through'],
  'resolved': ['moment_worked-through'],
  'inside joke': ['moment_inside-joke'],
  'stayed up': ['moment_stayed-up-late'],
  'late night': ['moment_stayed-up-late'],

  // Activities (for context)
  'deep': ['activity_deep-conversation', 'surprise_deeper-than-expected'],
  'talk': ['activity_deep-conversation', 'activity_caught-up'],
  'conversation': ['activity_deep-conversation'],
  'walk': ['activity_went-for'],
  'coffee': ['activity_shared-meal'],
  'dinner': ['activity_shared-meal'],
  'meal': ['activity_shared-meal'],
  'celebrated': ['activity_celebrated'],
  'party': ['activity_event'],

  // Surprises
  'learned': ['surprise_learned-new'],
  'discovered': ['surprise_learned-new'],
  'different side': ['surprise_different-side'],
  'perspective': ['surprise_perspective-shift'],
  'changed my mind': ['surprise_perspective-shift'],
  'unexpected': ['surprise_unexpected-topic'],
  'surprised': ['surprise_more-fun'],
  'remembered': ['surprise_they-remembered'],
};

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Generate a contextual reflection prompt based on the week's data
 */
export function generateReflectionPrompt(input: PromptEngineInput): ReflectionPrompt {
  // Sort templates by priority (highest first)
  const sortedTemplates = [...PROMPT_TEMPLATES].sort((a, b) => b.priority - a.priority);

  // Find first matching template
  for (const template of sortedTemplates) {
    if (template.condition(input)) {
      const generated = template.generate(input);
      return {
        id: template.id,
        ...generated,
      };
    }
  }

  // Should never reach here due to default template, but just in case
  return {
    id: 'fallback',
    question: `What's one moment of connection you want to remember?`,
    context: 'Fallback prompt',
    promptType: 'gratitude',
  };
}

/**
 * Generate a one-line insight based on the week's data
 */
export function generateInsightLine(input: PromptEngineInput): InsightLine {
  const sortedTemplates = [...INSIGHT_TEMPLATES].sort((a, b) => b.priority - a.priority);

  for (const template of sortedTemplates) {
    if (template.condition(input)) {
      return template.generate(input);
    }
  }

  return {
    text: 'Every connection matters.',
    tone: 'neutral',
  };
}

/**
 * Detect relevant story chips from user's reflection text
 * Returns max 2 chips, sorted by confidence
 */
export function detectChipsFromText(text: string): DetectedChip[] {
  if (!text || text.trim().length < 5) return [];

  const normalizedText = text.toLowerCase();
  const detectedChipIds = new Map<string, number>(); // chipId -> confidence score

  // Check each keyword
  for (const [keyword, chipIds] of Object.entries(KEYWORD_TO_CHIPS)) {
    if (normalizedText.includes(keyword)) {
      // Longer keywords get higher confidence
      const keywordConfidence = Math.min(1, 0.5 + (keyword.length / 20));

      chipIds.forEach(chipId => {
        const existing = detectedChipIds.get(chipId) || 0;
        detectedChipIds.set(chipId, Math.max(existing, keywordConfidence));
      });
    }
  }

  // Convert to array and sort by confidence
  const detected: DetectedChip[] = [];

  for (const [chipId, confidence] of detectedChipIds.entries()) {
    const chip = STORY_CHIPS.find(c => c.id === chipId);
    if (chip) {
      // Filter to only feeling and moment chips for weekly reflection
      if (chip.type === 'feeling' || chip.type === 'moment') {
        detected.push({ chipId, chip, confidence });
      }
    }
  }

  // Sort by confidence descending, take top 2
  return detected
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 2);
}

/**
 * Get suggested chips based on prompt type (used when user hasn't written anything)
 */
export function getDefaultChipsForPromptType(promptType: ReflectionPrompt['promptType']): string[] {
  const defaults: Record<ReflectionPrompt['promptType'], string[]> = {
    highlight: ['feeling_connected', 'moment_lost-track-time'],
    gratitude: ['feeling_grateful', 'feeling_connected'],
    intention: [],  // No default chips for intention prompts
    reconnect: ['dynamic_picked-up', 'feeling_closer'],
    quiet: ['feeling_grateful'],
    celebration: ['feeling_energized', 'feeling_joyful'],
  };

  return defaults[promptType] || [];
}

// ============================================================================
// DATA FETCHING HELPERS
// ============================================================================

/**
 * Get the most recent portfolio snapshot for comparison data
 */
export async function getRecentPortfolioSnapshot(): Promise<PortfolioSnapshot | null> {
  try {
    const snapshots = await database
      .get<PortfolioSnapshot>('portfolio_snapshots')
      .query(Q.sortBy('snapshot_date', Q.desc), Q.take(1))
      .fetch();

    return snapshots[0] || null;
  } catch (error) {
    console.error('[PromptEngine] Error fetching portfolio snapshot:', error);
    return null;
  }
}

/**
 * Get previous week's weave count from portfolio snapshots
 */
export async function getPreviousWeekWeaves(): Promise<number | undefined> {
  try {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = Date.now() - (14 * 24 * 60 * 60 * 1000);

    const snapshots = await database
      .get<PortfolioSnapshot>('portfolio_snapshots')
      .query(
        Q.where('snapshot_date', Q.between(twoWeeksAgo, oneWeekAgo)),
        Q.sortBy('snapshot_date', Q.desc),
        Q.take(1)
      )
      .fetch();

    if (snapshots[0]) {
      return snapshots[0].interactionsPerWeek;
    }

    return undefined;
  } catch (error) {
    console.error('[PromptEngine] Error fetching previous week weaves:', error);
    return undefined;
  }
}

/**
 * Get average weekly weaves from recent snapshots
 */
export async function getAverageWeeklyWeaves(): Promise<number | undefined> {
  try {
    const fourWeeksAgo = Date.now() - (28 * 24 * 60 * 60 * 1000);

    const snapshots = await database
      .get<PortfolioSnapshot>('portfolio_snapshots')
      .query(
        Q.where('snapshot_date', Q.gte(fourWeeksAgo)),
        Q.sortBy('snapshot_date', Q.desc)
      )
      .fetch();

    if (snapshots.length === 0) return undefined;

    const total = snapshots.reduce((sum, s) => sum + s.interactionsPerWeek, 0);
    return total / snapshots.length;
  } catch (error) {
    console.error('[PromptEngine] Error calculating average weaves:', error);
    return undefined;
  }
}
