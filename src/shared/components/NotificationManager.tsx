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
import { BackgroundTaskManager } from '@/shared/services/background-task-manager';

const NOTIFICATION_PERMISSION_ASKED_KEY = '@weave:notification_permission_asked';
const FIRST_RUN_COMPLETED_KEY = '@weave:first_run_completed';
const NOTIFICATION_INIT_DELAY_MS = 1500;
const PERMISSION_PROMPT_DELAY_MS = 750;

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
        const cleanupIntelligence = setupIntelligenceListeners();

        // DISABLED: Gamification is undercooked and adds ~2s processing per weave
        // Uncomment when ready to re-enable badges/achievements
        // const cleanupGamification = setupGamificationListeners();

        return () => {
            if (cleanupIntelligence) cleanupIntelligence();
            // if (cleanupGamification) cleanupGamification();
        };
    }, []);

    // Initialize all notification systems
    useEffect(() => {
        let isCancelled = false;

        const setupNotifications = async () => {
            try {
                // Keep startup smooth, but still initialize quickly for short sessions.
                await new Promise(resolve => setTimeout(resolve, NOTIFICATION_INIT_DELAY_MS));
                if (isCancelled) return;

                await NotificationOrchestrator.init();
                if (isCancelled) return;
                // Register background task for reliable notifications
                await BackgroundTaskManager.registerBackgroundTask();
                if (isCancelled) return;

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
            isCancelled = true;
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

                // Avoid showing the post-onboarding modal until the first-run setup
                // funnel is actually complete (social battery step reached).
                const firstRunCompleted = await AsyncStorage.getItem(FIRST_RUN_COMPLETED_KEY);
                const hasCompletedFirstRunSetup = firstRunCompleted === 'true';
                if (!hasCompletedFirstRunSetup) return;

                const { status } = await Notifications.getPermissionsAsync();
                if (status === 'granted') {
                    await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
                    return;
                }

                setTimeout(() => {
                    setShowNotificationPermissionModal(true);
                }, PERMISSION_PROMPT_DELAY_MS);
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
