import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Suggestion } from '@/shared/types/common';

const RECENT_FOCUS_SURFACED_SUGGESTIONS_KEY = '@weave:focus_recent_surfaced_suggestions';
const RECENT_FOCUS_SURFACED_SUGGESTIONS_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RECENT_FOCUS_SURFACED_SUGGESTIONS = 24;

interface RecentFocusSurfacedSuggestionRecord {
  id: string;
  surfacedAt: number;
}

export interface FocusSuggestionSurfaceInput {
  suggestions: Suggestion[];
  selectorSuggestions?: Suggestion[];
  surfaceSource: 'legacy-list' | 'selector';
  selectionReason?: string;
  selectorOpportunitySource?: 'synthesized' | 'pool';
  hasIntentions?: boolean;
  hasUpcomingDates?: boolean;
}

export function buildFocusSuggestionSurfaceFingerprint(
  input: FocusSuggestionSurfaceInput
): string {
  return [
    input.surfaceSource,
    input.selectionReason || 'unknown',
    input.selectorOpportunitySource || 'unknown',
    input.suggestions.map(suggestion => suggestion.id).join(','),
    (input.selectorSuggestions || []).map(suggestion => suggestion.id).join(','),
    input.hasIntentions ? 'intentions' : 'no-intentions',
    input.hasUpcomingDates ? 'dates' : 'no-dates',
  ].join('|');
}

export function buildFocusSuggestionSurfacePayload(
  input: FocusSuggestionSurfaceInput
): Record<string, unknown> {
  const selectorSuggestions = input.selectorSuggestions || [];
  const primarySuggestionId = selectorSuggestions[0]?.id || input.suggestions[0]?.id || null;
  const secondarySuggestionId = selectorSuggestions[1]?.id || input.suggestions[1]?.id || null;

  return {
    surface_source: input.surfaceSource,
    selection_reason: input.selectionReason || 'unknown',
    selector_opportunity_source: input.selectorOpportunitySource || 'unknown',
    displayed_count: input.suggestions.length,
    selector_count: selectorSuggestions.length,
    displayed_suggestion_ids: input.suggestions.map(suggestion => suggestion.id),
    selector_suggestion_ids: selectorSuggestions.map(suggestion => suggestion.id),
    primary_suggestion_id: primarySuggestionId,
    secondary_suggestion_id: secondarySuggestionId,
    has_intentions: !!input.hasIntentions,
    has_upcoming_dates: !!input.hasUpcomingDates,
  };
}

function normalizeRecentFocusSurfacedSuggestionRecords(
  records: RecentFocusSurfacedSuggestionRecord[],
  now: number
): RecentFocusSurfacedSuggestionRecord[] {
  const latestById = new Map<string, number>();

  for (const record of records) {
    if (
      !record
      || typeof record.id !== 'string'
      || record.id.length === 0
      || typeof record.surfacedAt !== 'number'
      || !Number.isFinite(record.surfacedAt)
      || now - record.surfacedAt > RECENT_FOCUS_SURFACED_SUGGESTIONS_RETENTION_MS
    ) {
      continue;
    }

    const existing = latestById.get(record.id);
    if (existing == null || record.surfacedAt > existing) {
      latestById.set(record.id, record.surfacedAt);
    }
  }

  return Array.from(latestById.entries())
    .map(([id, surfacedAt]) => ({ id, surfacedAt }))
    .sort((left, right) => {
      if (right.surfacedAt !== left.surfacedAt) {
        return right.surfacedAt - left.surfacedAt;
      }

      return left.id.localeCompare(right.id);
    })
    .slice(0, MAX_RECENT_FOCUS_SURFACED_SUGGESTIONS);
}

async function readRecentFocusSurfacedSuggestionRecords(
  now: number
): Promise<RecentFocusSurfacedSuggestionRecord[]> {
  try {
    const storedValue = await AsyncStorage.getItem(RECENT_FOCUS_SURFACED_SUGGESTIONS_KEY);
    if (!storedValue) {
      return [];
    }

    const parsedValue = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return normalizeRecentFocusSurfacedSuggestionRecords(parsedValue, now);
  } catch {
    return [];
  }
}

export async function recordRecentlySurfacedFocusSuggestions(
  suggestions: Suggestion[],
  surfacedAt: number = Date.now()
): Promise<void> {
  if (suggestions.length === 0) {
    return;
  }

  try {
    const existingRecords = await readRecentFocusSurfacedSuggestionRecords(surfacedAt);
    const newRecords = suggestions.map(suggestion => ({
      id: suggestion.id,
      surfacedAt,
    }));
    const nextRecords = normalizeRecentFocusSurfacedSuggestionRecords(
      [...existingRecords, ...newRecords],
      surfacedAt
    );

    await AsyncStorage.setItem(
      RECENT_FOCUS_SURFACED_SUGGESTIONS_KEY,
      JSON.stringify(nextRecords)
    );
  } catch {
    // Fail open: notification dedupe is a trust improvement, not a hard dependency.
  }
}

export async function getRecentlySurfacedFocusSuggestionIds(
  windowMs: number,
  now: number = Date.now()
): Promise<Set<string>> {
  const records = await readRecentFocusSurfacedSuggestionRecords(now);

  return new Set(
    records
      .filter(record => now - record.surfacedAt <= windowMs)
      .map(record => record.id)
  );
}
