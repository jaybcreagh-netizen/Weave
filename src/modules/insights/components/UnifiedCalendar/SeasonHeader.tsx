/**
 * SeasonHeader Component
 * Displays the current social season with ambient context
 * Long-press to override season
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { ChevronDown, ChevronUp } from 'lucide-react-native';

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
    const [isExpanded, setIsExpanded] = useState(false);

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

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsExpanded(!isExpanded);
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
                onPress={handlePress}
                onLongPress={handleLongPress}
                delayLongPress={500}
                activeOpacity={0.8}
                className="flex-row items-center px-4 py-3 rounded-xl mb-2"
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

                {/* Expand/Collapse Indicator and Avg Energy */}
                <View className="items-end">
                    {avgEnergy !== undefined && (
                        <>
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
                        </>
                    )}
                    {isExpanded ? (
                        <ChevronUp size={16} color={tokens.foregroundMuted} style={{ marginTop: 4 }} />
                    ) : (
                        <ChevronDown size={16} color={tokens.foregroundMuted} style={{ marginTop: 4 }} />
                    )}
                </View>
            </TouchableOpacity>

            {/* Expanded Pulse Content */}
            {isExpanded && (
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    layout={Layout.springify().damping(20).stiffness(200)}
                    className="px-4 py-3 rounded-xl mb-4"
                    style={{ backgroundColor: tokens.backgroundMuted }}
                >
                    <Text
                        style={{
                            color: tokens.foreground,
                            fontFamily: typography.fonts.sansMedium,
                            fontSize: typography.scale.body.fontSize,
                            marginBottom: 8,
                        }}
                    >
                        What this means for you
                    </Text>
                    <Text
                        style={{
                            color: tokens.foregroundMuted,
                            fontFamily: typography.fonts.sans,
                            fontSize: typography.scale.caption.fontSize,
                            lineHeight: typography.scale.caption.lineHeight * 1.4,
                        }}
                    >
                        {season === 'Resting' && 'Your energy is lower right now. Focus on deep 1:1 connections with your inner circle. Group activities can wait.'}
                        {season === 'Balanced' && 'You\'re in a sustainable rhythm. Great time to maintain existing connections and maybe rekindle one that\'s been quiet.'}
                        {season === 'Blooming' && 'You\'re at peak social energy! Perfect time for group weaves, new introductions, and expanding your community tier.'}
                    </Text>
                    <Text
                        className="mt-3"
                        style={{
                            color: tokens.foregroundMuted,
                            fontFamily: typography.fonts.sans,
                            fontSize: 11,
                            fontStyle: 'italic',
                        }}
                    >
                        Long-press to manually override your season
                    </Text>
                </Animated.View>
            )}

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
