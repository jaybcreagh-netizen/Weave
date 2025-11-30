import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    StyleSheet,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { X, Activity, BarChart3 } from 'lucide-react-native';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, isSameDay, startOfWeek, endOfWeek, differenceInDays } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/shared/hooks/useTheme';
import { type SocialSeason, type SeasonExplanationData } from '@/modules/intelligence';
import { SEASON_STYLES, getSeasonDisplayName } from '@/modules/intelligence';
import { generateSeasonExplanation } from '@/modules/reflection';
import { GraphsTabContent } from './YearInMoons/GraphsTabContentV2';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { useUserProfileStore } from '@/modules/auth';
import { Card } from '@/components/ui/Card';
import { WidgetHeader } from '@/components/ui/WidgetHeader';
import { Stat } from '@/components/ui/Stat';

interface SocialSeasonDetailSheetProps {
    isVisible: boolean;
    onClose: () => void;
    season: SocialSeason;
    seasonData: SeasonExplanationData | null;
    weeklyWeaves: number;
    currentStreak: number;
    networkHealth: number;
}

type Tab = 'pulse' | 'insights';

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

    if (!isVisible) return null;

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <BlurView intensity={isDarkMode ? 40 : 20} style={StyleSheet.absoluteFill} />
                <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

                <View style={[styles.sheet, { backgroundColor: tokens.backgroundElevated }]}>
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
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color={tokens.foregroundMuted} />
                        </TouchableOpacity>
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

                    <ScrollView contentContainerStyle={styles.content}>
                        {currentTab === 'pulse' && (
                            <PulseTabContent
                                season={season}
                                seasonData={seasonData}
                                weeklyWeaves={weeklyWeaves}
                                currentStreak={currentStreak}
                            />
                        )}

                        {currentTab === 'insights' && (
                            <GraphsTabContent />
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
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
    const [monthlyActivity, setMonthlyActivity] = useState<Map<string, boolean>>(new Map());
    const [completedWeaves, setCompletedWeaves] = useState<Map<string, boolean>>(new Map());
    const [monthlyWeaves, setMonthlyWeaves] = useState(0);
    const [totalWeaves, setTotalWeaves] = useState(0);
    const [totalDaysActive, setTotalDaysActive] = useState(0);
    const { profile } = useUserProfileStore();

    useEffect(() => {
        loadMonthlyStats();
    }, []);

    const loadMonthlyStats = async () => {
        try {
            const today = new Date();
            const monthStart = startOfMonth(today);
            const monthEnd = endOfMonth(today);

            const monthlyInteractions = await database
                .get<Interaction>('interactions')
                .query(
                    Q.where('status', 'completed'),
                    Q.where('interaction_date', Q.gte(monthStart.getTime())),
                    Q.where('interaction_date', Q.lte(monthEnd.getTime()))
                )
                .fetch();

            setMonthlyWeaves(monthlyInteractions.length);

            const activityMap = new Map<string, boolean>();
            const completedWeavesMap = new Map<string, boolean>();

            monthlyInteractions.forEach(interaction => {
                const dateKey = format(interaction.interactionDate, 'yyyy-MM-dd');
                activityMap.set(dateKey, true);
                completedWeavesMap.set(dateKey, true);
            });

            const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
            for (const day of days) {
                const dayStart = day.getTime();
                const dayEnd = dayStart + 24 * 60 * 60 * 1000;
                const dateKey = format(day, 'yyyy-MM-dd');

                if (!activityMap.has(dateKey)) {
                    const [batteryCheckins, journalEntries] = await Promise.all([
                        profile?.socialBatteryHistory?.filter(
                            entry => entry.timestamp >= dayStart && entry.timestamp < dayEnd
                        ).length || 0,
                        database
                            .get<WeeklyReflection>('weekly_reflections')
                            .query(
                                Q.where('created_at', Q.gte(dayStart)),
                                Q.where('created_at', Q.lt(dayEnd))
                            )
                            .fetchCount(),
                    ]);

                    if (batteryCheckins > 0 || journalEntries > 0) {
                        activityMap.set(dateKey, true);
                    }
                }
            }

            setMonthlyActivity(activityMap);
            setCompletedWeaves(completedWeavesMap);

            const allCompletedWeaves = await database
                .get<Interaction>('interactions')
                .query(Q.where('status', 'completed'))
                .fetchCount();

            setTotalWeaves(allCompletedWeaves);

            // Calculate total days active
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

    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
        <View style={{ gap: spacing[6] }}>
            {/* Season Explanation */}
            {explanation && (
                <Card variant="elevated">
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
            )}

            {/* Calendar */}
            <Card>
                <WidgetHeader title="Rhythm" subtitle={format(today, 'MMMM yyyy')} />

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
                        const isToday = isSameDay(day, today);
                        const isCurrentMonth = day.getMonth() === today.getMonth();

                        return (
                            <View key={index} style={styles.dayCell}>
                                <View style={[
                                    styles.dayContent,
                                    hasActivity && { backgroundColor: tokens.primary + '20' },
                                    hasCompletedWeave && { backgroundColor: tokens.primary, borderRadius: 999 },
                                    !isCurrentMonth && { opacity: 0.3 }
                                ]}>
                                    <Text style={[
                                        styles.dayText,
                                        {
                                            color: hasCompletedWeave ? tokens.primaryForeground : tokens.foreground,
                                            fontFamily: isToday ? typography.fonts.sansSemiBold : typography.fonts.sans
                                        }
                                    ]}>
                                        {day.getDate()}
                                    </Text>
                                </View>
                            </View>
                        );
                    })}
                </View>
            </Card>

            {/* Stats */}
            <Card>
                <WidgetHeader title="History" />
                <View style={styles.statsGrid}>
                    <Stat label="Total Weaves" value={totalWeaves} />
                    <Stat label="Active Days" value={totalDaysActive} />
                    <Stat label="This Month" value={monthlyWeaves} />
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
});
