import {
  CANONICAL_SUGGESTION_CATEGORIES,
  isSuggestionCategory,
  normalizeSuggestionCategory,
} from '../types';

describe('opportunity-system types', () => {
  it('accepts canonical categories', () => {
    expect(isSuggestionCategory('portfolio')).toBe(true);
    expect(isSuggestionCategory('signal-reconnect')).toBe(true);
    expect(CANONICAL_SUGGESTION_CATEGORIES).toContain('high-drift');
  });

  it('normalizes legacy aliases to canonical categories', () => {
    expect(normalizeSuggestionCategory('drift')).toBe('high-drift');
    expect(normalizeSuggestionCategory('community-drift')).toBe('community-checkin');
    expect(normalizeSuggestionCategory('effectiveness-insight')).toBe('insight');
  });

  it('returns null for unknown categories', () => {
    expect(normalizeSuggestionCategory('unknown-category')).toBeNull();
    expect(normalizeSuggestionCategory(undefined)).toBeNull();
  });
});
