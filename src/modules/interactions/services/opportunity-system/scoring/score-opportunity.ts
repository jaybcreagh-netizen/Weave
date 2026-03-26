import type {
  Opportunity,
  OpportunityScoreBreakdown,
  ScoredOpportunity,
  SelectionResult,
} from '../types';
import type {
  RecentSurfaceSnapshot,
  ScoringWeights,
  SelectionConfig,
  SelectorSignals,
  SocialSeason,
} from './score-types';
import {
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_SELECTION_CONFIG,
} from './score-types';
import { getSeasonPriorityMultiplier } from '@/modules/intelligence/services/social-season/season-suggestions.service';

const MAX_URGENCY = 100;
const MAX_CONFIDENCE = 1;
const HOURS_48_MS = 48 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const RESTING_EXEMPT_CATEGORIES = new Set(['life-event', 'critical-drift']);

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function isPreferredWindow(
  window: Opportunity['timeRelevance']['bestWindow'],
  signals: SelectorSignals
): boolean {
  if (!window) return true;
  return !signals.preferredWindows || signals.preferredWindows.length === 0
    || signals.preferredWindows.includes(window);
}

function isCurrentWindowPreferred(signals: SelectorSignals): boolean {
  return !signals.preferredWindows
    || signals.preferredWindows.length === 0
    || signals.preferredWindows.includes(signals.currentWindow);
}

function windowsMatch(opportunity: Opportunity, signals: SelectorSignals): boolean {
  const bestWindow = opportunity.timeRelevance.bestWindow;
  if (!bestWindow) return false;

  const currentMatch = bestWindow === signals.currentWindow
    && isPreferredWindow(signals.currentWindow, signals);
  const nextMatch = bestWindow === signals.nextWindow
    && isPreferredWindow(signals.nextWindow, signals);

  return currentMatch || nextMatch;
}

function getBatteryPercent(signals: SelectorSignals): number {
  if (typeof signals.batteryPercent !== 'number') return 50;
  return clamp(signals.batteryPercent, 0, 100);
}

function getRecentSurfaced(
  signals: SelectorSignals
): readonly RecentSurfaceSnapshot[] {
  const recent = signals.recentSurfaced || [];
  return recent.filter(item => signals.now - item.surfacedAt <= HOURS_48_MS);
}

export function scoreUrgency(
  opportunity: Opportunity,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  return (clamp(opportunity.urgency, 0, MAX_URGENCY) / MAX_URGENCY) * weights.urgency;
}

export function scoreScheduleFit(
  opportunity: Opportunity,
  signals: SelectorSignals,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  let base: number;

  if (!signals.calendarPermissionGranted) {
    base = 10;
  } else {
    const busyPenalty = clamp(signals.calendarBusyScore ?? 0, 0, 1) * 10;
    const windowMatch = windowsMatch(opportunity, signals) ? 5 : 0;
    const effortFit = signals.availableWindowMinutes !== undefined
      && opportunity.estimatedDurationMinutes !== undefined
      && signals.availableWindowMinutes >= opportunity.estimatedDurationMinutes
      ? 5
      : 0;

    base = 20 - busyPenalty + windowMatch + effortFit;
  }

  if (!isCurrentWindowPreferred(signals)) {
    base *= 0.5;
  }

  if (!isPreferredWindow(opportunity.timeRelevance.bestWindow, signals)) {
    base *= 0.75;
  }

  if ((signals.plansThisWeekCount ?? 0) >= 5 && opportunity.effortLevel !== 'minimal') {
    base *= 0.5;
  }

  return clamp(base, 0, weights.scheduleFit);
}

export function scoreBatterySeasonFit(
  opportunity: Opportunity,
  signals: SelectorSignals,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  const batteryPercent = getBatteryPercent(signals);
  let points = 15;

  if (batteryPercent >= 60) {
    points = 15;
  } else if (batteryPercent >= 30) {
    points = opportunity.effortLevel === 'high' ? 5 : 15;
  } else {
    points = opportunity.effortLevel === 'minimal' ? 10 : 2;
  }

  const season: SocialSeason = signals.season || 'balanced';
  if (season === 'resting' && !RESTING_EXEMPT_CATEGORIES.has(opportunity.category)) {
    points *= 0.3;
  }

  return clamp(points, 0, weights.batterySeasonFit);
}

