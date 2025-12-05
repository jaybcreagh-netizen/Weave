import { CloudStorage } from 'react-native-cloud-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { exportAllData } from '../auth/services/data-export';
import Logger from '../../shared/utils/Logger';

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
                try {
                    await CloudStorage.mkdir(`/${BACKUP_FOLDER}`);
                } catch (mkdirError: any) {
                    // Ignore error if folder was created by a parallel process
                    const checkAgain = await CloudStorage.exists(`/${BACKUP_FOLDER}`);
                    if (!checkAgain) {
                        throw mkdirError;
                    }
                }
            }
            return true;
        } catch (error) {
            Logger.error('AutoBackup: Failed to initialize (Code: INIT_FAIL):', error);
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
            const initSuccess = await AutoBackupService.init();
            if (!initSuccess) {
                throw new Error('Failed to initialize backup directory');
            }

            await CloudStorage.writeFile(path, jsonString);
            await AsyncStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());



            // Prune old backups
            await AutoBackupService.pruneBackups();
        } catch (error) {
            Logger.error('AutoBackup: Backup failed:', error);
            throw error;
        }
    },

    /**
     * Delete old backups, keeping only the most recent ones
     */
    pruneBackups: async () => {
        try {
            const files = await CloudStorage.readdir(`/${BACKUP_FOLDER}`);
            const backupFiles = files
                .filter(f => f.startsWith('weave-backup-'))
                .sort((a, b) => a.localeCompare(b)); // Oldest first

            if (backupFiles.length > MAX_BACKUPS) {
                const toDelete = backupFiles.slice(0, backupFiles.length - MAX_BACKUPS);
                for (const file of toDelete) {
                    await CloudStorage.unlink(`/${BACKUP_FOLDER}/${file}`);

                }
            }
        } catch (error) {
            Logger.error('AutoBackup: Pruning failed:', error);
        }
    },

    /**
     * Delete all backups
     */
    deleteAllBackups: async () => {
        try {
            const exists = await CloudStorage.exists(`/${BACKUP_FOLDER}`);
            if (!exists) return;

            const files = await CloudStorage.readdir(`/${BACKUP_FOLDER}`);
            for (const file of files) {
                await CloudStorage.unlink(`/${BACKUP_FOLDER}/${file}`);
            }
        } catch (error) {
            Logger.error('AutoBackup: Failed to delete all backups:', error);
        }
    },

    /**
     * Get list of available backups
     */
    getAvailableBackups: async (): Promise<string[]> => {
        try {
            const exists = await CloudStorage.exists(`/${BACKUP_FOLDER}`);
            if (!exists) return [];

            const files = await CloudStorage.readdir(`/${BACKUP_FOLDER}`);
            return files
                .filter(f => f.startsWith('weave-backup-') && f.endsWith('.json'))
                .sort((a, b) => b.localeCompare(a)); // Newest first
        } catch (error) {
            Logger.error('AutoBackup: Failed to list backups:', error);
            return [];
        }
    },

    /**
     * Read a backup file
     */
    restoreBackup: async (filename: string): Promise<string> => {
        try {
            const path = `/${BACKUP_FOLDER}/${filename}`;
            const content = await CloudStorage.readFile(path);
            return content;
        } catch (error) {
            Logger.error('AutoBackup: Failed to read backup:', error);
            throw error;
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
            Logger.error('AutoBackup: Check and backup failed:', error);
        }
    }
};
