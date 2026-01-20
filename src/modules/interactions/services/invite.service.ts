import { database } from '@/db';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import Interaction from '@/db/models/Interaction';

interface CreateInviteResponse {
    code: string;
    expires_at: string;
}

export async function generateInviteCode(
    friendLocalId: string,
    friendName: string,
    interaction?: Interaction
): Promise<string | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    try {
        // Get user display name
        let displayName = undefined;
        try {
            const userProfileCollection = database.get('user_profiles');
            const profiles = await userProfileCollection.query().fetch();
            if (profiles.length > 0) {
                displayName = (profiles[0] as any).displayName || (profiles[0] as any).username;
            }
        } catch (e) {
            // Ignore
        }

        // Construct weave snapshot if interaction provided
        let weaveSnapshot = null;
        if (interaction) {
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
            return inviteData[0].code;
        }
        return null;
    } catch (error) {
        console.error('Error generating invite code:', error);
        return null;
    }
}
