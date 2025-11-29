import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';

interface ButtonProps {
    label: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'ghost';
    size?: 'default' | 'small';
    disabled?: boolean;
    loading?: boolean;
    style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
    label,
    onPress,
    variant = 'primary',
    size = 'default',
    disabled = false,
    loading = false,
    style,
}) => {
    const { tokens, typography, radius, spacing } = useTheme();

    const handlePress = () => {
        if (disabled || loading) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
    };

    const getBackgroundColor = () => {
        if (disabled) return tokens.secondary;
        switch (variant) {
            case 'primary': return tokens.primary;
            case 'secondary': return tokens.secondary;
            case 'ghost': return 'transparent';
        }
    };

    const getTextColor = () => {
        if (disabled) return tokens.foregroundMuted;
        switch (variant) {
            case 'primary': return tokens.primaryForeground;
            case 'secondary': return tokens.secondaryForeground;
            case 'ghost': return tokens.primary;
        }
    };

    const paddingVertical = size === 'default' ? spacing[3] : spacing[2];
    const paddingHorizontal = size === 'default' ? spacing[4] : spacing[3];

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={disabled ? 1 : 0.7}
            style={[
                styles.base,
                {
                    backgroundColor: getBackgroundColor(),
                    borderRadius: radius.sm,
                    paddingVertical,
                    paddingHorizontal,
                },
                variant === 'ghost' && { paddingHorizontal: 0 },
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator size="small" color={getTextColor()} />
            ) : (
                <Text style={[
                    {
                        color: getTextColor(),
                        fontSize: typography.scale.label.fontSize,
                        lineHeight: typography.scale.label.lineHeight,
                        fontFamily: typography.fonts.sansSemiBold,
                        textAlign: 'center',
                    }
                ]}>
                    {label}
                </Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        alignItems: 'center',
        justifyContent: 'center',
    },
});
