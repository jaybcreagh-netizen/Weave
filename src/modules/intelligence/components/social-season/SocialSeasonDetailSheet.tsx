import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { Activity, BarChart3, Scale, ChevronLeft, ChevronRight, Zap, Book, CheckCircle2 } from 'lucide-react-native';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { type SocialSeason, type SeasonExplanationData } from '@/modules/intelligence';
import { SEASON_STYLES, getSeasonDisplayName } from '@/modules/intelligence';
import { generateSeasonExplanation } from '@/modules/reflection';
import { GraphsTabContent } from '@/modules/intelligence/components/social-season/YearInMoons/GraphsTabContentV2';
import { TierBalanceContent } from '@/modules/relationships';
import { SeasonEffectsPanel } from '@/modules/intelligence';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { useUserProfile } from '@/modules/auth';
import { Card } from '@/shared/ui/Card';
import { WidgetHeader } from '@/shared/ui/WidgetHeader';
import { Stat } from '@/shared/ui/Stat';
import Friend from '@/db/models/Friend';

interface SocialSeasonDetailSheetProps {
    isVisible: boolean;
    onClose: () => void;
    season: SocialSeason;
    seasonData: SeasonExplanationData | null;
    weeklyWeaves: number;
    currentStreak: number;
    networkHealth: number;
}

type Tab = 'pulse' | 'alignment' | 'insights';

export function SocialSeasonDetailSheet({
    isVisible,
    onClose,
    season,
    seasonData,
    weeklyWeaves,
    currentStreak,
    networkHealth,
}: SocialSeasonDetailSheetProps) {
    const { tokens, typography, spacing, isDarkMode } = useTheme();
    const [currentTab, setCurrentTab] = useState<Tab>('pulse');

    return (
        <AnimatedBottomSheet
            visible={isVisible}
            onClose={onClose}
            height="full"
            scrollable
        >
            {/* Header */}
            <View className="flex-row justify-between items-center px-5 mb-5">
                <View>
                    <Text
                        className="text-2xl font-lora-bold"
                        style={{ color: tokens.foreground }}
                    >
                        {getSeasonDisplayName(season)}
                    </Text>
                    <Text
                        className="text-sm font-inter-regular"
                        style={{ color: tokens.foregroundMuted }}
                    >
                        Network Health & Insights
                    </Text>
                </View>
            </View>

            {/* Tabs */}
            <View className="flex-row px-5 mb-5 gap-3">
                <TouchableOpacity
                    onPress={() => setCurrentTab('pulse')}
                    className="flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-2"
                    style={[
                        currentTab === 'pulse' && { backgroundColor: tokens.background },
                        currentTab === 'pulse' && { borderColor: tokens.border, borderWidth: 1 },
                    ]}
                >
                    <Activity size={16} color={currentTab === 'pulse' ? tokens.primary : tokens.foregroundMuted} />
                    <Text
                        className="text-sm font-inter-medium"
                        style={{
                            color: currentTab === 'pulse' ? tokens.primary : tokens.foregroundMuted,
                        }}
                    >
                        Pulse
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setCurrentTab('alignment')}
                    className="flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-2"
                    style={[
                        currentTab === 'alignment' && { backgroundColor: tokens.background },
                        currentTab === 'alignment' && { borderColor: tokens.border, borderWidth: 1 },
                    ]}
                >
                    <Scale size={16} color={currentTab === 'alignment' ? tokens.primary : tokens.foregroundMuted} />
                    <Text
                        className="text-sm font-inter-medium"
                        style={{
                            color: currentTab === 'alignment' ? tokens.primary : tokens.foregroundMuted,
                        }}
                    >
                        Alignment
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setCurrentTab('insights')}
                    className="flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-2"
                    style={[
                        currentTab === 'insights' && { backgroundColor: tokens.background },
                        currentTab === 'insights' && { borderColor: tokens.border, borderWidth: 1 },
                    ]}
                >
                    <BarChart3 size={16} color={currentTab === 'insights' ? tokens.primary : tokens.foregroundMuted} />
                    <Text
                        className="text-sm font-inter-medium"
                        style={{
                            color: currentTab === 'insights' ? tokens.primary : tokens.foregroundMuted,
                        }}
                    >
                        Insights
                    </Text>
                </TouchableOpacity>
            </View>

            <View>
                {currentTab === 'pulse' && (
                    <PulseTabContent
                        season={season}
                        seasonData={seasonData}
                        weeklyWeaves={weeklyWeaves}
                        currentStreak={currentStreak}
                    />
                )}

                {currentTab === 'alignment' && (
                    <TierBalanceContent />
                )}

                {currentTab === 'insights' && (
                    <GraphsTabContent />
                )}
            </View>
        </AnimatedBottomSheet>
    );
}

