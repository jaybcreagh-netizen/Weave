/**
 * Friend Linking Service
 * 
 * Handles connecting local Friend records to Weave user accounts.
 * This enables shared weaves and profile data sync.
 */

import { database } from '@/db';
import Friend from '@/db/models/Friend';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { getCurrentSession } from '@/modules/auth/services/supabase-auth.service';

export interface WeaveUserSearchResult {
    id: string;
    username: string;
    displayName: string;
    photoUrl?: string;
    archetype?: string;
}

export interface LinkRequest {
    id: string;
    userId: string;
    username: string;
    displayName: string;
    photoUrl?: string;
    status: 'pending' | 'accepted' | 'declined';
    createdAt: string;
}

/**
 * Search for Weave users by username
 * Returns users that match the search query (case-insensitive)
 */
export async function searchUsersByUsername(query: string): Promise<WeaveUserSearchResult[]> {
    if (!query || query.length < 2) return [];

    const client = getSupabaseClient();
    if (!client) return [];

    const session = await getCurrentSession();
    if (!session) return [];

    try {
        // Search for users whose username starts with the query
        const { data, error } = await client
            .from('user_profiles')
            .select('id, username, display_name, photo_url, archetype')
            .ilike('username', `${query}%`)
            .neq('id', session.userId) // Exclude self
            .limit(10);

        if (error || !data) {
            console.error('[FriendLinking] Search error:', error);
            return [];
        }

        return data.map((user: { id: string; username: string; display_name: string; photo_url?: string | null; archetype?: string | null }) => ({
            id: user.id,
            username: user.username,
            displayName: user.display_name,
            photoUrl: user.photo_url ?? undefined,
            archetype: user.archetype ?? undefined,
        }));
    } catch (e) {
        console.error('[FriendLinking] Search exception:', e);
        return [];
    }
}

/**
 * Create a new Friend from a Weave user and send a link request
 * This is Model C: Create Friend immediately, sharing unlocks on accept
 */
export async function createLinkedFriend(
    targetUser: WeaveUserSearchResult,
    tier: 'InnerCircle' | 'CloseFriends' | 'Community'
): Promise<Friend | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    const session = await getCurrentSession();
    if (!session) return null;

    try {
        // 1. Create friend_link in Supabase (pending request)
        const { data: linkData, error: linkError } = await client
            .from('friend_links')
            .insert({
                user_a_id: session.userId, // Requester
                user_b_id: targetUser.id,   // Target
                initiated_by: session.userId,
                status: 'pending',
            })
            .select('id')

        if (linkError) {
            console.error('[FriendLinking] Failed to create link request:', linkError);
            return null;
        }

        // 2. Create local Friend with their profile data
        let createdFriend: Friend | null = null;

        await database.write(async () => {
            const friend = await database.get<Friend>('friends').create(f => {
                f.name = targetUser.displayName;
                f.dunbarTier = tier;
                f.archetype = (targetUser.archetype as any) || 'Hermit';
                f.weaveScore = 50; // Start at midpoint
                f.photoUrl = targetUser.photoUrl;
                f.lastUpdated = new Date();
                f.resilience = 0;
                f.ratedWeavesCount = 0;
                f.momentumScore = 0;
                f.momentumLastUpdated = new Date();
                f.isDormant = false;
                f.outcomeCount = 0;
                f.initiationRatio = 0.5;
                f.consecutiveUserInitiations = 0;
                f.totalUserInitiations = 0;
                f.totalFriendInitiations = 0;
                // Friend Linking fields
                f.linkedUserId = targetUser.id;
                f.linkStatus = 'pending_sent';
            });
            createdFriend = friend;
        });

        if (createdFriend) {
            console.log('[FriendLinking] Created linked friend:', (createdFriend as Friend).id, 'for user:', targetUser.username);
        }
        return createdFriend;
    } catch (e) {
        console.error('[FriendLinking] Exception creating linked friend:', e);
        return null;
    }
}

/**
 * Send a link request for an existing Friend
 */
export async function sendLinkRequest(
    localFriendId: string,
    targetUserId: string
): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const session = await getCurrentSession();
    if (!session) return false;

    try {
        // 1. Create friend_link in Supabase
        const { error: linkError } = await client
            .from('friend_links')
            .insert({
                user_a_id: session.userId,
                user_b_id: targetUserId,
                user_a_friend_id: localFriendId, // Store local friend reference
                initiated_by: session.userId,
                status: 'pending',
            });

        if (linkError) {
            console.error('[FriendLinking] Failed to create link:', linkError);
            return false;
        }

        // 2. Update local Friend
        await database.write(async () => {
            const friend = await database.get<Friend>('friends').find(localFriendId);
            await friend.update(f => {
                f.linkedUserId = targetUserId;
                f.linkStatus = 'pending_sent';
            });
        });

        return true;
    } catch (e) {
        console.error('[FriendLinking] Exception sending link:', e);
        return false;
    }
}

/**
 * Get pending incoming link requests
 */
