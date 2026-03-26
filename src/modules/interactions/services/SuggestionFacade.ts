import type { SocialSeason } from '@/db/models/UserProfile';
import type { Suggestion } from '@/shared/types/common';
import {
  fetchSuggestionSurface as fetchLegacySuggestionSurface,
  fetchSuggestions as fetchLegacySuggestions,
  type SuggestionFetchResult,
  type SuggestionSurfaceOptions,
} from './suggestion-provider.service';

export type { SuggestionFetchResult, SuggestionSurfaceOptions };

export async function fetchSuggestionSurface(
  limit: number = 3,
  season?: SocialSeason | null,
  userCap?: number,
  options?: SuggestionSurfaceOptions
): Promise<SuggestionFetchResult> {
  return fetchLegacySuggestionSurface(limit, season, userCap, options);
}

export async function fetchSuggestions(
  limit: number = 3,
  season?: SocialSeason | null,
  userCap?: number,
  options?: SuggestionSurfaceOptions
): Promise<Suggestion[]> {
  return fetchLegacySuggestions(limit, season, userCap, options);
}
