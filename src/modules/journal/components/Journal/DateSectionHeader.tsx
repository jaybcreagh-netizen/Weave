import React from 'react';
import { View } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { useTheme } from '@/shared/hooks/useTheme';

interface DateSectionHeaderProps {
    label: string;
}

export const DateSectionHeader: React.FC<DateSectionHeaderProps> = ({ label }) => {
    const { colors } = useTheme();

    return (
        <View className="flex-row items-center gap-3 py-2 mt-2 mb-1">
            <Text
                variant="caption"
                weight="semibold"
                style={{
                    color: colors['muted-foreground'],
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                }}
            >
                {label}
            </Text>
            <View
                className="flex-1 h-px"
                style={{ backgroundColor: colors.border }}
            />
        </View>
    );
};
