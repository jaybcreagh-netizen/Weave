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

import { useTheme } from '@/shared/hooks/useTheme';
import { AuthProvider } from '@/modules/auth/context/AuthContext';
import { SyncConflictProvider } from '@/modules/auth/context/SyncConflictContext';
import { GlobalUIProvider } from '@/shared/context/GlobalUIContext';
import { TutorialProvider } from '@/shared/context/TutorialContext';

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


function ThemedRoot({ children }: { children: ReactNode }) {
    const { colors } = useTheme();
    // We can access global UI here if needed, or theme handles it.
    // Assuming useTheme() uses useGlobalUI() internally now.

    // We need to access isDarkMode for StatusBar. 
    // Ideally useTheme returns isDark too.
    const { isDark } = useTheme();

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar style={isDark ? 'light' : 'dark'} />
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
    );
}

export function AppProviders({ children }: AppProvidersProps) {
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
                        <TutorialProvider>
                            <GlobalUIProvider>
                                <ThemedRoot>
                                    {children}
                                </ThemedRoot>
                            </GlobalUIProvider>
                        </TutorialProvider>
                    </SyncConflictProvider>
                </AuthProvider>
            </PostHogProvider >
        </QueryClientProvider >
    );
}
