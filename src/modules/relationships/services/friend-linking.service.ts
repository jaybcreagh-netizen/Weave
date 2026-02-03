/**
 * Friend Linking Service
 * 
 * Handles connecting local Friend records to Weave user accounts.
 * This enables shared weaves and profile data sync.
 */

import { database } from '@/db';
import Friend from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
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

interface FriendLinkRow {
    id: string;
    user_a_id: string;
    user_b_id: string;
    initiated_by: string;
    status: 'pending' | 'accepted' | 'declined' | 'unlinked';
    created_at: string;
    linked_at?: string | null;
    user_a_profile?: LinkedUserProfile | LinkedUserProfile[] | null;
    user_b_profile?: LinkedUserProfile | LinkedUserProfile[] | null;
}

interface LinkedUserProfile {
    id: string;
    username: string;
    display_name: string;
    photo_url?: string | null;
    archetype?: string | null;
    birthday?: string | null;
}

function getOtherUserId(link: { user_a_id: string; user_b_id: string }, currentUserId: string): string | null {
    if (link.user_a_id === currentUserId) return link.user_b_id;
    if (link.user_b_id === currentUserId) return link.user_a_id;
    return null;
}

function getCurrentUserFriendIdField(
    link: { user_a_id: string; user_b_id: string },
    currentUserId: string
): 'user_a_friend_id' | 'user_b_friend_id' | null {
    if (link.user_a_id === currentUserId) return 'user_a_friend_id';
    if (link.user_b_id === currentUserId) return 'user_b_friend_id';
    return null;
}

