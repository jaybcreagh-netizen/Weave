import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Suggestion } from '@/shared/types/common';
import {
  buildFocusSuggestionSurfaceFingerprint,
  buildFocusSuggestionSurfacePayload,
  getRecentlySurfacedFocusSuggestionIds,
  recordRecentlySurfacedFocusSuggestions,
} from '../focus-suggestion-telemetry.service';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

function createSuggestion(id: string): Suggestion {
  return {
    id,
    friendId: `friend-${id}`,
    friendName: `Friend ${id}`,
    type: 'connect',
    title: `Suggestion ${id}`,
    subtitle: 'Helpful context',
    icon: 'Sparkles',
    action: { type: 'log' },
    urgency: 'medium',
  } as Suggestion;
}

describe('focus-suggestion-telemetry.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a stable fingerprint from the surfaced suggestion state', () => {
    const fingerprint = buildFocusSuggestionSurfaceFingerprint({
      suggestions: [createSuggestion('s1'), createSuggestion('s2')],
      selectorSuggestions: [createSuggestion('s1')],
      surfaceSource: 'selector',
      selectionReason: 'selected',
      selectorOpportunitySource: 'pool',
      hasIntentions: true,
      hasUpcomingDates: false,
    });

    expect(fingerprint).toBe('selector|selected|pool|s1,s2|s1|intentions|no-dates');
  });

  it('builds analytics payload from displayed and selector suggestions', () => {
    const payload = buildFocusSuggestionSurfacePayload({
      suggestions: [createSuggestion('s1'), createSuggestion('s2')],
      selectorSuggestions: [createSuggestion('s1')],
      surfaceSource: 'legacy-list',
      selectionReason: 'selected',
      selectorOpportunitySource: 'synthesized',
      hasIntentions: false,
      hasUpcomingDates: true,
    });

    expect(payload).toEqual({
      surface_source: 'legacy-list',
      selection_reason: 'selected',
      selector_opportunity_source: 'synthesized',
      displayed_count: 2,
      selector_count: 1,
      displayed_suggestion_ids: ['s1', 's2'],
      selector_suggestion_ids: ['s1'],
      primary_suggestion_id: 's1',
      secondary_suggestion_id: 's2',
      has_intentions: false,
      has_upcoming_dates: true,
    });
  });

  it('records recently surfaced suggestions with latest timestamps', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([
      { id: 's1', surfacedAt: 1000 },
      { id: 'stale', surfacedAt: 0 },
    ]));

    await recordRecentlySurfacedFocusSuggestions(
      [createSuggestion('s1'), createSuggestion('s2')],
      2000
    );

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@weave:focus_recent_surfaced_suggestions',
      JSON.stringify([
        { id: 's1', surfacedAt: 2000 },
        { id: 's2', surfacedAt: 2000 },
        { id: 'stale', surfacedAt: 0 },
      ])
    );
  });

  it('returns only suggestion ids surfaced within the requested window', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify([
      { id: 'fresh', surfacedAt: 9_000 },
      { id: 'still-fresh', surfacedAt: 8_500 },
      { id: 'expired', surfacedAt: 1_000 },
    ]));

    const result = await getRecentlySurfacedFocusSuggestionIds(1_500, 10_000);

    expect(result).toEqual(new Set(['fresh', 'still-fresh']));
  });
});
