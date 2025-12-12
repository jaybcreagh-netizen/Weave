import 'react-native-get-random-values';
import '../global.css';
import { Stack } from 'expo-router';
import React from 'react';

import { AppProviders } from '@/components/AppProviders';
import { DataInitializer } from '@/components/DataInitializer';
import { NotificationManager } from '@/components/NotificationManager';
import { GlobalModals } from '@/components/GlobalModals';

/**
 * The root layout component for the application.
 * Refactored to use composed components for better maintainability.
 */
export default function RootLayout() {
  return (
    <AppProviders>
      <DataInitializer>
        <Stack screenOptions={{ headerShown: false }}>
          {/* The Stack navigator will automatically discover all files in the app directory */}
        </Stack>

        {/* Managers and Global UI Elements */}
        <NotificationManager />
        <GlobalModals />
      </DataInitializer>
    </AppProviders>
  );
}
