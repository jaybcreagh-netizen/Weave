import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase.service';
import { useAuth } from '../context/AuthContext';
import type { SubscriptionTier } from '../services/subscription-tiers';

export interface UserSubscription {
    tier: SubscriptionTier;
    status: 'active' | 'canceled' | 'past_due' | 'trialing';
    trialEndsAt: Date | null;
    currentPeriodEnd: Date | null;
}

export const USER_SUBSCRIPTION_QUERY_KEY = ['user', 'subscription'];

export function useSubscription() {
    const { user } = useAuth();

    return useQuery({
        queryKey: [...USER_SUBSCRIPTION_QUERY_KEY, user?.id],
        queryFn: async (): Promise<UserSubscription> => {
            if (!user) throw new Error('User not logged in');

            const { data, error } = await supabase
                .from('user_subscriptions')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) {
                console.error('Error fetching subscription:', error);
                return {
                    tier: 'free',
                    status: 'active',
                    trialEndsAt: null,
                    currentPeriodEnd: null,
                };
            }

            if (!data) {
                return {
                    tier: 'free',
                    status: 'active',
                    trialEndsAt: null,
                    currentPeriodEnd: null,
                };
            }

            return {
                tier: (data as any).tier as SubscriptionTier,
                status: (data as any).status as any,
                trialEndsAt: (data as any).trial_ends_at ? new Date((data as any).trial_ends_at) : null,
                currentPeriodEnd: (data as any).current_period_end ? new Date((data as any).current_period_end) : null,
            };
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
