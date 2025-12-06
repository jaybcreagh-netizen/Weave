
import * as Notifications from 'expo-notifications';
import { Platform, Linking } from 'react-native';
import Logger from '@/shared/utils/Logger';
import { notificationAnalytics } from './notification-analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSION_REQUESTED_KEY = '@weave:notification_permission_requested';

export interface NotificationPermissionStatus {
    status: Notifications.PermissionStatus;
    canAskAgain: boolean;
    granted: boolean;
}

class NotificationPermissionService {
    /**
     * Get current permission status without requesting
     */
    async getStatus(): Promise<NotificationPermissionStatus> {
        try {
            const settings = await Notifications.getPermissionsAsync();
            return {
                status: settings.status,
                canAskAgain: settings.canAskAgain,
                granted: settings.granted,
            };
        } catch (error) {
            Logger.error('[Permissions] Error getting status:', error);
            return {
                status: Notifications.PermissionStatus.UNDETERMINED,
                canAskAgain: true,
                granted: false,
            };
        }
    }

    /**
     * Request notification permissions
     * Handles platform specific logic (like Android channels)
     */
    async requestPermissions(): Promise<boolean> {
        try {
            Logger.info('[Permissions] Requesting notification permissions...');
            notificationAnalytics.trackPermissionRequested('permission_service');

            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            // Only request if not already granted
            if (existingStatus !== Notifications.PermissionStatus.GRANTED) {
                const { status } = await Notifications.requestPermissionsAsync({
                    ios: {
                        allowAlert: true,
                        allowBadge: true,
                        allowSound: true,
                    },
                });
                finalStatus = status;
            }

            // Mark as requested
            await AsyncStorage.setItem(PERMISSION_REQUESTED_KEY, 'true');

            if (finalStatus !== Notifications.PermissionStatus.GRANTED) {
                Logger.info('[Permissions] Permission denied or not granted');
                notificationAnalytics.trackPermissionResult(false, existingStatus !== 'granted'); // Simplified logic
                return false;
            }

            // Android Channel Setup (Safe to run on iOS as it's a no-op or handled by check)
            if (Platform.OS === 'android') {
                await this.setupAndroidChannels();
            }

            Logger.info('[Permissions] Permission granted');
            notificationAnalytics.trackPermissionResult(true, true);
            return true;
        } catch (error) {
            Logger.error('[Permissions] Error requesting permissions:', error);
            return false;
        }
    }

    /**
     * Setup Android Notification Channels
     */
    private async setupAndroidChannels() {
        try {
            // General Channel
            await Notifications.setNotificationChannelAsync('default', {
                name: 'General',
                importance: Notifications.AndroidImportance.DEFAULT,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#6366F1',
            });

            // Event Suggestions
            await Notifications.setNotificationChannelAsync('event-suggestions', {
                name: 'Event Suggestions',
                description: 'Suggestions to log calendar events as weaves',
                importance: Notifications.AndroidImportance.DEFAULT,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#8B7FD6',
            });

            // Reflections
            await Notifications.setNotificationChannelAsync('reflections', {
                name: 'Reflections',
                description: 'Weekly reflections and deepening nudges',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#F472B6',
            });

            Logger.info('[Permissions] Android channels configured');
        } catch (error) {
            Logger.error('[Permissions] Error setting up Android channels:', error);
        }
    }

    /**
     * Check if we have already asked for permissions
     */
    async hasAskedBefore(): Promise<boolean> {
        try {
            const result = await AsyncStorage.getItem(PERMISSION_REQUESTED_KEY);
            return result === 'true';
        } catch (error) {
            return false;
        }
    }
}

export const permissionService = new NotificationPermissionService();

// Standalone Helper Exports
export const checkNotificationPermissions = async (): Promise<boolean> => {
    const status = await permissionService.getStatus();
    return status.granted;
};

export const requestNotificationPermissions = async (): Promise<boolean> => {
    return await permissionService.requestPermissions();
};

export const openSystemSettings = async (): Promise<void> => {
    await Linking.openSettings();
};
