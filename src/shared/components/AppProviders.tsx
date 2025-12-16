import React, { ReactNode } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { PortalProvider } from '@gorhom/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';

import { QuickWeaveProvider } from '@/shared/components/QuickWeaveProvider';
import { ToastProvider } from '@/shared/components/toast_provider';
import { CardGestureProvider } from '@/shared/context/CardGestureContext';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { PostHogProvider, POSTHOG_API_KEY, posthogOptions } from '@/shared/services/posthog.service';
import { useUIStore } from '@/shared/stores/uiStore';
import { useTheme } from '@/shared/hooks/useTheme';
import { AuthProvider } from '@/modules/auth/context/AuthContext';
import { SyncConflictProvider } from '@/modules/auth/context/SyncConflictContext';

import { queryClient } from '@/shared/api/query-client';

// Initialize Sentry
Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    sendDefaultPii: false,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],
});

interface AppProvidersProps {
    children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
    const isDarkMode = useUIStore((state) => state.isDarkMode);
    const { colors } = useTheme();

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
                <AuthProvider>
                    <SyncConflictProvider>
                        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
                            <StatusBar style={isDarkMode ? 'light' : 'dark'} />
                            <PortalProvider>
                                <CardGestureProvider>
                                    <QuickWeaveProvider>
                                        <ToastProvider>
                                            <ErrorBoundary
                                                onError={(error, errorInfo) => {
                                                    console.error('[App] Global error caught:', error);
                                                    console.error('[App] Error info:', errorInfo);
                                                    Sentry.captureException(error);
                                                }}
                                            >
                                                {children}
                                            </ErrorBoundary>
                                        </ToastProvider>
                                    </QuickWeaveProvider>
                                </CardGestureProvider>
                            </PortalProvider>
                        </GestureHandlerRootView>
                    </SyncConflictProvider>
                </AuthProvider>
            </PostHogProvider>
        </QueryClientProvider>
    );
}
