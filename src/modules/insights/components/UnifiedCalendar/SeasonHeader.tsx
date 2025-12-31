/**
 * SeasonHeader Component
 * Displays the current social season with ambient context
 * Long-press to override season
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';

import { useTheme } from '@/shared/hooks/useTheme';
import { useUserProfile } from '@/modules/auth';
import {
    SeasonIcon,
    SeasonOverrideModal,
    getSeasonDisplayName,
    SocialSeasonService,
    type SocialSeason,
} from '@/modules/intelligence';

interface SeasonHeaderProps {
    season: 'Resting' | 'Balanced' | 'Blooming';
    avgEnergy?: number;
}

const SEASON_DESCRIPTIONS = {
    Resting: 'Low energy period · Focus on close 1:1s',
    Balanced: 'Steady energy · Great for maintaining connections',
    Blooming: 'High energy period · Perfect for group weaves',
};

// Season colors - warm earthy tones (no red)
const SEASON_COLORS = {
    Resting: { light: '#9D8CB0', dark: '#A78BFA' },   // Dusty lavender (calm, restful)
    Balanced: { light: '#C9985A', dark: '#D4A855' },  // Aged gold (matches app primary)
    Blooming: { light: '#7D9B76', dark: '#8FBC8F' },  // Sage green (vibrant but calm)
};

export function SeasonHeader({ season, avgEnergy }: SeasonHeaderProps) {
    const { isDarkMode, tokens, typography } = useTheme();
    const { profile } = useUserProfile();
    const [showOverrideModal, setShowOverrideModal] = useState(false);

    // Map to lowercase for service/component compatibility
    const seasonLower = season.toLowerCase() as SocialSeason;

    // Get season-specific color
    const seasonColor = isDarkMode
        ? SEASON_COLORS[season].dark
        : SEASON_COLORS[season].light;

    const handleLongPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowOverrideModal(true);
    };

    const handleSeasonOverride = async (newSeason: SocialSeason, durationDays?: number) => {
        if (!profile) return;
        await SocialSeasonService.updateSeason(profile.id, newSeason, durationDays);
    };

    const hasActiveOverride =
        profile?.seasonOverrideUntil && profile.seasonOverrideUntil > Date.now();

    return (
        <>
            <TouchableOpacity
                onLongPress={handleLongPress}
                delayLongPress={500}
                activeOpacity={0.8}
                className="flex-row items-center px-4 py-3 rounded-xl mb-4"
                style={{ backgroundColor: seasonColor + '15' }}
            >
                {/* Season Icon */}
                <View
                    className="w-12 h-12 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: seasonColor + '25' }}
                >
                    <SeasonIcon season={seasonLower} size={32} color={seasonColor} />
                </View>

                {/* Season Info */}
                <View className="flex-1">
                    <Text
                        className="text-base"
                        style={{
                            color: tokens.foreground,
                            fontFamily: typography.fonts.serifBold,
                            fontSize: typography.scale.h3.fontSize,
                        }}
                    >
                        {getSeasonDisplayName(seasonLower)}
                    </Text>
                    <Text
                        className="text-sm"
                        style={{
                            color: tokens.foregroundMuted,
                            fontFamily: typography.fonts.sans,
                        }}
                    >
                        {SEASON_DESCRIPTIONS[season]}
                    </Text>

                    {/* Override Badge */}
                    {hasActiveOverride && (
                        <View
                            className="flex-row items-center gap-1 mt-1"
                        >
                            <View
                                style={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: seasonColor,
                                }}
                            />
                            <Text
                                style={{
                                    color: seasonColor,
                                    fontFamily: typography.fonts.sansMedium,
                                    fontSize: 11,
                                }}
                            >
                                Override until {format(profile!.seasonOverrideUntil!, 'MMM d')}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Average Energy */}
                {avgEnergy !== undefined && (
                    <View className="items-end">
                        <Text
                            className="text-lg"
                            style={{
                                color: seasonColor,
                                fontFamily: typography.fonts.serifBold,
                            }}
                        >
                            {avgEnergy.toFixed(1)}
                        </Text>
                        <Text
                            className="text-xs"
                            style={{
                                color: tokens.foregroundMuted,
                                fontFamily: typography.fonts.sans,
                            }}
                        >
                            avg
                        </Text>
                    </View>
                )}
            </TouchableOpacity>

            {/* Override Modal */}
            <SeasonOverrideModal
                visible={showOverrideModal}
                onClose={() => setShowOverrideModal(false)}
                currentSeason={seasonLower}
                onSelectSeason={handleSeasonOverride}
            />
        </>
    );
}
