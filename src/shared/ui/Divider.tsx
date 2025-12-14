import React from 'react';
import { View } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface DividerProps {
    variant?: 'default' | 'subtle';
    spacing?: number;
}

export const Divider: React.FC<DividerProps> = ({
    variant = 'default',
    spacing: spacingProp,
}) => {
    const { tokens, spacing } = useTheme();

    const marginVertical = spacingProp ?? spacing[3];
    const color = variant === 'subtle' ? tokens.borderSubtle : tokens.border;

    return (
        <View style={{
            height: 1,
            backgroundColor: color,
            marginVertical,
        }} />
    );
};
