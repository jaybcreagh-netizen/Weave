import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { useUserProfile, useSocialBatteryStats } from '@/modules/auth';
import { useInteractions } from '@/modules/interactions';
import {
    calculateSocialSeason,
    calculateSeasonContext,
    getSeasonGreeting,
    getSeasonDisplayName,
    calculateWeightedNetworkHealth,
    calculateCurrentScore,
    type SocialSeason,
    type SeasonCalculationInput,
    type SeasonExplanationData,
    logNetworkHealth,
    SocialSeasonService
} from '@/modules/intelligence';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import withObservables from '@nozbe/with-observables';
import { startOfDay, subDays, format } from 'date-fns';
import { SeasonIcon, PulseSheet, SeasonOverrideModal } from '@/modules/intelligence';
import { useDashboardCacheStore } from '@/shared/stores/dashboardCacheStore';

const WIDGET_CONFIG: HomeWidgetConfig = {
    id: 'social-season',
    type: 'social-season',
    title: 'Your Season',
    minHeight: 120,
    fullWidth: true,
};

interface SocialSeasonWidgetProps {
    friends: FriendModel[];
}

const SocialSeasonWidgetContent: React.FC<SocialSeasonWidgetProps> = ({ friends }) => {
    const { tokens, typography } = useTheme();
    const { profile } = useUserProfile();
    const { data: batteryStats = { average: 50, trend: 'stable' } } = useSocialBatteryStats();
    const { allInteractions } = useInteractions();

    // Get cached values from Zustand store
    const cache = useDashboardCacheStore((state) => state.socialSeasonCache);
    const isCacheStale = useDashboardCacheStore((state) => state.isSocialSeasonStale);
    const setCache = useDashboardCacheStore((state) => state.setSocialSeasonCache);

    // Initialize state from cache (instant display, no loading flicker)
    const [isCalculating, setIsCalculating] = useState(false);
    const [season, setSeason] = useState<SocialSeason>(cache.season);
    const [seasonData, setSeasonData] = useState<SeasonExplanationData | null>(cache.seasonData);
    const [showDetailSheet, setShowDetailSheet] = useState(false);
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [weeklyWeaves, setWeeklyWeaves] = useState(cache.weeklyWeaves);
    const [currentStreak, setCurrentStreak] = useState(cache.currentStreak);
    const [networkHealth, setNetworkHealth] = useState(cache.networkHealth);

    // Track previous dependency values to detect significant changes
    const prevDepsRef = useRef({ interactionCount: 0, friendCount: 0 });

    // Logic ported from V1
    const calculateActivityStats = async () => {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentDayOfWeek = today.getDay();
            const daysFromMonday = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
            const monday = new Date(today);
            monday.setDate(today.getDate() - daysFromMonday);
            monday.setHours(0, 0, 0, 0);

            let weaveCount = 0;
            const knots: boolean[] = [];

            for (let i = 0; i < 7; i++) {
                const dayDate = new Date(monday);
                dayDate.setDate(monday.getDate() + i);
                const dayStart = dayDate.getTime();
                const dayEnd = dayStart + 24 * 60 * 60 * 1000;

                const completedWeaves = await database
                    .get<Interaction>('interactions')
                    .query(
                        Q.where('status', 'completed'),
                        Q.where('interaction_date', Q.gte(dayStart)),
                        Q.where('interaction_date', Q.lt(dayEnd))
                    )
                    .fetchCount();
                weaveCount += completedWeaves;
                knots.push(completedWeaves > 0);
            }
            setWeeklyWeaves(weaveCount);

            // Simple streak calculation (consecutive days with activity backwards from today)
            let streak = 0;
            const todayIndex = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
            for (let i = todayIndex; i >= 0; i--) {
                if (knots[i]) streak++;
                else break;
            }
            setCurrentStreak(streak);
            setNetworkHealth(calculateWeightedNetworkHealth(friends));
        } catch (error) {
            console.error('Error calculating activity stats:', error);
        }
    };

    const calculateAndUpdateSeason = async () => {
        if (!profile || friends.length === 0) return;
        setIsCalculating(true);
        try {
            const now = startOfDay(new Date()).getTime();
            const sevenDaysAgo = subDays(now, 7).getTime();
            const thirtyDaysAgo = subDays(now, 30).getTime();

            const weavesLast7Days = await database.get<Interaction>('interactions').query(Q.where('status', 'completed'), Q.where('interaction_date', Q.gte(sevenDaysAgo))).fetchCount();
            const weavesLast30Days = await database.get<Interaction>('interactions').query(Q.where('status', 'completed'), Q.where('interaction_date', Q.gte(thirtyDaysAgo))).fetchCount();
            const avgScoreAllFriends = calculateWeightedNetworkHealth(friends);
            const innerCircleFriends = friends.filter(f => f.dunbarTier === 'InnerCircle');
            const innerCircleScores = innerCircleFriends.map(f => calculateCurrentScore(f));
            const avgScoreInnerCircle = innerCircleScores.reduce((sum, score) => sum + score, 0) / innerCircleScores.length || 0;
            const momentumCount = friends.filter(f => f.momentumScore > 10 && f.momentumLastUpdated.getTime() > Date.now() - 24 * 60 * 60 * 1000).length;
            const averageBattery = batteryStats.average || 50;
            const batteryTrend = batteryStats.trend || 'stable';

            const input: SeasonCalculationInput = {
                weavesLast7Days,
                weavesLast30Days,
                avgScoreAllFriends,
                avgScoreInnerCircle,
                momentumCount,
                batteryLast7DaysAvg: averageBattery,
                batteryTrend: batteryTrend,
            };

            let newSeason = calculateSocialSeason(input, profile.currentSocialSeason);

            // CHECK OVERRIDE: If active, keep current season. If expired, allow calculation (which clears it).
            let isOverridden = false;
            if (profile.seasonOverrideUntil && profile.seasonOverrideUntil > Date.now()) {
                newSeason = profile.currentSocialSeason as SocialSeason;
                isOverridden = true;
            }

            setSeason(newSeason);
            setSeasonData({
                season: newSeason,
                weavesLast7Days,
                weavesLast30Days,
                avgScoreAllFriends,
                avgScoreInnerCircle,
                momentumCount,
                batteryLast7DaysAvg: averageBattery,
                batteryTrend: batteryTrend,
            });

            const oneHourAgo = Date.now() - 60 * 60 * 1000;

            // Only update DB if NOT overridden. 
            // If overridden, we skip auto-updates effectively pausing the engine.
            // If expired (isOverridden=false), we proceed, which calls updateSocialSeason(newSeason), clearing the expired fields.
            // If expired (isOverridden=false), we proceed, which calls updateSocialSeason(newSeason), clearing the expired fields.
            if (!isOverridden) {
                if (newSeason !== profile.currentSocialSeason || !profile.seasonLastCalculated || profile.seasonLastCalculated < oneHourAgo) {
                    await SocialSeasonService.updateSeason(profile.id, newSeason);
                }
            }

            // Log network health for historical tracking (throttled internally to once per 24h)
            await logNetworkHealth(avgScoreAllFriends, database);
        } catch (error) {
            console.error('Error calculating season:', error);
        } finally {
            setIsCalculating(false);
        }
    };

    // Smart caching: skip recalculation if cache is fresh and data hasn't changed significantly
    useEffect(() => {
        const currentInteractionCount = allInteractions.length;
        const currentFriendCount = friends.length;
        const prevDeps = prevDepsRef.current;

        // Detect if data has changed significantly (new weave logged, friend added, etc.)
        const hasSignificantChange =
            currentInteractionCount !== prevDeps.interactionCount ||
            currentFriendCount !== prevDeps.friendCount;

        // Update ref for next comparison
        prevDepsRef.current = {
            interactionCount: currentInteractionCount,
            friendCount: currentFriendCount,
        };

        // Skip recalculation if cache is fresh AND no significant data changes
        if (!isCacheStale() && !hasSignificantChange && cache.lastCalculated) {
            return;
        }

        // Debounce expensive calculations
        const timeout = setTimeout(async () => {
            await calculateActivityStats();
            await calculateAndUpdateSeason();
        }, 1000);

        return () => clearTimeout(timeout);
    }, [allInteractions.length, friends.length, profile?.id]);

    // Sync state to cache after calculations complete (when isCalculating goes false)
    useEffect(() => {
        if (!isCalculating && season && networkHealth > 0) {
            setCache({
                season,
                seasonData,
                weeklyWeaves,
                currentStreak,
                networkHealth,
            });
        }
    }, [isCalculating, season, seasonData, weeklyWeaves, currentStreak, networkHealth]);


    const context = calculateSeasonContext({
        weavesLast7Days: 0,
        weavesLast30Days: 0,
        avgScoreAllFriends: calculateWeightedNetworkHealth(friends) || 50,
        avgScoreInnerCircle: friends.filter(f => f.dunbarTier === 'InnerCircle').reduce((sum, f) => sum + calculateCurrentScore(f), 0) / friends.filter(f => f.dunbarTier === 'InnerCircle').length || 50,
        momentumCount: friends.filter(f => f.momentumScore > 10).length,
        batteryLast7DaysAvg: batteryStats.average || 50,
        batteryTrend: batteryStats.trend || 'stable',
    });

    const greeting = getSeasonGreeting(season, context);

    const handleLongPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowOverrideModal(true);
    };

    const handleSeasonOverride = async (newSeason: SocialSeason, durationDays?: number) => {
        if (!profile) return;
        setSeason(newSeason);
        await SocialSeasonService.updateSeason(profile.id, newSeason, durationDays);
    };

    return (
        <>
            <HomeWidgetBase config={WIDGET_CONFIG} isLoading={isCalculating}>
                <TouchableOpacity
                    onPress={() => setShowDetailSheet(true)}
                    onLongPress={handleLongPress}
                    delayLongPress={500}
                    activeOpacity={0.7}
                >
                    <View>
                        <View className="flex-row items-center gap-4">
                            <View
                                className="w-16 h-16 rounded-full items-center justify-center"
                                style={{ backgroundColor: 'rgba(255, 215, 0, 0.1)' }} // Subtle gold tint
                            >
                                <SeasonIcon season={season} size={48} color={tokens.primary} />
                            </View>
                            <View className="flex-1">
                                <Text
                                    className="mb-1"
                                    style={{
                                        color: tokens.foreground,
                                        fontFamily: typography.fonts.serifBold,
                                        fontSize: typography.scale.h2.fontSize,
                                        lineHeight: typography.scale.h2.lineHeight
                                    }}
                                >
                                    {getSeasonDisplayName(season)}
                                </Text>
                                <Text
                                    style={{
                                        color: tokens.foregroundMuted,
                                        fontFamily: typography.fonts.sans,
                                        fontSize: typography.scale.body.fontSize,
                                        lineHeight: typography.scale.body.lineHeight
                                    }}
                                >
                                    {greeting.subtext}
                                </Text>
                            </View>
                        </View>

                        {profile?.seasonOverrideUntil && profile.seasonOverrideUntil > Date.now() && (
                            <View
                                className="mt-3 self-start px-2.5 py-1 rounded-lg flex-row items-center gap-1.5"
                                style={{ backgroundColor: tokens.primary + '15' }}
                            >
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.primary }} />
                                <Text style={{
                                    color: tokens.primary,
                                    fontFamily: typography.fonts.sansMedium,
                                    fontSize: 12
                                }}>
                                    Override active until {format(profile.seasonOverrideUntil, 'MMM d')}
                                </Text>
                            </View>
                        )}

                        <View
                            className="mt-3 pt-3 border-t items-center"
                            style={{ borderTopColor: tokens.borderSubtle }}
                        >
                            <Text style={{
                                color: tokens.primary,
                                fontFamily: typography.fonts.sansMedium,
                                fontSize: typography.scale.label.fontSize,
                            }}>
                                View pulse
                            </Text>
                        </View>
                    </View>
                </TouchableOpacity >
            </HomeWidgetBase >

            <PulseSheet
                isVisible={showDetailSheet}
                onClose={() => setShowDetailSheet(false)}
                season={season}
                seasonData={seasonData}
                weeklyWeaves={weeklyWeaves}
                currentStreak={currentStreak}
                networkHealth={networkHealth}
            />

            <SeasonOverrideModal
                visible={showOverrideModal}
                onClose={() => setShowOverrideModal(false)}
                currentSeason={season}
                onSelectSeason={handleSeasonOverride}
            />
        </>
    );
};

const enhance = withObservables([], () => ({
    friends: database.get<FriendModel>('friends').query().observe(),
}));

export const SocialSeasonWidgetV2 = enhance(SocialSeasonWidgetContent);