function PulseTabContent({
    season,
    seasonData,
    weeklyWeaves,
    currentStreak,
}: {
    season: SocialSeason;
    seasonData: SeasonExplanationData | null;
    weeklyWeaves: number;
    currentStreak: number;
}) {
    const { tokens, typography, spacing, isDarkMode } = useTheme();
    const explanation = seasonData ? generateSeasonExplanation(seasonData) : null;
    const { profile } = useUserProfile();

    // State for navigation and selection
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);

    // Stats for the displayed month
    const [monthlyActivity, setMonthlyActivity] = useState<Map<string, boolean>>(new Map());
    const [completedWeaves, setCompletedWeaves] = useState<Map<string, boolean>>(new Map());
    const [monthlyWeavesCount, setMonthlyWeavesCount] = useState(0);
    const [totalWeaves, setTotalWeaves] = useState(0);
    const [totalDaysActive, setTotalDaysActive] = useState(0);

    // Detailed data for the selected day
    const [dayDetails, setDayDetails] = useState<{
        weaves: { id: string; name: string; type: string; status: string }[];
        hasJournal: boolean;
        hasCheckin: boolean;
        isLoading: boolean;
    } | null>(null);

    useEffect(() => {
        loadMonthlyStats(currentMonth);
    }, [currentMonth]);

    useEffect(() => {
        if (selectedDate) {
            loadDayDetails(selectedDate);
        } else {
            setDayDetails(null);
        }
    }, [selectedDate]);

    const loadMonthlyStats = async (date: Date) => {
        try {
            const monthStart = startOfMonth(date);
            const monthEnd = endOfMonth(date);

            const monthlyInteractions = await database
                .get<Interaction>('interactions')
                .query(
                    Q.where('status', 'completed'),
                    Q.where('interaction_date', Q.gte(monthStart.getTime())),
                    Q.where('interaction_date', Q.lte(monthEnd.getTime()))
                )
                .fetch();

            setMonthlyWeavesCount(monthlyInteractions.length);

            const activityMap = new Map<string, boolean>();
            const completedWeavesMap = new Map<string, boolean>();

            monthlyInteractions.forEach(interaction => {
                const dateKey = format(interaction.interactionDate, 'yyyy-MM-dd');
                activityMap.set(dateKey, true);
                completedWeavesMap.set(dateKey, true);
            });

            // Check for other activity (Battery, Journal) to mark "activity" days
            const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

            // We need to fetch reflections for the whole month efficiently
            const monthlyReflections = await database
                .get<WeeklyReflection>('weekly_reflections')
                .query(
                    Q.where('created_at', Q.gte(monthStart.getTime())),
                    Q.where('created_at', Q.lte(monthEnd.getTime()))
                )
                .fetch();

            const reflectionSet = new Set(monthlyReflections.map(r => format(new Date(r.createdAt), 'yyyy-MM-dd')));

            // Check local profile battery history
            const batteryHistory = profile?.socialBatteryHistory || [];

            for (const day of days) {
                const dayStart = day.getTime();
                const dayEnd = dayStart + 24 * 60 * 60 * 1000;
                const dateKey = format(day, 'yyyy-MM-dd');

                if (!activityMap.has(dateKey)) {
                    const hasBattery = batteryHistory.some((entry: any) => entry.timestamp >= dayStart && entry.timestamp < dayEnd);
                    const hasJournal = reflectionSet.has(dateKey);

                    if (hasBattery || hasJournal) {
                        activityMap.set(dateKey, true);
                    }
                }
            }

            setMonthlyActivity(activityMap);
            setCompletedWeaves(completedWeavesMap);

            // Global stats (Total Weaves & Active Days) - these are lifetime stats
            const allCompletedWeavesCount = await database
                .get<Interaction>('interactions')
                .query(Q.where('status', 'completed'))
                .fetchCount();

            setTotalWeaves(allCompletedWeavesCount);

            const allInteractions = await database
                .get<Interaction>('interactions')
                .query(Q.where('status', 'completed'))
                .fetch();

            const uniqueDays = new Set<string>();
            allInteractions.forEach(interaction => {
                const dateKey = format(interaction.interactionDate, 'yyyy-MM-dd');
                uniqueDays.add(dateKey);
            });

            setTotalDaysActive(uniqueDays.size);

        } catch (error) {
            console.error('Error loading monthly stats:', error);
        }
    };

    const loadDayDetails = async (date: Date) => {
        setDayDetails(prev => ({ ...prev, weaves: [], hasJournal: false, hasCheckin: false, isLoading: true }));
        try {
            const dayStart = date.getTime();
            const nextDay = new Date(date);
            nextDay.setDate(date.getDate() + 1);
            nextDay.setHours(0, 0, 0, 0);
            const dayEnd = nextDay.getTime();

            // Fetch interactions
            const dayInteractions = await database
                .get<Interaction>('interactions')
                .query(
                    Q.where('status', Q.oneOf(['completed', 'planned'])),
                    Q.where('interaction_date', Q.gte(dayStart)),
                    Q.where('interaction_date', Q.lt(dayEnd))
                )
                .fetch();

            // Enrich interactions with Friend names
            const enrichedWeaves = await Promise.all(
                dayInteractions.map(async (interaction) => {
                    const interactionFriends = await interaction.interactionFriends.fetch();
                    const friends = await Promise.all(interactionFriends.map((ifriend: any) => ifriend.friend.fetch()));
                    const names = friends.map((f: any) => f.name).join(', ');
                    return {
                        id: interaction.id,
                        name: names || 'Unknown Friend',
                        type: interaction.interactionType,
                        status: interaction.status
                    };
                })
            );

            // Check Check-in
            const hasCheckin = (profile?.socialBatteryHistory || []).some(
                (entry: any) => entry.timestamp >= dayStart && entry.timestamp < dayEnd
            );

            // Check Journal
            const journalCount = await database
                .get<WeeklyReflection>('weekly_reflections')
                .query(
                    Q.where('created_at', Q.gte(dayStart)),
                    Q.where('created_at', Q.lt(dayEnd))
                )
                .fetchCount();

            setDayDetails({
                weaves: enrichedWeaves,
                hasJournal: journalCount > 0,
                hasCheckin: hasCheckin,
                isLoading: false
            });

        } catch (error) {
            console.error('Error loading day details:', error);
            setDayDetails({ weaves: [], hasJournal: false, hasCheckin: false, isLoading: false });
        }
    };

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
        <View style={{ gap: spacing[6], paddingHorizontal: 16, paddingBottom: 20 }}>
            {/* Season Explanation */}
            {explanation && (
                <View style={{ gap: 16 }}>
                    <Card variant="outlined">
                        <Text
                            className="font-lora-bold mb-2"
                            style={{
                                color: tokens.foreground,
                                fontSize: typography.scale.h3.fontSize,
                            }}
                        >
                            {explanation.headline}
                        </Text>
                        <Text
                            className="font-inter-regular"
                            style={{
                                color: tokens.foregroundMuted,
                                fontSize: typography.scale.body.fontSize,
                                lineHeight: typography.scale.body.lineHeight
                            }}
                        >
                            {explanation.insight}
                        </Text>
                    </Card>
                    <SeasonEffectsPanel season={season} />
                </View>
            )}

            {/* Calendar */}
            <Card>
                <View className="flex-row justify-between items-center mb-3">
                    <View>
                        <Text
                            className="text-lg font-lora-bold"
                            style={{ color: tokens.foreground }}
                        >
                            Rhythm
                        </Text>
                        <Text
                            className="text-sm font-inter-regular"
                            style={{ color: tokens.foregroundMuted }}
                        >
                            {format(currentMonth, 'MMMM yyyy')}
                        </Text>
                    </View>
                    <View className="flex-row gap-2">
                        <TouchableOpacity onPress={handlePrevMonth} className="p-2">
                            <ChevronLeft size={20} color={tokens.foreground} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleNextMonth} className="p-2">
                            <ChevronRight size={20} color={tokens.foreground} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Legend */}
                <View className="flex-row justify-start gap-4 mb-4">
                    <View className="flex-row items-center gap-1.5">
                        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: tokens.primary }} />
                        <Text className="text-xs" style={{ color: tokens.foregroundMuted }}>Weave</Text>
                    </View>
                    <View className="flex-row items-center gap-1.5">
                        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: tokens.primary + '20' }} />
                        <Text className="text-xs" style={{ color: tokens.foregroundMuted }}>Activity</Text>
                    </View>
                </View>

                <View className="flex-row mb-2">
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                        <Text
                            key={index}
                            className="flex-1 text-center text-xs font-inter-medium"
                            style={{ color: tokens.foregroundMuted }}
                        >
                            {day}
                        </Text>
                    ))}
                </View>

                <View className="flex-row flex-wrap">
                    {calendarDays.map((day, index) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const hasActivity = monthlyActivity.get(dateKey) || false;
                        const hasCompletedWeave = completedWeaves.get(dateKey) || false;
                        const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                        const isSelected = selectedDate && isSameDay(day, selectedDate);

                        return (
                            <TouchableOpacity
                                key={index}
                                className="w-[14.28%] aspect-square p-0.5"
                                onPress={() => setSelectedDate(day)}
                            >
                                <View
                                    className="flex-1 items-center justify-center rounded-lg"
                                    style={[
                                        hasActivity && { backgroundColor: tokens.primary + '20' },
                                        hasCompletedWeave && { backgroundColor: tokens.primary },
                                        isSelected && { borderWidth: 2, borderColor: tokens.foreground },
                                        !isCurrentMonth && { opacity: 0.3 }
                                    ]}
                                >
                                    <Text
                                        className="text-xs font-inter-regular"
                                        style={[
                                            {
                                                color: hasCompletedWeave ? tokens.primaryForeground : tokens.foreground,
                                                fontFamily: isSelected ? typography.fonts.sansSemiBold : (hasCompletedWeave ? typography.fonts.sansSemiBold : typography.fonts.sans)
                                            }
                                        ]}
                                    >
                                        {day.getDate()}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Card>

            {/* Selected Day Details */}
            {selectedDate && (
                <Card>
                    <WidgetHeader
                        title={isSameDay(selectedDate, new Date()) ? "Today's Pulse" : `Pulse for ${format(selectedDate, 'MMM d')}`}
                        subtitle={dayDetails?.isLoading ? "Loading..." : (!dayDetails?.weaves.length && !dayDetails?.hasCheckin && !dayDetails?.hasJournal ? "No activity recorded" : "")}
                    />

                    {!dayDetails?.isLoading && (
                        <View style={{ gap: 12 }}>
                            {dayDetails?.weaves.map(weave => (
                                <View key={weave.id} className="flex-row items-center gap-3">
                                    <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: tokens.primary + '20' }}>
                                        <CheckCircle2 size={16} color={tokens.primary} />
                                    </View>
                                    <View>
                                        <Text className="text-sm font-inter-medium" style={{ color: tokens.foreground }}>
                                            Weave with {weave.name}
                                        </Text>
                                        <Text className="text-xs" style={{ color: tokens.foregroundMuted }}>
                                            {weave.type} {weave.status === 'planned' ? '(Planned)' : ''}
                                        </Text>
                                    </View>
                                </View>
                            ))}

                            {dayDetails?.hasCheckin && (
                                <View className="flex-row items-center gap-3">
                                    <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: tokens.destructive + '20' }}>
                                        <Zap size={16} color={tokens.destructive} />
                                    </View>
                                    <Text className="text-sm font-inter-medium" style={{ color: tokens.foreground }}>
                                        Social Battery Check-in
                                    </Text>
                                </View>
                            )}

                            {dayDetails?.hasJournal && (
                                <View className="flex-row items-center gap-3">
                                    <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: tokens.mystic.accent + '20' }}>
                                        <Book size={16} color={tokens.mystic.accent} />
                                    </View>
                                    <Text className="text-sm font-inter-medium" style={{ color: tokens.foreground }}>
                                        Journal Entry
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}
                </Card>
            )}

            {/* Stats */}
            <Card>
                <WidgetHeader title="History" />
                <View className="flex-row justify-between">
                    <Stat label="Total Weaves" value={totalWeaves} />
                    <Stat label="Active Days" value={totalDaysActive} />
                    <Stat label="This Month" value={monthlyWeavesCount} />
                </View>
            </Card>
        </View>
    );
}
