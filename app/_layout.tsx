import '../global.css';
import { Stack, SplashScreen, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TouchableWithoutFeedback, View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { QuickWeaveProvider } from '../src/components/QuickWeaveProvider';
import { ToastProvider } from '../src/components/toast_provider';
import { CardGestureProvider } from '../src/context/CardGestureContext'; // Import the provider
import { MilestoneCelebration } from '../src/components/MilestoneCelebration';
import TrophyCabinetModal from '../src/components/TrophyCabinetModal';
import { NotificationPermissionModal } from '../src/components/NotificationPermissionModal';
import { LoadingScreen } from '../src/components/LoadingScreen';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { EventSuggestionModal } from '../src/components/EventSuggestionModal';
import { useUIStore } from '../src/stores/uiStore';
import { useTheme } from '../src/hooks/useTheme';
import { useActivityKeepAwake } from '../src/hooks/useActivityKeepAwake';
import { initializeDataMigrations, initializeUserProfile, initializeUserProgress } from '../src/db';
import { appStateManager } from '../src/lib/app-state-manager';
import { useAppStateChange } from '../src/hooks/useAppState';
import { useRelationshipsStore } from '../src/modules/relationships';
import { useTutorialStore } from '../src/stores/tutorialStore';
import {
  initializeNotifications,
  requestNotificationPermissions,
} from '../src/lib/notification-manager-enhanced';
import {
  setupNotificationResponseListener,
  handleNotificationOnLaunch,
} from '../src/lib/notification-response-handler';
import {
  configureNotificationHandler,
  handleEventSuggestionTap,
} from '../src/lib/event-notifications';
import { useBackgroundSyncStore } from '../src/stores/backgroundSyncStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  useFonts,
  Lora_400Regular,
  Lora_700Bold,
} from '@expo-google-fonts/lora';
import {
  Inter_400Regular,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';
import * as Sentry from '@sentry/react-native';
import { initializeAnalytics, trackEvent, trackRetentionMetrics, AnalyticsEvents, setPostHogInstance } from '../src/lib/analytics';
import { PostHogProvider, usePostHog } from 'posthog-react-native';

Sentry.init({
  dsn: 'https://1b94b04a0400cdc5a0378c0f485a2435@o4510357596471296.ingest.de.sentry.io/4510357600993360',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

/**
 * A component to connect the PostHog instance to the analytics module.
 * @param {{children: React.ReactNode}} props - The component props.
 * @returns {React.ReactElement} The rendered component.
 */
function PostHogConnector({ children }: { children: React.ReactNode }) {
  const posthog = usePostHog();

  React.useEffect(() => {
    if (posthog) {
      setPostHogInstance(posthog);
    }
  }, [posthog]);

  return <>{children}</>;
}

const NOTIFICATION_PERMISSION_ASKED_KEY = '@weave:notification_permission_asked';

/**
 * The root layout component for the application.
 * This component sets up the global providers, navigators, and modals.
 * @returns {React.ReactElement | null} The rendered root layout.
 */
export default Sentry.wrap(function RootLayout() {
  // Apply the activity-based keep-awake logic globally
  useActivityKeepAwake();

  const { colors } = useTheme();
  const isDarkMode = useUIStore((state) => state.isDarkMode);
  const milestoneCelebrationData = useUIStore((state) => state.milestoneCelebrationData);
  const hideMilestoneCelebration = useUIStore((state) => state.hideMilestoneCelebration);
  const isTrophyCabinetOpen = useUIStore((state) => state.isTrophyCabinetOpen);
  const closeTrophyCabinet = useUIStore((state) => state.closeTrophyCabinet);
  const hasCompletedOnboarding = useTutorialStore((state) => state.hasCompletedOnboarding);

  const [fontsLoaded, fontError] = useFonts({
    Lora_400Regular,
    Lora_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const [dataLoaded, setDataLoaded] = useState(false);
  const [uiMounted, setUiMounted] = useState(false);
  const [showNotificationPermissionModal, setShowNotificationPermissionModal] = useState(false);

  // Animated opacity for smooth fade-in of content
  const contentOpacity = useSharedValue(0);

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
        await initializeAnalytics();
        // Track app open and retention metrics
        trackEvent(AnalyticsEvents.APP_OPENED);
        await trackRetentionMetrics();

        // Sync calendar changes on app launch (non-blocking)
        import('../src/stores/interactionStore').then(({ useInteractionStore }) => {
          useInteractionStore.getState().syncWithCalendar().catch((error) => {
            console.error('[App] Error syncing calendar on launch:', error);
          });
        });

        // Scan for event suggestions on app launch (non-blocking)
        import('../src/stores/eventSuggestionStore').then(({ useEventSuggestionStore }) => {
          useEventSuggestionStore.getState().scanForSuggestions().catch((error) => {
            console.error('[App] Error scanning for event suggestions on launch:', error);
          });
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

    const checkFriendsLoaded = () => {
      const friends = useRelationshipsStore.getState().friends;
      // Mark UI as mounted once we have friends data (even if empty)
      // Give a small delay to ensure lists are rendered
      if (friends !== null) {
        setTimeout(() => {
          setUiMounted(true);
        }, 300); // Small delay to ensure UI is painted
      }
    };

    // Subscribe to friend store
    const unsubscribe = useRelationshipsStore.subscribe(checkFriendsLoaded);
    checkFriendsLoaded(); // Check immediately

    return () => unsubscribe();
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
    console.log('[App] State changed to:', state);
    if (state === 'active') {
      console.log('[App] App is active - resuming operations');
      trackEvent(AnalyticsEvents.APP_OPENED);
      trackRetentionMetrics();

      // Trigger smart notification evaluation when app comes to foreground
      // This runs async in the background without blocking the UI
      import('../src/lib/smart-notification-scheduler').then(({ evaluateAndScheduleSmartNotifications }) => {
        evaluateAndScheduleSmartNotifications().catch((error) => {
          console.error('[App] Error evaluating smart notifications on foreground:', error);
        });
      });

      // Sync calendar changes when app becomes active
      // This runs async in the background without blocking the UI
      import('../src/stores/interactionStore').then(({ useInteractionStore }) => {
        useInteractionStore.getState().syncWithCalendar().catch((error) => {
          console.error('[App] Error syncing calendar on foreground:', error);
        });
      });

      // Scan for event suggestions (birthdays, holidays, past events)
      // This runs async in the background without blocking the UI
      import('../src/stores/eventSuggestionStore').then(({ useEventSuggestionStore }) => {
        useEventSuggestionStore.getState().scanForSuggestions().catch((error) => {
          console.error('[App] Error scanning for event suggestions:', error);
        });
      });
    } else if (state === 'background') {
      console.log('[App] App went to background - pausing heavy operations');
      trackEvent(AnalyticsEvents.APP_BACKGROUNDED);
    }
  });

  // Initialize app state listeners for stores (battery optimization)
  useEffect(() => {
    console.log('[App] Initializing store app state listeners');
    const initializeAppStateListener = useRelationshipsStore.getState().initializeAppStateListener;
    initializeAppStateListener();

    // Cleanup on unmount (though app layout rarely unmounts)
    return () => {
      const cleanupAppStateListener = useRelationshipsStore.getState().cleanupAppStateListener;
      cleanupAppStateListener();
    };
  }, []);

  // Initialize all notification systems (battery, events, deepening, reflection)
  useEffect(() => {
    const setupNotifications = async () => {
      try {
        // Configure notification handler for event suggestions
        configureNotificationHandler();

        await initializeNotifications();
        console.log('[App] All notification systems initialized');

        // Check if app was launched via notification
        await handleNotificationOnLaunch();
      } catch (error) {
        console.error('[App] Failed to initialize notifications:', error);
      }
    };

    setupNotifications();

    // Setup listener for notification taps while app is running
    const cleanupListener = setupNotificationResponseListener();

    return () => {
      cleanupListener();
    };
  }, []);

  // Initialize background sync on app startup
  useEffect(() => {
    const initBackgroundSync = async () => {
      try {
        // Load settings (will register task if enabled)
        await useBackgroundSyncStore.getState().loadSettings();
        console.log('[App] Background sync settings loaded');
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

  // Handle notification permission request
  const handleRequestNotificationPermission = async () => {
    try {
      const granted = await requestNotificationPermissions();
      await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, 'true');
      setShowNotificationPermissionModal(false);

      if (granted) {
        console.log('[App] Notification permissions granted, initializing notifications');
        await initializeNotifications();
      } else {
        console.log('[App] Notification permissions denied');
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
      console.log('[App] User skipped notification permissions');
    } catch (error) {
      console.error('[App] Error skipping notification permissions:', error);
    }
  };

  // Prevent rendering until the font has loaded or an error was returned
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <PostHogProvider
      apiKey="phc_7zVVcjN8nMJWbw2XgIANio1B7EqNUn4jxWiZZzGActJ"
      options={{ host: 'https://eu.i.posthog.com', enableSessionReplay: true }}
      autocapture
    >
      <PostHogConnector>
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBar style={isDarkMode ? 'light' : 'dark'} />
        {/* Wrap with CardGestureProvider so both Dashboard and Overlay can access it */}
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
                </Animated.View>

                {/* Loading Screen - shows until data is loaded AND UI is mounted */}
                <LoadingScreen visible={fontsLoaded && (!dataLoaded || !uiMounted)} />
              </ErrorBoundary>
            </ToastProvider>
          </QuickWeaveProvider>
        </CardGestureProvider>
        </GestureHandlerRootView>
      </PostHogConnector>
    </PostHogProvider>
  );
});
