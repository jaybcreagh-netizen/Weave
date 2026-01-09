/**
 * Auth Store with Subscription Support
 * Manages user authentication state and subscription tier
 */

import { create } from 'zustand';
import { supabase } from '../services/supabase.service';
import type { User, Session } from '@supabase/supabase-js';
import { hasFeatureAccess, isAtLimit, TIER_LIMITS, type SubscriptionTier } from '../services/subscription-tiers';

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

  // Helper getters
  getTier: () => SubscriptionTier;
  isFreeTier: () => boolean;
  isPlusTier: () => boolean;
  isPremiumTier: () => boolean;
  isSubscriptionActive: () => boolean;
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
   */
  initialize: async () => {
    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        set({
          user: session.user,
          session,
          isAuthenticated: true,
        });

        // Load subscription and usage data
        await get().refreshSubscription();
        await get().refreshUsage();
      }

      set({ isLoading: false });

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, session) => {
        set({
          user: session?.user ?? null,
          session,
          isAuthenticated: !!session,
        });

        if (session) {
          await get().refreshSubscription();
          await get().refreshUsage();
        } else {
          set({
            subscription: null,
            usage: null,
          });
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isLoading: false });
    }
  },

  /**
   * Sign out current user
   */
  signOut: async () => {
    try {
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
