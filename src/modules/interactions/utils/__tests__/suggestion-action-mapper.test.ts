import { Suggestion } from '@/shared/types/common';
import {
  isValidInteractionCategory,
  resolveSuggestionInteractionCategory,
} from '../suggestion-action-mapper';

function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    id: 's-1',
    type: 'connect',
    friendId: 'f-1',
    title: 'Test',
    subtitle: 'Test subtitle',
    icon: 'Sparkles',
    action: { type: 'plan' },
    ...overrides,
  };
}

describe('suggestion-action-mapper', () => {
  it('uses prefilled interaction category when valid', () => {
    const suggestion = makeSuggestion({
      action: { type: 'plan', prefilledCategory: 'meal-drink' },
      category: 'high-drift',
    });

    expect(resolveSuggestionInteractionCategory(suggestion)).toBe('meal-drink');
  });

  it('falls back from meta category to interaction category', () => {
    const suggestion = makeSuggestion({
      action: { type: 'plan' },
      category: 'critical-drift',
    });

    expect(resolveSuggestionInteractionCategory(suggestion)).toBe('text-call');
  });

  it('returns default fallback when neither prefilled nor mapped category is valid', () => {
    const suggestion = makeSuggestion({
      action: { type: 'plan', prefilledCategory: 'not-real-category' },
      category: 'unknown-meta-bucket',
    });

    expect(resolveSuggestionInteractionCategory(suggestion, 'deep-talk')).toBe('deep-talk');
  });

  it('validates interaction categories strictly', () => {
    expect(isValidInteractionCategory('deep-talk')).toBe(true);
    expect(isValidInteractionCategory('high-drift')).toBe(false);
    expect(isValidInteractionCategory(undefined)).toBe(false);
  });
});
