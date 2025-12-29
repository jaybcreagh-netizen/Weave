/**
 * ShareStatusBadge
 * 
 * Badge component showing share status on interaction cards.
 * Uses Lucide icons with status-appropriate colors.
 */

import React from 'react';
import { View } from 'react-native';
import { Link, Check, X, Clock } from 'lucide-react-native';

import { useTheme } from '@/shared/hooks/useTheme';

type ShareStatus = 'pending' | 'accepted' | 'declined' | 'expired';

interface ShareStatusBadgeProps {
    status: ShareStatus;
    size?: 'small' | 'medium';
}

export function ShareStatusBadge({ status, size = 'small' }: ShareStatusBadgeProps) {
    const { colors } = useTheme();

    const iconSize = size === 'small' ? 12 : 16;
    const badgeSize = size === 'small' ? 'w-5 h-5' : 'w-7 h-7';

    const getStatusConfig = () => {
        switch (status) {
            case 'pending':
                return {
                    Icon: Clock,
                    bgColor: colors.accent,
                    iconColor: colors['accent-foreground'],
                };
            case 'accepted':
                return {
                    Icon: Check,
                    bgColor: colors.primary,
                    iconColor: colors['primary-foreground'],
                };
            case 'declined':
                return {
                    Icon: X,
                    bgColor: colors.destructive + '80',
                    iconColor: colors['destructive-foreground'],
                };
            case 'expired':
                return {
                    Icon: Clock,
                    bgColor: colors.muted,
                    iconColor: colors['muted-foreground'],
                };
            default:
                return {
                    Icon: Link,
                    bgColor: colors.muted,
                    iconColor: colors['muted-foreground'],
                };
        }
    };

    const { Icon, bgColor, iconColor } = getStatusConfig();

    return (
        <View
            className={`${badgeSize} rounded-full items-center justify-center`}
            style={{ backgroundColor: bgColor }}
        >
            <Icon size={iconSize} color={iconColor} />
        </View>
    );
}
