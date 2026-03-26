import type { TimingWindow, SuggestionCategory } from '../types';
import type { Tier } from '@/shared/types/common';

export type SocialSeason = 'resting' | 'balanced' | 'blooming';

export interface RecentSurfaceSnapshot {
  opportunityId: string;
  friendId?: string;
  friendTier?: Tier;
  category: SuggestionCategory;
  surfacedAt: number;
}

export interface SelectorSignals {
  now: number;
  currentWindow: TimingWindow;
  nextWindow?: TimingWindow;
  preferredWindows?: readonly TimingWindow[];
  quietHoursActive?: boolean;
  calendarPermissionGranted?: boolean;
  calendarBusyScore?: number; // 0-1
  availableWindowMinutes?: number;
  plannedFriendIds?: ReadonlySet<string> | readonly string[];
  matchedCalendarFriendIds?: ReadonlySet<string> | readonly string[];
  recentlyInteractedFriendIds?: ReadonlySet<string> | readonly string[];
  snoozedOpportunityIds?: ReadonlySet<string> | readonly string[];
  suppressedFriendIds?: ReadonlySet<string> | readonly string[];
  activeIntentionFriendIds?: ReadonlySet<string> | readonly string[];
  plansThisWeekCount?: number;
  batteryPercent?: number | null; // Normalized 0-100; integration layers can map from 1-5 later
  season?: SocialSeason;
  recentSurfaced?: readonly RecentSurfaceSnapshot[];
}

export interface ScoringWeights {
  urgency: number;
  scheduleFit: number;
  batterySeasonFit: number;
  intentionAlignment: number;
  whyNowStrength: number;
  noveltyDiversity: number;
  confidence: number;
}

export interface SelectionConfig {
  minThreshold: number;
  secondaryRatio: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  urgency: 30,
  scheduleFit: 20,
  batterySeasonFit: 15,
  intentionAlignment: 15,
  whyNowStrength: 10,
  noveltyDiversity: 5,
  confidence: 5,
};

export const DEFAULT_SELECTION_CONFIG: SelectionConfig = {
  minThreshold: 35,
  secondaryRatio: 0.6,
};

export type SuppressionReason =
  | 'already_planned'
  | 'just_interacted'
  | 'dismissed_or_snoozed'
  | 'expired'
  | 'quiet_hours'
  | 'suppressed_friend';

export interface SuppressionResult<TOpportunity> {
  opportunity: TOpportunity;
  reasons: SuppressionReason[];
}

export function toLookupSet(values?: ReadonlySet<string> | readonly string[]): ReadonlySet<string> {
  if (!values) return new Set();
  return values instanceof Set ? values : new Set(values);
}
