import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { Q } from '@nozbe/watermelondb';
import { format, startOfWeek, addDays, isSameWeek } from 'date-fns';
import { Clock, CheckCircle2, ChevronRight, Play } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface JournalReflectionsProps {
    onEntryPress: (entry: WeeklyReflection) => void;
    onNewReflection: () => void;
}

export function JournalReflections({ onEntryPress, onNewReflection }: JournalReflectionsProps) {
    const { colors, typography, tokens } = useTheme();
    const router = useRouter(); // Use router if we need direct nav, or props
    const [reflections, setReflections] = useState<WeeklyReflection[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Current week status
    const [thisWeekStatus, setThisWeekStatus] = useState<'locked' | 'ready' | 'done'>('locked');
    const [currentWeekReflection, setCurrentWeekReflection] = useState<WeeklyReflection | null>(null);

    const loadData = useCallback(async () => {
        try {
            // Fetch past reflections
            const data = await database
                .get<WeeklyReflection>('weekly_reflections')
                .query(
                    Q.sortBy('week_start_date', Q.desc)
                )
                .fetch();

            setReflections(data);

            // Determine status for this week (starts Monday usually, or Sunday depending on locale, let's assume Monday for ISO)
            // But Weave uses "Social Season" logic where Sunday is usually reflection day.
            const today = new Date();
            const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday

            // Check if reflection exists for this week
            // Logic: Find a reflection where weekStartDate is within the last 7 days matching the cycle?
            // Simplified: Look for a reflection created/started this week.
            // Actually, we usually key off "weekStartDate".

            const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 1 }); // Monday start
            const existing = data.find(r => isSameWeek(new Date(r.weekStartDate), today, { weekStartsOn: 1 }));

            if (existing) {
                setThisWeekStatus('done');
                setCurrentWeekReflection(existing);
            } else {
                // If it's Sunday (0) or Monday (1), it's "Ready"
                if (dayOfWeek === 0 || dayOfWeek === 1) {
                    setThisWeekStatus('ready');
                } else {
                    // Start mid-week? We allow it but maybe "locked" state isn't strict.
                    // Let's say it's always "ready" if not done? 
                    // User requested "managing" so maybe "Start" is always available but "Recommended on Sunday".
                    // Let's stick to "Ready" if not done.
                    setThisWeekStatus('ready');
                }
            }

        } catch (error) {
            console.error('Error loading reflections:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();

        const sub = database.get<WeeklyReflection>('weekly_reflections').changes.subscribe(() => {
            loadData();
        });
        return () => sub.unsubscribe();
    }, [loadData]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const formatDateRange = (dateStr: string | number) => {
        const start = new Date(dateStr);
        const end = addDays(start, 6);
        return `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
    };

    const renderHeaderCard = () => {
        // Status Card
        const isDone = thisWeekStatus === 'done';

        return (
            <Animated.View entering={FadeInDown.duration(400)} className="mb-6">
                <View
                    className="p-5 rounded-3xl overflow-hidden"
                    style={{
                        backgroundColor: isDone ? colors.card : tokens.primary,
                        borderWidth: isDone ? 1 : 0,
                        borderColor: colors.border
                    }}
                >
                    {!isDone && (
                        // Background decoration for "Ready" state
                        <View className="absolute -right-10 -bottom-10 opacity-20">
                            <Clock size={120} color={colors['primary-foreground']} />
                        </View>
                    )}

                    <View className="flex-row justify-between items-start mb-4">
                        <View>
                            <Text
                                className="text-sm font-semibold uppercase tracking-wider mb-1"
                                style={{
                                    color: isDone ? colors['muted-foreground'] : 'rgba(255,255,255,0.8)'
                                }}
                            >
                                {isDone ? 'This Week' : 'Action Required'}
                            </Text>
                            <Text
                                className="text-2xl font-serif font-bold"
                                style={{
                                    color: isDone ? colors.foreground : colors['primary-foreground']
                                }}
                            >
                                {isDone ? 'Reflection Complete' : 'Weekly Reflection'}
                            </Text>
                        </View>
                        <View
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{
                                backgroundColor: isDone ? colors.muted : 'rgba(255,255,255,0.2)'
                            }}
                        >
                            {isDone ? (
                                <CheckCircle2 size={20} color={colors.primary} />
                            ) : (
                                <Play size={20} color={colors['primary-foreground']} fill={colors['primary-foreground']} />
                            )}
                        </View>
                    </View>

                    <Text
                        className="text-base mb-6 leading-6"
                        style={{
                            color: isDone ? colors['muted-foreground'] : 'rgba(255,255,255,0.9)'
                        }}
                    >
                        {isDone
                            ? "You've captured your social energy for this week. Great job staying mindful!"
                            : "Take 2 minutes to review your social week, track your energy, and set intentions."}
                    </Text>

                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            if (isDone && currentWeekReflection) {
                                onEntryPress(currentWeekReflection);
                            } else {
                                onNewReflection();
                            }
                        }}
                        className="py-3 px-6 rounded-xl flex-row items-center justify-center self-start gap-2"
                        style={{
                            backgroundColor: isDone ? colors.muted : colors.card
                        }}
                    >
                        <Text
                            className="font-semibold text-sm"
                            style={{
                                color: isDone ? colors.foreground : colors.primary
                            }}
                        >
                            {isDone ? 'View Summary' : 'Start Reflection'}
                        </Text>
                        {!isDone && <ChevronRight size={16} color={colors.primary} />}
                    </TouchableOpacity>
                </View>
            </Animated.View>
        );
    };

    return (
        <ScrollView
            className="flex-1 px-5"
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
            }
        >
            {renderHeaderCard()}

            <Text
                className="text-xs uppercase tracking-wide mb-4 mt-2"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
            >
                Start History
            </Text>

            {reflections.length === 0 && thisWeekStatus !== 'done' && (
                <Text style={{ color: colors['muted-foreground'] }} className="italic text-center py-10">
                    No past reflections yet.
                </Text>
            )}

            {reflections.map((entry, index) => (
                <Animated.View
                    key={entry.id}
                    entering={FadeInDown.delay(index * 50).duration(400)}
                >
                    <TouchableOpacity
                        onPress={() => onEntryPress(entry)}
                        className="mb-3 p-4 rounded-2xl border flex-row items-center gap-4"
                        style={{
                            backgroundColor: colors.card,
                            borderColor: colors.border
                        }}
                    >
                        <View
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <Clock size={18} color={colors['muted-foreground']} />
                        </View>

                        <View className="flex-1">
                            <Text
                                className="text-base font-medium mb-0.5"
                                style={{ color: colors.foreground }}
                            >
                                Week of {formatDateRange(entry.weekStartDate)}
                            </Text>
                            <Text
                                className="text-sm"
                                style={{ color: colors['muted-foreground'] }}
                                numberOfLines={1}
                            >
                                {entry.gratitudeText ? entry.gratitudeText : 'No notes added'}
                            </Text>
                        </View>

                        <ChevronRight size={18} color={colors.border} />
                    </TouchableOpacity>
                </Animated.View>
            ))}

            <View className="h-24" />
        </ScrollView>
    );
}
