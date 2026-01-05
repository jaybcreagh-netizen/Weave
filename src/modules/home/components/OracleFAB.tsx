import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeaveIcon } from '@/shared/components/WeaveIcon';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';

import { useOracleSheet } from '@/modules/oracle/hooks/useOracleSheet';

export function OracleFAB() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors, isDarkMode } = useTheme();
    const { open } = useOracleSheet();

    return (
        <TouchableOpacity
            style={{
                position: 'absolute',
                left: 20,
                bottom: insets.bottom + 20,
                width: 52,
                height: 52,
                borderRadius: 26,
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
                backgroundColor: isDarkMode ? colors.accent : colors.primary + '33',
                shadowColor: isDarkMode ? colors.accent : '#000',
                shadowOffset: { width: 0, height: 5 },
                shadowOpacity: 0.22,
                shadowRadius: 6,
                elevation: 10,
            }}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                open({ context: 'insights' });
            }}
            activeOpacity={0.8}
        >
            <WeaveIcon size={24} color={colors.foreground} />
        </TouchableOpacity>
    );
}
