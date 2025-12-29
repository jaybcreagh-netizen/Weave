import { database } from '@/db';
import Group from '@/db/models/Group';
import GroupMember from '@/db/models/GroupMember';
import Friend from '@/db/models/Friend';
import InteractionFriend from '@/db/models/InteractionFriend';
import { Q } from '@nozbe/watermelondb';
import { deleteGroupPhoto } from '../../relationships/services/image.service';

export const groupService = {
    /**
     * Create a new manual group
     */
    async createGroup(name: string, friendIds: string[], photoUrl?: string): Promise<Group> {
        return await database.write(async () => {
            // 1. Create the group
            const group = await database.get<Group>('groups').create(g => {
                g.name = name;
                g.type = 'manual';
                if (photoUrl) {
                    g.photoUrl = photoUrl;
                }
            });

            // 2. Prepare member creation
            const memberCollection = database.get<GroupMember>('group_members');
            const membersToCreate = friendIds.map(friendId =>
                memberCollection.prepareCreate(m => {
                    m.groupId = group.id;
                    m.friendId = friendId;
                })
            );

            // 3. Batch execute
            await database.batch(...membersToCreate);

            return group;
        });
    },

    /**
     * Update an existing group
     */
    async updateGroup(groupId: string, name: string, friendIds: string[], photoUrl?: string): Promise<void> {
        await database.write(async () => {
            const group = await database.get<Group>('groups').find(groupId);

            // prepare changes for group itself
            const groupUpdate = group.prepareUpdate(g => {
                g.name = name;
                if (photoUrl !== undefined) {
                    g.photoUrl = photoUrl;
                }
            });

            // Prepare deletion of old members
            const currentMembers = await group.members.fetch();
            const deletions = currentMembers.map((m: GroupMember) => m.prepareDestroyPermanently());

            // Prepare creation of new members
            const memberCollection = database.get<GroupMember>('group_members');
            const additions = friendIds.map(friendId =>
                memberCollection.prepareCreate(m => {
                    m.groupId = group.id;
                    m.friendId = friendId;
                })
            );

            // Batch all operations
            await database.batch(
                groupUpdate,
                ...deletions,
                ...additions
            );
        });
    },

    /**
     * Delete a group
     */
    async deleteGroup(groupId: string): Promise<void> {
        // Clean up the group's photo if it exists
        await deleteGroupPhoto(groupId);

        await database.write(async () => {
            const group = await database.get<Group>('groups').find(groupId);
            await group.destroyPermanently(); // Cascade delete should handle members if configured, but explicit is safe

            // Explicitly delete members if cascade isn't set up in schema (WatermelonDB usually needs explicit delete)
            const members = await database.get<GroupMember>('group_members').query(Q.where('group_id', groupId)).fetch();
            await Promise.all(members.map(m => m.destroyPermanently()));
        });
    },

    /**
     * Get all manual groups
     */
    async getManualGroups(): Promise<Group[]> {
        return await database.get<Group>('groups').query(Q.where('type', 'manual')).fetch();
    },

    /**
     * Get groups that a specific friend belongs to
     */
    /**
     * Get groups that a specific friend belongs to
     */
    async getGroupsForFriend(friendId: string): Promise<Group[]> {
        const memberships = await database.get<GroupMember>('group_members')
            .query(Q.where('friend_id', friendId))
            .fetch();

        const groupIds = memberships.map(m => m.groupId);

        if (groupIds.length === 0) return [];

        return await database.get<Group>('groups')
            .query(Q.where('id', Q.oneOf(groupIds)))
            .fetch();
    },

    /**
     * Add a single member to a group
     */
    async addMember(groupId: string, friendId: string): Promise<void> {
        await database.write(async () => {
            await database.get<GroupMember>('group_members').create(m => {
                m.groupId = groupId;
                m.friendId = friendId;
            });
        });
    },

    /**
     * Remove a single member from a group
     */
    async removeMember(groupId: string, friendId: string): Promise<void> {
        await database.write(async () => {
            const members = await database.get<GroupMember>('group_members')
                .query(
                    Q.where('group_id', groupId),
                    Q.where('friend_id', friendId)
                )
                .fetch();

            if (members.length > 0) {
                await members[0].destroyPermanently();
            }
        });
    },

    /**
     * Detect smart groups based on interaction history
     */
    async detectSmartGroups(): Promise<GroupSuggestion[]> {
        const interactionFriends = await database.get<InteractionFriend>('interaction_friends').query().fetch();

        // Group friends by interaction
        const interactionMap = new Map<string, string[]>();
        interactionFriends.forEach(ifriend => {
            const current = interactionMap.get(ifriend.interactionId) || [];
            current.push(ifriend.friendId);
            interactionMap.set(ifriend.interactionId, current);
        });

        // Identify clusters (size >= 2)
        const clusterCounts = new Map<string, number>();
        const clusterMembers = new Map<string, string[]>();

        for (const [_, members] of interactionMap.entries()) {
            if (members.length < 2) continue;

            // Sort to ensure unique key for same set of friends
            const sortedMembers = [...members].sort();
            const key = sortedMembers.join('|');

            clusterCounts.set(key, (clusterCounts.get(key) || 0) + 1);
            clusterMembers.set(key, sortedMembers);
        }

        // Filter and Format Suggestions
        const rawSuggestions: Omit<GroupSuggestion, 'friends'>[] = [];
        const existingGroups = await this.getManualGroups();

        // Build set of existing group signatures
        const existingSignatures = new Set<string>();
        for (const group of existingGroups) {
            const members = await group.members.fetch();
            const memberIds = members.map((m: any) => m.friendId).sort();
            existingSignatures.add(memberIds.join('|'));
        }

        for (const [key, count] of clusterCounts.entries()) {
            // Threshold: appeared together at least 3 times
            if (count < 3) continue;

            // Check if group already exists (exact match)
            if (existingSignatures.has(key)) continue;

            const friendIds = clusterMembers.get(key)!;

            rawSuggestions.push({
                friendIds,
                confidence: Math.min(count * 0.1, 1.0), // Simple confidence
                interactionCount: count,
                suggestedName: '', // Will be filled by UI or helper
            });
        }

        // Populate Friend objects
        const enrichedSuggestions: GroupSuggestion[] = [];

        for (const s of rawSuggestions) {
            const friends = await database.get<Friend>('friends').query(Q.where('id', Q.oneOf(s.friendIds))).fetch();
            if (friends.length !== s.friendIds.length) continue; // Some friends might be deleted

            const names = friends.map(f => f.name).join(', ');

            enrichedSuggestions.push({
                ...s,
                friends,
                suggestedName: names,
                reason: `You often weave with ${names} together`
            });
        }

        return enrichedSuggestions.sort((a, b) => b.interactionCount - a.interactionCount);
    }
};

export interface GroupSuggestion {
    friendIds: string[];
    friends: Friend[];
    suggestedName: string;
    confidence: number;
    interactionCount: number;
    reason?: string;
}
