/**
 * Supabase Cloud Adapter
 * 
 * Real implementation of CloudAdapter that connects to Supabase.
 * This is only used when ACCOUNTS_ENABLED feature flag is true.
 * 
 * NOTE: Type assertions used here because the full Database schema will be
 * generated from Supabase once the project is created. For now we use
 * explicit typing to document the expected structure.
 */

import { getSupabaseClient, isSupabaseConfigured } from './supabase-client';
import type {
    CloudAdapter,
    SyncResult,
    SharedWeaveData,
    IncomingSharedWeave,
    LinkRequestData,
    IncomingLinkRequest,
    UserProfile,
} from './cloud-adapter';

// Type helpers for Supabase responses (will be replaced with generated types)
/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRow = any;

export class SupabaseCloudAdapter implements CloudAdapter {
    // ─────────────────────────────────────────────────────────────────
    // Status
    // ─────────────────────────────────────────────────────────────────

    isAvailable(): boolean {
        return isSupabaseConfigured() && getSupabaseClient() !== null;
    }

    async isAuthenticated(): Promise<boolean> {
        const client = getSupabaseClient();
        if (!client) return false;

        const { data: { session } } = await client.auth.getSession();
        return session !== null;
    }

    async getCurrentUserId(): Promise<string | null> {
        const client = getSupabaseClient();
        if (!client) return null;

        const { data: { user } } = await client.auth.getUser();
        return user?.id ?? null;
    }

    // ─────────────────────────────────────────────────────────────────
    // Shared Weaves
    // ─────────────────────────────────────────────────────────────────

