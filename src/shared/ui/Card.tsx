import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

export interface CardProps extends ViewProps {
    variant?: 'default' | 'outlined' | 'ghost';
    padding?: 'none' | 'sm' | 'md' | 'lg';
    className?: string;
}

export function Card({
    variant = 'default',
    padding = 'md',
    className = '',
    style,
    children,
    ...props
}: CardProps) {
    const { colors } = useTheme();

    // Base styles
    let baseStyle = 'rounded-2xl overflow-hidden';

    // Padding
    switch (padding) {
        case 'sm':
            baseStyle += ' p-3';
            break;
        case 'md':
            baseStyle += ' p-4';
            break;
        case 'lg':
            baseStyle += ' p-6';
            break;
    }

    // Variant styles
    const getVariantStyles = () => {
        switch (variant) {
            case 'default':
                return {
                    backgroundColor: colors.card,
                    // Add shadow if needed, but keeping it simple for now
                };
            case 'outlined':
                return {
                    backgroundColor: 'transparent',
                    borderColor: colors.border,
                    borderWidth: 1,
                };
            case 'ghost':
                return {
                    backgroundColor: 'transparent',
                };
            default:
                return {};
        }
    };

    return (
        <View
            className={`${baseStyle} ${className}`}
            style={[getVariantStyles(), style]}
            {...props}
        >
            {children}
        </View>
    );
}
