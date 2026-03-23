import React from 'react';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeaveIcon } from '@/shared/components/WeaveIcon';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';

import { useOracleSheet, OracleContext, OracleSheetParams } from '@/modules/oracle/hooks/useOracleSheet';
import { PerfLogger } from '@/shared/utils/performance-logger';

interface OracleFABProps {
    context?: OracleContext
    params?: Omit<OracleSheetParams, 'context'>
}

export function OracleFAB({ context = 'circle', params }: OracleFABProps) {
    const insets = useSafeAreaInsets();
    const { colors, isDarkMode } = useTheme();
    const { open, canOpen } = useOracleSheet();

    if (!canOpen) {
        return null;
    }

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
                borderWidth: 1,
                borderColor: colors.border,
                shadowColor: isDarkMode ? colors.accent : '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.25,
                shadowRadius: 3.84,
                elevation: 0,
            }}
            onPress={() => {
                PerfLogger.log('Oracle', 'FAB Pressed');
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                open({ context, ...params });
            }}
            activeOpacity={0.8}
        >
            <WeaveIcon size={24} color={colors.foreground} />
        </TouchableOpacity>
    );
}
