
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
import { registerPushToken, handleRemotePushNotification } from './push-token.service';
import { showSharedWeaveNotification, showLinkRequestNotification } from './shared-weave-notifications';

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
import UserProfile from '@/db/models/UserProfile';
import { GLOBAL_NOTIFICATION_SETTINGS, NOTIFICATION_CONFIG, NotificationConfigItem } from '../notification.config';

class NotificationOrchestratorService {
    private isInitialized = false;
    private lastCheckTime: number = 0;
    private initPromise: Promise<void> | null = null;

    /**
     * Initialize the notification system.
     * Uses a promise guard to prevent concurrent initialization.
     */
    async init(): Promise<void> {
        // If already initialized, return immediately
        if (this.isInitialized) return;

        // If initialization is in progress, return the existing promise
        if (this.initPromise) return this.initPromise;

        // Start initialization and store the promise
        this.initPromise = this._doInit();
        return this.initPromise;
    }

    /**
     * Internal initialization logic.
     * Separated from init() to support the promise guard pattern.
     */
    private async _doInit(): Promise<void> {
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
            // Reset promise on failure to allow retry
            this.initPromise = null;
            Logger.error('[NotificationOrchestrator] Init failed:', error);
        }
    }

    private async getCurrentSeason(): Promise<string> {
        try {
            const profile = await database.get<UserProfile>('user_profile').query().fetch();
            if (profile && profile.length > 0) {
                return profile[0].currentSocialSeason || 'balanced';
            }
        } catch (e) {
            Logger.error('[NotificationOrchestrator] Failed to get season', e);
        }
        return 'balanced';
    }

    private getEffectiveConfig(key: string, season: string): NotificationConfigItem {
        const base = NOTIFICATION_CONFIG[key];
        if (!base) return base;

        // Use Global Profile
        const profile = GLOBAL_NOTIFICATION_SETTINGS.seasonProfiles?.[season as keyof typeof GLOBAL_NOTIFICATION_SETTINGS.seasonProfiles];

        let enabled = base.enabled;
        let schedule = { ...base.schedule };

        if (profile) {
            // Check if disabled globally for this season
            if (profile.disabledChannels?.includes(key)) {
                enabled = false;
            }

            // Check for interval override
            if (base.schedule.type === 'interval' && profile.intervalOverrides?.[key]) {
                const override = profile.intervalOverrides[key];
                schedule.hours = override.hours;
                if (override.startHour !== undefined) {
                    schedule.startHour = override.startHour;
                }
            }
        }

        return {
            ...base,
            enabled,
            schedule
        };
    }

    /**
     * Run checks that should happen on app launch or significant foregrounding
     */
    async runStartupChecks(): Promise<void> {
        Logger.info('[NotificationOrchestrator] Running startup/maintenance checks');
        this.lastCheckTime = Date.now();

        try {
            const season = await this.getCurrentSeason();
            Logger.info(`[NotificationOrchestrator] Applying profile for season: ${season}`);

            const qh = GLOBAL_NOTIFICATION_SETTINGS.quietHours;

            // Helper to check if now is quiet hour
            const isQuietHourNow = () => {
                if (!qh?.enabled) return false;
                const h = new Date().getHours();
                if (qh.startHour < qh.endHour) {
                    return h >= qh.startHour && h < qh.endHour;
                } else {
                    return h >= qh.startHour || h < qh.endHour;
                }
            };

            // 1. Memory Nudge
            const nudgesConfig = this.getEffectiveConfig('memory-nudge', season);
            if (nudgesConfig.enabled) {
                await MemoryNudgeChannel.schedule();
            } else {
                // If disabled by profile, ensure cancelled
                await MemoryNudgeChannel.cancel();
            }

            // 2. Evening Digest
            const digestConfig = this.getEffectiveConfig('evening-digest', season);
            if (digestConfig.enabled) {
                // Use default logic for daily
                if (EveningDigestChannel.ensureScheduled) {
                    await EveningDigestChannel.ensureScheduled();
                } else {
                    await EveningDigestChannel.schedule();
                }
            } else {
                await EveningDigestChannel.cancel();
            }

            // 3. Smart Suggestions (Interval)
            const suggestionsConfig = this.getEffectiveConfig('smart-suggestions', season);
            if (suggestionsConfig.enabled) {
                // Check Quiet Hours for Interval
                // If we are strictly in quiet hours, maybe we skip *evaluating* now?
                // Or if the *interval* would land us in quiet hours.
                // For now, if it's an interval driven check like "extend batch", we just run it.
                // But if it triggers immediate notifications, we should block.

                if (isQuietHourNow()) {
                    Logger.info('[NotificationOrchestrator] Quiet Hours active, skipping interval checks');
                } else {
                    // The channel itself handles the 4hr interval scheduling. 
                    // We might need to pass the config down or just let it run if enabled.
                    // IMPORTANT: The channel class might read raw config. merging logic should ideally be passed.
                    // For this MVP, we toggle 'enabled'. 
                    // If enabled, we proceed.
                    await SmartSuggestionsChannel.evaluateAndSchedule(suggestionsConfig);
                }
            }

            // 4. Battery Checkin
            const batteryConfig = this.getEffectiveConfig('daily-battery-checkin', season);
            if (batteryConfig.enabled) {
                await BatteryCheckinChannel.checkAndExtendBatch();
            }

            // 5. Weekly Reflection
            const reflectionConfig = this.getEffectiveConfig('weekly-reflection', season);
            if (reflectionConfig.enabled) {
                if (WeeklyReflectionChannel.ensureScheduled) {
                    await WeeklyReflectionChannel.ensureScheduled();
                } else {
                    await WeeklyReflectionChannel.schedule();
                }
            }

            // Restore event reminders
            await EventReminderChannel.scheduleAll();

            // Register push token for server-sent notifications
            registerPushToken().catch(err => {
                Logger.error('[NotificationOrchestrator] Push token registration failed:', err);
            });

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

        // Listen for interaction deletion
        eventBus.on('interaction:deleted', async (payload: any) => {
            try {
                if (!payload?.interactionId) return;
                await EventReminderChannel.cancel(payload.interactionId);
                Logger.info(`[NotificationOrchestrator] Cancelled notifications for deleted interaction: ${payload.interactionId}`);
            } catch (error) {
                Logger.error('[NotificationOrchestrator] Failed to handle interaction:deleted:', error);
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
    /**
     * Run checks triggered by background fetch task
     * Safe to run without UI
     */
    async runBackgroundChecks(): Promise<void> {
        Logger.info('[NotificationOrchestrator] Running background checks');

        // Track overall success/failure but try to execute as much as possible
        const errors: any[] = [];

        try {
            // Re-evaluate smart suggestions (calculate new ones if needed)
            try {
                await SmartSuggestionsChannel.evaluateAndSchedule();
            } catch (err) {
                Logger.error('[NotificationOrchestrator] Background SmartSuggestions failed:', err);
                errors.push(err);
            }

            // Ensure weekly reflection is still compliant
            try {
                if (WeeklyReflectionChannel.ensureScheduled) {
                    await WeeklyReflectionChannel.ensureScheduled();
                }
            } catch (err) {
                Logger.error('[NotificationOrchestrator] Background WeeklyReflection failed:', err);
                errors.push(err);
            }

            // Ensure evening digest
            try {
                if (EveningDigestChannel.ensureScheduled) {
                    await EveningDigestChannel.ensureScheduled();
                } else {
                    await EveningDigestChannel.schedule();
                }
            } catch (err) {
                Logger.error('[NotificationOrchestrator] Background EveningDigest failed:', err);
                errors.push(err);
            }

            // Mark check time
            this.lastCheckTime = Date.now();

            if (errors.length > 0) {
                Logger.warn(`[NotificationOrchestrator] Background checks completed with ${errors.length} errors`);
                // We still don't throw heavily here so the task manager counts it as "NewData" 
                // essentially, unless it was catastrophic. 
                // But for observability, we might want to throw if EVERYTHING failed.
                if (errors.length >= 3) {
                    throw new Error('All background sub-tasks failed');
                }
            }
        } catch (error) {
            Logger.error('[NotificationOrchestrator] Error during background checks:', error);
            throw error; // Let task manager know it failed
        }
    }
}

export const NotificationOrchestrator = new NotificationOrchestratorService();
