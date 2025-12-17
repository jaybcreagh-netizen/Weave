
/**
 * Background Task Manager
 * Handles registration and execution of background tasks
 */

import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import Logger from '@/shared/utils/Logger';
import { NotificationOrchestrator } from '@/modules/notifications';

// Task Names
export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND_NOTIFICATION_TASK';

// 1. Define the task
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async () => {
    const now = new Date();
    Logger.info(`[BackgroundTask] 🚀 Starting background task at ${now.toISOString()}`);

    try {
        // Run orchestrator background checks
        await NotificationOrchestrator.runBackgroundChecks();

        Logger.info(`[BackgroundTask] ✅ Background task completed successfully at ${new Date().toISOString()}`);
        // Return success
        return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (error) {
        Logger.error('[BackgroundTask] ❌ Error running background task:', error);
        return BackgroundFetch.BackgroundFetchResult.Failed;
    }
});

class BackgroundTaskManagerService {
    /**
     * Register the background fetch task
     */
    async registerBackgroundTask() {
        try {
            Logger.info('[BackgroundTaskManager] Registering background task...');

            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
            if (isRegistered) {
                Logger.info('[BackgroundTaskManager] Task already registered');
                return;
            }

            await BackgroundFetch.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK, {
                minimumInterval: 60 * 60 * 6, // 6 hours
                stopOnTerminate: false, // Keep running after app close (Android)
                startOnBoot: true, // Auto-start on boot (Android)
            });

            Logger.info('[BackgroundTaskManager] Background task registered successfully');
        } catch (error) {
            Logger.error('[BackgroundTaskManager] Failed to register background task:', error);
        }
    }

    /**
     * Unregister the background fetch task
     */
    async unregisterBackgroundTask() {
        try {
            const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_NOTIFICATION_TASK);
            if (isRegistered) {
                await BackgroundFetch.unregisterTaskAsync(BACKGROUND_NOTIFICATION_TASK);
                Logger.info('[BackgroundTaskManager] Background task unregistered');
            }
        } catch (error) {
            Logger.error('[BackgroundTaskManager] Failed to unregister task:', error);
        }
    }
}

export const BackgroundTaskManager = new BackgroundTaskManagerService();
