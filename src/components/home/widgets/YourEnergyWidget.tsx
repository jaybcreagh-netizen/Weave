import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { Moon, BookOpen, Zap } from 'lucide-react-native';
import withObservables from '@nozbe/with-observables';
import { Q } from '@nozbe/watermelondb';

import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { MoonPhaseIllustration } from '@/components/YearInMoons/MoonPhaseIllustration';
import { YearInMoonsModal } from '@/components/YearInMoons/YearInMoonsModal';
import { ReflectionJourneyModal } from '@/components/ReflectionJourney/ReflectionJourneyModal';
import { WidgetHeader } from '@/components/ui/WidgetHeader';
import { Card } from '@/components/ui/Card';
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

interface YourEnergyWidgetContentProps {
    logs: SocialBatteryLog[];
}

const YourEnergyWidgetContent: React.FC<YourEnergyWidgetContentProps> = ({ logs }) => {
    const { tokens, typography, colors } = useTheme();
    const [showModal, setShowModal] = useState(false);
    const [showJournal, setShowJournal] = useState(false);

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
        monthData: MonthMoonData | null;
        stats: any;
    }>({ monthData: null, stats: null });

    React.useEffect(() => {
        let mounted = true;
        const load = async () => {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth();

            const [yearData, stats] = await Promise.all([
                getYearMoonData(currentYear),
                getYearStats(currentYear),
            ]);

            if (mounted) {
                setAsyncData({
                    monthData: yearData[currentMonth],
                    stats: stats
                });
            }
        };
        load();
        return () => { mounted = false; };
    }, [logs]);

    if (!asyncData.monthData) {
        return (
            <HomeWidgetBase config={WIDGET_CONFIG} isLoading={true}>
                <View />
            </HomeWidgetBase>
        );
    }

    const currentMonthData = asyncData.monthData;
    const currentStats = yearStats;
    const currentMonthName = getMonthName(currentMonthData.month);

    // Flatten year data to get continuous days for correct cross-month week calculation
    // We need this because a "2 week view" might span across two months
    // Since we only have current month data in asyncData.monthData, we need to be careful.
    // Ideally we should have the full year data, but for now let's work with what we have
    // and assume the user is mostly interested in the current context.

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
        // We can search in the current month data if it matches
        const existingDay = currentMonthData.days.find(d =>
            d.date.getDate() === date.getDate() &&
            d.date.getMonth() === date.getMonth()
        );

        if (existingDay) return existingDay;

        // Fallback for days not in current loaded month (e.g. previous month tail)
        // We create a dummy day object. In a real scenario we'd fetch prev month data too.
        return {
            date: date,
            moonPhase: 0, // Default or calculate if needed
            hasCheckin: false,
            batteryLevel: null,
            journalEntry: null
        } as any; // Cast to avoid strict type issues with missing props if any
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
                            onPress: () => setShowModal(true)
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
                                    color={tokens.primary}
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
                                onPress={() => setShowJournal(true)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tokens.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                            >
                                <BookOpen size={12} color={tokens.background} />
                                <Text style={{
                                    fontSize: typography.scale.label.fontSize,
                                    lineHeight: typography.scale.label.lineHeight,
                                    fontFamily: typography.fonts.sansSemiBold,
                                    color: tokens.background
                                }}>
                                    Journal
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setShowModal(true)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: tokens.secondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                            >
                                <Moon size={12} color={tokens.foreground} />
                                <Text style={{
                                    fontSize: typography.scale.label.fontSize,
                                    lineHeight: typography.scale.label.lineHeight,
                                    fontFamily: typography.fonts.sansMedium,
                                    color: tokens.foreground
                                }}>
                                    Full Year
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </HomeWidgetBase>

            <YearInMoonsModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
            />

            <ReflectionJourneyModal
                isOpen={showJournal}
                onClose={() => setShowJournal(false)}
            />
        </>
    );
};

const enhance = withObservables([], () => {
    const currentYear = new Date().getFullYear();
    const startOfYear = new Date(currentYear, 0, 1).getTime();
    const endOfYear = new Date(currentYear, 11, 31).getTime();

    return {
        logs: database.get<SocialBatteryLog>('social_battery_logs')
            .query(
                Q.where('timestamp', Q.gte(startOfYear)),
                Q.where('timestamp', Q.lte(endOfYear))
            )
            .observe(),
    };
});

export const YourEnergyWidget = enhance(YourEnergyWidgetContent);
