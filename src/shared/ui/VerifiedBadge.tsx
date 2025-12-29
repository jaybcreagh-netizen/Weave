import React from 'react';
import { View } from 'react-native';
import { BadgeCheck } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface VerifiedBadgeProps {
    size?: number;
    color?: string;
}

export function VerifiedBadge({ size = 16, color }: VerifiedBadgeProps) {
    const { colors } = useTheme();
    const badgeColor = color || colors.primary;

    return (
        <View style={{ marginLeft: 4 }}>
            <BadgeCheck size={size} color={badgeColor} fill={badgeColor} />
        </View>
    );
}
