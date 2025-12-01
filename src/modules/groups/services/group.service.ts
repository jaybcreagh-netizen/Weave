import { database } from '@/db';
import Group from '@/db/models/Group';
import GroupMember from '@/db/models/GroupMember';
import { Q } from '@nozbe/watermelondb';

export const groupService = {
    /**
     * Create a new manual group
     */
    async createGroup(name: string, friendIds: string[]): Promise<Group> {
        return await database.write(async () => {
            const group = await database.get<Group>('groups').create(g => {
                g.name = name;
                g.type = 'manual';
            });

            const memberCollection = database.get<GroupMember>('group_members');
            await Promise.all(
                friendIds.map(friendId =>
                    memberCollection.create(m => {
                        m.groupId = group.id;
                        m.friendId = friendId;
                    })
                )
            );

            return group;
        });
    },

    /**
     * Update an existing group
     */
    async updateGroup(groupId: string, name: string, friendIds: string[]): Promise<void> {
        await database.write(async () => {
            const group = await database.get<Group>('groups').find(groupId);

            // Update name
            if (group.name !== name) {
                await group.update(g => {
                    g.name = name;
                });
            }

            // Update members (delete old, add new)
            // Note: A more efficient diffing could be done here, but full replace is safer for now
            const currentMembers = await group.members.fetch();
            await Promise.all(currentMembers.map((m: GroupMember) => m.destroyPermanently()));

            const memberCollection = database.get<GroupMember>('group_members');
            await Promise.all(
                friendIds.map(friendId =>
                    memberCollection.create(m => {
                        m.groupId = group.id;
                        m.friendId = friendId;
                    })
                )
            );
        });
    },

    /**
     * Delete a group
     */
    async deleteGroup(groupId: string): Promise<void> {
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
     * Detect smart groups based on interaction history
     * This is a simplified version - in production this would be more complex
     */
    async detectSmartGroups(): Promise<void> {
        // 1. Fetch all interaction_friends to analyze patterns
        // This is expensive, so we should limit to recent history or run in background
        // For MVP, we'll skip the complex implementation and just stub it
        console.log('Smart group detection not yet implemented');
    }
};
