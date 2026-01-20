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

    // Map variant to classes
    const variantClasses = {
        default: '', // Background handled via style for dark mode support
        outlined: 'bg-transparent border border-border',
        ghost: 'bg-transparent',
    };

    // Map padding
    const paddingClasses = {
        none: 'p-0',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
    };

    const finalClass = [
        'rounded-2xl overflow-hidden',
        variantClasses[variant],
        paddingClasses[padding],
        className
    ].filter(Boolean).join(' ');

    // Add shadow/elevation only for default variant
    const elevationStyle = variant === 'default'
        ? {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 3, // Android elevation
            backgroundColor: colors.card,
        }
        : {};

    return (
        <View
            className={finalClass}
            style={[elevationStyle, style]}
            {...props}
        >
            {children}
        </View>
    );
}
