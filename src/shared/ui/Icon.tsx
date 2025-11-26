import React from 'react';
import { LucideIcon, icons } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

export interface IconProps {
    name: keyof typeof icons;
    size?: number;
    color?: string;
    className?: string;
    strokeWidth?: number;
}

export function Icon({
    name,
    size = 24,
    color,
    className,
    strokeWidth = 2,
}: IconProps) {
    const { colors } = useTheme();

    const IconComponent = icons[name] as LucideIcon;

    if (!IconComponent) {
        console.warn(`Icon "${name}" not found in lucide-react-native`);
        return null;
    }

    return (
        <IconComponent
            size={size}
            color={color || colors.foreground}
            strokeWidth={strokeWidth}
            className={className}
        />
    );
}
