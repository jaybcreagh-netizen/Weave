import { useState, useEffect, useCallback } from 'react';
import { AppState, Linking } from 'react-native';
import * as Notifications from 'expo-notifications';
import { permissionService, NotificationPermissionStatus } from '../services/permission.service';
import Logger from '@/shared/utils/Logger';

export function useNotificationPermissions() {
    const [status, setStatus] = useState<NotificationPermissionStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const checkStatus = useCallback(async () => {
        try {
            const currentStatus = await permissionService.getStatus();
            setStatus(currentStatus);
        } catch (error) {
            Logger.error('[useNotificationPermissions] Error checking status:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Check on mount and when app comes to foreground
    useEffect(() => {
        checkStatus();

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                checkStatus();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [checkStatus]);

    const requestPermission = useCallback(async () => {
        setIsLoading(true);
        try {
            const granted = await permissionService.requestPermissions();
            await checkStatus(); // Refresh status
            return granted;
        } catch (error) {
            Logger.error('[useNotificationPermissions] Error requesting permission:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [checkStatus]);

    const openSettings = useCallback(async () => {
        try {
            await Linking.openSettings();
        } catch (error) {
            Logger.error('[useNotificationPermissions] Error opening settings:', error);
        }
    }, []);

    return {
        status,
        isLoading,
        isGranted: status?.granted ?? false,
        canAskAgain: status?.canAskAgain ?? true,
        requestPermission,
        openSettings,
        checkStatus,
    };
}
