import { startOfDay } from 'date-fns';
import type UserProfileModel from '@/db/models/UserProfile';
import type { SocialSeason, SuggestionFrequency } from '@/db/models/UserProfile';
import type SurfacingLogModel from '@/db/models/SurfacingLog';
import { Q } from '@nozbe/watermelondb';
import { getOptionalQueryCollection } from '@/shared/utils/optional-query-collection';

export type SuggestionQuietReason =
  | 'budget_exhausted'
  | 'recently_handled'
  | 'resting_pause'
  | 'low_battery_pause';

export interface SuggestionPacingState {
  season: SocialSeason;
  suggestionFrequency: SuggestionFrequency;
  batteryLevel?: number;
  dailyFreshBudget: number;
  budgetRemaining: number;
  replacementDelayMinutes: number;
  adaptiveBudgetAdjustment: number;
  adaptiveReplacementDelayMinutes: number;
  adaptiveReasons: SuggestionPacingAdaptiveReason[];
  surfacedPrimaryToday: number;
  actedToday: number;
  lastActedAt?: number;
  allowAutoSuggestions: boolean;
  allowManualMore: boolean;
  quietReason?: SuggestionQuietReason;
}

interface SuggestionPacingInput {
  now?: number;
  season?: SocialSeason | null;
  suggestionFrequency?: SuggestionFrequency;
  batteryLevel?: number;
}

const BASE_BUDGETS: Record<SocialSeason, Record<SuggestionFrequency, number>> = {
  resting: {
    quiet: 0,
    balanced: 1,
    proactive: 1,
  },
  balanced: {
    quiet: 1,
    balanced: 1,
    proactive: 2,
  },
  blooming: {
    quiet: 1,
    balanced: 2,
    proactive: 3,
  },
};

const REPLACEMENT_DELAYS_MINUTES: Record<SocialSeason, number> = {
  resting: 12 * 60,
  balanced: 4 * 60,
  blooming: 2 * 60,
};

const ADAPTIVE_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;
const MIN_BUDGET_EXHAUSTED_QUIET_SAMPLES = 3;
const MIN_RECENTLY_HANDLED_QUIET_SAMPLES = 3;
const MAX_ADAPTIVE_DELAY_MINUTES = 8 * 60;

export type SuggestionPacingAdaptiveReason =
  | 'frequent_budget_exhausted'
  | 'frequent_recently_handled';

interface SuggestionPacingTelemetryStats {
  budgetExhaustedQuietCount: number;
  recentlyHandledQuietCount: number;
  manualPullSurfaceCount: number;
}

interface SuggestionPacingAdaptiveAdjustments {
  budgetAdjustment: number;
  replacementDelayAdjustmentMinutes: number;
  reasons: SuggestionPacingAdaptiveReason[];
}

async function resolveProfile(): Promise<UserProfileModel | null> {
  const collection = getOptionalQueryCollection<UserProfileModel>('user_profile');
  if (!collection) {
    return null;
  }

  const profiles = await collection.query().fetch();
  return profiles[0] || null;
}

async function loadTodayStats(now: number): Promise<{
  surfacedPrimaryToday: number;
  actedToday: number;
  lastActedAt?: number;
}> {
  const collection = getOptionalQueryCollection<SurfacingLogModel>('surfacing_log');
  if (!collection) {
    return {
      surfacedPrimaryToday: 0,
      actedToday: 0,
    };
  }

  const dayStart = startOfDay(new Date(now)).getTime();
  const logs = await collection.query(
    Q.where('timestamp', Q.gte(dayStart))
  ).fetch();

  const surfacedPrimaryToday = logs.filter(log =>
    log.eventType === 'surfaced'
    && log.surfaceSource === 'selector'
    && log.surfaceSlot === 'primary'
  ).length;

  const actedLogs = logs.filter(log => log.eventType === 'acted');
  const lastActedAt = actedLogs.reduce<number | undefined>((latest, log) => (
    latest === undefined || log.timestamp > latest ? log.timestamp : latest
  ), undefined);

  return {
    surfacedPrimaryToday,
    actedToday: actedLogs.length,
    lastActedAt,
  };
}

async function loadRecentPacingTelemetry(
  now: number
): Promise<SuggestionPacingTelemetryStats> {
  const collection = getOptionalQueryCollection<SurfacingLogModel>('surfacing_log');
  if (!collection) {
    return {
      budgetExhaustedQuietCount: 0,
      recentlyHandledQuietCount: 0,
      manualPullSurfaceCount: 0,
    };
  }

  const logs = await collection.query(
    Q.where('timestamp', Q.gte(now - ADAPTIVE_LOOKBACK_MS))
  ).fetch();

  return {
    budgetExhaustedQuietCount: logs.filter(log =>
      log.eventType === 'quiet'
      && log.surfaceSource === 'selector'
      && log.surfaceRequestKind !== 'manual_pull'
      && log.quietReason === 'budget_exhausted'
    ).length,
    recentlyHandledQuietCount: logs.filter(log =>
      log.eventType === 'quiet'
      && log.surfaceSource === 'selector'
      && log.surfaceRequestKind !== 'manual_pull'
      && log.quietReason === 'recently_handled'
    ).length,
    manualPullSurfaceCount: logs.filter(log =>
      log.eventType === 'surfaced'
      && log.surfaceSource === 'selector'
      && log.surfaceSlot === 'primary'
      && log.surfaceRequestKind === 'manual_pull'
    ).length,
  };
}

