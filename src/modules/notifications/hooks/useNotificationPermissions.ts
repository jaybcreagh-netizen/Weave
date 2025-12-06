
import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { checkNotificationPermissions, requestNotificationPermissions, openSystemSettings } from '../services/permission.service';
import { notificationStore } from '../services/notification-store';

export function useNotificationPermissions() {
    const [hasPermission, setHasPermission] = useState<boolean>(false);
    const [hasRequested, setHasRequested] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    const check = useCallback(async () => {
        setIsLoading(true);
        const granted = await checkNotificationPermissions();
        const requested = await notificationStore.getPermissionRequested();

        setHasPermission(granted);
        setHasRequested(requested);
        setIsLoading(false);
    }, []);

    const request = useCallback(async () => {
        setIsLoading(true);
        const granted = await requestNotificationPermissions();
        setHasPermission(granted);
        setHasRequested(true);
        setIsLoading(false);
        return granted;
    }, []);

    // Check on mount and app resume
    useEffect(() => {
        check();

        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                check();
            }
        });

        return () => {
            subscription.remove();
        };
    }, [check]);

    return {
        hasPermission,
        hasRequested,
        isLoading,
        requestPermission: request,
        openSettings: openSystemSettings,
        checkPermission: check,
    };
}
