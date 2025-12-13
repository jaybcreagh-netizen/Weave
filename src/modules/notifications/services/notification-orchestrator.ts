
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

import { EveningDigestChannel } from './channels/evening-digest';
import { eventBus } from '@/shared/events/event-bus';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';

class NotificationOrchestratorService {
    private isInitialized = false;
    private lastCheckTime: number = 0;

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

                    // Suppress all foreground notifications - they'll still work in background
                    // Users shouldn't be interrupted while actively using the app
                    return {
                        shouldShowAlert: false,
                        shouldPlaySound: false,
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

            // 4. Setup Event Listeners
            this.setupEventListeners();

            this.isInitialized = true;
            Logger.info('[NotificationOrchestrator] Initialized');
        } catch (error) {
            Logger.error('[NotificationOrchestrator] Init failed:', error);
        }
    }

    /**
     * Run checks that should happen on app launch or significant foregrounding
     */
    async runStartupChecks(): Promise<void> {
        Logger.info('[NotificationOrchestrator] Running startup/maintenance checks');
        this.lastCheckTime = Date.now();

        try {
            // Check if battery batch needs extending
            // This checks if we're running low on scheduled notifications and adds more if needed
            await BatteryCheckinChannel.checkAndExtendBatch();

            // Refresh memory nudges (they change daily)
            // This ensures if we open the app on a new day, we schedule the new nudge
            await MemoryNudgeChannel.schedule();

            // Ensure weekly reflection is scheduled (idempotent)
            await WeeklyReflectionChannel.schedule();

            // Ensure evening digest is scheduled
            await EveningDigestChannel.schedule();

            // Restore event reminders
            await EventReminderChannel.scheduleAll();

        } catch (error) {
            Logger.error('[NotificationOrchestrator] Error during startup checks:', error);
        }
    }

    private setupEventListeners() {
        // Listen for new interactions to schedule reminders
        eventBus.on('interaction:created', async (payload: any) => {
            try {
                if (!payload?.interactionId) return;
                const interaction = await database.get<Interaction>('interactions').find(payload.interactionId);
                if (interaction && interaction.status === 'planned') {
                    await EventReminderChannel.schedule(interaction);
                }
            } catch (error) {
                Logger.error('[NotificationOrchestrator] Failed to handle interaction:created:', error);
            }
        });

        // Listen for interaction updates (reschedule or cancel)
        eventBus.on('interaction:updated', async (payload: any) => {
            // If plan changed, we might need to reschedule.
            // For now, simpler to just reschedule if it's planned.
            try {
                if (!payload?.interactionId) return;
                const interaction = await database.get<Interaction>('interactions').find(payload.interactionId);
                if (interaction) {
                    if (interaction.status === 'planned') {
                        await EventReminderChannel.schedule(interaction);
                    } else {
                        // If cancelled or completed, cancel reminder
                        await EventReminderChannel.cancel(interaction.id);
                    }
                }
            } catch (error) {
                Logger.error('[NotificationOrchestrator] Failed to handle interaction:updated:', error);
            }
        });
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

    /**
     * Handle app returning to foreground
     * Checks if maintenance is needed based on time elapsed
     */
    async onAppForeground(): Promise<void> {
        Logger.info('[NotificationOrchestrator] App foregrounded');

        // Always evaluate smart notifications as they are context-dependent (time, location, etc)
        await this.evaluateSmartNotifications();

        // Throttle heavy maintenance checks
        // If it's been more than an hour, or if the day has changed (logic simplified to time interval for now)
        const now = Date.now();
        const ONE_HOUR = 60 * 60 * 1000;

        // Check if day changed
        const lastCheckDate = new Date(this.lastCheckTime);
        const currentDate = new Date(now);
        const isDifferentDay = lastCheckDate.getDate() !== currentDate.getDate() ||
            lastCheckDate.getMonth() !== currentDate.getMonth();

        if (isDifferentDay || (now - this.lastCheckTime > ONE_HOUR)) {
            Logger.info('[NotificationOrchestrator] Running maintenance checks due to time elapsed/day change');
            await this.runStartupChecks();
        }
    }
}

export const NotificationOrchestrator = new NotificationOrchestratorService();
