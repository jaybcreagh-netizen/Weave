import React from 'react';
import { router } from 'expo-router';
import { FeatureGate } from '@/shared/components/FeatureGate';
import { AccountsDisabledFallback } from '@/modules/auth/components/AccountsDisabledFallback';
import { PhoneAuthScreen } from '@/modules/auth/screens/PhoneAuthScreen';

export default function PhoneAuthRoute() {
    return (
        <FeatureGate
            flag="ACCOUNTS_ENABLED"
            fallback={
                <AccountsDisabledFallback
                    title="Phone auth is unavailable"
                    description="Account features are disabled in this build. You can keep using Weave offline."
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
            <PhoneAuthScreen />
        </FeatureGate>
    );
}
