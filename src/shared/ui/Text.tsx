import React from 'react';
import { Text as RNText, TextProps as RNTextProps } from 'react-native';


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
    // Map variants to Tailwind classes
    const variantClasses = {
        h1: 'font-serif text-h1',
        h2: 'font-serif text-h2',
        h3: 'font-serif text-h3',
        h4: 'font-serif text-h4', // fallback if h4 not in config, but assuming h4 exists or use h3
        body: 'font-sans text-body',
        caption: 'font-sans text-caption',
        label: 'font-sans text-label uppercase tracking-wide',
        button: 'font-sans-medium text-sm',
    };

    // Map weights
    // Note: Tailwind config has font-family specific weights (e.g. font-serif-bold).
    // Standard font-bold sets fontWeight: '700'.
    const getWeightClass = () => {
        // If variant is a heading (serif), handle bold/regular
        const isHeading = ['h1', 'h2', 'h3', 'h4'].includes(variant);

        switch (weight) {
            case 'regular': return 'font-normal';
            case 'medium': return 'font-medium'; // might need font-sans-medium
            case 'semibold': return 'font-semibold'; // might need font-sans-semibold
            case 'bold':
                return isHeading ? 'font-serif-bold' : 'font-bold';
            default: return '';
        }
    };

    // Map colors
    const colorClasses = {
        default: 'text-foreground',
        muted: 'text-muted-foreground',
        primary: 'text-primary',
        secondary: 'text-secondary',
        accent: 'text-primary-muted', // Mapping 'accent' to primary-muted based on legacy keys or similar
        destructive: 'text-destructive',
        white: 'text-white',
    };

    // Map alignment
    const alignClass = `text-${align}`;

    // Combine classes
    // Note: We use specific checks to robustly map props to classes
    const finalClass = [
        variantClasses[variant] || 'font-sans text-body',
        getWeightClass(),
        colorClasses[color] || 'text-foreground',
        alignClass,
        className
    ].filter(Boolean).join(' ');

    return (
        <RNText
            className={finalClass}
            style={style}
            {...props}
        >
            {children}
        </RNText>
    );
}
