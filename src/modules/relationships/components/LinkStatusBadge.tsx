/**
 * Link Status Badge
 * 
 * Shows the linking status of a friend and provides action buttons
 * for linking/unlinking Weave users.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Link, Check, Clock, X, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Text } from '@/shared/ui';
import { useTheme } from '@/shared/hooks/useTheme';
import FriendModel from '@/db/models/Friend';
import { FeatureFlags } from '@/shared/config/feature-flags';

interface LinkStatusBadgeProps {
    friend: FriendModel;
    onLinkPress?: () => void;
    onUnlinkPress?: () => void;
}

export function LinkStatusBadge({ friend, onLinkPress, onUnlinkPress }: LinkStatusBadgeProps) {
    const { colors } = useTheme();

    // Don't show if accounts aren't enabled
    if (!FeatureFlags.ACCOUNTS_ENABLED) return null;

    const { linkStatus, linkedUserId } = friend;

    // Already linked - show linked badge (clickable if unlink handler provided)
    if (linkStatus === 'linked' && linkedUserId) {
        if (onUnlinkPress) {
            return (
                <TouchableOpacity
                    className="flex-row items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: colors.primary + '20' }}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onUnlinkPress();
                    }}
                >
                    <Check size={16} color={colors.primary} />
                    <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                        Linked Weave User
                    </Text>
                </TouchableOpacity>
            );
        }

        return (
            <View
                className="flex-row items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.primary + '20' }}
            >
                <Check size={16} color={colors.primary} />
                <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                    Linked Weave User
                </Text>
            </View>
        );
    }

    // Pending sent - show waiting badge
    if (linkStatus === 'pending_sent') {
        return (
            <View
                className="flex-row items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.muted }}
            >
                <Clock size={16} color={colors['muted-foreground']} />
                <Text className="text-sm" style={{ color: colors['muted-foreground'] }}>
                    Link request pending...
                </Text>
            </View>
        );
    }

    // Pending received - show accept/decline
    if (linkStatus === 'pending_received') {
        return (
            <View
                className="flex-row items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: colors.primary + '20' }}
            >
                <UserPlus size={16} color={colors.primary} />
                <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                    Wants to link with you
                </Text>
            </View>
        );
    }

    // Not linked - show link button
    return (
        <TouchableOpacity
            className="flex-row items-center gap-2 px-3 py-2 rounded-lg"
            style={{ backgroundColor: colors.muted }}
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onLinkPress?.();
            }}
        >
            <Link size={16} color={colors.primary} />
            <Text className="text-sm font-medium" style={{ color: colors.primary }}>
                Link to Weave User
            </Text>
        </TouchableOpacity>
    );
}
