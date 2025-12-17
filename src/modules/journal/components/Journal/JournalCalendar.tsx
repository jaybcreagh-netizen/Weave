import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import FriendModel from '@/db/models/Friend';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { format, parseISO } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import Animated, { FadeInDown } from 'react-native-reanimated';

interface JournalCalendarProps {
    onEntryPress: (entry: JournalEntry | WeeklyReflection) => void;
}

interface CalendarEntryItem {
    id: string;
    dateStr: string;
    type: 'journal' | 'reflection';
    entry: JournalEntry | WeeklyReflection;
}

export function JournalCalendar({ onEntryPress }: JournalCalendarProps) {
    const { colors, typography } = useTheme();
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

    // We store minimal data needed for marking
    const [calendarEntries, setCalendarEntries] = useState<CalendarEntryItem[]>([]);
    const [milestones, setMilestones] = useState<any[]>([]); // simplified

    useEffect(() => {
        loadCalendarData();
    }, []);

    const loadCalendarData = async () => {
        try {
            // Fetch ALL entries for calendar marking (optimized query if possible, but WMDB queries return full objects)
            // We can just fetch all safely as they are local. If thousands, might need batching, but for now fetch all.
            const [journalEntries, reflections, friends] = await Promise.all([
                database.get<JournalEntry>('journal_entries').query().fetch(),
                database.get<WeeklyReflection>('weekly_reflections').query().fetch(),
                database.get<FriendModel>('friends').query().fetch()
            ]);

            const items: CalendarEntryItem[] = [];

            journalEntries.forEach(e => {
                items.push({
                    id: e.id,
                    dateStr: format(new Date(e.entryDate), 'yyyy-MM-dd'),
                    type: 'journal',
                    entry: e
                });
            });

            reflections.forEach(r => {
                items.push({
                    id: r.id,
                    dateStr: format(new Date(r.weekStartDate), 'yyyy-MM-dd'),
                    type: 'reflection',
                    entry: r
                });
            });

            setCalendarEntries(items);

            // Process milestones from friends
            // (Simplification: Just passed processed milestones if needed, or recalculate here)
            // For now, let's skip complex milestones visualization inside the calendar dots to keep it clean 
            // matching the "Streamlined" goal, but current JournalHome has them.
            // Let's keep it simple: Dot for Entry.

        } catch (error) {
            console.error('Error loading calendar data:', error);
        } finally {
            setLoading(false);
        }
    };

    const markedDates = useMemo(() => {
        const marks: any = {};

        // Mark dates with entries
        calendarEntries.forEach(item => {
            marks[item.dateStr] = {
                marked: true,
                dotColor: colors.primary,
            };
        });

        // Mark selected date
        if (selectedDate) {
            marks[selectedDate] = {
                ...(marks[selectedDate] || {}),
                selected: true,
                selectedColor: colors.primary,
                selectedTextColor: colors['primary-foreground']
            };
        }

        return marks;
    }, [calendarEntries, selectedDate, colors]);

    const selectedEntries = useMemo(() => {
        return calendarEntries.filter(e => e.dateStr === selectedDate);
    }, [calendarEntries, selectedDate]);

    // Import JournalCalendarDay from shared/components if widely used? 
    // Currently it was local to JournalHome. I will assume we can just use standard list content below the calendar.

    return (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="px-5 mb-4">
                <View
                    className="rounded-2xl overflow-hidden"
                    style={{
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.card
                    }}
                >
                    <RNCalendar
                        current={selectedDate}
                        onDayPress={(day: DateData) => {
                            setSelectedDate(day.dateString);
                        }}
                        markedDates={markedDates}
                        theme={{
                            backgroundColor: colors.card,
                            calendarBackground: colors.card,
                            textSectionTitleColor: colors['muted-foreground'],
                            selectedDayBackgroundColor: colors.primary,
                            selectedDayTextColor: colors['primary-foreground'],
                            todayTextColor: colors.primary,
                            dayTextColor: colors.foreground,
                            textDisabledColor: colors.muted,
                            dotColor: colors.primary,
                            monthTextColor: colors.foreground,
                            arrowColor: colors.primary,
                            textMonthFontFamily: typography.fonts.sansMedium,
                            textDayFontFamily: typography.fonts.sans,
                            textDayHeaderFontFamily: typography.fonts.sansMedium,
                        }}
                    />
                </View>
            </View>

            <View className="px-5">
                <Text
                    className="text-xs uppercase tracking-wide mb-4"
                    style={{ color: colors['muted-foreground'], fontFamily: typography.fonts.sansSemiBold }}
                >
                    {selectedDate === format(new Date(), 'yyyy-MM-dd') ? 'Today' : format(parseISO(selectedDate), 'MMMM d, yyyy')}
                </Text>

                {selectedEntries.length === 0 ? (
                    <Text className="text-center py-8 italic" style={{ color: colors['muted-foreground'] }}>
                        No entries for this date.
                    </Text>
                ) : (
                    selectedEntries.map((item, index) => {
                        // Re-use render logic? Or import JournalFeed card?
                        // For simplicity, simple text list for now as "Streamlined".
                        // Or better: Create a shared EntryCard component?
                        // I'll render a simple view.
                        const title = item.type === 'journal'
                            ? (item.entry as JournalEntry).title || 'Journal Entry'
                            : 'Weekly Reflection';

                        return (
                            <Animated.View
                                key={item.id}
                                entering={FadeInDown.delay(index * 50)}
                            >
                                <TouchableOpacity
                                    onPress={() => onEntryPress(item.entry)}
                                    className="p-4 mb-3 rounded-xl border flex-row justify-between items-center"
                                    style={{
                                        backgroundColor: colors.card,
                                        borderColor: colors.border
                                    }}
                                >
                                    <Text className="flex-1 mr-4" style={{ color: colors.foreground, fontFamily: typography.fonts.sansMedium }}>{title}</Text>
                                    <Text style={{ color: colors.primary, fontFamily: typography.fonts.sansMedium }}>View</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        );
                    })
                )}
            </View>
            <View className="h-24" />
        </ScrollView>
    );
}
