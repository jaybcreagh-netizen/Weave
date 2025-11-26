import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

export interface TextProps extends RNTextProps {
    variant?: 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'caption' | 'label' | 'button';
    weight?: 'regular' | 'medium' | 'semibold' | 'bold';
    color?: 'default' | 'muted' | 'primary' | 'secondary' | 'accent' | 'destructive' | 'white';
    align?: 'left' | 'center' | 'right';
    className?: string;
}

export function Text({
    variant = 'body',
    weight = 'regular',
    color = 'default',
    align = 'left',
    className = '',
    style,
    children,
    ...props
}: TextProps) {
    const { colors } = useTheme();

    // Base styles
    let baseStyle = '';

    // Variant styles
    switch (variant) {
        case 'h1':
            baseStyle += " font-['Lora'] text-3xl";
            break;
        case 'h2':
            baseStyle += " font-['Lora'] text-2xl";
            break;
        case 'h3':
            baseStyle += " font-['Lora'] text-xl";
            break;
        case 'h4':
            baseStyle += " font-['Lora'] text-lg";
            break;
        case 'body':
            baseStyle += " font-['Inter'] text-base";
            break;
        case 'caption':
            baseStyle += " font-['Inter'] text-xs";
            break;
        case 'label':
            baseStyle += " font-['Inter'] text-sm uppercase tracking-wide";
            break;
        case 'button':
            baseStyle += " font-['Inter'] text-sm font-semibold";
            break;
    }

    // Weight styles (overrides variant default if specified)
    // Note: Tailwind classes for weight might conflict if not handled carefully, 
    // but here we just append.
    switch (weight) {
        case 'regular':
            baseStyle += ' font-normal';
            break;
        case 'medium':
            baseStyle += ' font-medium';
            break;
        case 'semibold':
            baseStyle += ' font-semibold';
            break;
        case 'bold':
            baseStyle += ' font-bold';
            break;
    }

    // Alignment
    switch (align) {
        case 'center':
            baseStyle += ' text-center';
            break;
        case 'right':
            baseStyle += ' text-right';
            break;
        default:
            baseStyle += ' text-left';
            break;
    }

    // Color styles - using inline styles for dynamic theme colors to be safe, 
    // or we can use tailwind classes if they map to theme.
    // We'll use inline styles for colors to ensure they match the current theme context perfectly.
    const getTextColor = () => {
        switch (color) {
            case 'muted':
                return colors['muted-foreground'];
            case 'primary':
                return colors.primary;
            case 'secondary':
                return colors.secondary;
            case 'accent':
                return colors.accent;
            case 'destructive':
                return colors.destructive;
            case 'white':
                return '#FFFFFF';
            default:
                return colors.foreground;
        }
    };

    return (
        <RNText
            className={`${baseStyle} ${className}`}
            style={[{ color: getTextColor() }, style]}
            {...props}
        >
            {children}
        </RNText>
    );
}
