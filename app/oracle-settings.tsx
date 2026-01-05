import React from 'react';
import { Stack } from 'expo-router';
import { useTheme } from '@/shared/hooks/useTheme';
import { OracleInsightSettings } from '@/modules/oracle/components/OracleInsightSettings';

export default function OracleSettingsScreen() {
    const { colors } = useTheme();

    return (
        <>
            <Stack.Screen options={{
                title: 'Oracle Settings',
                headerBackTitle: 'Back',
                headerStyle: { backgroundColor: colors.background },
                headerTintColor: colors.foreground,
            }} />
            <OracleInsightSettings />
        </>
    );
}
