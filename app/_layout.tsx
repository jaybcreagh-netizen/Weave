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
import { LoadingScreen } from '../src/components/LoadingScreen';
import { useUIStore } from '../src/stores/uiStore';
import { useTheme } from '../src/hooks/useTheme';
import { initializeDataMigrations, initializeUserProfile, initializeUserProgress } from '../src/db';
import { appStateManager } from '../src/lib/app-state-manager';
import { useAppStateChange } from '../src/hooks/useAppState';
import { useFriendStore } from '../src/stores/friendStore';
import { initializeNotifications } from '../src/lib/notification-manager-enhanced';
import {
  setupNotificationResponseListener,
  handleNotificationOnLaunch,
} from '../src/lib/notification-response-handler';
import {
  useFonts,
  Lora_400Regular,
  Lora_700Bold,
} from '@expo-google-fonts/lora';
import {
  Inter_400Regular,
  Inter_600SemiBold,
} from '@expo-google-fonts/inter';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { colors } = useTheme();
  const isDarkMode = useUIStore((state) => state.isDarkMode);
  const milestoneCelebrationData = useUIStore((state) => state.milestoneCelebrationData);
  const hideMilestoneCelebration = useUIStore((state) => state.hideMilestoneCelebration);
  const isTrophyCabinetOpen = useUIStore((state) => state.isTrophyCabinetOpen);
  const closeTrophyCabinet = useUIStore((state) => state.closeTrophyCabinet);

  const [fontsLoaded, fontError] = useFonts({
    Lora_400Regular,
    Lora_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  const [dataLoaded, setDataLoaded] = useState(false);
  const [uiMounted, setUiMounted] = useState(false);

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
        setDataLoaded(true);
      } catch (error) {
        console.error('Failed to initialize app data:', error);
        setDataLoaded(true); // Still mark as loaded to prevent infinite loading
      }
    };

    initializeData();
  }, []);

  // Wait for friends to be loaded before marking UI as mounted
  useEffect(() => {
    if (!dataLoaded) return;

    const checkFriendsLoaded = () => {
      const friends = useFriendStore.getState().friends;
      // Mark UI as mounted once we have friends data (even if empty)
      // Give a small delay to ensure lists are rendered
      if (friends !== null) {
        setTimeout(() => {
          setUiMounted(true);
        }, 300); // Small delay to ensure UI is painted
      }
    };

    // Subscribe to friend store
    const unsubscribe = useFriendStore.subscribe(checkFriendsLoaded);
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

      // Trigger smart notification evaluation when app comes to foreground
      // This runs async in the background without blocking the UI
      import('../src/lib/smart-notification-scheduler').then(({ evaluateAndScheduleSmartNotifications }) => {
        evaluateAndScheduleSmartNotifications().catch((error) => {
          console.error('[App] Error evaluating smart notifications on foreground:', error);
        });
      });
    } else if (state === 'background') {
      console.log('[App] App went to background - pausing heavy operations');
    }
  });

  // Initialize app state listeners for stores (battery optimization)
  useEffect(() => {
    console.log('[App] Initializing store app state listeners');
    const initializeAppStateListener = useFriendStore.getState().initializeAppStateListener;
    initializeAppStateListener();

    // Cleanup on unmount (though app layout rarely unmounts)
    return () => {
      const cleanupAppStateListener = useFriendStore.getState().cleanupAppStateListener;
      cleanupAppStateListener();
    };
  }, []);

  // Initialize all notification systems (battery, events, deepening, reflection)
  useEffect(() => {
    const setupNotifications = async () => {
      try {
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

  // Track user activity globally
  const handleUserActivity = () => {
    appStateManager.recordActivity();
  };

  // Prevent rendering until the font has loaded or an error was returned
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }} onTouchStart={handleUserActivity}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {/* Wrap with CardGestureProvider so both Dashboard and Overlay can access it */}
      <CardGestureProvider>
        <QuickWeaveProvider>
          <ToastProvider>
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
            </Animated.View>

            {/* Loading Screen - shows until data is loaded AND UI is mounted */}
            <LoadingScreen visible={fontsLoaded && (!dataLoaded || !uiMounted)} />
          </ToastProvider>
        </QuickWeaveProvider>
      </CardGestureProvider>
    </GestureHandlerRootView>
  );
}