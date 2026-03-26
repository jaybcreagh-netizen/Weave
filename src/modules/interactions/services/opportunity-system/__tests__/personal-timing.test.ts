import {
  DEFAULT_PREFERRED_SUGGESTION_WINDOWS,
  getMillisecondsUntilNextTimingWindow,
  getTimingWindowForDate,
  isPreferredSuggestionWindowActive,
  isWindowWithinPreferences,
  resolvePreferredSuggestionWindows,
} from '../personal-timing';

describe('personal timing helpers', () => {
  it('defaults to morning and evening when no profile timing exists', () => {
    expect(resolvePreferredSuggestionWindows()).toEqual(DEFAULT_PREFERRED_SUGGESTION_WINDOWS);
  });

  it('prefers explicit user-set windows over learned timing', () => {
    expect(resolvePreferredSuggestionWindows({
      preferredSuggestionWindows: ['midday', 'afternoon'],
      timingProfile: {
        preferredWindows: ['evening'],
      },
    })).toEqual(['midday', 'afternoon']);
  });

  it('intersects explicit and learned timing windows when they overlap', () => {
    expect(resolvePreferredSuggestionWindows({
      preferredSuggestionWindows: ['midday', 'evening'],
      timingProfile: {
        preferredWindows: ['evening', 'night'],
      },
    })).toEqual(['evening']);
  });

  it('falls back to learned timing windows when explicit windows are absent', () => {
    expect(resolvePreferredSuggestionWindows({
      timingProfileJSON: JSON.stringify({
        preferredWindows: ['midday', 'evening'],
      }),
    })).toEqual(['midday', 'evening']);
  });

  it('detects whether the current window is preferred', () => {
    expect(isPreferredSuggestionWindowActive(['evening'], new Date('2026-03-23T19:00:00.000Z'))).toBe(true);
    expect(isPreferredSuggestionWindowActive(['morning'], new Date('2026-03-23T19:00:00.000Z'))).toBe(false);
  });

  it('computes the current timing window and next refresh delay', () => {
    expect(getTimingWindowForDate(new Date('2026-03-23T13:30:00.000Z'))).toBe('midday');
    expect(isWindowWithinPreferences('midday', ['midday', 'evening'])).toBe(true);
    expect(getMillisecondsUntilNextTimingWindow(new Date('2026-03-23T10:30:00.000Z'))).toBe(30 * 60 * 1000);
  });
});
