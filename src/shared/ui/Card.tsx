import React from 'react';
import { View, ViewProps } from 'react-native';


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
    // Map variant to classes
    const variantClasses = {
        default: 'bg-card', // Shadow usually handled via style/elevation or shadow-* classes. NativeWind shadow classes work on iOS.
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

    return (
        <View
            className={finalClass}
            style={style}
            {...props}
        >
            {children}
        </View>
    );
}
