import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabase.service';
import { useAuth } from '../context/AuthContext';

export interface UsageStats {
    friendsCount: number;
    weavesThisMonth: number;
    periodStart: Date;
    periodEnd: Date;
}

export const USER_USAGE_QUERY_KEY = ['user', 'usage'];

export function useUsage() {
    const { user } = useAuth();

    return useQuery({
        queryKey: [...USER_USAGE_QUERY_KEY, user?.id],
        queryFn: async (): Promise<UsageStats> => {
            if (!user) throw new Error('User not logged in');

            const now = new Date();
            const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

            const { data, error } = await supabase
                .from('usage_tracking')
                .select('*')
                .eq('user_id', user.id)
                .gte('period_start', periodStart.toISOString())
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (data) {
                return {
                    friendsCount: (data as any).friends_count,
                    weavesThisMonth: (data as any).weaves_this_month,
                    periodStart: new Date((data as any).period_start),
                    periodEnd: new Date((data as any).period_end),
                };
            } else {
                return {
                    friendsCount: 0,
                    weavesThisMonth: 0,
                    periodStart,
                    periodEnd: new Date(now.getFullYear(), now.getMonth() + 1, 0),
                };
            }
        },
        enabled: !!user,
        staleTime: 1000 * 60 * 5, // 5 minutes
    });
}
