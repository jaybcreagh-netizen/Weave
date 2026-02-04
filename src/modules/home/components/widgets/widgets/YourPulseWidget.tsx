/**
 * YourPulseWidget
 * 
 * Merged widget combining Social Season + Energy Calendar.
 * Header: Season name + greeting
 * Body: 2-week moon calendar
 * Footer: Action buttons only (no stats)
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { Calendar, Sparkles, Scale } from 'lucide-react-native';
import { Q } from '@nozbe/watermelondb';
import * as Haptics from 'expo-haptics';
import { startOfDay, subDays, format } from 'date-fns';

import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { MoonPhaseIllustration } from '@/modules/intelligence';
import { UnifiedCalendarModal } from '@/modules/insights/components/UnifiedCalendar';
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
    SocialSeasonService,
    SeasonIcon,
    SeasonOverrideModal
} from '@/modules/intelligence';
import {
    getYearMoonData,
    MonthMoonData,
} from '@/modules/reflection';
import SocialBatteryLog from '@/db/models/SocialBatteryLog';
import Interaction from '@/db/models/Interaction';
import { useUserProfile, useSocialBatteryStats } from '@/modules/auth';
import { useInteractions } from '@/modules/interactions';
import { useDashboardCacheStore } from '@/shared/stores/dashboardCacheStore';
import { useFriendsObservable } from '@/shared/context/FriendsObservableContext';

const WIDGET_CONFIG: HomeWidgetConfig = {
    id: 'your-pulse',
    type: 'your-pulse',
    title: 'Your Pulse',
    fullWidth: true,
};

/**
 * Hook to observe battery logs for the current year
 */
function useBatteryLogs(): SocialBatteryLog[] {
    const [logs, setLogs] = useState<SocialBatteryLog[]>([]);

    useEffect(() => {
        const currentYear = new Date().getFullYear();
        const startOfYear = new Date(currentYear, 0, 1).getTime();
        const endOfYear = new Date(currentYear, 11, 31).getTime();

        const subscription = database.get<SocialBatteryLog>('social_battery_logs')
            .query(
                Q.where('timestamp', Q.gte(startOfYear)),
                Q.where('timestamp', Q.lte(endOfYear))
            )
            .observe()
            .subscribe((fetchedLogs) => {
                setLogs(fetchedLogs);
            });

        return () => subscription.unsubscribe();
    }, []);

    return logs;
}

