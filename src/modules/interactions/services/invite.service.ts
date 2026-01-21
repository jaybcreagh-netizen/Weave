import { database } from '@/db';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import Interaction from '@/db/models/Interaction';
import UserProfile from '@/db/models/UserProfile';

interface CreateInviteResponse {
    code: string;
    expires_at: string;
}

export async function generateInviteCode(
    friendLocalId: string,
    friendName: string,
    interaction?: Interaction,
    existingSnapshot?: any
): Promise<{ code: string; link: string } | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
        // Get user display name
        let displayName = 'User';
        try {
            const profiles = await database.get<UserProfile>('user_profile').query().fetch();
            if (profiles.length > 0) {
                const profile = profiles[0];
                displayName = profile.username || profile.email?.split('@')[0] || 'User';
            }
        } catch (e) {
            console.warn('Could not fetch user profile for invite name', e);
        }

        // Construct weave snapshot if interaction provided
        let weaveSnapshot = existingSnapshot || null;

        if (interaction && !weaveSnapshot) {
            weaveSnapshot = {
                title: interaction.title,
                interaction_date: interaction.interactionDate,
                location: interaction.location,
                activity: interaction.activity,
                duration: interaction.duration,
                vibe: interaction.vibe,
                note: interaction.note,
                mode: interaction.mode,
                interaction_type: interaction.interactionType,
                event_importance: interaction.eventImportance,
                interaction_category: interaction.interactionCategory,
            };
        }

        const { data, error } = await supabase.rpc('create_invite', {
            p_weave_snapshot: weaveSnapshot,
            p_friend_name: friendName,
            p_creator_friend_local_id: friendLocalId,
            p_display_name: displayName,
        });

        if (error) throw error;

        const inviteData = data as CreateInviteResponse[];
        if (inviteData && inviteData.length > 0) {
            const code = inviteData[0].code;
            const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
            if (!supabaseUrl) {
                console.warn('[InviteService] Missing SUPABASE_URL, returning raw code');
                return { code, link: code }; // Fallback
            }
            // Construct proxy URL
            // Ensure no double slash if url ends with /
            const baseUrl = supabaseUrl.replace(/\/$/, '');
            const link = `${baseUrl}/functions/v1/invite-proxy?code=${code}`;
            return { code, link };
        }
        return null;
    } catch (error) {
        console.error('Error generating invite code:', error);
        return null;
    }
}
