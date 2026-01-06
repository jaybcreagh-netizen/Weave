import 'react-native-get-random-values';
import '../global.css';
import { Stack } from 'expo-router';
import React from 'react';

import { AppProviders } from '@/shared/components/AppProviders';
import { DataInitializer } from '@/shared/components/DataInitializer';
import { NotificationManager } from '@/shared/components/NotificationManager';
import { GlobalModals } from '@/shared/components/GlobalModals';
import { PerfLogger } from '@/shared/utils/performance-logger';

/**
 * The root layout component for the application.
 * Refactored to use composed components for better maintainability.
 */
export default function RootLayout() {
  React.useEffect(() => {
    PerfLogger.log('App', 'RootLayout Mounted');
  }, []);

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
