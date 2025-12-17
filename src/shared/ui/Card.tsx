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

    const dynamicStyle = variant === 'default'
        ? { backgroundColor: colors.card }
        : {};

    return (
        <View
            className={finalClass}
            style={[dynamicStyle, style]}
            {...props}
        >
            {children}
        </View>
    );
}
