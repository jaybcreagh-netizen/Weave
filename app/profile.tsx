/**
 * Profile Screen Route
 * 
 * Thin wrapper for the ProfileScreen component.
 * Gated by ACCOUNTS_ENABLED feature flag.
 */

import React from 'react';
import { router } from 'expo-router';
import { FeatureGate } from '@/shared/components/FeatureGate';
import { AccountsDisabledFallback } from '@/modules/auth/components/AccountsDisabledFallback';
import { ProfileScreen } from '@/modules/auth/screens/ProfileScreen';

export default function ProfileRoute() {
    return (
        <FeatureGate
            flag="ACCOUNTS_ENABLED"
            fallback={
                <AccountsDisabledFallback
                    title="Profile syncing is unavailable"
                    description="This build is local-only right now. Your local data is still available."
                    ctaLabel="Back to dashboard"
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
            <ProfileScreen />
        </FeatureGate>
    );
}
