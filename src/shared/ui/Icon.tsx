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

    // Determine color: primitive prop > style > default
    // If className is provided with 'text-red-500', NativeWind might pass style={{color}}. 
    // LucideIcon needs 'color' prop usually. 
    // For now, we keep the reliable `color` prop logic, but default to colors.foreground.
    // Ideally we would inspect className or rely on style injection.
    // To support `text-primary` via className, we might need `cssInterop`.
    // Without `cssInterop`, we trust the user to pass `color` OR `className` that works.
    // But existing calls use `color`.

    return (
        <IconComponent
            size={size}
            // If color prop is missing, use theme foreground. 
            // This prevents className text-color from working if Lucide ignores style color.
            // But we must maintain backward compat.
            color={color || colors.foreground}
            strokeWidth={strokeWidth}
            className={className}
        />
    );
}
