import React, { useEffect, useState, ReactNode } from 'react';
import { AppState } from 'react-native';
import { SplashScreen, usePathname } from 'expo-router';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';


import {
    useFonts,
    Lora_400Regular,
    Lora_700Bold,
} from '@expo-google-fonts/lora';
import {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
} from '@expo-google-fonts/inter';

import { initializeDataMigrations, initializeAppSingletons } from '@/db';
import { LoadingScreen } from '@/shared/components/LoadingScreen';
import { useDatabaseReady } from '@/shared/hooks/useDatabaseReady';
import { useAppStateChange } from '@/shared/hooks/useAppState';
import { useTutorialStore } from '@/shared/stores/tutorialStore';
import { AutoBackupService } from '@/modules/backup';
import { useBackgroundSyncStore } from '@/modules/auth';
import { PlanService } from '@/modules/interactions';
import { NotificationOrchestrator } from '@/modules/notifications';

import {
    initializeAnalytics,
    trackEvent,
    trackRetentionMetrics,
    AnalyticsEvents,
    setPostHogInstance,
    setUserProperties
} from '@/shared/services/analytics.service';
import { usePostHog } from '@/shared/services/posthog.service';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

interface DataInitializerProps {
    children: ReactNode;
}

export function DataInitializer({ children }: DataInitializerProps) {
    const posthog = usePostHog();
    const [analyticsInitialized, setAnalyticsInitialized] = useState(false);
    const hasCompletedOnboarding = useTutorialStore((state) => state.hasCompletedOnboarding);
    const pathname = usePathname();

    const [fontsLoaded, fontError] = useFonts({
        Lora_400Regular,
        Lora_700Bold,
        Inter_400Regular,
        Inter_500Medium,
        Inter_600SemiBold,
    });

    const [dataLoaded, setDataLoaded] = useState(false);
    const [isSplashAnimationComplete, setIsSplashAnimationComplete] = useState(false);

    // Animated opacity for smooth fade-in of content
    const contentOpacity = useSharedValue(0);

    // Custom hook to handle safe database initialization check
    const isDatabaseReady = useDatabaseReady(dataLoaded);

    // Analytics Initialization
    useEffect(() => {
        if (posthog) {
            setPostHogInstance(posthog);

            if (!analyticsInitialized) {
                trackEvent(AnalyticsEvents.APP_OPENED);
                trackRetentionMetrics();
                setAnalyticsInitialized(true);
            }

            // Sync onboarding status for existing users who might have missed the event
            if (hasCompletedOnboarding) {
                setUserProperties({ onboarding_completed: true });
            }
        }
    }, [posthog, analyticsInitialized, hasCompletedOnboarding]);

    // Manually track screen views
    useEffect(() => {
        if (posthog && pathname) {
            posthog.screen(pathname);
        }
    }, [posthog, pathname]);

    // App State & Backup Logic
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'background' || nextAppState === 'inactive') {
                AutoBackupService.checkAndBackup();
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    // Splash Screen Logic
    useEffect(() => {
        SplashScreen.hideAsync().catch(() => {
            // Ignore errors if splash screen is already hidden
        });

        // Enforce minimum display time for the splash animation
        const timer = setTimeout(() => {
            setIsSplashAnimationComplete(true);
        }, 300);  // Reduced from 800ms for faster startup

        return () => clearTimeout(timer);
    }, []);

    // Initialize Data
    useEffect(() => {
        const initializeData = async () => {
            const startTime = Date.now();
            console.log('[Startup] Beginning initialization...');

            try {
                // Pre-warm friend cache to prevent empty flash on dashboard
                const initializeFriendCache = async () => {
                    const { database } = await import('@/db');
                    // Just fetching the count is enough to initialize the collection and adapter
                    await database.get('friends').query().fetchCount();
                };

                // CRITICAL WRITES: Run sequentially to prevent queue congestion
                // 1. Data migrations must complete first (may have writes)
                const t1 = Date.now();
                await initializeDataMigrations();
                console.log(`[Startup] Data migrations: ${Date.now() - t1}ms`);

                // 2. App singletons in a single batched write
                const t2 = Date.now();
                await initializeAppSingletons();
                console.log(`[Startup] App singletons: ${Date.now() - t2}ms`);

                // NON-CRITICAL: These are reads or non-blocking, can run in parallel
                const t3 = Date.now();
                await Promise.all([
                    initializeAnalytics(),
                    initializeFriendCache()
                ]);
                console.log(`[Startup] Analytics + Friend cache: ${Date.now() - t3}ms`);

                // Sync calendar changes on app launch (non-blocking)
                import('@/modules/interactions').then(({ CalendarService }) => {
                    CalendarService.syncCalendarChanges().catch((error: unknown) => {
                        console.error('[App] Error syncing calendar on launch:', error);
                    });
                });

                // NOTE: Event suggestion prefetching removed from startup
                // It runs on foreground via useAppStateChange and React Query's staleTime
                // prevents excessive rescans. Running it here caused duplicate scans.

                // DEFERRED: These write-heavy operations run after a delay to avoid queue congestion
                // They will fire 3 seconds after UI is ready, giving priority to user interactions
                setTimeout(() => {
                    // Run image cleanup (non-blocking)
                    import('@/modules/relationships/services/image.service').then(({ verifyAndCleanupFriendImages }) => {
                        verifyAndCleanupFriendImages().catch(err => {
                            console.error('[App] Error during image verification:', err);
                        });
                    });

                    // Run tier integrity repair (non-blocking, only runs once per device)
                    import('@/shared/services/integrity.service').then(({ integrityService }) => {
                        integrityService.repairTiers().catch(err => {
                            console.error('[App] Error during tier integrity repair:', err);
                        });
                    });

                    // Check for pending plans (has database writes)
                    PlanService.checkPendingPlans().catch(err => {
                        console.error('[App] Error checking pending plans on launch:', err);
                    });
                }, 3000);

                console.log(`[Startup] Total initialization: ${Date.now() - startTime}ms`);
                setDataLoaded(true);

            } catch (error) {
                console.error('Failed to initialize app data:', error);
                Sentry.captureException(error);
                setDataLoaded(true);
            }
        };

        initializeData();
    }, []);

    // Initialize background sync
    useEffect(() => {
        const initBackgroundSync = async () => {
            try {
                await useBackgroundSyncStore.getState().loadSettings();
            } catch (error) {
                console.error('[App] Failed to initialize background sync:', error);
            }
        };
        initBackgroundSync();
    }, []);

    // Fade in content when UI is mounted
    useEffect(() => {
        if (isDatabaseReady) {
            contentOpacity.value = withTiming(1, {
                duration: 400,  // Reduced from 800ms for faster startup
                easing: Easing.out(Easing.ease),
            });
        }
    }, [isDatabaseReady]);

    const contentStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
    }));

    // Monitor app state changes for logging and maintenance
    useAppStateChange((state) => {
        if (state === 'active') {
            trackEvent(AnalyticsEvents.APP_OPENED);
            trackRetentionMetrics();

            NotificationOrchestrator.onAppForeground().catch((error) => {
                console.error('[App] Error during foreground notification checks:', error);
            });

            // Sync calendar changes when app becomes active
            import('@/modules/interactions').then(({ CalendarService }) => {
                CalendarService.syncCalendarChanges().catch((error: unknown) => {
                    console.error('[App] Error syncing calendar on foreground:', error);
                });
            });

            import('@/modules/interactions/hooks/useEventSuggestions').then(({ prefetchEventSuggestions }) => {
                import('@/shared/api/query-client').then(({ queryClient }) => {
                    prefetchEventSuggestions(queryClient).catch((error) => {
                        console.error('[App] Error prefetching event suggestions on foreground:', error);
                    });
                });
            });

            PlanService.checkPendingPlans().catch(err => {
                console.error('[App] Error checking pending plans on active:', err);
            });
        } else if (state === 'background') {
            trackEvent(AnalyticsEvents.APP_BACKGROUNDED);
        }
    });

    if (!fontsLoaded && !fontError) {
        return null;
    }

    return (
        <>
            <Animated.View style={[{ flex: 1 }, contentStyle]}>
                {children}
            </Animated.View>

            <LoadingScreen visible={!fontsLoaded || !dataLoaded || !isDatabaseReady || !isSplashAnimationComplete} />
        </>
    );
}
