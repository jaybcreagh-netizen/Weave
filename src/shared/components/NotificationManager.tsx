import React, { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
    NotificationOrchestrator,
    useNotificationResponseHandler,
} from '@/modules/notifications';
import { useNotificationPermissions } from '@/modules/notifications';
import { setupIntelligenceListeners } from '@/modules/intelligence';
import { setupGamificationListeners } from '@/modules/gamification';
import { NotificationPermissionModal } from '@/modules/notifications';
import { useTutorialStore } from '@/shared/stores/tutorialStore';
import { useDatabaseReady } from '@/shared/hooks/useDatabaseReady';
import { BackgroundTaskManager } from '@/shared/services/background-task-manager';

const NOTIFICATION_PERMISSION_ASKED_KEY = '@weave:notification_permission_asked';

export function NotificationManager() {
    const [showNotificationPermissionModal, setShowNotificationPermissionModal] = useState(false);
    const hasCompletedOnboarding = useTutorialStore((state) => state.hasCompletedOnboarding);

    // Need to check database/data readiness indirectly or assume it's guarded by parent
    // But here we can use the hook just to be safe if we need 'dataLoaded' signal. 
    // We'll assume the parent (DataInitializer) only renders this when data is mostly valid, 
    // BUT strict dependency on 'dataLoaded' state from _layout is gone.
    // Instead, we can check basic readiness if needed, or just rely on 'hasCompletedOnboarding'.

    // Handle notification permission request
    const { requestPermission: requestNotificationPermission } = useNotificationPermissions();
    const { handleResponse } = useNotificationResponseHandler();

    // Initialize Event Listeners
    useEffect(() => {
        setupIntelligenceListeners();
        setupGamificationListeners();
    }, []);

    // Initialize all notification systems
    useEffect(() => {
        const setupNotifications = async () => {
            try {
                // Delay initialization to avoid writer contention on startup
                // This prevents the "writer queue" warning and potential UI jank during splash dismissal
                await new Promise(resolve => setTimeout(resolve, 2000));

                await NotificationOrchestrator.init();
                // Register background task for reliable notifications
                await BackgroundTaskManager.registerBackgroundTask();

                const response = await Notifications.getLastNotificationResponseAsync();
                if (response) {
                    handleResponse(response);
                }
            } catch (error) {
                console.error('[App] Failed to initialize notifications:', error);
            }
        };

        setupNotifications();

        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            handleResponse(response);
        });

        return () => {
            subscription.remove();
        };
    }, []);

    // Check if we should show notification permission modal
    useEffect(() => {
        const checkNotificationPermissions = async () => {
            if (!hasCompletedOnboarding) return;

            try {
                const hasAsked = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY);
                if (hasAsked === 'true') return;

                const { status } = await Notifications.getPermissionsAsync();
                if (status === 'granted') {
                    await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
                    return;
                }

                setTimeout(() => {
                    setShowNotificationPermissionModal(true);
                }, 1000);
            } catch (error) {
                console.error('[App] Error checking notification permissions:', error);
            }
        };

        checkNotificationPermissions();
    }, [hasCompletedOnboarding]);

    const handleRequestNotificationPermission = async () => {
        try {
            const granted = await requestNotificationPermission();
            await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
            setShowNotificationPermissionModal(false);

            if (granted) {
                await NotificationOrchestrator.requestPermissions();
            }
        } catch (error) {
            console.error('[App] Error requesting notification permissions:', error);
            setShowNotificationPermissionModal(false);
        }
    };

    const handleSkipNotificationPermission = async () => {
        try {
            await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
            setShowNotificationPermissionModal(false);
        } catch (error) {
            console.error('[App] Error skipping notification permissions:', error);
        }
    };

    return (
        <NotificationPermissionModal
            visible={showNotificationPermissionModal}
            onRequestPermission={handleRequestNotificationPermission}
            onSkip={handleSkipNotificationPermission}
        />
    );
}
