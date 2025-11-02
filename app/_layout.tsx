import '../global.css';
import { Stack, SplashScreen } from 'expo-router';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { TouchableWithoutFeedback, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { QuickWeaveProvider } from '../src/components/QuickWeaveProvider';
import { ToastProvider } from '../src/components/toast_provider';
import { CardGestureProvider } from '../src/context/CardGestureContext'; // Import the provider
import { MilestoneCelebration } from '../src/components/MilestoneCelebration';
import { useUIStore } from '../src/stores/uiStore';
import { initializeDataMigrations, initializeUserProfile, initializeUserProgress } from '../src/db';
import { appStateManager } from '../src/lib/app-state-manager';
import { useAppStateChange } from '../src/hooks/useAppState';
import { useFriendStore } from '../src/stores/friendStore';
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
  const isDarkMode = useUIStore((state) => state.isDarkMode);
  const milestoneCelebrationData = useUIStore((state) => state.milestoneCelebrationData);
  const hideMilestoneCelebration = useUIStore((state) => state.hideMilestoneCelebration);

  const [fontsLoaded, fontError] = useFonts({
    Lora_400Regular,
    Lora_700Bold,
    Inter_400Regular,
    Inter_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide the splash screen after the fonts have loaded or an error occurred
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Run data migrations and initialize user profile on app startup
  useEffect(() => {
    initializeDataMigrations().catch((error) => {
      console.error('Failed to run data migrations:', error);
    });
    initializeUserProfile().catch((error) => {
      console.error('Failed to initialize user profile:', error);
    });
    initializeUserProgress().catch((error) => {
      console.error('Failed to initialize user progress:', error);
    });
  }, []);

  // Monitor app state changes for logging
  useAppStateChange((state) => {
    console.log('[App] State changed to:', state);
    if (state === 'active') {
      console.log('[App] App is active - resuming operations');
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

  // Track user activity globally
  const handleUserActivity = () => {
    appStateManager.recordActivity();
  };

  // Prevent rendering until the font has loaded or an error was returned
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onTouchStart={handleUserActivity}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {/* Wrap with CardGestureProvider so both Dashboard and Overlay can access it */}
      <CardGestureProvider>
        <QuickWeaveProvider>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false }}>
              {/* The Stack navigator will automatically discover all files in the app directory */}
            </Stack>

            {/* Global Milestone Celebration Modal */}
            <MilestoneCelebration
              visible={milestoneCelebrationData !== null}
              milestone={milestoneCelebrationData}
              onClose={hideMilestoneCelebration}
            />
          </ToastProvider>
        </QuickWeaveProvider>
      </CardGestureProvider>
    </GestureHandlerRootView>
  );
}