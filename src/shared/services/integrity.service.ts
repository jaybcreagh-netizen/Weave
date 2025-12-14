import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { logger } from '@/shared/services/logger.service';

/**
 * Service to handle data integrity checks and auto-repairs.
 * Should be called on app startup or dashboard mount.
 */
export const integrityService = {
    /**
     * Repairs friend records with legacy tier values (lowercase)
     * to match the correct enum values (PascalCase).
     */
    async repairTiers() {
        try {
            const friendsToFix = await database.get<FriendModel>('friends').query().fetch();
            const updates: any[] = [];

            for (const friend of friendsToFix) {
                let needsFix = false;
                let newTier = '';

                if (friend.dunbarTier === 'inner') {
                    needsFix = true;
                    newTier = 'InnerCircle';
                } else if (friend.dunbarTier === 'close') {
                    needsFix = true;
                    newTier = 'CloseFriends';
                } else if (friend.dunbarTier === 'community') {
                    needsFix = true;
                    newTier = 'Community';
                }

                if (needsFix) {
                    updates.push(friend.prepareUpdate((f: any) => {
                        f.dunbarTier = newTier;
                    }));
                }
            }

            if (updates.length > 0) {
                logger.info('IntegrityService', `Repaired ${updates.length} friends with incorrect tier values.`);
                await database.write(async () => {
                    await database.batch(...updates);
                });
            }
        } catch (error) {
            logger.error('IntegrityService', 'Failed to repair tiers', error);
        }
    }
};
