/**
 * Onboarding Auth Route
 * 
 * Thin wrapper for OnboardingAuthScreen.
 * Shown after onboarding completes, before permissions.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { FeatureGate } from '@/shared/components/FeatureGate';
import { OnboardingAuthScreen } from '@/modules/auth/screens/OnboardingAuthScreen';

export default function OnboardingAuthRoute() {
    return (
        <FeatureGate
            flag="ACCOUNTS_ENABLED"
            fallback={
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Accounts feature not enabled</Text>
                </View>
            }
        >
            <OnboardingAuthScreen />
        </FeatureGate>
    );
}
