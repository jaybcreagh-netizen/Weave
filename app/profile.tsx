/**
 * Profile Screen Route
 * 
 * Thin wrapper for the ProfileScreen component.
 * Gated by ACCOUNTS_ENABLED feature flag.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { FeatureGate } from '@/shared/components/FeatureGate';
import { ProfileScreen } from '@/modules/auth/screens/ProfileScreen';

export default function ProfileRoute() {
    return (
        <FeatureGate
            flag="ACCOUNTS_ENABLED"
            fallback={
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Accounts feature not enabled</Text>
                </View>
            }
        >
            <ProfileScreen />
        </FeatureGate>
    );
}
