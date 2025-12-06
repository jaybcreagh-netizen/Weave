
/**
 * Notification Orchestrator
 * Central coordinator for the notification system
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Logger from '@/shared/utils/Logger';
import { notificationStore } from './notification-store';
import { notificationAnalytics } from './notification-analytics';
import { checkNotificationPermissions, requestNotificationPermissions } from './permission.service';

// Channels
import { BatteryCheckinChannel } from './channels/battery-checkin';
import { WeeklyReflectionChannel } from './channels/weekly-reflection';
import { MemoryNudgeChannel } from './channels/memory-nudge';
import { SmartSuggestionsChannel } from './channels/smart-suggestions';
import { EventSuggestionChannel } from './channels/event-suggestion';
import { DeepeningNudgeChannel } from './channels/deepening-nudge';
import { EventReminderChannel } from './channels/event-reminder';
import { NotificationType } from '../types';

class NotificationOrchestratorService {
    private isInitialized = false;

    async init(): Promise<void> {
        if (this.isInitialized) return;

        try {
            // 1. Configure handler for foreground notifications
            Notifications.setNotificationHandler({
                handleNotification: async (notification) => {
                    // Track foreground presentation
                    const type = notification.request.content.data?.type as NotificationType;
                    if (type) {
                        notificationAnalytics.trackForegroundShown(type);
                    }

                    return {
                        shouldShowAlert: true,
                        shouldPlaySound: true,
                        shouldSetBadge: false,
                    };
                },
            });

            // 2. Check if we have permissions to proceed with setup
            const hasPermission = await checkNotificationPermissions();
            if (hasPermission) {
                // 3. Run startup checks
                await this.runStartupChecks();
            }

            this.isInitialized = true;
            Logger.info('[NotificationOrchestrator] Initialized');
        } catch (error) {
            Logger.error('[NotificationOrchestrator] Init failed:', error);
        }
    }

    /**
     * Run checks that should happen on app launch
     */
    async runStartupChecks(): Promise<void> {
        Logger.info('[NotificationOrchestrator] Running startup checks');

        // Check if battery batch needs extending
        await BatteryCheckinChannel.checkAndExtendBatch();

        // Refresh memory nudges (they change daily/weekly)
        // We might want to only do this once a day? 
        // For now, running it on startup is safe as it checks dates.
        await MemoryNudgeChannel.schedule(); // This function cleans up old ones internally

        // Ensure weekly reflection is scheduled (idempotent)
        await WeeklyReflectionChannel.schedule();

        // Note: We do NOT automatically schedule smart suggestions here. 
        // That usually happens via background tasks or specialized triggers.
    }

    /**
     * Request permissions and setup if granted
     */
    async requestPermissions(): Promise<boolean> {
        const granted = await requestNotificationPermissions();
        if (granted) {
            await this.runStartupChecks();
        }
        return granted;
    }

    /**
     * Cancel ALL notifications across all channels
     */
    async cancelAll(): Promise<void> {
        await Notifications.cancelAllScheduledNotificationsAsync();
        await notificationStore.clearAll();
        Logger.info('[NotificationOrchestrator] All notifications cancelled');
    }

    /**
     * Get all scheduled notifications with typed data
     */
    async getAllScheduled() {
        return await Notifications.getAllScheduledNotificationsAsync();
    }

    /**
     * Evaluate and schedule smart notifications (called on foreground)
     */
    async evaluateSmartNotifications(): Promise<void> {
        await SmartSuggestionsChannel.evaluateAndSchedule();
    }
}

export const NotificationOrchestrator = new NotificationOrchestratorService();
