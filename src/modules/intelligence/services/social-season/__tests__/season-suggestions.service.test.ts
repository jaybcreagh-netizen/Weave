import {
  filterSuggestionsBySeason,
  getSeasonPriorityMultiplier,
  getSeasonSuggestionConfig,
} from '../season-suggestions.service';
import type { Suggestion } from '@/shared/types/common';

function createSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 'suggestion-1',
    friendId: 'friend-1',
    friendName: 'Alex',
    type: 'connect',
    title: 'Check in with Alex',
    subtitle: 'A gentle nudge.',
    icon: 'Sparkles',
    action: { type: 'connect' },
    actionLabel: 'Reach out',
    urgency: 'medium',
    category: 'maintain',
    dismissible: true,
    createdAt: new Date('2026-03-25T09:00:00.000Z'),
    ...overrides,
  };
}

describe('season suggestion config', () => {
  it('uses differentiated daily caps by season', () => {
    expect(getSeasonSuggestionConfig('resting').maxDaily).toBe(1);
    expect(getSeasonSuggestionConfig('balanced').maxDaily).toBe(2);
    expect(getSeasonSuggestionConfig('blooming').maxDaily).toBe(3);
  });

  it('keeps bypass categories neutral for selector multipliers', () => {
    expect(getSeasonPriorityMultiplier('resting', 'maintain')).toBe(0.7);
    expect(getSeasonPriorityMultiplier('resting', 'life-event')).toBe(1);
    expect(getSeasonPriorityMultiplier('blooming', 'maintain')).toBe(1.2);
  });

  it('applies the season cap only to regular suggestions', () => {
    const filtered = filterSuggestionsBySeason(
      [
        createSuggestion({ id: 'life-event', category: 'life-event', urgency: 'high' }),
        createSuggestion({ id: 'critical-drift', category: 'critical-drift', urgency: 'critical' }),
        createSuggestion({ id: 'maintain-1', category: 'maintain', urgency: 'medium' }),
        createSuggestion({ id: 'maintain-2', category: 'maintain', urgency: 'medium' }),
      ],
      'resting'
    );

    expect(filtered.map(suggestion => suggestion.id)).toEqual([
      'life-event',
      'critical-drift',
      'maintain-1',
    ]);
  });
});