export function scoreIntentionAlignment(
  opportunity: Opportunity,
  signals: SelectorSignals,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  if (opportunity.intentionId) return weights.intentionAlignment;

  const activeIntentionFriendIds = signals.activeIntentionFriendIds instanceof Set
    ? signals.activeIntentionFriendIds
    : new Set(signals.activeIntentionFriendIds || []);

  if (opportunity.friendId && activeIntentionFriendIds.has(opportunity.friendId)) {
    return 10;
  }

  return 0;
}

export function scoreWhyNowStrength(
  opportunity: Opportunity,
  signals: SelectorSignals,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  const deadlineAt = opportunity.timeRelevance.deadlineAt;
  if (typeof deadlineAt === 'number') {
    const daysUntil = (deadlineAt - signals.now) / DAY_MS;
    if (daysUntil <= 3) return weights.whyNowStrength;
    if (daysUntil <= 7) return 7;
  }

  if (windowsMatch(opportunity, signals)) {
    return 5;
  }

  if (!isCurrentWindowPreferred(signals)) {
    return 0.5;
  }

  if ((opportunity.momentumScore ?? 0) > 15) {
    return 4;
  }

  return 1;
}

export function scoreNoveltyDiversity(
  opportunity: Opportunity,
  signals: SelectorSignals,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  const recentSurfaced = getRecentSurfaced(signals);
  let points = 0;

  if (opportunity.friendTier && !recentSurfaced.some(item => item.friendTier === opportunity.friendTier)) {
    points += 2;
  }

  if (!recentSurfaced.some(item => item.category === opportunity.category)) {
    points += 2;
  }

  if (opportunity.friendId && !recentSurfaced.some(item => item.friendId === opportunity.friendId)) {
    points += 1;
  }

  return clamp(points, 0, weights.noveltyDiversity);
}

export function scoreConfidence(
  opportunity: Opportunity,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): number {
  return clamp(opportunity.confidence, 0, MAX_CONFIDENCE) * weights.confidence;
}

export function scoreOpportunity(
  opportunity: Opportunity,
  signals: SelectorSignals,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): ScoredOpportunity {
  const scoreBreakdown: OpportunityScoreBreakdown = {
    urgency: scoreUrgency(opportunity, weights),
    scheduleFit: scoreScheduleFit(opportunity, signals, weights),
    batterySeasonFit: scoreBatterySeasonFit(opportunity, signals, weights),
    intentionAlignment: scoreIntentionAlignment(opportunity, signals, weights),
    whyNowStrength: scoreWhyNowStrength(opportunity, signals, weights),
    noveltyDiversity: scoreNoveltyDiversity(opportunity, signals, weights),
    confidence: scoreConfidence(opportunity, weights),
    seasonAdjustment: 0,
  };

  const baseScore = Object.entries(scoreBreakdown)
    .filter(([key]) => key !== 'seasonAdjustment')
    .reduce((sum, [, value]) => sum + value, 0);
  const seasonPriorityMultiplier = getSeasonPriorityMultiplier(
    signals.season,
    opportunity.category
  );

  scoreBreakdown.seasonAdjustment = baseScore * (seasonPriorityMultiplier - 1);

  const totalScore = baseScore + scoreBreakdown.seasonAdjustment;

  return {
    ...opportunity,
    scoreBreakdown,
    totalScore,
  };
}

export function scoreOpportunities(
  opportunities: Opportunity[],
  signals: SelectorSignals,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS
): ScoredOpportunity[] {
  return opportunities.map(opportunity => scoreOpportunity(opportunity, signals, weights));
}

export function selectOpportunities(
  scored: ScoredOpportunity[],
  config: SelectionConfig = DEFAULT_SELECTION_CONFIG
): SelectionResult {
  const ranked = [...scored].sort((a, b) => b.totalScore - a.totalScore);

  if (ranked.length === 0) {
    return { primary: null, secondary: null, reason: 'empty' };
  }

  const primary = ranked[0];
  if (primary.totalScore < config.minThreshold) {
    return { primary: null, secondary: null, reason: 'below_threshold' };
  }

  const secondary = ranked.slice(1).find(candidate =>
    (candidate.friendTier !== primary.friendTier || candidate.category !== primary.category)
    && candidate.totalScore >= primary.totalScore * config.secondaryRatio
  ) || null;

  return {
    primary,
    secondary,
    reason: 'selected',
  };
}
