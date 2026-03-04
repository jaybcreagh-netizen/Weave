/**
 * Auth Store with Subscription Support
 * Manages user authentication state and subscription tier
 */

import { create } from 'zustand';
import { supabase } from '../services/supabase.service';
import type { User, Session } from '@supabase/supabase-js';
import * as Network from 'expo-network';
import { hasFeatureAccess, isAtLimit, TIER_LIMITS, type SubscriptionTier } from '../services/subscription-tiers';
import { withTimeout } from '../services/auth-utils';

// Type for the auth state change subscription (has unsubscribe method)
type AuthSubscription = { unsubscribe: () => void };

// Module-level state to prevent duplicate initialization and listeners
let authListenerSubscription: AuthSubscription | null = null;
let isInitialized = false;

const AUTH_INIT_FALLBACK_MS = 3000;
const SESSION_FETCH_TIMEOUT_MS = 2500;
const SESSION_VALIDATION_TIMEOUT_MS = 3000;

interface UserSubscription {
  tier: SubscriptionTier;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
}

interface UsageStats {
  friendsCount: number;
  weavesThisMonth: number;
  periodStart: Date;
  periodEnd: Date;
}

interface AuthState {
  // Auth state
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Subscription state
  subscription: UserSubscription | null;
  usage: UsageStats | null;

  // Actions
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  refreshUsage: () => Promise<void>;
  refreshSubscriptionAndUsage: () => Promise<void>;

  // Helper getters
  getTier: () => SubscriptionTier;
  isFreeTier: () => boolean;
  isPlusTier: () => boolean;
  isPremiumTier: () => boolean;
  isSubscriptionActive: () => boolean;
}

