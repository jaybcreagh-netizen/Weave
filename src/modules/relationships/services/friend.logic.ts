import { FriendDTO } from '@/shared/types/validators';
import { calculateCurrentScore } from '@/modules/intelligence';

import { friendRepository } from '../repositories/friend.repository';

/**
 * Pure business logic for Friend entities.
 * Moves logic away from the WatermelonDB model.
 */

export async function getFriendScore(friendId: string): Promise<number> {
    const friend = await friendRepository.getFriendById(friendId);
    if (!friend) {
        throw new Error(`Friend with id ${friendId} not found`);
    }
    return calculateCurrentScore(friend);
}

export function isFriendDormant(friend: FriendDTO): boolean {
    return friend.isDormant;
}

export function getFriendTier(friend: FriendDTO): string | undefined {
    return friend.dunbarTier;
}
