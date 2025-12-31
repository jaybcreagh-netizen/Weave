import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Calendar, Sparkles, Zap } from 'lucide-react-native';
import { Q } from '@nozbe/watermelondb';
import { useRouter } from 'expo-router';

import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { MoonPhaseIllustration } from '@/modules/intelligence';
import { UnifiedCalendarModal } from '@/modules/insights/components/UnifiedCalendar';
import { WidgetHeader } from '@/shared/ui/WidgetHeader';
import {
    getYearMoonData,
    getYearStats,
    getMonthName,
    MonthMoonData,
} from '@/modules/reflection';
import SocialBatteryLog from '@/db/models/SocialBatteryLog';

const WIDGET_CONFIG: HomeWidgetConfig = {
    id: 'your-energy',
    type: 'your-energy',
    title: 'Your Energy',
    fullWidth: true,
};

/**
 * Hook to observe battery logs for the current year
 * Replaces withObservables HOC for better performance and simpler code
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
    }, []); // Only subscribe once on mount

    return logs;
}

export const YourEnergyWidget: React.FC = () => {
    const logs = useBatteryLogs();
    const { tokens, typography, colors } = useTheme();
    const router = useRouter();
    const [showLifeCalendar, setShowLifeCalendar] = useState(false);
    const [calendarInitialTab, setCalendarInitialTab] = useState<'moons' | 'patterns'>('moons');

    const screenWidth = Dimensions.get('window').width;
    // Calculate column width to ensure 7 items fit perfectly in the row
    const columnWidth = Math.floor((screenWidth - 100) / 7);
    // Moon size is 67% of the column width (reduced size as requested)
    const moonSize = Math.floor(columnWidth * 0.67);

    // Process data synchronously when logs change
    const { yearStats } = useMemo(() => {
        const totalCheckins = logs.length;
        const avgBattery = logs.length > 0
            ? (logs.reduce((acc, log) => acc + log.value, 0) / logs.length).toFixed(1)
            : '0.0';

        return {
            currentMonthData: null as MonthMoonData | null,
            yearStats: {
                totalCheckins,
                avgBattery,
                mostCommonLevel: 0,
                streakDays: 0
            }
        };
    }, [logs]);

    const [asyncData, setAsyncData] = useState<{
        yearData: MonthMoonData[] | null;
        stats: any;
    }>({ yearData: null, stats: null });

    // Track if we've loaded initial data
    const hasLoadedInitialData = useRef(false);
    const lastLogCount = useRef(0);

    useEffect(() => {
        // Only refetch if:
        // 1. We haven't loaded initial data yet, OR
        // 2. Log count changed by more than 0 (new checkin)
        const shouldRefetch = !hasLoadedInitialData.current ||
            Math.abs(logs.length - lastLogCount.current) > 0;

        if (!shouldRefetch) return;

        lastLogCount.current = logs.length;
        hasLoadedInitialData.current = true;

        let mounted = true;
        const load = async () => {
            const currentYear = new Date().getFullYear();

            const [yearData, stats] = await Promise.all([
                getYearMoonData(currentYear),
                getYearStats(currentYear),
            ]);

            if (mounted) {
                setAsyncData({
                    yearData: yearData,
                    stats: stats
                });
            }
        };
        load();
        return () => { mounted = false; };
    }, [logs.length]); // Only depend on logs.length, not the full array

    if (!asyncData.yearData) {
        return (
            <HomeWidgetBase config={WIDGET_CONFIG} isLoading={true}>
                <View />
            </HomeWidgetBase>
        );
    }

    const currentMonthIndex = new Date().getMonth();
    const currentMonthData = asyncData.yearData[currentMonthIndex];
    const currentStats = yearStats;
    const currentMonthName = getMonthName(currentMonthData.month);

    // BETTER APPROACH: Use the current date to determine the 2-week window
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)

    // Calculate start date: Today - (Current Day of Week) - 7 days (Previous Sunday)
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - currentDayOfWeek - 7);
    startDate.setHours(0, 0, 0, 0);

    // Generate the 14 days
    const visibleDays = Array.from({ length: 14 }, (_, i) => {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);

        // Find matching log/data if available
        // We search in the correct month within yearData
        const monthIndex = date.getMonth();
        const targetMonthData = asyncData.yearData![monthIndex];

        const existingDay = targetMonthData?.days.find(d =>
            d.date.getDate() === date.getDate() &&
            d.date.getFullYear() === date.getFullYear()
        );

        if (existingDay) return existingDay;

        // Fallback for days not found (e.g. previous year or future)
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
            <HomeWidgetBase config={WIDGET_CONFIG} padding="none">
                <View style={{ padding: 16 }}>
                    <WidgetHeader
                        title="Your Energy"
                        icon={<Zap size={16} color={tokens.primaryMuted} />}
                        action={{
                            label: `${currentMonthName} ${currentMonthData.year}`,
                            onPress: () => setShowLifeCalendar(true)
                        }}
                    />

                    <View style={{ flexDirection: 'row', marginBottom: 12, marginTop: 4 }}>
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

                    {/* Stats & Actions Footer */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: tokens.borderSubtle }}>
                        <View>
                            <Text style={{
                                fontSize: typography.scale.bodySmall.fontSize,
                                lineHeight: typography.scale.bodySmall.lineHeight,
                                fontFamily: typography.fonts.serifBold,
                                color: tokens.foreground
                            }}>
                                Avg: {currentStats.avgBattery}/5
                            </Text>
                            <Text style={{
                                fontSize: typography.scale.caption.fontSize,
                                lineHeight: typography.scale.caption.lineHeight,
                                fontFamily: typography.fonts.sans,
                                color: tokens.foregroundMuted
                            }}>
                                {currentStats.totalCheckins} check-ins
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            <TouchableOpacity
                                onPress={() => setShowLifeCalendar(true)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tokens.secondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                            >
                                <Calendar size={12} color={tokens.foreground} />
                                <Text style={{
                                    fontSize: typography.scale.label.fontSize,
                                    lineHeight: typography.scale.label.lineHeight,
                                    fontFamily: typography.fonts.sansMedium,
                                    color: tokens.foreground
                                }}>
                                    Life Calendar
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setCalendarInitialTab('patterns');
                                    setShowLifeCalendar(true);
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tokens.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                            >
                                <Sparkles size={12} color={tokens.background} />
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
                </View>
            </HomeWidgetBase>

            <UnifiedCalendarModal
                isOpen={showLifeCalendar}
                onClose={() => setShowLifeCalendar(false)}
                initialTab={calendarInitialTab}
            />
        </>
    );
};
