import { CloudStorage } from 'react-native-cloud-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { exportAllData } from '../auth/services/data-export';

const BACKUP_FOLDER = 'Backups';
const MAX_BACKUPS = 5;
const AUTO_BACKUP_KEY = '@weave:auto_backup_enabled';
const LAST_BACKUP_KEY = '@weave:last_backup_time';

export const AutoBackupService = {
    /**
     * Initialize the backup service
     */
    init: async (): Promise<boolean> => {
        try {
            const exists = await CloudStorage.exists(`/${BACKUP_FOLDER}`);
            if (!exists) {
                await CloudStorage.mkdir(`/${BACKUP_FOLDER}`);
            }
            return true;
        } catch (error) {
            console.error('[AutoBackup] Failed to initialize:', error);
            return false;
        }
    },

    /**
     * Check if auto-backup is enabled
     */
    isEnabled: async (): Promise<boolean> => {
        const enabled = await AsyncStorage.getItem(AUTO_BACKUP_KEY);
        return enabled ? JSON.parse(enabled) : false;
    },

    /**
     * Enable or disable auto-backup
     */
    setEnabled: async (enabled: boolean) => {
        await AsyncStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(enabled));
        if (enabled) {
            await AutoBackupService.init();
        }
    },

    /**
     * Get the timestamp of the last successful backup
     */
    getLastBackupTime: async (): Promise<string | null> => {
        return await AsyncStorage.getItem(LAST_BACKUP_KEY);
    },

    /**
     * Perform a backup immediately
     */
    performBackup: async () => {
        try {

            const jsonString = await exportAllData();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `weave-backup-${timestamp}.json`;
            const path = `/${BACKUP_FOLDER}/${filename}`;

            // Ensure directory exists
            await AutoBackupService.init();

            await CloudStorage.writeFile(path, jsonString);
            await AsyncStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());



            // Prune old backups
            await AutoBackupService.pruneBackups();
        } catch (error) {
            console.error('[AutoBackup] Backup failed:', error);
            throw error;
        }
    },

    /**
     * Delete old backups, keeping only the most recent ones
     */
    pruneBackups: async () => {
        try {
            const files = await CloudStorage.readdir(`/${BACKUP_FOLDER}`);
            const backupFiles = files.filter(f => f.startsWith('weave-backup-')).sort();

            if (backupFiles.length > MAX_BACKUPS) {
                const toDelete = backupFiles.slice(0, backupFiles.length - MAX_BACKUPS);
                for (const file of toDelete) {
                    await CloudStorage.unlink(`/${BACKUP_FOLDER}/${file}`);

                }
            }
        } catch (error) {
            console.error('[AutoBackup] Pruning failed:', error);
        }
    },

    /**
     * Check if a backup is needed (e.g., once per day)
     */
    checkAndBackup: async () => {
        try {
            const enabled = await AutoBackupService.isEnabled();
            if (!enabled) return;

            const lastBackup = await AutoBackupService.getLastBackupTime();
            const now = new Date();

            if (lastBackup) {
                const lastBackupDate = new Date(lastBackup);
                const diffHours = (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60);

                // Backup at most once every 24 hours
                if (diffHours < 24) {

                    return;
                }
            }

            await AutoBackupService.performBackup();
        } catch (error) {
            console.error('[AutoBackup] Check and backup failed:', error);
        }
    }
};
