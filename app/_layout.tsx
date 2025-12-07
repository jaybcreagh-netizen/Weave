import 'react-native-get-random-values';
import '../global.css';
import { Stack, SplashScreen, usePathname, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { QuickWeaveProvider } from '@/components/QuickWeaveProvider';
import { ToastProvider } from '@/components/toast_provider';
import { PortalProvider } from '@gorhom/portal';
import { CardGestureProvider } from '@/context/CardGestureContext'; // Import the provider
import { MilestoneCelebration } from '@/components/MilestoneCelebration';
import TrophyCabinetModal from '@/components/TrophyCabinetModal';
import { NotificationPermissionModal } from '@/components/NotificationPermissionModal';
import { LoadingScreen } from '@/shared/components/LoadingScreen';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { EventSuggestionModal } from '@/components/EventSuggestionModal';
import { WeeklyReflectionModal } from '@/components/WeeklyReflection/WeeklyReflectionModal';
import { MemoryMomentModal } from '@/components/Journal/MemoryMomentModal';
import { DigestSheet } from '@/components/DigestSheet';
import { useUIStore } from '@/stores/uiStore';
import { useTheme } from '@/shared/hooks/useTheme';
import { SyncConflictModal } from '@/modules/auth/components/SyncConflictModal';

import { initializeDataMigrations, initializeUserProfile, initializeUserProgress, database } from '@/db';
import { useAppStateChange } from '@/shared/hooks/useAppState';
import { useTutorialStore } from '@/stores/tutorialStore';
import {
  NotificationOrchestrator,
  useNotificationResponseHandler,
} from '@/modules/notifications';
import { PostWeaveRatingModal, PlanService } from '@/modules/interactions';
import { useNotificationPermissions } from '@/modules/notifications/hooks/useNotificationPermissions';
import { AppState } from 'react-native';
import { AutoBackupService } from '@/modules/backup/AutoBackupService';
import { useBackgroundSyncStore } from '@/modules/auth';
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
import * as Sentry from '@sentry/react-native';
import { initializeAnalytics, trackEvent, trackRetentionMetrics, AnalyticsEvents, setPostHogInstance } from '@/shared/services/analytics.service';
import { PostHogProvider, usePostHog, POSTHOG_API_KEY, posthogOptions } from '@/shared/services/posthog.service';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isSunday, isSameDay } from 'date-fns';
import { notificationStore } from '@/modules/notifications';

const queryClient = new QueryClient();

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs


  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();



const NOTIFICATION_PERMISSION_ASKED_KEY = '@weave:notification_permission_asked';

/**
 * The root layout component for the application.
 * This component sets up the global providers, navigators, and modals.
 * @returns {React.ReactElement | null} The rendered root layout.
 */
