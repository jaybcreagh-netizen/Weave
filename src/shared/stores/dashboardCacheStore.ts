/**
 * Dashboard Cache Store
 * 
 * Caches expensive computed dashboard data (social season, activity stats, etc.)
 * to prevent recalculation on every tab switch.
 * 
 * The cache persists across component unmounts, so data is instantly available
 * when returning to dashboard tabs - no loading flicker.
 */

import { create } from 'zustand';
import { type SocialSeason, type SeasonExplanationData } from '@/modules/intelligence';

// Staleness threshold: 5 minutes
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

interface SocialSeasonCache {
    season: SocialSeason;
    seasonData: SeasonExplanationData | null;
    weeklyWeaves: number;
    currentStreak: number;
    networkHealth: number;
    lastCalculated: number | null;
}

interface DashboardCacheStore {
    // Social Season Cache
    socialSeasonCache: SocialSeasonCache;
    setSocialSeasonCache: (data: Omit<SocialSeasonCache, 'lastCalculated'>) => void;
    isSocialSeasonStale: () => boolean;
    invalidateSocialSeasonCache: () => void;

    // Generic cache invalidation (e.g., after logging a weave)
    invalidateAll: () => void;
}

const DEFAULT_SOCIAL_SEASON_CACHE: SocialSeasonCache = {
    season: 'balanced',
    seasonData: null,
    weeklyWeaves: 0,
    currentStreak: 0,
    networkHealth: 0,
    lastCalculated: null,
};

export const useDashboardCacheStore = create<DashboardCacheStore>((set, get) => ({
    socialSeasonCache: { ...DEFAULT_SOCIAL_SEASON_CACHE },

    setSocialSeasonCache: (data) => {
        set({
            socialSeasonCache: {
                ...data,
                lastCalculated: Date.now(),
            },
        });
    },

    isSocialSeasonStale: () => {
        const { lastCalculated } = get().socialSeasonCache;
        if (!lastCalculated) return true;
        return Date.now() - lastCalculated > STALE_THRESHOLD_MS;
    },

    invalidateSocialSeasonCache: () => {
        set({
            socialSeasonCache: { ...DEFAULT_SOCIAL_SEASON_CACHE },
        });
    },

    invalidateAll: () => {
        set({
            socialSeasonCache: { ...DEFAULT_SOCIAL_SEASON_CACHE },
        });
    },
}));

// Export individual selectors for granular subscriptions
export const useSocialSeasonCache = () =>
    useDashboardCacheStore((state) => state.socialSeasonCache);

export const useIsSocialSeasonStale = () =>
    useDashboardCacheStore((state) => state.isSocialSeasonStale);

export const useSetSocialSeasonCache = () =>
    useDashboardCacheStore((state) => state.setSocialSeasonCache);

export const useInvalidateDashboardCache = () =>
    useDashboardCacheStore((state) => state.invalidateAll);
