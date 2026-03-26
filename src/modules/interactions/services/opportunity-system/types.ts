import type { Suggestion, Tier } from '@/shared/types/common';

export const TIMING_WINDOWS = ['morning', 'midday', 'afternoon', 'evening', 'night'] as const;
export type TimingWindow = typeof TIMING_WINDOWS[number];

export const EFFORT_LEVELS = ['minimal', 'moderate', 'high'] as const;
export type EffortLevel = typeof EFFORT_LEVELS[number];

export const CANONICAL_SUGGESTION_CATEGORIES = [
  'critical-drift',
  'high-drift',
  'life-event',
  'first-weave',
  'intention-reminder',
  'archetype-mismatch',
  'momentum',
  'maintain',
  'deepen',
  'reflect',
  'celebrate',
  'daily-reflect',
  'gentle-nudge',
  'wildcard',
  'community-checkin',
  'set-intention',
  'signal-followup',
  'signal-repair',
  'signal-values',
  'signal-reconnect',
  'insight',
  'portfolio',
  'variety',
] as const;

export type SuggestionCategory = typeof CANONICAL_SUGGESTION_CATEGORIES[number];

const CATEGORY_ALIASES: Record<string, SuggestionCategory> = {
  drift: 'high-drift',
  'community-drift': 'community-checkin',
  'effectiveness-insight': 'insight',
  seasonal: 'maintain',
};

export function isSuggestionCategory(category?: string | null): category is SuggestionCategory {
  return CANONICAL_SUGGESTION_CATEGORIES.includes(category as SuggestionCategory);
}

export function normalizeSuggestionCategory(category?: string | null): SuggestionCategory | null {
  if (!category) return null;
  if (isSuggestionCategory(category)) return category;
  return CATEGORY_ALIASES[category] || null;
}

export interface OpportunityExplanation {
  whyNow: string;
  whyThisFriend: string;
  whyThisAction: string;
}

export interface OpportunityTimeRelevance {
  bestWindow?: TimingWindow;
  deadlineAt?: number;
  expiresAt?: number;
}

export interface OpportunityCopyContext {
  lastInteractionAt?: number;
  daysSinceLastInteraction?: number;
  recentInteractionCategory?: string;
  topInterest?: string;
  locationHint?: string;
  vibeHint?: string;
}

export interface OpportunityPresentationCopy {
  title: string;
  subtitle: string;
  contextSnippet?: string;
  actionLabel?: string;
  reason?: string;
  aiEnriched?: boolean;
}

export interface OpportunitySuggestionPayload {
  type?: Suggestion['type'];
  icon?: string;
  dismissible?: boolean;
  action?: Suggestion['action'];
  trackingContext?: Suggestion['trackingContext'];
  signalContext?: Suggestion['signalContext'];
}

export interface Opportunity {
  id: string;
  friendId?: string;
  friendName?: string;
  friendTier?: Tier;
  category: SuggestionCategory;
  generatorSource: string;
  urgency: number; // 0-100
  confidence: number; // 0-1
  effortLevel: EffortLevel;
  estimatedDurationMinutes?: number;
  momentumScore?: number;
  explanation: OpportunityExplanation;
  timeRelevance: OpportunityTimeRelevance;
  intentionId?: string;
  intentionBoost?: number;
  copyContext?: OpportunityCopyContext;
  presentationCopy?: OpportunityPresentationCopy;
  suggestionPayload?: OpportunitySuggestionPayload;
  createdAt: number;
}

export interface OpportunityScoreBreakdown {
  urgency: number;
  scheduleFit: number;
  batterySeasonFit: number;
  intentionAlignment: number;
  whyNowStrength: number;
  noveltyDiversity: number;
  confidence: number;
  seasonAdjustment: number;
}

export type SelectorSurfaceRequestKind = 'automatic' | 'manual_pull';

export interface SelectorPacingSnapshot {
  season?: string;
  suggestionFrequency?: string;
  batteryLevel?: number;
  dailyFreshBudget?: number;
  budgetRemaining?: number;
  replacementDelayMinutes?: number;
  adaptiveBudgetAdjustment?: number;
  adaptiveReplacementDelayMinutes?: number;
  adaptiveReasons?: string[];
  surfacedPrimaryToday?: number;
  actedToday?: number;
  lastActedAt?: number;
  allowAutoSuggestions?: boolean;
  allowManualMore?: boolean;
  quietReason?: string;
}

export interface ScoredOpportunity extends Opportunity {
  scoreBreakdown: OpportunityScoreBreakdown;
  totalScore: number;
}

export interface SelectionResult {
  primary: ScoredOpportunity | null;
  secondary: ScoredOpportunity | null;
  reason: 'selected' | 'below_threshold' | 'empty';
}
