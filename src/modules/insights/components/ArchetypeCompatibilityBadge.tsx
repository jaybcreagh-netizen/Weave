/**
 * Archetype Compatibility Badge
 * 
 * Shows how well two archetypes complement each other
 * for use on linked friend profiles.
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { Text } from '@/shared/ui';
import { useTheme } from '@/shared/hooks/useTheme';
import { Archetype } from '@/shared/types/common';
import { getArchetypeCompatibility, getCompatibilityLabel } from '../services/archetype-compatibility.service';
import { archetypeData } from '@/shared/constants/constants';

interface ArchetypeCompatibilityBadgeProps {
    userArchetype: Archetype;
    friendArchetype: Archetype;
    friendName: string;
    variant?: 'compact' | 'expanded';
    onPress?: () => void;
}

export function ArchetypeCompatibilityBadge({
    userArchetype,
    friendArchetype,
    friendName,
    variant = 'compact',
    onPress,
}: ArchetypeCompatibilityBadgeProps) {
    const { colors } = useTheme();
    const compatibility = getArchetypeCompatibility(userArchetype, friendArchetype);

    const getBackgroundColor = () => {
        switch (compatibility.level) {
            case 'high':
                return colors.primary + '20';
            case 'medium':
                return '#8b5cf6' + '20'; // Keep violet for medium to distinguish from primary/low
            case 'low':
                return colors['muted-foreground'] + '20';
        }
    };

    const getAccentColor = () => {
        switch (compatibility.level) {
            case 'high':
                return colors.primary;
            case 'medium':
                return '#8b5cf6';
            case 'low':
                return colors['muted-foreground'];
        }
    };

    const friendArchetypeInfo = archetypeData[friendArchetype];
    const userArchetypeInfo = archetypeData[userArchetype];

    if (variant === 'compact') {
        const content = (
            <View
                className="flex-row items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ backgroundColor: getBackgroundColor() }}
            >
                <Text style={{ fontSize: 12 }}>{compatibility.emoji}</Text>
                <Text
                    variant="caption"
                    style={{ color: getAccentColor(), fontWeight: '600' }}
                >
                    {getCompatibilityLabel(compatibility.level)}
                </Text>
            </View>
        );

        if (onPress) {
            return (
                <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
                    {content}
                </TouchableOpacity>
            );
        }

        return content;
    }

    // Expanded variant
    const content = (
        <View
            className="p-3 rounded-xl"
            style={{ backgroundColor: getBackgroundColor() }}
        >
            <View className="flex-row items-center gap-2 mb-2">
                <Sparkles size={16} color={getAccentColor()} />
                <Text
                    className="font-semibold"
                    style={{ color: getAccentColor() }}
                >
                    Archetype Compatibility
                </Text>
            </View>

            {/* Archetype icons row */}
            <View className="flex-row items-center justify-center gap-3 mb-2">
                <View className="items-center">
                    <Text style={{ fontSize: 24 }}>{userArchetypeInfo?.icon || '✨'}</Text>
                    <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                        You
                    </Text>
                </View>
                <Text style={{ color: getAccentColor(), fontSize: 18 }}>
                    {compatibility.emoji}
                </Text>
                <View className="items-center">
                    <Text style={{ fontSize: 24 }}>{friendArchetypeInfo?.icon || '✨'}</Text>
                    <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                        {friendName}
                    </Text>
                </View>
            </View>

            <Text
                variant="caption"
                className="text-center"
                style={{ color: colors.foreground }}
            >
                {compatibility.description}
            </Text>
        </View>
    );

    if (onPress) {
        return (
            <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
                {content}
            </TouchableOpacity>
        );
    }

    return content;
}
