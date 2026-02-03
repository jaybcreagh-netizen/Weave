/**
 * Onboarding Auth Route
 * 
 * Thin wrapper for OnboardingAuthScreen.
 * Shown after onboarding completes, before permissions.
 */

import React from 'react';
import { router } from 'expo-router';
import { FeatureGate } from '@/shared/components/FeatureGate';
import { AccountsDisabledFallback } from '@/modules/auth/components/AccountsDisabledFallback';
import { OnboardingAuthScreen } from '@/modules/auth/screens/OnboardingAuthScreen';

export default function OnboardingAuthRoute() {
    return (
        <FeatureGate
            flag="ACCOUNTS_ENABLED"
            fallback={
                <AccountsDisabledFallback
                    title="Account setup is unavailable"
                    description="This build is running in local-only mode. You can continue with permissions and start using Weave."
                    ctaLabel="Continue setup"
                    onPress={() => router.replace('/permissions')}
                />
            }
        >
            <OnboardingAuthScreen />
        </FeatureGate>
    );
}