    async shareWeave(weave: SharedWeaveData): Promise<SyncResult> {
        const client = getSupabaseClient();
        if (!client) {
            return { success: false, error: 'Supabase not available' };
        }

        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            // Create the shared weave record
            const { data: sharedWeave, error: weaveError } = await client
                .from('shared_weaves')
                .insert({
                    created_by: userId,
                    weave_date: weave.weaveDate,
                    title: weave.title,
                    location: weave.location,
                    category: weave.category,
                    duration: weave.duration,
                    status: 'pending',
                })
                .select()
                .single();

            if (weaveError || !sharedWeave) {
                return { success: false, error: weaveError?.message ?? 'Failed to create shared weave' };
            }

            // Add participants
            const participants = weave.participantUserIds.map(participantUserId => ({
                shared_weave_id: sharedWeave.id,
                user_id: participantUserId,
                response: 'pending',
            }));

            const { error: participantsError } = await client
                .from('shared_weave_participants')
                .insert(participants);

            if (participantsError) {
                // Rollback the shared weave if participants failed
                await client.from('shared_weaves').delete().eq('id', sharedWeave.id);
                return { success: false, error: participantsError.message };
            }

            return { success: true, serverId: sharedWeave.id };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    async acceptSharedWeave(serverId: string, localInteractionId: string): Promise<SyncResult> {
        const client = getSupabaseClient();
        if (!client) {
            return { success: false, error: 'Supabase not available' };
        }

        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            const { error } = await client
                .from('shared_weave_participants')
                .update({
                    response: 'accepted',
                    responded_at: new Date().toISOString(),
                    local_interaction_id: localInteractionId,
                })
                .eq('shared_weave_id', serverId)
                .eq('user_id', userId);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, serverId };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    async declineSharedWeave(serverId: string): Promise<SyncResult> {
        const client = getSupabaseClient();
        if (!client) {
            return { success: false, error: 'Supabase not available' };
        }

        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            const { error } = await client
                .from('shared_weave_participants')
                .update({
                    response: 'declined',
                    responded_at: new Date().toISOString(),
                })
                .eq('shared_weave_id', serverId)
                .eq('user_id', userId);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, serverId };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    async fetchPendingShares(): Promise<IncomingSharedWeave[]> {
        const client = getSupabaseClient();
        if (!client) return [];

        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return [];

            // Get pending participations for this user
            const { data: participations, error } = await client
                .from('shared_weave_participants')
                .select(`
          shared_weave_id,
          response,
          created_at,
          shared_weaves (
            id,
            created_by,
            weave_date,
            title,
            location,
            category,
            duration,
            status,
            created_at
          )
        `)
                .eq('user_id', userId)
                .eq('response', 'pending');

            if (error || !participations) {
                console.warn('[SupabaseAdapter] Failed to fetch pending shares:', error);
                return [];
            }

            // Transform and fetch creator names
            const shares: IncomingSharedWeave[] = [];

            for (const p of participations) {
                const weave = p.shared_weaves as unknown as {
                    id: string;
                    created_by: string;
                    weave_date: string;
                    title: string | null;
                    location: string | null;
                    category: string;
                    duration: string | null;
                    status: string;
                    created_at: string;
                };

                if (!weave) continue;

                // Fetch creator's display name
                const { data: creator } = await client
                    .from('user_profiles')
                    .select('display_name')
                    .eq('id', weave.created_by)
                    .single();

                shares.push({
                    serverId: weave.id,
                    createdByUserId: weave.created_by,
                    createdByDisplayName: creator?.display_name ?? 'Unknown',
                    weaveDate: weave.weave_date,
                    title: weave.title ?? undefined,
                    location: weave.location ?? undefined,
                    category: weave.category,
                    duration: weave.duration ?? undefined,
                    status: p.response as 'pending' | 'accepted' | 'declined',
                    createdAt: weave.created_at,
                });
            }

            return shares;
        } catch (error) {
            console.warn('[SupabaseAdapter] Error fetching pending shares:', error);
            return [];
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Friend Linking
    // ─────────────────────────────────────────────────────────────────

    async searchByUsername(username: string): Promise<UserProfile | null> {
        const client = getSupabaseClient();
        if (!client) return null;

        try {
            const { data, error } = await client
                .from('user_profiles')
                .select('id, username, display_name, photo_url')
                .ilike('username', username)
                .single();

            if (error || !data) return null;

            return {
                id: data.id,
                username: data.username,
                displayName: data.display_name,
                photoUrl: data.photo_url ?? undefined,
            };
        } catch {
            return null;
        }
    }

    async sendLinkRequest(data: LinkRequestData): Promise<SyncResult> {
        const client = getSupabaseClient();
        if (!client) {
            return { success: false, error: 'Supabase not available' };
        }

        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            let targetUserId = data.targetUserId;

            // If username provided, look up the user ID
            if (!targetUserId && data.targetUsername) {
                const profile = await this.searchByUsername(data.targetUsername);
                if (!profile) {
                    return { success: false, error: 'User not found' };
                }
                targetUserId = profile.id;
            }

            if (!targetUserId) {
                return { success: false, error: 'No target user specified' };
            }

            // Check for existing link
            const { data: existing } = await client
                .from('friend_links')
                .select('id, status')
                .or(`and(user_a_id.eq.${userId},user_b_id.eq.${targetUserId}),and(user_a_id.eq.${targetUserId},user_b_id.eq.${userId})`)
                .single();

            if (existing) {
                if (existing.status === 'active') {
                    return { success: false, error: 'Already linked with this user' };
                }
                if (existing.status === 'pending') {
                    return { success: false, error: 'Link request already pending' };
                }
            }

            // Create link request
            const { data: link, error } = await client
                .from('friend_links')
                .insert({
                    user_a_id: userId,
                    user_b_id: targetUserId,
                    initiated_by: userId,
                    status: 'pending',
                })
                .select()
                .single();

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, serverId: link?.id };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    async acceptLinkRequest(requestId: string, localFriendId: string): Promise<SyncResult> {
        const client = getSupabaseClient();
        if (!client) {
            return { success: false, error: 'Supabase not available' };
        }

        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            // Get the link request to determine which field to update
            const { data: link, error: fetchError } = await client
                .from('friend_links')
                .select('*')
                .eq('id', requestId)
                .single();

            if (fetchError || !link) {
                return { success: false, error: 'Link request not found' };
            }

            // Determine which friend ID field to update
            const friendIdField = link.user_a_id === userId ? 'user_a_friend_id' : 'user_b_friend_id';

            const { error } = await client
                .from('friend_links')
                .update({
                    status: 'active',
                    linked_at: new Date().toISOString(),
                    [friendIdField]: localFriendId,
                })
                .eq('id', requestId);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, serverId: requestId };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    async declineLinkRequest(requestId: string): Promise<SyncResult> {
        const client = getSupabaseClient();
        if (!client) {
            return { success: false, error: 'Supabase not available' };
        }

        try {
            const { error } = await client
                .from('friend_links')
                .update({ status: 'declined' })
                .eq('id', requestId);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true, serverId: requestId };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }

    async fetchPendingLinkRequests(): Promise<IncomingLinkRequest[]> {
        const client = getSupabaseClient();
        if (!client) return [];

        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return [];

            // Get pending link requests where this user is the recipient
            const { data: links, error } = await client
                .from('friend_links')
                .select('id, user_a_id, initiated_by, created_at')
                .eq('user_b_id', userId)
                .eq('status', 'pending');

            if (error || !links) return [];

            // Fetch sender profiles
            const requests: IncomingLinkRequest[] = [];

            for (const link of links) {
                const senderId = link.initiated_by;
                const { data: sender } = await client
                    .from('user_profiles')
                    .select('username, display_name, photo_url')
                    .eq('id', senderId)
                    .single();

                if (sender) {
                    requests.push({
                        requestId: link.id,
                        fromUserId: senderId,
                        fromUsername: sender.username,
                        fromDisplayName: sender.display_name,
                        fromPhotoUrl: sender.photo_url ?? undefined,
                        createdAt: link.created_at,
                    });
                }
            }

            return requests;
        } catch {
            return [];
        }
    }

    async isLinkedFriend(linkedUserId: string): Promise<boolean> {
        const client = getSupabaseClient();
        if (!client) return false;

        try {
            const userId = await this.getCurrentUserId();
            if (!userId) return false;

            const { data } = await client
                .from('friend_links')
                .select('id')
                .eq('status', 'active')
                .or(`and(user_a_id.eq.${userId},user_b_id.eq.${linkedUserId}),and(user_a_id.eq.${linkedUserId},user_b_id.eq.${userId})`)
                .single();

            return data !== null;
        } catch {
            return false;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Push Notifications
    // ─────────────────────────────────────────────────────────────────

    async registerPushToken(token: string): Promise<SyncResult> {
        const client = getSupabaseClient();
        if (!client) {
            return { success: false, error: 'Supabase not available' };
        }

        try {
            const userId = await this.getCurrentUserId();
            if (!userId) {
                return { success: false, error: 'Not authenticated' };
            }

            const { error } = await client
                .from('user_profiles')
                .update({ push_token: token })
                .eq('id', userId);

            if (error) {
                return { success: false, error: error.message };
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: String(error) };
        }
    }
}
