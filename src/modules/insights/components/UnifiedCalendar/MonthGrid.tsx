/**
 * MonthGrid Component
 * Displays a month grid with colored moon phases for each day
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSequence,
    withSpring,
} from 'react-native-reanimated';
import {
    startOfMonth,
    endOfMonth,
    eachDayOfInterval,
    format,
    isSameDay,
    isToday,
    getDay,
    addMonths,
    subMonths,
} from 'date-fns';

import { useTheme } from '@/shared/hooks/useTheme';
import { MoonPhaseIllustration } from '@/modules/intelligence/components/social-season/YearInMoons/MoonPhaseIllustration';

/**
 * Animated wrapper for moon cells that pulses when battery level changes
 */
const AnimatedMoonCell = React.memo(({
    children,
    batteryLevel,
    hasCheckin,
}: {
    children: React.ReactNode;
    batteryLevel: number | null;
    hasCheckin: boolean;
}) => {
    const scale = useSharedValue(1);
    const firstRender = useRef(true);
    const prevHasCheckin = useRef(hasCheckin);

    useEffect(() => {
        // Skip animation on first render
        if (firstRender.current) {
            firstRender.current = false;
            prevHasCheckin.current = hasCheckin;
            return;
        }

        // Animate when a new check-in appears (hasCheckin changes from false to true)
        // or when batteryLevel changes on an existing check-in
        if (hasCheckin && (!prevHasCheckin.current || batteryLevel !== null)) {
            scale.value = withSequence(
                withSpring(1.08, { damping: 15, stiffness: 300 }),
                withSpring(1, { damping: 15, stiffness: 200 })
            );
        }

        prevHasCheckin.current = hasCheckin;
    }, [batteryLevel, hasCheckin]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.value }],
    }));

    return (
        <Animated.View style={animatedStyle}>
            {children}
        </Animated.View>
    );
});

export interface DayData {
    date: Date;
    batteryLevel: number | null;
    hasCheckin: boolean;
    weaveCount?: number;
    planCount?: number;
}

interface MonthGridProps {
    currentMonth: Date;
    onMonthChange: (date: Date) => void;
    dayData: Map<string, DayData>;
    onDayPress: (date: Date, data: DayData | null) => void;
    selectedDate?: Date | null;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function MonthGrid({
    currentMonth,
    onMonthChange,
    dayData,
    onDayPress,
    selectedDate,
}: MonthGridProps) {
    const { tokens, typography } = useTheme();
    const screenWidth = Dimensions.get('window').width;
    const columnWidth = Math.floor((screenWidth - 48) / 7);
    const moonSize = Math.floor(columnWidth * 0.7);

    // Generate days for the month
    const days = useMemo(() => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(currentMonth);
        const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

        // Add padding for the first week
        const startDayOfWeek = getDay(monthStart);
        const paddingDays: (Date | null)[] = Array(startDayOfWeek).fill(null);

        return [...paddingDays, ...daysInMonth];
    }, [currentMonth]);

    const handlePrevMonth = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onMonthChange(subMonths(currentMonth, 1));
    };

    const handleNextMonth = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onMonthChange(addMonths(currentMonth, 1));
    };

    const handleDayPress = (date: Date) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const dateKey = format(date, 'yyyy-MM-dd');
        const data = dayData.get(dateKey) || null;
        onDayPress(date, data);
    };

    const getDataForDay = (date: Date): DayData | null => {
        const dateKey = format(date, 'yyyy-MM-dd');
        return dayData.get(dateKey) || null;
    };

    return (
        <View className="px-4">
            {/* Month Navigation */}
            <View className="flex-row items-center justify-between mb-4">
                <TouchableOpacity onPress={handlePrevMonth} className="p-2">
                    <ChevronLeft size={24} color={tokens.foreground} />
                </TouchableOpacity>
                <Text
                    className="text-lg font-lora-bold"
                    style={{ color: tokens.foreground }}
                >
                    {format(currentMonth, 'MMMM yyyy')}
                </Text>
                <TouchableOpacity onPress={handleNextMonth} className="p-2">
                    <ChevronRight size={24} color={tokens.foreground} />
                </TouchableOpacity>
            </View>

            {/* Weekday Headers */}
            <View className="flex-row mb-2">
                {WEEKDAYS.map((day, i) => (
                    <View key={i} style={{ width: columnWidth, alignItems: 'center' }}>
                        <Text
                            className="text-xs font-inter"
                            style={{ color: tokens.foregroundMuted }}
                        >
                            {day}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Days Grid */}
            <View className="flex-row flex-wrap">
                {days.map((day, index) => {
                    if (!day) {
                        // Padding cell
                        return (
                            <View
                                key={`padding-${index}`}
                                style={{ width: columnWidth, height: moonSize + 20 }}
                            />
                        );
                    }

                    const data = getDataForDay(day);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isTodayDate = isToday(day);

                    const hasWeave = (data?.weaveCount || 0) > 0;
                    const hasPlan = (data?.planCount || 0) > 0;

                    // Determine border style
                    let borderWidth = 0;
                    let borderColor = 'transparent';
                    let borderStyle: 'solid' | 'dashed' = 'solid';

                    if (hasWeave) {
                        borderWidth = 1.5;
                        borderColor = tokens.primary;
                        borderStyle = 'solid';
                    } else if (hasPlan) {
                        borderWidth = 1.5;
                        borderColor = tokens.primary;
                        borderStyle = 'dashed';
                    } else if (isTodayDate) {
                        // Fallback for Today if no event
                        // We can make it subtle or just rely on bold text
                        // Let's keep a very subtle border for today if nothing else
                        borderWidth = 1;
                        borderColor = tokens.border; // Subtle border for today
                    }

                    return (
                        <TouchableOpacity
                            key={day.toISOString()}
                            onPress={() => handleDayPress(day)}
                            style={{
                                width: columnWidth,
                                height: moonSize + 20,
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <AnimatedMoonCell
                                batteryLevel={data?.batteryLevel ?? null}
                                hasCheckin={data?.hasCheckin ?? false}
                            >
                                <View
                                    style={{
                                        borderRadius: moonSize, // Full circle
                                        padding: 4,
                                        backgroundColor: isSelected
                                            ? tokens.primary + '20'
                                            : 'transparent',
                                        borderWidth,
                                        borderColor,
                                        borderStyle,
                                    }}
                                >
                                    <MoonPhaseIllustration
                                        phase={0}
                                        batteryLevel={data?.batteryLevel ?? undefined}
                                        size={moonSize}
                                        hasCheckin={data?.hasCheckin ?? false}
                                    />
                                </View>
                            </AnimatedMoonCell>
                            <Text
                                className="text-[10px] mt-0.5 font-inter"
                                style={{
                                    color: data?.hasCheckin
                                        ? tokens.foreground
                                        : tokens.foregroundMuted,
                                    fontWeight: isTodayDate ? '600' : '400',
                                }}
                            >
                                {format(day, 'd')}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
