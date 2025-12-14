import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
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
import { useUserProfileStore } from '@/modules/auth';
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
            <View style={styles.header}>
                <View>
                    <Text style={[styles.title, { color: tokens.foreground, fontFamily: typography.fonts.serifBold }]}>
                        {getSeasonDisplayName(season)}
                    </Text>
                    <Text style={[styles.subtitle, { color: tokens.foregroundMuted, fontFamily: typography.fonts.sans }]}>
                        Network Health & Insights
                    </Text>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabContainer}>
                <TouchableOpacity
                    onPress={() => setCurrentTab('pulse')}
                    style={[
                        styles.tab,
                        currentTab === 'pulse' && { backgroundColor: tokens.background },
                        currentTab === 'pulse' && { borderColor: tokens.border, borderWidth: 1 },
                    ]}
                >
                    <Activity size={16} color={currentTab === 'pulse' ? tokens.primary : tokens.foregroundMuted} />
                    <Text style={[
                        styles.tabText,
                        {
                            color: currentTab === 'pulse' ? tokens.primary : tokens.foregroundMuted,
                            fontFamily: typography.fonts.sansMedium
                        }
                    ]}>
                        Pulse
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setCurrentTab('alignment')}
                    style={[
                        styles.tab,
                        currentTab === 'alignment' && { backgroundColor: tokens.background },
                        currentTab === 'alignment' && { borderColor: tokens.border, borderWidth: 1 },
                    ]}
                >
                    <Scale size={16} color={currentTab === 'alignment' ? tokens.primary : tokens.foregroundMuted} />
                    <Text style={[
                        styles.tabText,
                        {
                            color: currentTab === 'alignment' ? tokens.primary : tokens.foregroundMuted,
                            fontFamily: typography.fonts.sansMedium
                        }
                    ]}>
                        Alignment
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setCurrentTab('insights')}
                    style={[
                        styles.tab,
                        currentTab === 'insights' && { backgroundColor: tokens.background },
                        currentTab === 'insights' && { borderColor: tokens.border, borderWidth: 1 },
                    ]}
                >
                    <BarChart3 size={16} color={currentTab === 'insights' ? tokens.primary : tokens.foregroundMuted} />
                    <Text style={[
                        styles.tabText,
                        {
                            color: currentTab === 'insights' ? tokens.primary : tokens.foregroundMuted,
                            fontFamily: typography.fonts.sansMedium
                        }
                    ]}>
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
    const { profile } = useUserProfileStore();

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
                    const hasBattery = batteryHistory.some(entry => entry.timestamp >= dayStart && entry.timestamp < dayEnd);
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
                entry => entry.timestamp >= dayStart && entry.timestamp < dayEnd
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
                        <Text style={{
                            color: tokens.foreground,
                            fontFamily: typography.fonts.serifBold,
                            fontSize: typography.scale.h3.fontSize,
                            marginBottom: spacing[2]
                        }}>
                            {explanation.headline}
                        </Text>
                        <Text style={{
                            color: tokens.foregroundMuted,
                            fontFamily: typography.fonts.sans,
                            fontSize: typography.scale.body.fontSize,
                            lineHeight: typography.scale.body.lineHeight
                        }}>
                            {explanation.insight}
                        </Text>
                    </Card>
                    <SeasonEffectsPanel season={season} />
                </View>
            )}

            {/* Calendar */}
            <Card>
                <View style={[styles.header, { paddingHorizontal: 0, marginBottom: 12 }]}>
                    <View>
                        <Text style={{
                            color: tokens.foreground,
                            fontFamily: typography.fonts.serifBold,
                            fontSize: 18
                        }}>
                            Rhythm
                        </Text>
                        <Text style={{
                            color: tokens.foregroundMuted,
                            fontFamily: typography.fonts.sans,
                            fontSize: 14
                        }}>
                            {format(currentMonth, 'MMMM yyyy')}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={handlePrevMonth} style={styles.navButton}>
                            <ChevronLeft size={20} color={tokens.foreground} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                            <ChevronRight size={20} color={tokens.foreground} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Legend */}
                <View style={styles.legendContainer}>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: tokens.primary }]} />
                        <Text style={[styles.legendText, { color: tokens.foregroundMuted }]}>Weave</Text>
                    </View>
                    <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: tokens.primary + '20' }]} />
                        <Text style={[styles.legendText, { color: tokens.foregroundMuted }]}>Activity</Text>
                    </View>
                </View>

                <View style={styles.calendarHeader}>
                    {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                        <Text key={index} style={[styles.dayLabel, { color: tokens.foregroundMuted, fontFamily: typography.fonts.sansMedium }]}>
                            {day}
                        </Text>
                    ))}
                </View>

                <View style={styles.calendarGrid}>
                    {calendarDays.map((day, index) => {
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const hasActivity = monthlyActivity.get(dateKey) || false;
                        const hasCompletedWeave = completedWeaves.get(dateKey) || false;
                        const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                        const isSelected = selectedDate && isSameDay(day, selectedDate);

                        return (
                            <TouchableOpacity
                                key={index}
                                style={styles.dayCell}
                                onPress={() => setSelectedDate(day)}
                            >
                                <View style={[
                                    styles.dayContent,
                                    hasActivity && { backgroundColor: tokens.primary + '20' },
                                    hasCompletedWeave && { backgroundColor: tokens.primary },
                                    isSelected && { borderWidth: 2, borderColor: tokens.foreground },
                                    !isCurrentMonth && { opacity: 0.3 }
                                ]}>
                                    <Text style={[
                                        styles.dayText,
                                        {
                                            color: hasCompletedWeave ? tokens.primaryForeground : tokens.foreground,
                                            fontFamily: isSelected ? typography.fonts.sansSemiBold : (hasCompletedWeave ? typography.fonts.sansSemiBold : typography.fonts.sans)
                                        }
                                    ]}>
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
                                <View key={weave.id} style={styles.detailRow}>
                                    <View style={[styles.iconBox, { backgroundColor: tokens.primary + '20' }]}>
                                        <CheckCircle2 size={16} color={tokens.primary} />
                                    </View>
                                    <View>
                                        <Text style={[styles.detailText, { color: tokens.foreground, fontFamily: typography.fonts.sansMedium }]}>
                                            Weave with {weave.name}
                                        </Text>
                                        <Text style={[styles.detailSubtext, { color: tokens.foregroundMuted }]}>
                                            {weave.type} {weave.status === 'planned' ? '(Planned)' : ''}
                                        </Text>
                                    </View>
                                </View>
                            ))}

                            {dayDetails?.hasCheckin && (
                                <View style={styles.detailRow}>
                                    <View style={[styles.iconBox, { backgroundColor: tokens.destructive + '20' }]}>
                                        <Zap size={16} color={tokens.destructive} />
                                    </View>
                                    <Text style={[styles.detailText, { color: tokens.foreground, fontFamily: typography.fonts.sansMedium }]}>
                                        Social Battery Check-in
                                    </Text>
                                </View>
                            )}

                            {dayDetails?.hasJournal && (
                                <View style={styles.detailRow}>
                                    <View style={[styles.iconBox, { backgroundColor: tokens.mystic.accent + '20' }]}>
                                        <Book size={16} color={tokens.mystic.accent} />
                                    </View>
                                    <Text style={[styles.detailText, { color: tokens.foreground, fontFamily: typography.fonts.sansMedium }]}>
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
                <View style={styles.statsGrid}>
                    <Stat label="Total Weaves" value={totalWeaves} />
                    <Stat label="Active Days" value={totalDaysActive} />
                    <Stat label="This Month" value={monthlyWeavesCount} />
                </View>
            </Card>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '90%',
        paddingTop: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
    },
    subtitle: {
        fontSize: 14,
    },
    closeButton: {
        padding: 4,
    },
    tabContainer: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        marginBottom: 20,
        gap: 12,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
    },
    tabText: {
        fontSize: 14,
    },
    content: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    calendarHeader: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    dayLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
    },
    calendarGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: '14.28%',
        aspectRatio: 1,
        padding: 2,
    },
    dayContent: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    dayText: {
        fontSize: 12,
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    navButton: {
        padding: 8,
    },
    legendContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        gap: 16,
        marginBottom: 16,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    legendText: {
        fontSize: 12,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    detailText: {
        fontSize: 14,
    },
    detailSubtext: {
        fontSize: 12,
    }
});
