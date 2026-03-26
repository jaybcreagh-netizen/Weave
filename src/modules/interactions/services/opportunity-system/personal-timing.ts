import { getTimeOfDay } from '@/shared/utils/time-aware-filter';
import { TIMING_WINDOWS, type TimingWindow } from './types';

export const DEFAULT_PREFERRED_SUGGESTION_WINDOWS: TimingWindow[] = ['morning', 'evening'];

type TimingProfileLike = {
  preferredWindows?: unknown;
};

type SuggestionTimingProfileLike = {
  preferredSuggestionWindows?: unknown;
  preferredSuggestionWindowsJSON?: string | null;
  timingProfile?: TimingProfileLike | null;
  timingProfileJSON?: string | null;
};

const TIMING_WINDOW_START_HOURS: Record<TimingWindow, number> = {
  morning: 6,
  midday: 11,
  afternoon: 14,
  evening: 18,
  night: 22,
};

function parseTimingWindows(value: unknown): TimingWindow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return TIMING_WINDOWS.filter(window => value.includes(window));
}

function parseTimingProfile(value: unknown): TimingProfileLike | null {
  if (!value) return null;

  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as TimingProfileLike;
    } catch {
      return null;
    }
  }

  if (typeof value === 'object') {
    return value as TimingProfileLike;
  }

  return null;
}

export function getTimingWindowForDate(date: Date = new Date()): TimingWindow {
  const timeOfDay = getTimeOfDay(date);
  return TIMING_WINDOWS.includes(timeOfDay as TimingWindow)
    ? timeOfDay as TimingWindow
    : 'midday';
}

export function resolvePreferredSuggestionWindows(
  profile?: SuggestionTimingProfileLike | null
): TimingWindow[] {
  let explicitWindows: TimingWindow[] = [];

  if (profile?.preferredSuggestionWindows !== undefined) {
    explicitWindows = parseTimingWindows(profile.preferredSuggestionWindows);
  } else if (profile?.preferredSuggestionWindowsJSON) {
    try {
      explicitWindows = parseTimingWindows(JSON.parse(profile.preferredSuggestionWindowsJSON));
    } catch {
      explicitWindows = [];
    }
  }

  const timingProfile = parseTimingProfile(profile?.timingProfile ?? profile?.timingProfileJSON);
  const learnedWindows = parseTimingWindows(timingProfile?.preferredWindows);

  if (explicitWindows.length > 0 && learnedWindows.length > 0) {
    const hybridWindows = explicitWindows.filter(window => learnedWindows.includes(window));
    return hybridWindows.length > 0 ? hybridWindows : explicitWindows;
  }

  if (explicitWindows.length > 0) {
    return explicitWindows;
  }

  if (learnedWindows.length > 0) {
    return learnedWindows;
  }

  return [...DEFAULT_PREFERRED_SUGGESTION_WINDOWS];
}

export function isWindowWithinPreferences(
  window: TimingWindow,
  preferredWindows?: readonly TimingWindow[] | null
): boolean {
  return !preferredWindows || preferredWindows.length === 0 || preferredWindows.includes(window);
}

export function isPreferredSuggestionWindowActive(
  profileOrWindows?: SuggestionTimingProfileLike | readonly TimingWindow[] | null,
  date: Date = new Date()
): boolean {
  let preferredWindows: readonly TimingWindow[];

  if (Array.isArray(profileOrWindows)) {
    preferredWindows = profileOrWindows as readonly TimingWindow[];
  } else {
    preferredWindows = resolvePreferredSuggestionWindows(
      profileOrWindows as SuggestionTimingProfileLike | null | undefined
    );
  }

  return isWindowWithinPreferences(getTimingWindowForDate(date), preferredWindows);
}

export function getMillisecondsUntilNextTimingWindow(date: Date = new Date()): number {
  const elapsedMs = (
    ((date.getHours() * 60 + date.getMinutes()) * 60 + date.getSeconds()) * 1000
  ) + date.getMilliseconds();

  const nextHour = Object.values(TIMING_WINDOW_START_HOURS).find(hour => hour > date.getHours())
    ?? (24 + TIMING_WINDOW_START_HOURS.morning);

  const nextElapsedMs = nextHour * 60 * 60 * 1000;
  return Math.max(1000, nextElapsedMs - elapsedMs);
}
