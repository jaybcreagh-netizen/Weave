import React from 'react';
import { View, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface CardProps {
    children: React.ReactNode;
    variant?: 'default' | 'elevated' | 'interactive';
    padding?: 'default' | 'large' | 'none';
    onPress?: () => void;
    style?: StyleProp<ViewStyle>;
}

export const Card: React.FC<CardProps> = ({
    children,
    variant = 'default',
    padding = 'default',
    onPress,
    style,
}) => {
    const { tokens, layout, radius, shadows } = useTheme();

    const containerStyle: StyleProp<ViewStyle> = [
        styles.base,
        {
            backgroundColor: tokens.card.background,
            borderColor: tokens.card.border,
            borderRadius: radius.lg,
        },
        padding === 'default' && { padding: layout.cardPadding },
        padding === 'large' && { padding: layout.cardPaddingLarge },
        padding === 'none' && { padding: 0 },
        variant === 'elevated' && {
            ...shadows.md,
            shadowColor: tokens.shadow.color,
            shadowOpacity: tokens.shadow.opacity.md,
        },
        variant === 'interactive' && {
            ...shadows.md,
            shadowColor: tokens.shadow.color,
            shadowOpacity: tokens.shadow.opacity.md,
        },
        style,
    ];

    if (onPress || variant === 'interactive') {
        return (
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.7}
                style={containerStyle}
            >
                {children}
            </TouchableOpacity>
        );
    }

    return <View style={containerStyle}>{children}</View>;
};

const styles = StyleSheet.create({
    base: {
        borderWidth: 1,
        overflow: 'hidden',
    },
});
