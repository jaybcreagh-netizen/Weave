import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { BookOpen, Trash2, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { logger } from '@/shared/services/logger.service';
import { PerfLogger } from '@/shared/utils/performance-logger';
import { SkeletonJournalFeed } from './SkeletonJournalFeed';
import { useEnrichedFeed, FeedItem, EnrichedFeedItem } from '../../hooks/useEnrichedFeed';
import { EnrichedEntryCard } from './EnrichedEntryCard';
import { ArcSummary } from './ArcSummary';
import { DateSectionHeader } from './DateSectionHeader';

interface JournalFeedProps {
    onEntryPress: (entry: JournalEntry | WeeklyReflection) => void;
    onEntriesDeleted?: () => void;
}

export function JournalFeed({ onEntryPress, onEntriesDeleted }: JournalFeedProps) {
    const { colors } = useTheme();

    // Use Enriched Feed Hook
    const { items, isLoading, refetch, loadMore, hasMore, invalidate } = useEnrichedFeed();
    const entries = items; // Items are now EnrichedFeedItem[]

    // Calculate offset for loadMore based on raw item count
    const journalOffset = entries.filter(item => item.type === 'entry' && !('weekStartDate' in item.entry)).length;

    // Local UI state
    const [loadingMore, setLoadingMore] = useState(false);
    const [isSelectMode, setIsSelectMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isDeleting, setIsDeleting] = useState(false);

    PerfLogger.log('JournalFeed', `Render - cached entries: ${entries.length}, isLoading: ${isLoading}`);

    const handleLoadMore = async () => {
        if (loadingMore || !hasMore) return;
        setLoadingMore(true);
        try {
            await loadMore(journalOffset);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleRefresh = async () => {
        await refetch();
    };

    const toggleSelectMode = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (isSelectMode) {
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
        const journalEntryIds = entries
            .filter(e => e.type === 'entry' && !('weekStartDate' in e.entry))
            .map(e => e.id);
        setSelectedIds(new Set(journalEntryIds));
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;

        const entriesToDelete = entries
            .filter((e): e is EnrichedFeedItem => e.type === 'entry' && selectedIds.has(e.id) && !('weekStartDate' in e.entry))
            .map(e => e.entry as JournalEntry);

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
                            invalidate(); // Refresh cache
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


    // ... (inside component)

    const renderEntryCard = useCallback((item: FeedItem, index: number) => {
        if (item.type === 'date_section') {
            return <DateSectionHeader label={item.label} />;
        }

        if (item.type === 'arc_summary') {
            return (
                <ArcSummary
                    type={item.summaryType}
                    title={item.title}
                    description={item.description}
                    index={index}
                />
            );
        }

        const entry = item.entry;
        const isReflection = 'weekStartDate' in entry;
        const isSelected = selectedIds.has(item.id);
        const canSelect = !isReflection;

        const handlePress = () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (isSelectMode && canSelect) {
                toggleSelection(item.id);
            } else {
                onEntryPress(entry);
            }
        };

        const handleLongPress = () => {
            if (!isSelectMode && canSelect) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setIsSelectMode(true);
                setSelectedIds(new Set([item.id]));
            }
        };

        return (
            <EnrichedEntryCard
                entry={entry}
                signals={item.signals}
                threads={item.threads}
                friendNames={item.friendNames}
                isSelected={isSelected}
                isSelectMode={isSelectMode}
                onPress={handlePress}
                onLongPress={handleLongPress}
                index={index}
            />
        );
    }, [isSelectMode, selectedIds, colors, onEntryPress]);

    // Show skeleton only on initial load with no cached data
    if (isLoading && entries.length === 0) {
        return <SkeletonJournalFeed />;
    }

    if (!isLoading && entries.length === 0) {
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

    const selectableCount = entries.filter(e => e.type === 'entry' && !('weekStartDate' in e.entry)).length;

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

            <FlashList
                data={entries}
                renderItem={({ item, index }) => renderEntryCard(item, index)}
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
                estimatedItemSize={150}
                refreshControl={
                    <RefreshControl refreshing={false} onRefresh={handleRefresh} tintColor={colors.primary} />
                }
                ListFooterComponent={
                    hasMore ? (
                        <View className="py-4">
                            <TouchableOpacity
                                onPress={handleLoadMore}
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
                    ) : (
                        <View className="h-6" />
                    )
                }
            />
        </View>
    );
}
