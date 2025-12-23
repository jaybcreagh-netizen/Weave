import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { logger } from '@/shared/services/logger.service';

// Version key for tier repair - bump to force re-run after new tier changes
const TIER_REPAIR_KEY = 'TIER_REPAIR_V1_COMPLETE';

/**
 * Service to handle data integrity checks and auto-repairs.
 * Uses AsyncStorage to ensure repairs only run once.
 */
export const integrityService = {
    /**
     * Repairs friend records with legacy tier values (lowercase)
     * to match the correct enum values (PascalCase).
     * Only runs once per device, tracked via AsyncStorage.
     */
    async repairTiers() {
        try {
            // Fast path: Already repaired
            const alreadyRepaired = await AsyncStorage.getItem(TIER_REPAIR_KEY);
            if (alreadyRepaired === 'true') {
                return;
            }

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

            // Mark as complete
            await AsyncStorage.setItem(TIER_REPAIR_KEY, 'true');
            logger.info('IntegrityService', 'Tier repair check complete, marked as done');
        } catch (error) {
            logger.error('IntegrityService', 'Failed to repair tiers', error);
        }
    }
};

