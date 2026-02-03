/**
 * Auth Screen Route
 * 
 * Thin wrapper for the OnboardingAuthScreen component.
 * Gated by ACCOUNTS_ENABLED feature flag.
 */

import React from 'react';
import { router } from 'expo-router';
import { FeatureGate } from '@/shared/components/FeatureGate';
import { AccountsDisabledFallback } from '@/modules/auth/components/AccountsDisabledFallback';
import { OnboardingAuthScreen } from '@/modules/auth/screens/OnboardingAuthScreen';

export default function AuthRoute() {
    return (
        <FeatureGate
            flag="ACCOUNTS_ENABLED"
            fallback={
                <AccountsDisabledFallback
                    title="Accounts are currently disabled"
                    description="This build is in local-only mode. You can return to settings and continue without sign-in."
                    ctaLabel="Go back"
                    onPress={() => {
                        if (router.canGoBack()) {
                            router.back();
                            return;
                        }
                        router.replace('/dashboard');
                    }}
                />
            }
        >
            <OnboardingAuthScreen source="settings" />
        </FeatureGate>
    );
}
