import type { SocialSeason } from '@/db/models/UserProfile';
import type { Suggestion, Tier } from '@/shared/types/common';
import { getTimeOfDay } from '@/shared/utils/time-aware-filter';
import type { FriendContextData } from '../suggestion-system/SuggestionDataLoader';
import {
  FocusSelectorService,
  type FocusSelectorEvaluation,
  type FocusSelectorOptions,
} from './FocusSelectorService';
import {
  adaptSelectionToSuggestions,
  adaptSuggestionsToOpportunities,
  type AdaptedSuggestionSelection,
  type OpportunityAdapterOptions,
} from './OpportunityAdapter';
import { applyOpportunityTriage } from './triage.shared';
import type { SelectorSignals, SocialSeason as SelectorSeason } from './scoring/score-types';
import { TIMING_WINDOWS, type Opportunity } from './types';

const RECENT_INTERACTION_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface LegacySuggestionShadowInput {
  suggestions: Suggestion[];
  opportunities?: Opportunity[];
  contextMap?: Map<string, FriendContextData>;
  season?: SocialSeason | null;
  now?: number;
  signalOverrides?: Partial<SelectorSignals>;
  selectorOptions?: FocusSelectorOptions;
  adapterOptions?: OpportunityAdapterOptions;
}

export interface LegacySuggestionShadowResult {
  opportunities: Opportunity[];
  signals: SelectorSignals;
  evaluation: FocusSelectorEvaluation;
  selectedSuggestions: AdaptedSuggestionSelection;
}

function normalizeSeason(season?: SocialSeason | null): SelectorSeason | undefined {
  if (season === 'resting' || season === 'balanced' || season === 'blooming') {
    return season;
  }

  return undefined;
}

function getCurrentWindow(now: number) {
  const timeOfDay = getTimeOfDay(new Date(now));
  return TIMING_WINDOWS.includes(timeOfDay) ? timeOfDay : 'midday';
}

function getNextWindow(currentWindow: SelectorSignals['currentWindow']) {
  const currentIndex = TIMING_WINDOWS.indexOf(currentWindow);
  return TIMING_WINDOWS[(currentIndex + 1) % TIMING_WINDOWS.length];
}

function getPlannedFriendIds(contextMap?: Map<string, FriendContextData>): string[] {
  if (!contextMap) return [];

  return Array.from(contextMap.values())
    .filter(context => context.plannedInteractions.length > 0)
    .map(context => context.friend.id);
}

function getRecentlyInteractedFriendIds(
  contextMap: Map<string, FriendContextData> | undefined,
  now: number
): string[] {
  if (!contextMap) return [];

  return Array.from(contextMap.values())
    .filter(context => context.lastDate !== null && now - context.lastDate <= RECENT_INTERACTION_WINDOW_MS)
    .map(context => context.friend.id);
}

function getPlansThisWeekCount(
  contextMap: Map<string, FriendContextData> | undefined,
  now: number
): number {
  if (!contextMap) return 0;

  return Array.from(contextMap.values())
    .flatMap(context => context.plannedInteractions)
    .filter(interaction => {
      const interactionTime = interaction.interactionDate?.getTime?.();
      return typeof interactionTime === 'number' && interactionTime >= now && interactionTime <= now + WEEK_MS;
    })
    .length;
}

export function buildLegacySelectorSignals(
  contextMap?: Map<string, FriendContextData>,
  season?: SocialSeason | null,
  now: number = Date.now(),
  overrides: Partial<SelectorSignals> = {}
): SelectorSignals {
  const currentWindow = getCurrentWindow(now);

  return {
    now,
    currentWindow,
    nextWindow: getNextWindow(currentWindow),
    quietHoursActive: false,
    calendarPermissionGranted: false,
    plannedFriendIds: getPlannedFriendIds(contextMap),
    recentlyInteractedFriendIds: getRecentlyInteractedFriendIds(contextMap, now),
    plansThisWeekCount: getPlansThisWeekCount(contextMap, now),
    season: normalizeSeason(season),
    ...overrides,
  };
}

export function evaluateLegacySuggestionShadow(
  input: LegacySuggestionShadowInput
): LegacySuggestionShadowResult {
  const now = input.now || Date.now();
  const opportunities = applyOpportunityTriage(
    input.opportunities || adaptSuggestionsToOpportunities(
      input.suggestions,
      suggestion => ({
        friendTier: suggestion.friendId
          ? input.contextMap?.get(suggestion.friendId)?.friend.dunbarTier as Tier | undefined
          : undefined,
      })
    ),
    now
  );
  const signals = buildLegacySelectorSignals(
    input.contextMap,
    input.season,
    now,
    input.signalOverrides
  );
  const evaluation = FocusSelectorService.evaluate(opportunities, signals, input.selectorOptions);
  const selectedSuggestions = adaptSelectionToSuggestions(
    evaluation.selection,
    input.suggestions,
    opportunities,
    input.adapterOptions
  );

  return {
    opportunities,
    signals,
    evaluation,
    selectedSuggestions,
  };
}
