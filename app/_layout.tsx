import '../global.css';
import { Stack, SplashScreen } from 'expo-router';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { QuickWeaveProvider } from '../src/components/QuickWeaveProvider';
import { ToastProvider } from '../src/components/toast_provider';
import { CardGestureProvider } from '../src/context/CardGestureContext'; // Import the provider
import { useUIStore } from '../src/stores/uiStore';
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

  // Prevent rendering until the font has loaded or an error was returned
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      {/* Wrap with CardGestureProvider so both Dashboard and Overlay can access it */}
      <CardGestureProvider>
        <QuickWeaveProvider>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false }}>
              {/* The Stack navigator will automatically discover all files in the app directory */}
            </Stack>
          </ToastProvider>
        </QuickWeaveProvider>
      </CardGestureProvider>
    </GestureHandlerRootView>
  );
}