export const YourPulseWidget: React.FC = () => {
    const logs = useBatteryLogs();
    const { friends } = useFriendsObservable();
    const { tokens, typography } = useTheme();
    const { profile } = useUserProfile();
    const { allInteractions } = useInteractions();

    // === Calendar State ===
    const [showLifeCalendar, setShowLifeCalendar] = useState(false);
    const [calendarInitialTab, setCalendarInitialTab] = useState<'moons' | 'alignment' | 'patterns'>('moons');

    const screenWidth = Dimensions.get('window').width;
    const columnWidth = Math.floor((screenWidth - 100) / 7);
    const moonSize = Math.floor(columnWidth * 0.67);

    // === Season State ===
    const [isDeferralOver, setIsDeferralOver] = useState(false);
    useEffect(() => {
        const timer = setTimeout(() => setIsDeferralOver(true), 2000);
        return () => clearTimeout(timer);
    }, []);

    const { data: batteryStats = { average: null, trend: null } } = useSocialBatteryStats({
        enabled: isDeferralOver
    });

    const cache = useDashboardCacheStore((state) => state.socialSeasonCache);
    const isCacheStale = useDashboardCacheStore((state) => state.isSocialSeasonStale);
    const setCache = useDashboardCacheStore((state) => state.setSocialSeasonCache);

    const [isCalculating, setIsCalculating] = useState(false);
    const [season, setSeason] = useState<SocialSeason>(cache.season);
    const [seasonData, setSeasonData] = useState<SeasonExplanationData | null>(cache.seasonData);
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [weeklyWeaves, setWeeklyWeaves] = useState(cache.weeklyWeaves);
    const [currentStreak, setCurrentStreak] = useState(cache.currentStreak);
    const [networkHealth, setNetworkHealth] = useState(cache.networkHealth);

    const prevDepsRef = useRef({ interactionCount: 0, friendCount: 0 });

    // Sync season from profile when cache is stale
    useEffect(() => {
        if (!cache.lastCalculated && profile?.currentSocialSeason) {
            setSeason(profile.currentSocialSeason as SocialSeason);
        }
    }, [profile?.currentSocialSeason, cache.lastCalculated]);

    // === Calendar Data Loading ===
    const [asyncData, setAsyncData] = useState<{
        yearData: MonthMoonData[] | null;
    }>({ yearData: null });

    const hasLoadedInitialData = useRef(false);
    const lastLogCount = useRef(0);

    useEffect(() => {
        const shouldRefetch = !hasLoadedInitialData.current ||
            Math.abs(logs.length - lastLogCount.current) > 0;

        if (!shouldRefetch) return;

        lastLogCount.current = logs.length;
        hasLoadedInitialData.current = true;

        let mounted = true;
        const load = async () => {
            const currentYear = new Date().getFullYear();
            const yearData = await getYearMoonData(currentYear);
            if (mounted) {
                setAsyncData({ yearData });
            }
        };
        load();
        return () => { mounted = false; };
    }, [logs.length]);

    // === Season Calculation ===
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
            const averageBattery = batteryStats.average;
            const batteryTrend = batteryStats.trend;

            const input: SeasonCalculationInput = {
                weavesLast7Days,
                weavesLast30Days,
                avgScoreAllFriends,
                avgScoreInnerCircle,
                momentumCount,
                batteryLast7DaysAvg: averageBattery ?? 0,
                batteryTrend: batteryTrend ?? 'stable',
            };

            let newSeason = calculateSocialSeason(input, profile.currentSocialSeason);

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
                batteryLast7DaysAvg: averageBattery ?? 0,
                batteryTrend: batteryTrend ?? 'stable',
            });

            const oneHourAgo = Date.now() - 60 * 60 * 1000;
            if (!isOverridden) {
                if (newSeason !== profile.currentSocialSeason || !profile.seasonLastCalculated || profile.seasonLastCalculated < oneHourAgo) {
                    await SocialSeasonService.updateSeason(profile.id, newSeason);
                }
            }

            await logNetworkHealth(avgScoreAllFriends, database);
        } catch (error) {
            console.error('Error calculating season:', error);
        } finally {
            setIsCalculating(false);
        }
    };

    useEffect(() => {
        const currentInteractionCount = allInteractions.length;
        const currentFriendCount = friends.length;
        const prevDeps = prevDepsRef.current;

        const hasSignificantChange =
            currentInteractionCount !== prevDeps.interactionCount ||
            currentFriendCount !== prevDeps.friendCount;

        prevDepsRef.current = {
            interactionCount: currentInteractionCount,
            friendCount: currentFriendCount,
        };

        if (!isCacheStale() && !hasSignificantChange && cache.lastCalculated) {
            return;
        }

        const timeout = setTimeout(async () => {
            await calculateActivityStats();
            await calculateAndUpdateSeason();
        }, 1000);

        return () => clearTimeout(timeout);
    }, [allInteractions.length, friends.length, profile?.id]);

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

    // === Greeting ===
    const context = calculateSeasonContext({
        weavesLast7Days: 0,
        weavesLast30Days: 0,
        avgScoreAllFriends: calculateWeightedNetworkHealth(friends) || 50,
        avgScoreInnerCircle: friends.filter(f => f.dunbarTier === 'InnerCircle').reduce((sum, f) => sum + calculateCurrentScore(f), 0) / friends.filter(f => f.dunbarTier === 'InnerCircle').length || 50,
        momentumCount: friends.filter(f => f.momentumScore > 10).length,
        batteryLast7DaysAvg: batteryStats.average,
        batteryTrend: batteryStats.trend,
    });
    const greeting = getSeasonGreeting(season, context);

    // === Handlers ===
    const handleLongPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setShowOverrideModal(true);
    };

    const handleSeasonOverride = async (newSeason: SocialSeason, durationDays?: number) => {
        if (!profile) return;
        setSeason(newSeason);
        await SocialSeasonService.updateSeason(profile.id, newSeason, durationDays);
    };

    // === Calendar Data ===
    if (!asyncData.yearData) {
        return (
            <HomeWidgetBase config={WIDGET_CONFIG} isLoading={true}>
                <View />
            </HomeWidgetBase>
        );
    }

    const today = new Date();
    const currentDayOfWeek = today.getDay();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - currentDayOfWeek - 7);
    startDate.setHours(0, 0, 0, 0);

    const visibleDays = Array.from({ length: 14 }, (_, i) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        const monthIndex = date.getMonth();
        const targetMonthData = asyncData.yearData![monthIndex];

        const existingDay = targetMonthData?.days.find(d =>
            d.date.getDate() === date.getDate() &&
            d.date.getFullYear() === date.getFullYear()
        );

        if (existingDay) return existingDay;

        return {
            date: date,
            moonPhase: 0,
            hasCheckin: false,
            batteryLevel: null,
            journalEntry: null
        } as any;
    });

    return (
        <>
            <HomeWidgetBase config={WIDGET_CONFIG} padding="none" isLoading={isCalculating}>
                <View style={{ padding: 16 }}>
                    {/* Season Header - Tappable to open Life Calendar */}
                    <TouchableOpacity
                        onPress={() => {
                            setCalendarInitialTab('moons');
                            setShowLifeCalendar(true);
                        }}
                        onLongPress={handleLongPress}
                        delayLongPress={500}
                        activeOpacity={0.7}
                    >
                        {/* Subtle label */}
                        <Text
                            style={{
                                color: tokens.foregroundMuted,
                                fontFamily: typography.fonts.sansMedium,
                                fontSize: 11,
                                letterSpacing: 0.5,
                                textTransform: 'uppercase',
                                marginBottom: 6,
                            }}
                        >
                            Your Pulse
                        </Text>

                        {/* Season as hero */}
                        <Animated.View
                            key={season}
                            entering={FadeIn.duration(300)}
                            exiting={FadeOut.duration(200)}
                            layout={Layout.springify()}
                            className="mb-4"
                        >
                            <View className="flex-row items-center gap-2.5 mb-1">
                                <SeasonIcon season={season} size={20} color={tokens.primary} />
                                <Text
                                    style={{
                                        color: tokens.foreground,
                                        fontFamily: typography.fonts.sansSemiBold,
                                        fontSize: typography.scale.bodyLarge.fontSize,
                                        lineHeight: typography.scale.bodyLarge.lineHeight,
                                    }}
                                >
                                    {getSeasonDisplayName(season)} Season
                                </Text>
                            </View>
                            <Text
                                style={{
                                    color: tokens.foregroundMuted,
                                    fontFamily: typography.fonts.sans,
                                    fontSize: typography.scale.bodySmall.fontSize,
                                    lineHeight: typography.scale.bodySmall.lineHeight,
                                }}
                            >
                                {greeting.subtext}
                            </Text>
                        </Animated.View>

                        {profile?.seasonOverrideUntil && profile.seasonOverrideUntil > Date.now() && (
                            <View
                                className="mb-3 self-start px-2.5 py-1 rounded-lg flex-row items-center gap-1.5"
                                style={{ backgroundColor: tokens.primary + '15' }}
                            >
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: tokens.primary }} />
                                <Text style={{
                                    color: tokens.primary,
                                    fontFamily: typography.fonts.sansMedium,
                                    fontSize: 12
                                }}>
                                    Override until {format(profile.seasonOverrideUntil, 'MMM d')}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    {/* Day Labels */}
                    <View style={{ flexDirection: 'row', marginBottom: 12 }}>
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                            <View key={i} style={{ width: columnWidth, alignItems: 'center' }}>
                                <Text style={{
                                    fontSize: typography.scale.labelSmall.fontSize,
                                    lineHeight: typography.scale.labelSmall.lineHeight,
                                    color: tokens.foregroundMuted,
                                    fontFamily: typography.fonts.sans
                                }}>
                                    {day}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Moon Calendar Grid */}
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 }}>
                        {visibleDays.map((day) => (
                            <View
                                key={day.date.toISOString()}
                                style={{ width: columnWidth, height: moonSize + 12, alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}
                            >
                                <MoonPhaseIllustration
                                    phase={day.moonPhase}
                                    size={moonSize}
                                    hasCheckin={day.hasCheckin}
                                />
                                <Text
                                    style={{
                                        fontSize: typography.scale.labelSmall.fontSize,
                                        lineHeight: typography.scale.labelSmall.lineHeight,
                                        marginTop: 1,
                                        color: day.hasCheckin ? tokens.foreground : tokens.foregroundMuted,
                                        fontFamily: typography.fonts.sans,
                                        opacity: day.hasCheckin ? 1 : 0.5,
                                    }}
                                >
                                    {day.date.getDate()}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Footer - 3 Buttons */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: tokens.borderSubtle, gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => {
                                setCalendarInitialTab('moons');
                                setShowLifeCalendar(true);
                            }}
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                                backgroundColor: tokens.backgroundMuted,
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: tokens.border,
                            }}
                        >
                            <Calendar size={13} color={tokens.foreground} />
                            <Text style={{
                                fontSize: typography.scale.label.fontSize,
                                lineHeight: typography.scale.label.lineHeight,
                                fontFamily: typography.fonts.sansMedium,
                                color: tokens.foreground
                            }}>
                                Moons
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                setCalendarInitialTab('alignment');
                                setShowLifeCalendar(true);
                            }}
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                                backgroundColor: tokens.backgroundMuted,
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                borderRadius: 999,
                                borderWidth: 1,
                                borderColor: tokens.border,
                            }}
                        >
                            <Scale size={13} color={tokens.foreground} />
                            <Text style={{
                                fontSize: typography.scale.label.fontSize,
                                lineHeight: typography.scale.label.lineHeight,
                                fontFamily: typography.fonts.sansMedium,
                                color: tokens.foreground
                            }}>
                                Alignment
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                setCalendarInitialTab('patterns');
                                setShowLifeCalendar(true);
                            }}
                            style={{
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 4,
                                backgroundColor: tokens.primary,
                                paddingHorizontal: 10,
                                paddingVertical: 8,
                                borderRadius: 999,
                            }}
                        >
                            <Sparkles size={13} color={tokens.background} />
                            <Text style={{
                                fontSize: typography.scale.label.fontSize,
                                lineHeight: typography.scale.label.lineHeight,
                                fontFamily: typography.fonts.sansSemiBold,
                                color: tokens.background
                            }}>
                                Patterns
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </HomeWidgetBase>

            <UnifiedCalendarModal
                isOpen={showLifeCalendar}
                onClose={() => setShowLifeCalendar(false)}
                initialTab={calendarInitialTab}
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