function RootLayoutContent() {
  // Apply the activity-based keep-awake logic globally
  // useActivityKeepAwake();

  const posthog = usePostHog();
  const [analyticsInitialized, setAnalyticsInitialized] = useState(false);

  const pathname = usePathname();

  useEffect(() => {
    if (posthog) {
      setPostHogInstance(posthog);

      if (!analyticsInitialized) {
        trackEvent(AnalyticsEvents.APP_OPENED);
        trackRetentionMetrics();
        setAnalyticsInitialized(true);
      }
    }
  }, [posthog, analyticsInitialized]);

  // Manually track screen views
  useEffect(() => {
    if (posthog && pathname) {
      posthog.screen(pathname);
    }
  }, [posthog, pathname]);

  const { colors } = useTheme();
  const isDarkMode = useUIStore((state) => state.isDarkMode);
  const milestoneCelebrationData = useUIStore((state) => state.milestoneCelebrationData);
  const hideMilestoneCelebration = useUIStore((state) => state.hideMilestoneCelebration);
  const isTrophyCabinetOpen = useUIStore((state) => state.isTrophyCabinetOpen);
  const closeTrophyCabinet = useUIStore((state) => state.closeTrophyCabinet);
  const isWeeklyReflectionOpen = useUIStore((state) => state.isWeeklyReflectionOpen);
  const openWeeklyReflection = useUIStore((state) => state.openWeeklyReflection);
  const closeWeeklyReflection = useUIStore((state) => state.closeWeeklyReflection);
  const lastReflectionPromptDate = useUIStore((state) => state.lastReflectionPromptDate);
  const markReflectionPromptShown = useUIStore((state) => state.markReflectionPromptShown);
  const memoryMomentData = useUIStore((state) => state.memoryMomentData);
  const digestSheetVisible = useUIStore((state) => state.digestSheetVisible);
  const digestItems = useUIStore((state) => state.digestItems);
  const hasCompletedOnboarding = useTutorialStore((state) => state.hasCompletedOnboarding);

  const [fontsLoaded, fontError] = useFonts({
    Lora_400Regular,
    Lora_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  const [dataLoaded, setDataLoaded] = useState(false);
  const [uiMounted, setUiMounted] = useState(false);
  const [showNotificationPermissionModal, setShowNotificationPermissionModal] = useState(false);

  // Animated opacity for smooth fade-in of content
  const contentOpacity = useSharedValue(0);
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
  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide the splash screen after the fonts have loaded or an error occurred
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Run data migrations and initialize user profile on app startup
  useEffect(() => {
    const initializeData = async () => {
      try {
        await initializeDataMigrations();
        await initializeUserProfile();
        await initializeUserProgress();
        // Initialize analytics
        // Note: Actual tracking happens in useEffect dependent on posthog instance
        await initializeAnalytics();


        // Sync calendar changes on app launch (non-blocking)
        import('@/modules/interactions').then(({ useInteractionsStore }) => {
          useInteractionsStore.getState().syncCalendar().catch((error) => {
            console.error('[App] Error syncing calendar on launch:', error);
          });
        });

        // Scan for event suggestions on app launch (non-blocking)
        import('@/modules/interactions').then(({ useEventSuggestionStore }) => {
          useEventSuggestionStore.getState().scanForSuggestions().catch((error) => {
            console.error('[App] Error scanning for event suggestions on launch:', error);
          });
        });

        // Check for pending plans (past events that need rating)
        PlanService.checkPendingPlans().catch(err => {
          console.error('[App] Error checking pending plans on launch:', err);
        });

        setDataLoaded(true);
      } catch (error) {
        console.error('Failed to initialize app data:', error);
        Sentry.captureException(error);
        setDataLoaded(true); // Still mark as loaded to prevent infinite loading
      }
    };

    initializeData();
  }, []);

  // Wait for friends to be loaded before marking UI as mounted
  useEffect(() => {
    if (!dataLoaded) return;

    const checkFriendsLoaded = async () => {
      // Just check if we can query the database, effectively
      try {
        await database.get('friends').query().fetchCount();
        setTimeout(() => {
          setUiMounted(true);
        }, 300);
      } catch (e) {
        console.error('Failed to check friends', e);
        // Fallback
        setUiMounted(true);
      }
    };

    checkFriendsLoaded();
  }, [dataLoaded]);

  // Fade in content when UI is mounted
  useEffect(() => {
    if (uiMounted) {
      // Delay slightly to overlap with loading screen fade out
      contentOpacity.value = withTiming(1, {
        duration: 800,
        easing: Easing.out(Easing.ease),
      });
    }
  }, [uiMounted]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  // Monitor app state changes for logging
  useAppStateChange((state) => {

    if (state === 'active') {

      trackEvent(AnalyticsEvents.APP_OPENED);
      trackRetentionMetrics();

      // Trigger smart notification evaluation when app comes to foreground
      NotificationOrchestrator.evaluateSmartNotifications().catch((error) => {
        console.error('[App] Error evaluating smart notifications on foreground:', error);
      });

      // Sync calendar changes when app becomes active
      // This runs async in the background without blocking the UI
      import('@/modules/interactions').then(({ useInteractionsStore }) => {
        useInteractionsStore.getState().syncCalendar().catch((error) => {
          console.error('[App] Error syncing calendar on foreground:', error);
        });
      });

      // Scan for event suggestions (birthdays, holidays, past events)
      // This runs async in the background without blocking the UI
      import('@/modules/interactions').then(({ useEventSuggestionStore }) => {
        useEventSuggestionStore.getState().scanForSuggestions().catch((error) => {
          console.error('[App] Error scanning for event suggestions:', error);
        });
      });

      // Check for pending plans when app comes to foreground
      PlanService.checkPendingPlans().catch(err => {
        console.error('[App] Error checking pending plans on active:', err);
      });
    } else if (state === 'background') {

      trackEvent(AnalyticsEvents.APP_BACKGROUNDED);
    }
  });

  // Handle notification permission request
  const { requestPermission: requestNotificationPermission } = useNotificationPermissions();
  const { handleResponse } = useNotificationResponseHandler();

  // Initialize all notification systems (battery, events, deepening, reflection)
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        // Initialize orchestrator (sets up handler and runs startup checks)
        await NotificationOrchestrator.init();

        // Check if app was launched via notification
        const response = await Notifications.getLastNotificationResponseAsync();
        if (response) {
          handleResponse(response);
        }
      } catch (error) {
        console.error('[App] Failed to initialize notifications:', error);
      }
    };

    setupNotifications();

    // Setup listener for notification taps while app is running
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      handleResponse(response);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Initialize background sync on app startup
  useEffect(() => {
    const initBackgroundSync = async () => {
      try {
        // Load settings (will register task if enabled)
        await useBackgroundSyncStore.getState().loadSettings();

      } catch (error) {
        console.error('[App] Failed to initialize background sync:', error);
      }
    };

    initBackgroundSync();
  }, []);

  // Check if we should show notification permission modal
  useEffect(() => {
    const checkNotificationPermissions = async () => {
      if (!hasCompletedOnboarding || !dataLoaded) return;

      try {
        // Check if we've already asked for permissions
        const hasAsked = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY);
        if (hasAsked === 'true') return;

        // Check current permission status
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'granted') {
          // Already have permissions, mark as asked
          await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
          return;
        }

        // Show permission modal after a short delay to let UI settle
        setTimeout(() => {
          setShowNotificationPermissionModal(true);
        }, 1000);
      } catch (error) {
        console.error('[App] Error checking notification permissions:', error);
      }
    };

    checkNotificationPermissions();
  }, [hasCompletedOnboarding, dataLoaded]);

  // Weekly Reflection Sunday Check
  useEffect(() => {
    const checkWeeklyReflection = async () => {
      // Only run if UI is mounted and data loaded
      if (!uiMounted || !dataLoaded || !hasCompletedOnboarding) return;

      const now = new Date();

      // 1. Must be Sunday
      if (!isSunday(now)) return;

      // 2. Must not have completed reflection today
      const lastReflectionDate = await notificationStore.getLastReflectionDate();
      if (lastReflectionDate && isSameDay(lastReflectionDate, now)) return;

      // 3. Must not have shown prompt today
      if (lastReflectionPromptDate && isSameDay(new Date(lastReflectionPromptDate), now)) return;

      // Show it!
      markReflectionPromptShown();
      // Small delay to let animations settle
      setTimeout(() => {
        openWeeklyReflection();
      }, 1000);
    };

    checkWeeklyReflection();
  }, [uiMounted, dataLoaded, hasCompletedOnboarding, lastReflectionPromptDate]);



  const handleRequestNotificationPermission = async () => {
    try {
      const granted = await requestNotificationPermission();
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
      setShowNotificationPermissionModal(false);

      if (granted) {

        await NotificationOrchestrator.requestPermissions();
      } else {

      }
    } catch (error) {
      console.error('[App] Error requesting notification permissions:', error);
      setShowNotificationPermissionModal(false);
    }
  };

  // Handle skipping notification permissions
  const handleSkipNotificationPermission = async () => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
      setShowNotificationPermissionModal(false);

    } catch (error) {
      console.error('[App] Error skipping notification permissions:', error);
    }
  };

  // Prevent rendering until the font has loaded or an error was returned
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (

    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {/* Wrap with CardGestureProvider so both Dashboard and Overlay can access it */}
      <PortalProvider>
        <CardGestureProvider>
          <QuickWeaveProvider>
            <ToastProvider>
              <ErrorBoundary
                onError={(error, errorInfo) => {
                  console.error('[App] Global error caught:', error);
                  console.error('[App] Error info:', errorInfo);
                  // TODO: Send to error tracking service (e.g., Sentry)
                }}
              >
                {/* Animated wrapper for smooth fade-in */}
                <Animated.View style={[{ flex: 1 }, contentStyle]}>
                  <Stack screenOptions={{ headerShown: false }}>
                    {/* The Stack navigator will automatically discover all files in the app directory */}
                  </Stack>

                  {/* Global Milestone Celebration Modal */}
                  <MilestoneCelebration
                    visible={milestoneCelebrationData !== null}
                    milestone={milestoneCelebrationData}
                    onClose={hideMilestoneCelebration}
                  />

                  <TrophyCabinetModal
                    visible={isTrophyCabinetOpen}
                    onClose={closeTrophyCabinet}
                  />

                  {/* Notification Permission Modal */}
                  <NotificationPermissionModal
                    visible={showNotificationPermissionModal}
                    onRequestPermission={handleRequestNotificationPermission}
                    onSkip={handleSkipNotificationPermission}
                  />

                  {/* Global Event Suggestion Modal */}
                  <EventSuggestionModal />

                  {/* Weekly Reflection Modal */}
                  <WeeklyReflectionModal
                    isOpen={isWeeklyReflectionOpen}
                    onClose={closeWeeklyReflection}
                  />

                  {/* Sync Conflict Modal */}
                  <SyncConflictModal />

                  {/* Post Weave Rating Modal */}
                  <PostWeaveRatingModal />

                  {/* Memory Moment Modal */}
                  <MemoryMomentModal
                    visible={!!memoryMomentData}
                    onClose={() => useUIStore.getState().closeMemoryMoment()}
                    memory={memoryMomentData?.memory || null}
                    entry={memoryMomentData?.entry || null}
                    friendName={memoryMomentData?.friendName}
                    onReadEntry={() => {
                      const data = useUIStore.getState().memoryMomentData;
                      useUIStore.getState().closeMemoryMoment();

                      if (data?.memory?.relatedEntryId) {
                        router.push({
                          pathname: '/journal',
                          params: {
                            openEntryId: data.memory.relatedEntryId,
                            openEntryType: data.memory.type.includes('reflection') || data.memory.id.includes('reflection') ? 'reflection' : 'journal'
                          }
                        });
                      } else {
                        router.push('/journal');
                      }
                    }}
                    onWriteAbout={() => {
                      const data = useUIStore.getState().memoryMomentData;
                      useUIStore.getState().closeMemoryMoment();

                      if (data) {
                        router.push({
                          pathname: '/journal',
                          params: {
                            prefilledText: `Thinking about this memory: "${data.memory.title}"...\n\n`,
                            prefilledFriendIds: data.friendId ? [data.friendId] : undefined
                          }
                        });
                      } else {
                        router.push('/journal');
                      }
                    }}
                  />

                  {/* Evening Digest Sheet */}
                  <DigestSheet
                    isVisible={digestSheetVisible}
                    onClose={() => useUIStore.getState().closeDigestSheet()}
                    items={digestItems}
                  />

                </Animated.View>

                {/* Loading Screen - shows until data is loaded AND UI is mounted */}
                <LoadingScreen visible={fontsLoaded && (!dataLoaded || !uiMounted)} />
              </ErrorBoundary>
            </ToastProvider>
          </QuickWeaveProvider>
        </CardGestureProvider>
      </PortalProvider>
    </GestureHandlerRootView>

  );

}

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <PostHogProvider
        apiKey={POSTHOG_API_KEY}
        options={posthogOptions}
        autocapture={{
          captureScreens: false,
          captureTouches: true
        }}
      >
        <RootLayoutContent />
      </PostHogProvider>
    </QueryClientProvider>
  );
}

export default RootLayout;
