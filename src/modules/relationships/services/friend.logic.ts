import { FriendDTO } from '@/shared/types/validators';
import { calculateCurrentScore } from '@/modules/intelligence';

import { database } from '@/db';
import FriendModel from '@/db/models/Friend';

/**
 * Pure business logic for Friend entities.
 * Moves logic away from the WatermelonDB model.
 */

export async function getFriendScore(friendId: string): Promise<number> {
    const friend = await database.get<FriendModel>('friends').find(friendId);
    return calculateCurrentScore(friend);
}

export function isFriendDormant(friend: FriendDTO): boolean {
    return friend.isDormant;
}

export function getFriendTier(friend: FriendDTO): string | undefined {
    return friend.dunbarTier;
}