/**
 * Retry a function with exponential backoff
 * Only retries on network-related errors, not auth errors
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const message = String(error?.message || '').toLowerCase();

      // Don't retry on auth errors (invalid token, etc.) - only network issues
      const isNetworkError =
        message.includes('network') ||
        message.includes('fetch') ||
        message.includes('timeout') ||
        error?.code === 'NETWORK_ERROR';

      if (!isNetworkError || attempt === maxAttempts) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s...
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.log(`[Auth] Retry attempt ${attempt}/${maxAttempts} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

async function hasInternetConnection(): Promise<boolean> {
  try {
    const networkState = await Network.getNetworkStateAsync();
    if (!networkState.isConnected) return false;
    // Treat unknown reachability as online to avoid false offline detections.
    return networkState.isInternetReachable !== false;
  } catch {
    // If network probing fails, proceed optimistically.
    return true;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  subscription: null,
  usage: null,

  /**
   * Initialize auth state on app startup
   *
   * Improvements over naive approach:
   * 1. Validates cached session with server (getUser) to catch revoked tokens
   * 2. Parallelizes subscription/usage fetches for faster startup
   * 3. Retries on transient network failures
   * 4. Guards against duplicate listener registration
   * 5. Prevents multiple initialization calls
   */
  initialize: async () => {
    // Prevent duplicate initialization
    if (isInitialized) {
      console.log('[Auth] Already initialized, skipping');
      return;
    }
    isInitialized = true;

    // Safety valve: never let auth init block the global loading screen indefinitely.
    const loadingFallbackTimer = setTimeout(() => {
      set({ isLoading: false });
    }, AUTH_INIT_FALLBACK_MS);

    const validateCachedSessionInBackground = async (cachedSession: Session) => {
      try {
        const isOnline = await hasInternetConnection();
        if (!isOnline) {
          console.log('[Auth] Offline at startup, skipping server-side session validation');
          return;
        }

        console.log('[Auth] Validating cached session in background...');
        const { data: { user: validatedUser }, error: userError } = await withRetry(
          () => withTimeout(
            supabase.auth.getUser(),
            SESSION_VALIDATION_TIMEOUT_MS,
            'supabase.auth.getUser'
          ),
          2,
          750
        );

        if (userError || !validatedUser) {
          // Cached session is invalid - clear it
          console.warn('[Auth] Cached session invalid, clearing:', userError?.message);
          await supabase.auth.signOut();
          set({
            user: null,
            session: null,
            isAuthenticated: false,
            subscription: null,
            usage: null,
          });
          return;
        }

        // Refresh user shape from server if validation succeeded.
        set({
          user: validatedUser,
          session: cachedSession,
          isAuthenticated: true,
        });

        // Subscription/usage refresh is best-effort and non-blocking.
        get().refreshSubscriptionAndUsage().catch(err => {
          console.error('[Auth] Background refresh failed:', err);
        });
      } catch (error) {
        // Keep cached session so the app remains usable offline.
        console.warn('[Auth] Deferred session validation failed, keeping cached session:', error);
      }
    };

    try {
      // Step 1: Set up auth state change listener (with duplicate guard)
      if (authListenerSubscription) {
        console.log('[Auth] Cleaning up existing listener');
        authListenerSubscription.unsubscribe();
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('[Auth] State change:', event);

        set({
          user: session?.user ?? null,
          session,
          isAuthenticated: !!session,
        });

        if (session) {
          // Refresh in parallel, don't block the state update
          get().refreshSubscriptionAndUsage().catch(err => {
            console.error('[Auth] Refresh after state change failed:', err);
          });

          // Best-effort push token registration on auth transitions.
          void import('@/modules/notifications/services/push-token.service')
            .then(({ registerPushToken }) => registerPushToken())
            .catch(err => {
              console.error('[Auth] Push token registration on auth change failed:', err);
            });
        } else {
          set({
            subscription: null,
            usage: null,
          });

          // Best-effort cleanup when auth session is cleared.
          void import('@/modules/notifications/services/push-token.service')
            .then(({ unregisterPushToken }) => unregisterPushToken())
            .catch(err => {
              console.error('[Auth] Push token unregister on auth clear failed:', err);
            });
        }
      });

      authListenerSubscription = subscription;

      // Step 2: Restore cached session quickly (bounded by timeout)
      const { data: { session: cachedSession } } = await withTimeout(
        supabase.auth.getSession(),
        SESSION_FETCH_TIMEOUT_MS,
        'supabase.auth.getSession'
      );

      if (cachedSession) {
        // Restore immediately so offline users can use the app without waiting on network.
        set({
          user: cachedSession.user ?? null,
          session: cachedSession,
          isAuthenticated: true,
        });

        // Validate with server asynchronously when online.
        void validateCachedSessionInBackground(cachedSession);
      }
    } catch (error) {
      console.error('[Auth] Initialization error:', error);
      // Reset initialization flag so retry is possible on next app foreground
      isInitialized = false;
    } finally {
      clearTimeout(loadingFallbackTimer);
      set({ isLoading: false });
    }
  },

  /**
   * Sign out current user
   */
  signOut: async () => {
    try {
      // Remove push token before auth session is invalidated.
      try {
        const { unregisterPushToken } = await import('@/modules/notifications/services/push-token.service');
        await unregisterPushToken();
      } catch (pushTokenError) {
        console.error('[Auth] Failed to unregister push token before sign out:', pushTokenError);
      }

      await supabase.auth.signOut();
      set({
        user: null,
        session: null,
        isAuthenticated: false,
        subscription: null,
        usage: null,
      });
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  },

  /**
   * Fetch latest subscription data from server
   */
  refreshSubscription: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        return;
      }

      if (!data) {
        // Default to free tier if no subscription found
        set({
          subscription: {
            tier: 'free',
            status: 'active',
            trialEndsAt: null,
            currentPeriodEnd: null,
          },
        });
        return;
      }

      set({
        subscription: {
          tier: (data as any).tier as SubscriptionTier,
          status: (data as any).status as any,
          trialEndsAt: (data as any).trial_ends_at ? new Date((data as any).trial_ends_at) : null,
          currentPeriodEnd: (data as any).current_period_end ? new Date((data as any).current_period_end) : null,
        },
      });
    } catch (error) {
      console.error('Subscription refresh error:', error);
    }
  },

  /**
   * Fetch latest usage stats from server
   */
  refreshUsage: async () => {
    const { user } = get();
    if (!user) return;

    try {
      // Get current period usage
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { data, error } = await supabase
        .from('usage_tracking')
        .select('*')
        .eq('user_id', user.id)
        .gte('period_start', periodStart.toISOString())
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows
        console.error('Error fetching usage:', error);
        return;
      }

      if (data) {
        set({
          usage: {
            friendsCount: (data as any).friends_count,
            weavesThisMonth: (data as any).weaves_this_month,
            periodStart: new Date((data as any).period_start),
            periodEnd: new Date((data as any).period_end),
          },
        });
      } else {
        // No usage record for this period yet
        set({
          usage: {
            friendsCount: 0,
            weavesThisMonth: 0,
            periodStart,
            periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
          },
        });
      }
    } catch (error) {
      console.error('Usage refresh error:', error);
    }
  },

  /**
   * Refresh both subscription and usage data in parallel
   * More efficient than calling them sequentially
   */
  refreshSubscriptionAndUsage: async () => {
    const { user } = get();
    if (!user) return;

    await Promise.all([
      get().refreshSubscription(),
      get().refreshUsage(),
    ]);
  },

  /**
   * Get current subscription tier
   */
  getTier: () => {
    return get().subscription?.tier ?? 'free';
  },

  /**
   * Check if user is on free tier
   */
  isFreeTier: () => {
    return get().getTier() === 'free';
  },

  /**
   * Check if user is on plus tier
   */
  isPlusTier: () => {
    return get().getTier() === 'plus';
  },

  /**
   * Check if user is on premium tier
   */
  isPremiumTier: () => {
    return get().getTier() === 'premium';
  },

  /**
   * Check if subscription is active (not canceled or past due)
   */
  isSubscriptionActive: () => {
    const { subscription } = get();
    if (!subscription) return false;
    return subscription.status === 'active' || subscription.status === 'trialing';
  },
}));

/**
 * Hook to check feature access
 * Returns true if user has access to the feature
 * Fails secure: unknown features or inactive subscriptions default to restricted
 */
export function useFeatureAccess(feature: keyof typeof TIER_LIMITS.free): boolean {
  const tier = useAuthStore(state => state.getTier());
  const isActive = useAuthStore(state => state.isSubscriptionActive());

  // If subscription is canceled/past_due, treat as free tier
  const effectiveTier = isActive ? tier : 'free';

  return hasFeatureAccess(effectiveTier, feature);
}

/**
 * Hook to get usage stats
 */
export function useUsageStats() {
  return useAuthStore(state => state.usage);
}

/**
 * Hook to check if at limit for friends or weaves
 */
export function useIsAtLimit(feature: 'friends' | 'weaves'): boolean {
  const tier = useAuthStore(state => state.getTier());
  const isActive = useAuthStore(state => state.isSubscriptionActive());
  const usage = useAuthStore(state => state.usage);

  if (!usage) return false;

  // If subscription is not active, use free tier limits
  const effectiveTier = isActive ? tier : 'free';

  if (feature === 'friends') {
    return isAtLimit(effectiveTier, 'maxFriends', usage.friendsCount);
  } else {
    return isAtLimit(effectiveTier, 'maxWeavesPerMonth', usage.weavesThisMonth);
  }
}
