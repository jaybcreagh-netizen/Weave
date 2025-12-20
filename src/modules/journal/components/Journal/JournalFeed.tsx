import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { Q } from '@nozbe/watermelondb';
import { format } from 'date-fns';
import { BookOpen, Edit3, Clock, CheckCircle2, Circle, Trash2, X } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { logger } from '@/shared/services/logger.service';

// Shared types (can come from a types file, but defining here for now for independence)
interface JournalFeedProps {
    onEntryPress: (entry: JournalEntry | WeeklyReflection) => void;
    onEntriesDeleted?: () => void; // Called after entries are deleted
}

export function JournalFeed({ onEntryPress, onEntriesDeleted }: JournalFeedProps) {
    const { colors } = useTheme();
    const [entries, setEntries] = useState<(JournalEntry | WeeklyReflection)[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMoreEntries, setHasMoreEntries] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);

    // Multi-select state
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

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

    const toggleSelectMode = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isSelectMode) {
            // Exit select mode
            setSelectedIds(new Set());
        }
        setIsSelectMode(!isSelectMode);
    };

    const toggleSelection = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const selectAll = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Only select journal entries, not weekly reflections (which can't be deleted from here)
        const journalEntryIds = entries
            .filter(e => !isWeeklyReflection(e))
            .map(e => e.id);
        setSelectedIds(new Set(journalEntryIds));
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;

        // Filter to only include journal entries (WeeklyReflections handled separately)
        const entriesToDelete = entries.filter(
            e => selectedIds.has(e.id) && !isWeeklyReflection(e)
        ) as JournalEntry[];

        if (entriesToDelete.length === 0) {
            Alert.alert('Cannot Delete', 'Weekly reflections cannot be deleted from here.');
            return;
        }

        const count = entriesToDelete.length;
        Alert.alert(
            `Delete ${count} ${count === 1 ? 'Entry' : 'Entries'}?`,
            'These journal entries will be permanently deleted. This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        setIsDeleting(true);
                        try {
                            await database.write(async () => {
                                const deleteOps = await Promise.all(
                                    entriesToDelete.map(entry => entry.prepareDestroyWithChildren())
                                );
                                await database.batch(...deleteOps);
                            });

                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            setSelectedIds(new Set());
                            setIsSelectMode(false);
                            onEntriesDeleted?.();
                            // Refresh the list
                            await loadEntries(true);
                        } catch (error) {
                            logger.error('JournalFeed', 'Error deleting entries:', error);
                            Alert.alert('Error', 'Failed to delete entries. Please try again.');
                        } finally {
                            setIsDeleting(false);
                        }
                    },
                },
            ]
        );
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
        const isSelected = selectedIds.has(entry.id);
        const canSelect = !isReflection; // Only journal entries can be selected for deletion

        const handlePress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (isSelectMode && canSelect) {
                toggleSelection(entry.id);
            } else {
                onEntryPress(entry);
            }
        };

        const handleLongPress = () => {
            if (!isSelectMode && canSelect) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setIsSelectMode(true);
                setSelectedIds(new Set([entry.id]));
            }
        };

        return (
            <Animated.View
                key={entry.id}
                entering={FadeInDown.delay(index * 30).duration(300)}
            >
                <TouchableOpacity
                    onPress={handlePress}
                    onLongPress={handleLongPress}
                    className="mb-3 p-4 rounded-2xl"
                    style={{
                        backgroundColor: colors.card,
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? colors.primary : colors.border,
                    }}
                    activeOpacity={0.7}
                >
                    <View className="flex-row items-center gap-2 mb-2">
                        {/* Selection checkbox */}
                        {isSelectMode && (
                            <View className="mr-1">
                                {canSelect ? (
                                    isSelected ? (
                                        <CheckCircle2 size={20} color={colors.primary} />
                                    ) : (
                                        <Circle size={20} color={colors['muted-foreground']} />
                                    )
                                ) : (
                                    <View style={{ width: 20 }} />
                                )}
                            </View>
                        )}

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

    // Count of selectable entries (journal entries only)
    const selectableCount = entries.filter(e => !isWeeklyReflection(e)).length;

    return (
        <View className="flex-1">
            {/* Selection Toolbar */}
            {entries.length > 0 && (
                <View className="flex-row items-center justify-between px-5 py-2 mb-2">
                    {isSelectMode ? (
                        <>
                            <View className="flex-row items-center gap-3">
                                <TouchableOpacity
                                    onPress={toggleSelectMode}
                                    className="p-2 rounded-full"
                                    style={{ backgroundColor: colors.muted }}
                                >
                                    <X size={18} color={colors.foreground} />
                                </TouchableOpacity>
                                <Text
                                    className="text-sm"
                                    style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                                >
                                    {selectedIds.size} selected
                                </Text>
                            </View>
                            <View className="flex-row items-center gap-2">
                                {selectedIds.size < selectableCount && (
                                    <TouchableOpacity
                                        onPress={selectAll}
                                        className="px-3 py-1.5 rounded-lg"
                                        style={{ backgroundColor: colors.muted }}
                                    >
                                        <Text
                                            className="text-xs"
                                            style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                                        >
                                            Select All
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    onPress={handleDeleteSelected}
                                    disabled={selectedIds.size === 0 || isDeleting}
                                    className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg"
                                    style={{
                                        backgroundColor: selectedIds.size > 0 ? colors.destructive : colors.muted,
                                        opacity: selectedIds.size === 0 || isDeleting ? 0.5 : 1,
                                    }}
                                >
                                    {isDeleting ? (
                                        <ActivityIndicator size="small" color={colors['primary-foreground']} />
                                    ) : (
                                        <>
                                            <Trash2 size={14} color={selectedIds.size > 0 ? '#fff' : colors['muted-foreground']} />
                                            <Text
                                                className="text-xs"
                                                style={{
                                                    color: selectedIds.size > 0 ? '#fff' : colors['muted-foreground'],
                                                    fontFamily: 'Inter_500Medium',
                                                }}
                                            >
                                                Delete
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <View className="flex-1 flex-row justify-end">
                            <TouchableOpacity
                                onPress={toggleSelectMode}
                                className="px-3 py-1.5 rounded-lg"
                                style={{ backgroundColor: colors.muted }}
                            >
                                <Text
                                    className="text-xs"
                                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                                >
                                    Select
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

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
        </View>
    );
}