export async function getPendingIncomingRequests(): Promise<LinkRequest[]> {
    const client = getSupabaseClient();
    if (!client) return [];

    const session = await getCurrentSession();
    if (!session) return [];

    try {
        const { data, error } = await client
            .from('friend_links')
            .select(`
                id,
                user_a_id,
                status,
                created_at,
                user_profiles!friend_links_user_a_id_fkey (
                    id,
                    username,
                    display_name,
                    photo_url
                )
            `)
            .eq('user_b_id', session.userId)
            .eq('status', 'pending');

        if (error || !data) {
            console.error('[FriendLinking] Error fetching requests:', error);
            return [];
        }

        return data.map((link: any) => ({
            id: link.id,
            userId: link.user_a_id,
            username: link.user_profiles?.username || 'unknown',
            displayName: link.user_profiles?.display_name || 'Unknown',
            photoUrl: link.user_profiles?.photo_url ?? undefined,
            status: link.status,
            createdAt: link.created_at,
        }));
    } catch (e) {
        console.error('[FriendLinking] Exception fetching requests:', e);
        return [];
    }
}

/**
 * Accept an incoming link request
 * Creates a local Friend if one doesn't exist
 */
export async function acceptLinkRequest(
    linkId: string,
    localFriendId?: string,
    tier: 'InnerCircle' | 'CloseFriends' | 'Community' = 'Community'
): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const session = await getCurrentSession();
    if (!session) return false;

    try {
        // 1. Get link request details
        const { data: linkData, error: linkError } = await client
            .from('friend_links')
            .select('*, user_profiles!friend_links_user_a_id_fkey(*)')
            .eq('id', linkId)
            .single();

        if (linkError || !linkData) {
            console.error('[FriendLinking] Link not found:', linkError);
            return false;
        }

        // 2. Update link status to accepted
        const { error: updateError } = await client
            .from('friend_links')
            .update({
                status: 'accepted',
                linked_at: new Date().toISOString(),
                user_b_friend_id: localFriendId,
            })
            .eq('id', linkId);

        if (updateError) {
            console.error('[FriendLinking] Failed to accept:', updateError);
            return false;
        }

        // 3. Create/update local Friend
        await database.write(async () => {
            if (localFriendId) {
                // Update existing friend
                const friend = await database.get<Friend>('friends').find(localFriendId);
                await friend.update(f => {
                    f.linkedUserId = linkData.user_a_id;
                    f.linkStatus = 'linked';
                    f.linkedAt = Date.now();
                    // Optionally sync profile data
                    if (linkData.user_profiles?.photo_url && !f.photoUrl) {
                        f.photoUrl = linkData.user_profiles.photo_url;
                    }
                    // Sync birthday from linked profile if not already set
                    if (linkData.user_profiles?.birthday && !f.birthday) {
                        f.birthday = linkData.user_profiles.birthday;
                    }
                });
            } else {
                // Create new friend from linked user
                await database.get<Friend>('friends').create(friend => {
                    friend.name = linkData.user_profiles?.display_name || 'Friend';
                    friend.dunbarTier = tier;
                    friend.archetype = (linkData.user_profiles?.archetype as any) || 'Hermit';
                    friend.weaveScore = 50;
                    friend.photoUrl = linkData.user_profiles?.photo_url;
                    friend.birthday = linkData.user_profiles?.birthday;
                    friend.lastUpdated = new Date();
                    friend.resilience = 0;
                    friend.ratedWeavesCount = 0;
                    friend.momentumScore = 0;
                    friend.momentumLastUpdated = new Date();
                    friend.isDormant = false;
                    friend.outcomeCount = 0;
                    friend.initiationRatio = 0.5;
                    friend.consecutiveUserInitiations = 0;
                    friend.totalUserInitiations = 0;
                    friend.totalFriendInitiations = 0;
                    friend.linkedUserId = linkData.user_a_id;
                    friend.linkStatus = 'linked';
                    friend.linkedAt = Date.now();
                });
            }
        });

        return true;
    } catch (e) {
        console.error('[FriendLinking] Exception accepting:', e);
        return false;
    }
}

/**
 * Decline an incoming link request
 */
export async function declineLinkRequest(linkId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    try {
        const { error } = await client
            .from('friend_links')
            .update({ status: 'declined' })
            .eq('id', linkId);

        if (error) {
            console.error('[FriendLinking] Failed to decline:', error);
            return false;
        }

        return true;
    } catch (e) {
        console.error('[FriendLinking] Exception declining:', e);
        return false;
    }
}

/**
 * Get count of pending incoming requests (for badge)
 */
export async function getPendingRequestCount(): Promise<number> {
    const client = getSupabaseClient();
    if (!client) return 0;

    const session = await getCurrentSession();
    if (!session) return 0;

    try {
        const { count, error } = await client
            .from('friend_links')
            .select('id', { count: 'exact', head: true })
            .eq('user_b_id', session.userId)
            .eq('status', 'pending');

        if (error) return 0;
        return count || 0;
    } catch {
        return 0;
    }
}