function normalizeSeason(season?: SocialSeason | null): SocialSeason {
  if (season === 'resting' || season === 'blooming') {
    return season;
  }
  return 'balanced';
}

function normalizeSuggestionFrequency(
  frequency?: SuggestionFrequency
): SuggestionFrequency {
  if (frequency === 'quiet' || frequency === 'proactive') {
    return frequency;
  }
  return 'balanced';
}

function clampBatteryLevel(batteryLevel?: number): number | undefined {
  if (typeof batteryLevel !== 'number' || Number.isNaN(batteryLevel)) {
    return undefined;
  }

  return Math.max(1, Math.min(5, batteryLevel));
}

function applyBatteryAdjustment(
  baseBudget: number,
  batteryLevel?: number
): number {
  if (typeof batteryLevel !== 'number') {
    return baseBudget;
  }

  if (batteryLevel <= 1.5) {
    return 0;
  }

  if (batteryLevel <= 2.5) {
    return Math.max(0, baseBudget - 1);
  }

  return baseBudget;
}

function deriveAdaptiveAdjustments(
  telemetry: SuggestionPacingTelemetryStats,
  baseReplacementDelayMinutes: number
): SuggestionPacingAdaptiveAdjustments {
  const reasons: SuggestionPacingAdaptiveReason[] = [];
  let budgetAdjustment = 0;
  let replacementDelayAdjustmentMinutes = 0;
  const manualPullsActive = telemetry.manualPullSurfaceCount >= 2;

  if (
    !manualPullsActive
    && telemetry.budgetExhaustedQuietCount >= MIN_BUDGET_EXHAUSTED_QUIET_SAMPLES
  ) {
    budgetAdjustment = -1;
    reasons.push('frequent_budget_exhausted');
  }

  if (
    !manualPullsActive
    && telemetry.recentlyHandledQuietCount >= MIN_RECENTLY_HANDLED_QUIET_SAMPLES
  ) {
    replacementDelayAdjustmentMinutes = Math.min(
      MAX_ADAPTIVE_DELAY_MINUTES,
      Math.max(60, Math.round(baseReplacementDelayMinutes * 0.5))
    );
    reasons.push('frequent_recently_handled');
  }

  return {
    budgetAdjustment,
    replacementDelayAdjustmentMinutes,
    reasons,
  };
}

function resolveQuietReason(
  season: SocialSeason,
  batteryLevel: number | undefined,
  budgetRemaining: number,
  handledRecently: boolean
): SuggestionQuietReason | undefined {
  if (handledRecently) {
    return 'recently_handled';
  }

  if (budgetRemaining > 0) {
    return undefined;
  }

  if (typeof batteryLevel === 'number' && batteryLevel <= 2) {
    return 'low_battery_pause';
  }

  if (season === 'resting') {
    return 'resting_pause';
  }

  return 'budget_exhausted';
}

export const SuggestionPacingService = {
  async getAutomaticPacing(
    input: SuggestionPacingInput = {}
  ): Promise<SuggestionPacingState> {
    const now = input.now ?? Date.now();
    const profile = await resolveProfile();
    const season = normalizeSeason(input.season ?? profile?.currentSocialSeason ?? null);
    const suggestionFrequency = normalizeSuggestionFrequency(
      input.suggestionFrequency ?? profile?.suggestionFrequency
    );
    const batteryLevel = clampBatteryLevel(
      input.batteryLevel ?? profile?.socialBatteryCurrent
    );
    const [stats, telemetry] = await Promise.all([
      loadTodayStats(now),
      loadRecentPacingTelemetry(now),
    ]);
    const baseBudget = BASE_BUDGETS[season][suggestionFrequency];
    const batteryAdjustedBudget = applyBatteryAdjustment(baseBudget, batteryLevel);
    const baseReplacementDelayMinutes = typeof batteryLevel === 'number' && batteryLevel <= 2.5
      ? Math.max(REPLACEMENT_DELAYS_MINUTES[season], 8 * 60)
      : REPLACEMENT_DELAYS_MINUTES[season];
    const adaptiveAdjustments = deriveAdaptiveAdjustments(
      telemetry,
      baseReplacementDelayMinutes
    );
    const dailyFreshBudget = Math.max(
      0,
      batteryAdjustedBudget + adaptiveAdjustments.budgetAdjustment
    );
    const budgetRemaining = Math.max(0, dailyFreshBudget - stats.surfacedPrimaryToday);
    const replacementDelayMinutes = baseReplacementDelayMinutes
      + adaptiveAdjustments.replacementDelayAdjustmentMinutes;
    const handledRecently = typeof stats.lastActedAt === 'number'
      && (now - stats.lastActedAt) < (replacementDelayMinutes * 60 * 1000);
    const quietReason = resolveQuietReason(
      season,
      batteryLevel,
      budgetRemaining,
      handledRecently
    );

    return {
      season,
      suggestionFrequency,
      batteryLevel,
      dailyFreshBudget,
      budgetRemaining,
      replacementDelayMinutes,
      adaptiveBudgetAdjustment: adaptiveAdjustments.budgetAdjustment,
      adaptiveReplacementDelayMinutes: adaptiveAdjustments.replacementDelayAdjustmentMinutes,
      adaptiveReasons: adaptiveAdjustments.reasons,
      surfacedPrimaryToday: stats.surfacedPrimaryToday,
      actedToday: stats.actedToday,
      lastActedAt: stats.lastActedAt,
      allowAutoSuggestions: !quietReason,
      allowManualMore: !(typeof batteryLevel === 'number' && batteryLevel <= 1.5),
      quietReason,
    };
  },
};
