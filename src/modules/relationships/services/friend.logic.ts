import { FriendDTO } from '@/shared/types/validators';
import { calculateCurrentScore } from '@/modules/intelligence';

/**
 * Pure business logic for Friend entities.
 * Moves logic away from the WatermelonDB model.
 */

export async function getFriendScore(friendId: string): Promise<number> {
    return await calculateCurrentScore(friendId);
}

export function isFriendDormant(friend: FriendDTO): boolean {
    return friend.isDormant;
}

export function getFriendTier(friend: FriendDTO): string | undefined {
    return friend.dunbarTier;
}
