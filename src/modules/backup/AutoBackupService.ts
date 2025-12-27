import { CloudStorage } from 'react-native-cloud-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { exportAllData } from '../auth/services/data-export';
import Logger from '@/shared/utils/Logger';

const BACKUP_FOLDER = 'Backups';
const MAX_BACKUPS = 5;
const AUTO_BACKUP_KEY = '@weave:auto_backup_enabled';
const LAST_BACKUP_KEY = '@weave:last_backup_time';

export const AutoBackupService = {
    /**
     * Initialize the backup service
     */
    init: async (): Promise<boolean> => {
        // Cloud backup is currently iOS-only (iCloud)
        if (Platform.OS === 'android') {
            Logger.info('AutoBackup: init() - Android not supported');
            return false;
        }

        try {
            Logger.info('AutoBackup: init() - Checking iCloud access...');
            let exists = false;
            try {
                exists = await CloudStorage.exists(`/${BACKUP_FOLDER}`);
                Logger.info(`AutoBackup: init() - Backup folder exists: ${exists}`);
            } catch (e) {
                // If exists() throws, it likely means the directory doesn't exist
                // We'll treat this as false and attempt to create it
                Logger.info('AutoBackup: init() - exists() threw, assuming folder does not exist');
                exists = false;
            }

            if (!exists) {
                try {
                    Logger.info('AutoBackup: init() - Creating backup folder...');
                    await CloudStorage.mkdir(`/${BACKUP_FOLDER}`);
                    Logger.info('AutoBackup: init() - Backup folder created successfully');
                } catch (mkdirError: any) {
                    // Ignore error if folder was created by a parallel process
                    let checkAgain = false;
                    try {
                        checkAgain = await CloudStorage.exists(`/${BACKUP_FOLDER}`);
                    } catch (e) {
                        // specific error handling if checkAgain fails
                        checkAgain = false;
                    }

                    if (!checkAgain) {
                        throw mkdirError;
                    }
                    Logger.info('AutoBackup: init() - Folder already exists (parallel creation)');
                }
            }
            Logger.info('AutoBackup: init() - Initialization successful');
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
            Logger.info('AutoBackup: Starting backup...');

            const jsonString = await exportAllData();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `weave-backup-${timestamp}.json`;
            const path = `/${BACKUP_FOLDER}/${filename}`;

            Logger.info(`AutoBackup: Exporting to ${path} (${Math.round(jsonString.length / 1024)}KB)`);

            // Ensure directory exists
            const initSuccess = await AutoBackupService.init();
            if (!initSuccess) {
                throw new Error('Failed to initialize backup directory');
            }

            await CloudStorage.writeFile(path, jsonString);
            await AsyncStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());

            Logger.info(`AutoBackup: Backup completed successfully: ${filename}`);

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
            Logger.info('AutoBackup: getAvailableBackups() - Checking for backups...');
            const exists = await CloudStorage.exists(`/${BACKUP_FOLDER}`);
            if (!exists) {
                Logger.info('AutoBackup: getAvailableBackups() - Backup folder does not exist');
                return [];
            }

            const files = await CloudStorage.readdir(`/${BACKUP_FOLDER}`);
            const backupFiles = files
                .filter(f => f.startsWith('weave-backup-') && f.endsWith('.json'))
                .sort((a, b) => b.localeCompare(a)); // Newest first

            Logger.info(`AutoBackup: getAvailableBackups() - Found ${backupFiles.length} backups: ${backupFiles.join(', ')}`);
            return backupFiles;
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
            Logger.info('AutoBackup: checkAndBackup triggered');

            const enabled = await AutoBackupService.isEnabled();
            if (!enabled) {
                Logger.info('AutoBackup: Skipping - auto-backup is disabled');
                return;
            }

            // Check platform
            if (Platform.OS === 'android') {
                Logger.info('AutoBackup: Skipping - Android not supported');
                return;
            }

            const lastBackup = await AutoBackupService.getLastBackupTime();
            const now = new Date();

            if (lastBackup) {
                const lastBackupDate = new Date(lastBackup);
                const diffHours = (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60);

                // Backup at most once every 24 hours
                if (diffHours < 24) {
                    Logger.info(`AutoBackup: Skipping - last backup was ${diffHours.toFixed(1)} hours ago (need 24+)`);
                    return;
                }
            } else {
                Logger.info('AutoBackup: No previous backup found, will create first backup');
            }

            await AutoBackupService.performBackup();
        } catch (error) {
            Logger.error('AutoBackup: Check and backup failed:', error);
        }
    }
};
