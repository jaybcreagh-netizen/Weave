import React from 'react';
import { View, Text } from 'react-native';
import { FeatureGate } from '@/shared/components/FeatureGate';
import { PhoneAuthScreen } from '@/modules/auth/screens/PhoneAuthScreen';

export default function PhoneAuthRoute() {
    return (
        <FeatureGate
            flag="ACCOUNTS_ENABLED"
            fallback={
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text>Accounts feature not enabled</Text>
                </View>
            }
        >
            <PhoneAuthScreen />
        </FeatureGate>
    );
}
