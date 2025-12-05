import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearDatabase } from '@/db';
import { supabase } from '@/modules/auth/services/supabase.service';
import { AutoBackupService } from '@/modules/backup/AutoBackupService';
// import * as Updates from 'expo-updates';
import Logger from '@/shared/utils/Logger';

export const DataWipeService = {
    /**
     * Wipe all data from the device and cloud
     * This includes:
     * - Local Database (WatermelonDB)
     * - Local Settings (AsyncStorage)
     * - Auth Session (Supabase)
     * - Cloud Backups (iCloud)
     */
    wipeAllData: async () => {
        try {
            Logger.info('DataWipe', 'Starting comprehensive data wipe...');

            // 1. Delete Cloud Backups
            Logger.info('DataWipe', 'Deleting cloud backups...');
            await AutoBackupService.deleteAllBackups();

            // 2. Clear Database
            Logger.info('DataWipe', 'Clearing local database...');
            await clearDatabase();

            // 3. Sign out of Auth
            Logger.info('DataWipe', 'Signing out...');
            const { error } = await supabase.auth.signOut();
            if (error) {
                Logger.warn('DataWipe', 'Error signing out (might already be signed out):', error);
            }

            // 4. Clear AsyncStorage
            Logger.info('DataWipe', 'Clearing AsyncStorage...');
            await AsyncStorage.clear();

            Logger.info('DataWipe', 'Data wipe complete.');

            // 5. Reload App
            // Updates.reloadAsync() is causing issues in some environments
            Logger.info('DataWipe', 'Please restart the app to complete the wipe.');

        } catch (error) {
            Logger.error('DataWipe', 'Critical error during data wipe:', error);
            throw error;
        }
    }
};