function normalizeLinkedProfile(
    profile: FriendLinkRow['user_a_profile'] | FriendLinkRow['user_b_profile']
): LinkedUserProfile | null {
    if (!profile) return null;
    if (Array.isArray(profile)) return profile[0] ?? null;
    return profile;
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
        // Sort user IDs to satisfy CHECK constraint (user_a_id < user_b_id)
        const [userAId, userBId] = [session.userId, targetUser.id].sort();
        const isCurrentUserA = userAId === session.userId;

        // 1. Create friend_link in Supabase (pending request)
        const { data: linkData, error: linkError } = await client
            .from('friend_links')
            .insert({
                user_a_id: userAId,
                user_b_id: userBId,
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
                f.serverLinkId = linkData?.[0]?.id;
            });
            createdFriend = friend;
        });

        // 3. Update the server with our local friend ID
        if (createdFriend && linkData?.[0]?.id) {
            await client
                .from('friend_links')
                .update({
                    [isCurrentUserA ? 'user_a_friend_id' : 'user_b_friend_id']: (createdFriend as Friend).id,
                })
                .eq('id', linkData[0].id);
        }

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
    localFriendId: string | undefined,
    targetUserId: string
): Promise<{ success: boolean; error?: string }> {
    const client = getSupabaseClient();
    if (!client) return { success: false, error: 'Network error: No Supabase client' };

    const session = await getCurrentSession();
    if (!session) return { success: false, error: 'Authentication error: No active session' };

    try {
        // Sort user IDs to satisfy CHECK constraint (user_a_id < user_b_id)
        const [userAId, userBId] = [session.userId, targetUserId].sort();
        const isCurrentUserA = userAId === session.userId;

        // 1. Create or update friend_link in Supabase
        // Use upsert to handle cases where a link already exists (e.g. unlinked or declined)
        const { error: linkError } = await client
            .from('friend_links')
            .upsert({
                user_a_id: userAId,
                user_b_id: userBId,
                // Store local friend ID in the correct column based on who's user A
                user_a_friend_id: isCurrentUserA ? localFriendId : undefined,
                user_b_friend_id: isCurrentUserA ? undefined : localFriendId,
                initiated_by: session.userId,
                status: 'pending',
                unlinked_at: null // Clear unlinked status if present
            }, {
                onConflict: 'user_a_id, user_b_id'
            });

        if (linkError) {
            console.error('[FriendLinking] Failed to create link:', linkError);
            return { success: false, error: linkError.message || 'Failed to send link request' };
        }

        // 2. Update local Friend if this request came from an existing local friend card.
        if (localFriendId) {
            await database.write(async () => {
                const friend = await database.get<Friend>('friends').find(localFriendId);
                await friend.update(f => {
                    f.linkedUserId = targetUserId;
                    f.linkStatus = 'pending_sent';
                });
            });
        }

        return { success: true };
    } catch (e: any) {
        console.error('[FriendLinking] Exception sending link:', e);
        return { success: false, error: e.message || 'An unexpected error occurred' };
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
                user_b_id,
                initiated_by,
                status,
                created_at,
                user_a_profile:user_profiles!friend_links_user_a_id_fkey (
                    id,
                    username,
                    display_name,
                    photo_url
                ),
                user_b_profile:user_profiles!friend_links_user_b_id_fkey (
                    id,
                    username,
                    display_name,
                    photo_url
                )
            `)
            .eq('status', 'pending')
            .or(`user_a_id.eq.${session.userId},user_b_id.eq.${session.userId}`)
            .neq('initiated_by', session.userId);

        if (error || !data) {
            console.error('[FriendLinking] Error fetching requests:', error);
            return [];
        }

        return (data as unknown as FriendLinkRow[]).map((link) => {
            const requesterId = link.initiated_by || getOtherUserId(link, session.userId) || '';
            const requesterProfileRaw = requesterId === link.user_a_id
                ? link.user_a_profile
                : link.user_b_profile;
            const requesterProfile = normalizeLinkedProfile(requesterProfileRaw);

            return {
                id: link.id,
                userId: requesterId,
                username: requesterProfile?.username || 'unknown',
                displayName: requesterProfile?.display_name || 'Unknown',
                photoUrl: requesterProfile?.photo_url ?? undefined,
                status: link.status === 'pending' ? 'pending' : link.status === 'accepted' ? 'accepted' : 'declined',
                createdAt: link.created_at,
            };
        });
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
            .select(`
                id,
                user_a_id,
                user_b_id,
                initiated_by,
                status,
                user_a_profile:user_profiles!friend_links_user_a_id_fkey(*),
                user_b_profile:user_profiles!friend_links_user_b_id_fkey(*)
            `)
            .eq('id', linkId)
            .single();

        if (linkError || !linkData) {
            console.error('[FriendLinking] Link not found:', linkError);
            return false;
        }

        const requesterUserId = linkData.initiated_by || getOtherUserId(linkData, session.userId);
        const currentUserFriendIdField = getCurrentUserFriendIdField(linkData, session.userId);

        if (!requesterUserId || !currentUserFriendIdField) {
            console.error('[FriendLinking] Invalid link participant mapping:', {
                linkId,
                userA: linkData.user_a_id,
                userB: linkData.user_b_id,
                sessionUserId: session.userId,
            });
            return false;
        }

        if (requesterUserId === session.userId) {
            console.error('[FriendLinking] Attempted to accept a self-initiated link request:', { linkId });
            return false;
        }

        // 2. Update link status to accepted
        const serverUpdatePayload: Record<string, string> = {
            status: 'accepted',
            linked_at: new Date().toISOString(),
        };
        if (localFriendId) {
            serverUpdatePayload[currentUserFriendIdField] = localFriendId;
        }

        const { error: updateError } = await client
            .from('friend_links')
            .update(serverUpdatePayload)
            .eq('id', linkId);

        if (updateError) {
            console.error('[FriendLinking] Failed to accept:', updateError);
            return false;
        }

        const requesterProfileRaw = requesterUserId === linkData.user_a_id
            ? linkData.user_a_profile
            : linkData.user_b_profile;
        const requesterProfile = normalizeLinkedProfile(requesterProfileRaw);

        // 3. Create/update local Friend
        let resolvedLocalFriendId = localFriendId;
        await database.write(async () => {
            let friendIdToUpdate = resolvedLocalFriendId;

            // Safety check: If no localFriendId provided, check if a friend with this linkedUserId already exists
            // This prevents duplicate creation if matching failed for any reason
            if (!friendIdToUpdate) {
                const existingFriends = await database.get<Friend>('friends')
                    .query(Q.where('linked_user_id', requesterUserId))
                    .fetch();

                if (existingFriends.length > 0) {
                    console.log('[FriendLinking] Found existing friend with linkedUserId, using that instead of creating new');
                    friendIdToUpdate = existingFriends[0].id;
                }
            }

            if (friendIdToUpdate) {
                // Update existing friend
                const friend = await database.get<Friend>('friends').find(friendIdToUpdate);
                await friend.update(f => {
                    f.linkedUserId = requesterUserId;
                    f.linkStatus = 'linked';
                    f.linkedAt = Date.now();
                    // Optionally sync profile data
                    if (requesterProfile?.photo_url && !f.photoUrl) {
                        f.photoUrl = requesterProfile.photo_url;
                    }
                    // Sync birthday from linked profile if not already set
                    if (requesterProfile?.birthday && !f.birthday) {
                        f.birthday = requesterProfile.birthday;
                    }
                });
                resolvedLocalFriendId = friendIdToUpdate;
            } else {
                // Create new friend from linked user
                const createdFriend = await database.get<Friend>('friends').create(friend => {
                    friend.name = requesterProfile?.display_name || 'Friend';
                    friend.dunbarTier = tier;
                    friend.archetype = (requesterProfile?.archetype as any) || 'Hermit';
                    friend.weaveScore = 50;
                    friend.photoUrl = requesterProfile?.photo_url ?? undefined;
                    friend.birthday = requesterProfile?.birthday ?? undefined;
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
                    friend.linkedUserId = requesterUserId;
                    friend.linkStatus = 'linked';
                    friend.linkedAt = Date.now();
                });
                resolvedLocalFriendId = createdFriend.id;
            }
        });

        // Backfill our local friend ID on server when we created or matched one after accepting.
        if (!localFriendId && resolvedLocalFriendId) {
            await client
                .from('friend_links')
                .update({ [currentUserFriendIdField]: resolvedLocalFriendId })
                .eq('id', linkId);
        }

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
            .eq('status', 'pending')
            .or(`user_a_id.eq.${session.userId},user_b_id.eq.${session.userId}`)
            .neq('initiated_by', session.userId);

        if (error) return 0;
        return count || 0;
    } catch {
        return 0;
    }
}

/**
 * Sync the status of an outgoing link request from the server
 * This updates the local Friend record if the request was accepted
 *
 * @param localFriendId - The local WatermelonDB friend ID
 * @returns true if status was synced (and possibly updated), false on error
 */
export async function syncOutgoingLinkStatus(localFriendId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) return false;

    const session = await getCurrentSession();
    if (!session) return false;

    try {
        // Get local friend to find their linkedUserId
        const friend = await database.get<Friend>('friends').find(localFriendId);

        if (!friend.linkedUserId) {
            console.log('[FriendLinking] Friend has no linkedUserId, nothing to sync');
            return true;
        }

        // Only sync if status is pending_sent
        if (friend.linkStatus !== 'pending_sent') {
            return true;
        }

        // Query server for the current link status
        // The link could be stored with user_a/user_b in either direction
        // Use limit(1) to be robust against potential duplicate data
        const { data: linkData, error } = await client
            .from('friend_links')
            .select('id, status, linked_at')
            .or(`and(user_a_id.eq.${session.userId},user_b_id.eq.${friend.linkedUserId}),and(user_a_id.eq.${friend.linkedUserId},user_b_id.eq.${session.userId})`)
            .in('status', ['pending', 'accepted'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.error('[FriendLinking] Error fetching link status:', error);
            return false;
        }

        if (!linkData) {
            // No link found - maybe it was declined or deleted
            // Could update local status to reflect this, but for now just return
            console.log('[FriendLinking] No active link found on server');
            return true;
        }

        // If server shows 'accepted', update local to 'linked'
        // We know friend.linkStatus is 'pending_sent' here due to check at start of function
        if (linkData.status === 'accepted') {
            console.log('[FriendLinking] Link was accepted! Updating local status to linked');
            await database.write(async () => {
                await friend.update(f => {
                    f.linkStatus = 'linked';
                    f.linkedAt = linkData.linked_at ? new Date(linkData.linked_at).getTime() : Date.now();
                    f.serverLinkId = linkData.id;
                });
            });
        }

        return true;
    } catch (e) {
        console.error('[FriendLinking] Exception syncing link status:', e);
        return false;
    }
}

/**
 * Sync all outgoing link requests that are pending
 * Call this on app foreground or periodic sync
 */
export async function syncAllOutgoingLinkStatuses(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    const session = await getCurrentSession();
    if (!session) return;

    try {
        // Get all local friends with pending_sent status
        const pendingFriends = await database
            .get<Friend>('friends')
            .query()
            .fetch();

        const pendingSent = pendingFriends.filter(f => f.linkStatus === 'pending_sent' && f.linkedUserId);

        if (pendingSent.length === 0) {
            return;
        }

        console.log(`[FriendLinking] Syncing ${pendingSent.length} pending outgoing requests`);

        // Get the linked user IDs
        const linkedUserIdSet = new Set(pendingSent.map(f => f.linkedUserId!));

        // Query server for all links we initiated and then match by "other user" ID.
        // This handles both user_a/user_b directions when IDs are sorted.
        const { data: serverLinks, error } = await client
            .from('friend_links')
            .select('id, user_a_id, user_b_id, initiated_by, status, linked_at')
            .eq('initiated_by', session.userId)
            .or(`user_a_id.eq.${session.userId},user_b_id.eq.${session.userId}`)
            .in('status', ['pending', 'accepted']);

        if (error) {
            console.error('[FriendLinking] Error fetching server links:', error);
            return;
        }

        if (!serverLinks || serverLinks.length === 0) {
            return;
        }

        // Create a map of linkedUserId -> server link status
        const statusMap = new Map<string, FriendLinkRow>();
        for (const link of serverLinks as unknown as FriendLinkRow[]) {
            const otherUserId = getOtherUserId(link, session.userId);
            if (otherUserId && linkedUserIdSet.has(otherUserId)) {
                statusMap.set(otherUserId, link);
            }
        }

        // Update local friends that have been accepted
        await database.write(async () => {
            for (const friend of pendingSent) {
                const serverLink = statusMap.get(friend.linkedUserId!);
                if (serverLink && serverLink.status === 'accepted') {
                    console.log(`[FriendLinking] Updating ${friend.name} to linked`);
                    await friend.update(f => {
                        f.linkStatus = 'linked';
                        f.linkedAt = serverLink.linked_at ? new Date(serverLink.linked_at).getTime() : Date.now();
                        f.serverLinkId = serverLink.id;
                    });
                }
            }
        });
    } catch (e) {
        console.error('[FriendLinking] Exception syncing all link statuses:', e);
    }
}

/**
 * Sync incoming link requests to local Friend records
 * Updates friends who sent us a link request to show pending_received status
 */
export async function syncIncomingLinkRequests(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    const session = await getCurrentSession();
    if (!session) return;

    try {
        // Get pending incoming link requests from server
        const { data: incomingRequests, error } = await client
            .from('friend_links')
            .select('id, user_a_id, user_b_id, initiated_by, status, created_at')
            .eq('status', 'pending')
            .or(`user_a_id.eq.${session.userId},user_b_id.eq.${session.userId}`)
            .neq('initiated_by', session.userId);

        if (error) {
            console.error('[FriendLinking] Error fetching incoming requests:', error);
            return;
        }

        if (!incomingRequests || incomingRequests.length === 0) {
            return;
        }

        console.log(`[FriendLinking] Found ${incomingRequests.length} incoming link requests`);

        // Find local friends that match the users who sent us requests
        // This handles the case where you already have someone as a local friend
        // and they send you a link request
        const allFriends = await database
            .get<Friend>('friends')
            .query()
            .fetch();

        // Create a map of linkedUserId -> friend for quick lookup
        const friendsByLinkedUserId = new Map<string, Friend>();
        for (const friend of allFriends) {
            if (friend.linkedUserId) {
                friendsByLinkedUserId.set(friend.linkedUserId, friend);
            }
        }

        // Update friends who have pending_received status needed
        await database.write(async () => {
            for (const request of incomingRequests) {
                const friend = friendsByLinkedUserId.get(request.initiated_by);

                // Only update if friend exists and doesn't already have pending_received or linked status
                if (friend && friend.linkStatus !== 'pending_received' && friend.linkStatus !== 'linked') {
                    console.log(`[FriendLinking] Updating ${friend.name} to pending_received`);
                    await friend.update(f => {
                        f.linkStatus = 'pending_received';
                        f.serverLinkId = request.id;
                    });
                }
            }
        });
    } catch (e) {
        console.error('[FriendLinking] Exception syncing incoming link requests:', e);
    }
}

/**
 * Unlink a friend (remove cloud connection, keep local friend record)
 * 
 * This allows users to disconnect from a linked friend while maintaining
 * their local relationship data (notes, history, etc.).
 * 
 * @param localFriendId - The local WatermelonDB friend ID
 * @returns true if successful, false otherwise
 */
export async function unlinkFriend(localFriendId: string): Promise<boolean> {
    const client = getSupabaseClient();
    if (!client) {
        console.error('[FriendLinking] No Supabase client');
        return false;
    }

    const session = await getCurrentSession();
    if (!session) {
        console.error('[FriendLinking] Not authenticated');
        return false;
    }

    try {
        // Get friend to check if linked
        const friend = await database.get<Friend>('friends').find(localFriendId);

        if (!friend.linkedUserId) {
            console.log('[FriendLinking] Friend is not linked, nothing to unlink');
            return true; // Already unlinked
        }

        // Update server link to unlinked status
        const { error: serverError } = await client
            .from('friend_links')
            .update({
                status: 'unlinked',
                unlinked_at: new Date().toISOString(),
            })
            .or(`and(user_a_id.eq.${session.userId},user_b_id.eq.${friend.linkedUserId}),and(user_a_id.eq.${friend.linkedUserId},user_b_id.eq.${session.userId})`)
            .in('status', ['pending', 'accepted']);

        if (serverError) {
            console.warn('[FriendLinking] Server unlink failed (continuing with local):', serverError);
            // Continue anyway - local unlink is more important for UX
        }

        // Update local friend to remove linking
        await database.write(async () => {
            await friend.update(f => {
                f.linkedUserId = undefined;
                f.linkStatus = undefined;
                f.linkedAt = undefined;
                f.serverLinkId = undefined;
            });
        });

        console.log('[FriendLinking] Friend unlinked successfully', { friendId: localFriendId });
        return true;
    } catch (error) {
        console.error('[FriendLinking] Exception unlinking friend:', error);
        return false;
    }
}

/**
 * Check for claimed invites and link the corresponding local friend
 * This handles the "Sender Side" of the referral flow
 */
export async function checkClaimedInvites(): Promise<void> {
    const client = getSupabaseClient();
    if (!client) return;

    const session = await getCurrentSession();
    if (!session) return;

    try {
        const { data: claimedInvites, error } = await client
            .from('invite_links')
            .select('id, creator_friend_local_id, claimed_by, claimed_at')
            .eq('creator_id', session.userId)
            .eq('status', 'claimed')
            .not('creator_friend_local_id', 'is', null);

        if (error) {
            console.error('[FriendLinking] Error checking claimed invites:', error);
            return;
        }

        if (!claimedInvites || claimedInvites.length === 0) return;

        await database.write(async () => {
            for (const invite of claimedInvites) {
                if (!invite.creator_friend_local_id || !invite.claimed_by) continue;

                try {
                    const friend = await database.get<Friend>('friends').find(invite.creator_friend_local_id);
                    if (friend && !friend.linkedUserId) {
                        console.log(`[FriendLinking] Linking friend ${friend.name} to user ${invite.claimed_by} via invite`);
                        await friend.update(f => {
                            f.linkedUserId = invite.claimed_by;
                            f.linkStatus = 'linked';
                            f.linkedAt = new Date(invite.claimed_at).getTime();
                        });
                    }
                } catch (e) {
                    // Friend might have been deleted locally
                    console.log(`[FriendLinking] Friend ${invite.creator_friend_local_id} not found locally`);
                }
            }
        });

    } catch (e) {
        console.error('[FriendLinking] Exception checking claimed invites:', e);
    }
}
