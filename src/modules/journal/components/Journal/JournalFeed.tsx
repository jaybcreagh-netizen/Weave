import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { Q } from '@nozbe/watermelondb';
import { format } from 'date-fns';
import { BookOpen, Edit3, Clock } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Shared types (can come from a types file, but defining here for now for independence)
interface JournalFeedProps {
    onEntryPress: (entry: JournalEntry | WeeklyReflection) => void;
}

export function JournalFeed({ onEntryPress }: JournalFeedProps) {
    const { colors } = useTheme();
    const [entries, setEntries] = useState<(JournalEntry | WeeklyReflection)[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMoreEntries, setHasMoreEntries] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    const ENTRIES_PAGE_SIZE = 50;

    const loadEntries = useCallback(async (reset = true) => {
        const offset = reset ? 0 : entries.length;
        if (!reset) setLoadingMore(true);

        try {
            const [journalEntries, reflections] = await Promise.all([
                database
                    .get<JournalEntry>('journal_entries')
                    .query(
                        Q.sortBy('entry_date', Q.desc),
                        Q.skip(offset),
                        Q.take(ENTRIES_PAGE_SIZE)
                    )
                    .fetch(),
                // Keep historical context of reflections in feed? Strategy: Yes, "All" means all.
                // Fetch fewer reflections if pagination deepens, but for now filtering purely by date.
                // Simple logic: fetch reflections only if reset, or if offset logic supports it. 
                // Currently maintaining JournalHome logic where reflections were fetched on reset.
                reset ? database
                    .get<WeeklyReflection>('weekly_reflections')
                    .query(Q.sortBy('week_start_date', Q.desc), Q.take(20))
                    .fetch() : Promise.resolve([]),
            ]);

            setHasMoreEntries(journalEntries.length === ENTRIES_PAGE_SIZE);

            const newEntries = [...journalEntries, ...reflections].sort((a, b) => {
                const dateA = 'entryDate' in a ? a.entryDate : a.weekStartDate;
                const dateB = 'entryDate' in b ? b.entryDate : b.weekStartDate;
                return dateB - dateA; // Descending
            });

            if (reset) {
                setEntries(newEntries);
                setLoading(false);
            } else {
                setEntries(prev => {
                    const existingIds = new Set(prev.map(e => e.id));
                    const uniqueNew = newEntries.filter(e => !existingIds.has(e.id));
                    return [...prev, ...uniqueNew];
                });
                setLoadingMore(false);
            }
        } catch (error) {
            console.error('Error loading feed:', error);
            setLoading(false);
            setLoadingMore(false);
        }
    }, [entries.length]);

    useEffect(() => {
        loadEntries(true);

        // Subscription logic could reside here or in parent. 
        // Keeping it simple: load on mount.
        // For real-time updates, parent subscription is better, or observable hoc.
        // Let's rely on refresh for now or add lightweight sub.
        const sub = database.get<JournalEntry>('journal_entries').changes.subscribe(() => {
            // Only refresh if near top? Or just let user refresh.
            // For now, no auto-refresh on change to avoid jumpiness during paging.
        });
        return () => sub.unsubscribe();
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadEntries(true);
        setRefreshing(false);
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const isWeeklyReflection = (entry: any): entry is WeeklyReflection => 'weekStartDate' in entry;

    const renderEntryCard = (entry: JournalEntry | WeeklyReflection, index: number) => {
        const isReflection = isWeeklyReflection(entry);
        const date = isReflection
            ? new Date(entry.weekStartDate)
            : new Date(entry.entryDate);

        return (
            <Animated.View
                key={entry.id}
                entering={FadeInDown.delay(index * 30).duration(300)}
            >
                <TouchableOpacity
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        onEntryPress(entry);
                    }}
                    className="mb-3 p-4 rounded-2xl"
                    style={{
                        backgroundColor: colors.card,
                        borderWidth: 1,
                        borderColor: colors.border,
                    }}
                    activeOpacity={0.7}
                >
                    <View className="flex-row items-center gap-2 mb-2">
                        {isReflection ? (
                            <Clock size={14} color={colors.primary} />
                        ) : (
                            <Edit3 size={14} color={colors.primary} />
                        )}
                        <Text
                            className="text-xs flex-1"
                            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                        >
                            {formatDate(date)}
                        </Text>
                        {isReflection && (
                            <View
                                className="px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: colors.muted }}
                            >
                                <Text
                                    className="text-xs"
                                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                                >
                                    Weekly
                                </Text>
                            </View>
                        )}
                    </View>

                    <Text
                        className="text-base mb-1"
                        style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                    >
                        {isReflection ? 'Weekly Reflection' : (entry as JournalEntry).title || 'Journal Entry'}
                    </Text>

                    <Text
                        className="text-sm"
                        style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                        numberOfLines={2}
                    >
                        {isReflection
                            ? (entry as WeeklyReflection).gratitudeText
                            : (entry as JournalEntry).content}
                    </Text>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    if (loading) {
        return (
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    }

    if (entries.length === 0) {
        return (
            <View className="flex-1 items-center justify-center px-8 py-16">
                <BookOpen size={40} color={colors['muted-foreground']} />
                <Text
                    className="text-lg mt-4 text-center"
                    style={{ color: colors.foreground, fontFamily: 'Lora_500Medium' }}
                >
                    No entries yet
                </Text>
                <Text
                    className="text-sm mt-2 text-center"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                    Start documenting your friendships
                </Text>
            </View>
        );
    }

    return (
        <ScrollView
            className="flex-1 px-5"
            showsVerticalScrollIndicator={false}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
            }
        >
            {entries.map((entry, index) => renderEntryCard(entry, index))}

            {hasMoreEntries && (
                <View className="py-4">
                    <TouchableOpacity
                        onPress={() => loadEntries(false)}
                        disabled={loadingMore}
                        className="py-3 rounded-xl items-center"
                        style={{
                            backgroundColor: colors.muted,
                            opacity: loadingMore ? 0.6 : 1,
                        }}
                    >
                        {loadingMore ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <Text
                                className="text-sm"
                                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                            >
                                Load more entries
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            <View className="h-24" />
        </ScrollView>
    );
}
