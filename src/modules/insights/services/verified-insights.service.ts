/**
 * Verified Insights Service
 * 
 * Provides verified insights based on shared weaves between linked friends.
 * Unlike self-reported reciprocity, this uses actual shared_weaves data
 * where both users have Weave accounts.
 */

import { getSupabaseClient } from '@/shared/services/supabase-client';
import { getCurrentSession } from '@/modules/auth/services/supabase-auth.service';
import Logger from '@/shared/utils/Logger';

const TAG = 'VerifiedInsights';

export interface VerifiedReciprocityAnalysis {
    /** Total shared weaves between the two users */
    totalSharedWeaves: number;
    /** Weaves initiated by current user */
    userInitiated: number;
    /** Weaves initiated by the linked friend */
    friendInitiated: number;
    /** Ratio: 0 = always friend, 1 = always user, 0.5 = balanced */
    initiationRatio: number;
    /** Human-readable balance description */
    balance: 'balanced' | 'slightly-imbalanced' | 'very-imbalanced' | 'one-sided';
    /** Whether there's enough data for a meaningful analysis */
    hasEnoughData: boolean;
    /** Optional warning message */
    warning?: string;
}

/**
 * Analyze verified reciprocity for a linked friend using shared weaves data.
 * This is more reliable than self-reported initiator field since it comes
 * from the actual shared_weaves table.
 */
export async function analyzeVerifiedReciprocity(
    linkedUserId: string
): Promise<VerifiedReciprocityAnalysis | null> {
    const session = await getCurrentSession();
    if (!session) {
        Logger.warn(`[${TAG}] No session, cannot analyze verified reciprocity`);
        return null;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
        Logger.warn(`[${TAG}] No Supabase client`);
        return null;
    }

    try {
        const currentUserId = session.userId;

        // Query shared_weaves where current user is creator and linked friend is participant
        const { data: userCreatedWeaves, error: error1 } = await supabase
            .from('shared_weaves')
            .select(`
                id,
                shared_weave_participants!inner(user_id, status)
            `)
            .eq('created_by', currentUserId)
            .eq('shared_weave_participants.user_id', linkedUserId)
            .eq('shared_weave_participants.status', 'accepted');

        if (error1) {
            Logger.error(`[${TAG}] Error fetching user-created weaves:`, error1);
            return null;
        }

        // Query shared_weaves where linked friend is creator and current user is participant
        const { data: friendCreatedWeaves, error: error2 } = await supabase
            .from('shared_weaves')
            .select(`
                id,
                shared_weave_participants!inner(user_id, status)
            `)
            .eq('created_by', linkedUserId)
            .eq('shared_weave_participants.user_id', currentUserId)
            .eq('shared_weave_participants.status', 'accepted');

        if (error2) {
            Logger.error(`[${TAG}] Error fetching friend-created weaves:`, error2);
            return null;
        }

        const userInitiated = userCreatedWeaves?.length || 0;
        const friendInitiated = friendCreatedWeaves?.length || 0;
        const totalSharedWeaves = userInitiated + friendInitiated;

        // Calculate ratio
        let initiationRatio = 0.5;
        if (totalSharedWeaves > 0) {
            initiationRatio = userInitiated / totalSharedWeaves;
        }

        // Determine balance
        let balance: VerifiedReciprocityAnalysis['balance'] = 'balanced';
        let warning: string | undefined;

        if (totalSharedWeaves < 3) {
            balance = 'balanced'; // Not enough data
        } else if (initiationRatio >= 0.4 && initiationRatio <= 0.6) {
            balance = 'balanced';
        } else if (initiationRatio >= 0.3 && initiationRatio < 0.4 || initiationRatio > 0.6 && initiationRatio <= 0.7) {
            balance = 'slightly-imbalanced';
        } else if (initiationRatio >= 0.2 && initiationRatio < 0.3 || initiationRatio > 0.7 && initiationRatio <= 0.8) {
            balance = 'very-imbalanced';
            warning = initiationRatio > 0.5
                ? `You've initiated ${Math.round(initiationRatio * 100)}% of shared weaves`
                : `Your friend has initiated ${Math.round((1 - initiationRatio) * 100)}% of shared weaves`;
        } else {
            balance = 'one-sided';
            warning = initiationRatio > 0.8
                ? `⚠️ One-sided: You've initiated ${userInitiated} of ${totalSharedWeaves} shared weaves`
                : `Your friend initiates most shared weaves (${friendInitiated} of ${totalSharedWeaves})`;
        }

        Logger.info(`[${TAG}] Verified reciprocity: ${userInitiated}/${totalSharedWeaves} user-initiated`);

        return {
            totalSharedWeaves,
            userInitiated,
            friendInitiated,
            initiationRatio,
            balance,
            hasEnoughData: totalSharedWeaves >= 3,
            warning,
        };

    } catch (error) {
        Logger.error(`[${TAG}] Error analyzing verified reciprocity:`, error);
        return null;
    }
}

/**
 * Fetch birthday from a linked user's profile.
 * Returns the birthday string (YYYY-MM-DD format) or null if not set.
 */
export async function fetchLinkedUserBirthday(
    linkedUserId: string
): Promise<string | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('birthday')
            .eq('id', linkedUserId)
            .single();

        if (error || !data?.birthday) {
            return null;
        }

        return data.birthday;
    } catch (error) {
        Logger.error(`[${TAG}] Error fetching linked user birthday:`, error);
        return null;
    }
}

/**
 * Fetch archetype from a linked user's profile.
 * Returns the archetype string or null if not set.
 */
export async function fetchLinkedUserArchetype(
    linkedUserId: string
): Promise<string | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
        const { data, error } = await supabase
            .from('user_profiles')
            .select('archetype')
            .eq('id', linkedUserId)
            .single();

        if (error || !data?.archetype) {
            return null;
        }

        return data.archetype;
    } catch (error) {
        Logger.error(`[${TAG}] Error fetching linked user archetype:`, error);
        return null;
    }
}
