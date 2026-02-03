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

type FriendLinkStatus = 'pending' | 'accepted' | 'declined' | 'unlinked';

function sortLinkUserIds(userIdA: string, userIdB: string): [string, string] {
    return [userIdA, userIdB].sort() as [string, string];
}

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

            if (targetUserId === userId) {
                return { success: false, error: 'You cannot link with yourself' };
            }

            // Sort IDs to satisfy server CHECK constraint (user_a_id < user_b_id)
            const [userAId, userBId] = sortLinkUserIds(userId, targetUserId);

            // Check for existing link
            const { data: existing, error: existingError } = await client
                .from('friend_links')
                .select('id, status')
                .eq('user_a_id', userAId)
                .eq('user_b_id', userBId)
                .maybeSingle();

            if (existingError) {
                return { success: false, error: existingError.message };
            }

            const existingStatus = existing?.status as FriendLinkStatus | undefined;
            if (existingStatus) {
                if (existingStatus === 'accepted') {
                    return { success: false, error: 'Already linked with this user' };
                }
                if (existingStatus === 'pending') {
                    return { success: false, error: 'Link request already pending' };
                }
            }

            // Create or reactivate link request
            const { data: link, error } = await client
                .from('friend_links')
                .upsert({
                    user_a_id: userAId,
                    user_b_id: userBId,
                    initiated_by: userId,
                    status: 'pending',
                    unlinked_at: null,
                    linked_at: null,
                    updated_at: new Date().toISOString(),
                }, {
                    onConflict: 'user_a_id,user_b_id',
                })
                .select('id')
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
                .select('id, user_a_id, user_b_id')
                .eq('id', requestId)
                .single();

            if (fetchError || !link) {
                return { success: false, error: 'Link request not found' };
            }

            // Determine which friend ID field to update
            const friendIdField = link.user_a_id === userId
                ? 'user_a_friend_id'
                : link.user_b_id === userId
                    ? 'user_b_friend_id'
                    : null;

            if (!friendIdField) {
                return { success: false, error: 'You are not part of this link request' };
            }

            const { error } = await client
                .from('friend_links')
                .update({
                    status: 'accepted',
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
                .select('id, user_a_id, user_b_id, initiated_by, created_at')
                .eq('status', 'pending')
                .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
                .neq('initiated_by', userId);

            if (error || !links) return [];

            const senderIds = Array.from(new Set((links as AnyRow[]).map(link => link.initiated_by).filter(Boolean)));
            if (senderIds.length === 0) return [];

            const { data: profiles, error: profilesError } = await client
                .from('user_profiles')
                .select('id, username, display_name, photo_url')
                .in('id', senderIds);

            if (profilesError || !profiles) return [];

            const profilesById = new Map((profiles as AnyRow[]).map(profile => [profile.id, profile]));

            return (links as AnyRow[])
                .map((link) => {
                    const senderId = link.initiated_by as string;
                    const sender = profilesById.get(senderId);
                    if (!sender) return null;

                    return {
                        requestId: link.id,
                        fromUserId: senderId,
                        fromUsername: sender.username,
                        fromDisplayName: sender.display_name,
                        fromPhotoUrl: sender.photo_url ?? undefined,
                        createdAt: link.created_at,
                    } as IncomingLinkRequest;
                })
                .filter((request): request is IncomingLinkRequest => request !== null);
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

            const [userAId, userBId] = sortLinkUserIds(userId, linkedUserId);

            const { data, error } = await client
                .from('friend_links')
                .select('id')
                .eq('status', 'accepted')
                .eq('user_a_id', userAId)
                .eq('user_b_id', userBId)
                .maybeSingle();

            if (error) return false;

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
