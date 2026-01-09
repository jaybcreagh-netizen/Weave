import React, { ReactNode, useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { PortalProvider } from '@gorhom/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import * as Sentry from '@sentry/react-native';

import { QuickWeaveProvider } from '@/shared/components/QuickWeaveProvider';
import { ToastProvider } from '@/shared/components/toast_provider';
import { CardGestureProvider } from '@/shared/context/CardGestureContext';
import { FriendsObservableProvider } from '@/shared/context/FriendsObservableContext';
import { InteractionObservableProvider } from '@/shared/context/InteractionObservableContext';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { PostHogProvider, POSTHOG_API_KEY, posthogOptions } from '@/shared/services/posthog.service';
import { useUIStore } from '@/shared/stores/uiStore';
import { useTheme } from '@/shared/hooks/useTheme';
import { AuthProvider } from '@/modules/auth';
import { SyncConflictProvider } from '@/modules/auth';
import { RealtimeProvider } from '@/shared/components/RealtimeProvider';
import { runExpirationCheckOnStartup } from '@/modules/sync';

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

    // Run shared weave expiration check on app startup
    useEffect(() => {
        runExpirationCheckOnStartup();
    }, []);

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
                    <RealtimeProvider>
                        <SyncConflictProvider>
                            <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
                                <StatusBar style={isDarkMode ? 'light' : 'dark'} />
                                <PortalProvider>
                                    <FriendsObservableProvider>
                                        <InteractionObservableProvider>
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
                                        </InteractionObservableProvider>
                                    </FriendsObservableProvider>
                                </PortalProvider>
                            </GestureHandlerRootView>
                        </SyncConflictProvider>
                    </RealtimeProvider>
                </AuthProvider>
            </PostHogProvider>
        </QueryClientProvider>
    );
}
