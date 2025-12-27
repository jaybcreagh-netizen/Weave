/**
 * Auth Screen Route
 * 
 * Thin wrapper for the AuthScreen component.
 * Gated by ACCOUNTS_ENABLED feature flag.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { FeatureGate } from '@/shared/components/FeatureGate';
import { AuthScreen } from '@/modules/auth/screens/AuthScreen';

export default function AuthRoute() {
    return (
        <FeatureGate
            flag="ACCOUNTS_ENABLED"
            fallback={
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Accounts feature not enabled</Text>
                </View>
            }
        >
            <AuthScreen />
        </FeatureGate>
    );
}
