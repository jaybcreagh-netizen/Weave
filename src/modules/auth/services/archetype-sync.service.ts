/**
 * Archetype Sync Service
 *
 * Fetches archetype information from linked Weave users.
 * Respects visibility settings when fetching profile data.
 */

import { getSupabaseClient } from '@/shared/services/supabase-client';
import { logger } from '@/shared/services/logger.service';

interface LinkedUserProfile {
    userId: string;
    displayName?: string;
    archetype?: string;
    birthday?: string;
    visibility: {
        displayName: 'public' | 'friends' | 'hidden';
        archetype: 'public' | 'friends' | 'hidden';
        birthday: 'public' | 'friends' | 'hidden';
    };
}

/**
 * Fetches a linked user's profile information.
 * Only returns fields that their visibility settings allow.
 *
 * @param linkedUserId - The Supabase user ID to fetch
 * @param isLinked - Whether the current user is linked with this user (for visibility checks)
 */
export async function getLinkedUserProfile(
    linkedUserId: string,
    isLinked: boolean = true
): Promise<LinkedUserProfile | null> {
    const client = getSupabaseClient();
    if (!client) return null;

    try {
        const { data, error } = await client
            .from('user_profiles')
            .select('id, display_name, archetype, birthday, visibility_settings')
            .eq('id', linkedUserId)
            .single();

        if (error || !data) {
            logger.error('ArchetypeSync', 'Failed to fetch linked profile:', error);
            return null;
        }

        const visibility = data.visibility_settings || {
            displayName: 'friends',
            archetype: 'friends',
            birthday: 'friends',
        };

        // Apply visibility rules
        const canSee = (setting: 'public' | 'friends' | 'hidden') => {
            if (setting === 'public') return true;
            if (setting === 'friends' && isLinked) return true;
            return false;
        };

        return {
            userId: data.id,
            displayName: canSee(visibility.displayName) ? data.display_name : undefined,
            archetype: canSee(visibility.archetype) ? data.archetype : undefined,
            birthday: canSee(visibility.birthday) ? data.birthday : undefined,
            visibility,
        };
    } catch (error) {
        logger.error('ArchetypeSync', 'Exception fetching linked profile:', error);
        return null;
    }
}

/**
 * Gets the archetype of a linked friend.
 * Returns null if the friend has hidden their archetype.
 */
export async function getLinkedFriendArchetype(
    linkedUserId: string
): Promise<string | null> {
    const profile = await getLinkedUserProfile(linkedUserId, true);
    return profile?.archetype || null;
}

/**
 * Batch fetches archetypes for multiple linked users.
 * Useful for displaying in a list of friends.
 */
export async function getLinkedFriendsArchetypes(
    linkedUserIds: string[]
): Promise<Map<string, string>> {
    const client = getSupabaseClient();
    if (!client || linkedUserIds.length === 0) {
        return new Map();
    }

    const result = new Map<string, string>();

    try {
        const { data, error } = await client
            .from('user_profiles')
            .select('id, archetype, visibility_settings')
            .in('id', linkedUserIds);

        if (error || !data) {
            logger.error('ArchetypeSync', 'Failed to batch fetch archetypes:', error);
            return result;
        }

        for (const profile of data) {
            const visibility = profile.visibility_settings || { archetype: 'friends' };
            // For linked friends, 'friends' visibility means visible
            if (visibility.archetype !== 'hidden' && profile.archetype) {
                result.set(profile.id, profile.archetype);
            }
        }

        return result;
    } catch (error) {
        logger.error('ArchetypeSync', 'Exception batch fetching archetypes:', error);
        return result;
    }
}
