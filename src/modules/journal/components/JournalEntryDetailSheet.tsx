import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import {
    Calendar,
    Sparkles,
    Edit3,
    ExternalLink,
    MessageCircle,
    Zap,
    Gift, // For Life Event
    Copy, // For Mimic
    Trash2,
    X,
    Loader2, // Import Loader2 for spinner
} from 'lucide-react-native';
import { WeaveIcon } from '@/shared/components/WeaveIcon';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { oracleService, OracleSuggestionSheet, OracleSuggestion } from '@/modules/oracle';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import FriendModel from '@/db/models/Friend';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import Interaction from '@/db/models/Interaction';
import InteractionFriend from '@/db/models/InteractionFriend';
import JournalSignals from '@/db/models/JournalSignals';
import { Q } from '@nozbe/watermelondb';
import { STORY_CHIPS } from '@/modules/reflection';
import { logger } from '@/shared/services/logger.service';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';

interface JournalEntryDetailSheetProps {
    isOpen: boolean;
    onClose: () => void;
    entry: JournalEntry | null;
    onEdit: (entry: JournalEntry) => void;
    onDelete: () => void;
    onMimicWeave: (friendIds: string[], options?: { date?: string; category?: string }) => void;
    onReflect: (entry: JournalEntry, suggestion?: OracleSuggestion) => void;
    onCreateLifeEvent: (friendId: string) => void;
    onReachOut: (friendId: string) => void;
}

export function JournalEntryDetailSheet({
    isOpen,
    onClose,
    entry,
    onEdit,
    onDelete,
    onMimicWeave,
    onReflect,
    onCreateLifeEvent,
    onReachOut,
}: JournalEntryDetailSheetProps) {
    const { colors, typography } = useTheme();

    const [friends, setFriends] = useState<FriendModel[]>([]);
    const [linkedWeaveInfo, setLinkedWeaveInfo] = useState<{
        id: string;
        friendName: string;
        title: string;
        category?: string;
    } | null>(null);
    const [signals, setSignals] = useState<JournalSignals | null>(null);
    const [relatedEntries, setRelatedEntries] = useState<JournalEntry[]>([]);

    // Oracle Lens State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showOracleSheet, setShowOracleSheet] = useState(false);
    const [suggestions, setSuggestions] = useState<OracleSuggestion[]>([]);

    const handleAskOracle = async () => {
        if (!entry) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        // If we already have suggestions for this entry, just show them
        if (suggestions.length > 0) {
            setShowOracleSheet(true);
            return;
        }

        setIsAnalyzing(true);
        try {
            const results = await oracleService.analyzeEntryContext(entry);

            if (results && results.length > 0) {
                setSuggestions(results);
                setShowOracleSheet(true);
            } else {
                // Fallback if no suggestions generated
                onReflect(entry);
            }
        } catch (error) {
            logger.error('JournalDetail', 'Failed to analyze entry', error);
            // Fallback - just open standard reflect if analysis fails
            onReflect(entry);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleOracleSelect = (suggestion: OracleSuggestion) => {
        setShowOracleSheet(false);
        // Delay to allow sheet to close
        setTimeout(() => {
            if (entry) onReflect(entry, suggestion);
        }, 500);
    };

    const loadData = async () => {
        if (!entry) return;

        try {
            // Load linked friends
            const links = await database.get<JournalEntryFriend>('journal_entry_friends')
                .query(Q.where('journal_entry_id', entry.id))
                .fetch();

            const friendModels = await Promise.all(
                links.map(link => database.get<FriendModel>('friends').find(link.friendId))
            );
            setFriends(friendModels);

            // Load linked weave
            if (entry.linkedWeaveId) {
                const interaction = await database.get<Interaction>('interactions').find(entry.linkedWeaveId);
                setLinkedWeaveInfo({
                    id: interaction.id,
                    friendName: 'Weave',
                    title: interaction.title || interaction.activity || 'Interaction',
                    category: interaction.interactionCategory || interaction.interactionType,
                });
            }

            // Load signals (for Vibe Check)
            const signalRecords = await database.get<JournalSignals>('journal_signals')
                .query(Q.where('journal_entry_id', entry.id))
                .fetch();

            if (signalRecords.length > 0) {
                setSignals(signalRecords[0]);
            }

            // Load Memory Threads (Related Entries)
            if (friendModels.length > 0) {
                const friendIds = friendModels.map(f => f.id);
                // Find entries linked to these friends, excluding current
                const relatedLinks = await database.get<JournalEntryFriend>('journal_entry_friends')
                    .query(
                        Q.where('friend_id', Q.oneOf(friendIds)),
                        Q.take(50) // Fetch potential candidates
                    )
                    .fetch();

                const candidateEntryIds = new Set(relatedLinks.map(l => l.journalEntryId));
                candidateEntryIds.delete(entry.id);

                if (candidateEntryIds.size > 0) {
                    const related = await database.get<JournalEntry>('journal_entries')
                        .query(
                            Q.where('id', Q.oneOf(Array.from(candidateEntryIds))),
                            Q.sortBy('entry_date', Q.desc),
                            Q.take(3)
                        )
                        .fetch();
                    setRelatedEntries(related);
                } else {
                    setRelatedEntries([]);
                }
            } else {
                setRelatedEntries([]);
            }

        } catch (error) {
            logger.error('JournalDetail', 'Error loading entry data', error);
        }
    };

    useEffect(() => {
        if (entry && isOpen) {
            loadData();
        } else {
            setFriends([]);
            setLinkedWeaveInfo(null);
            setSignals(null);
            setRelatedEntries([]);
            setSuggestions([]);
        }
    }, [entry, isOpen]);

    const getNextSameWeekday = (date: Date): string => {
        const result = new Date();
        result.setDate(result.getDate() + ((date.getDay() + 7 - result.getDay()) % 7));
        // If it's today, add 7 days
        if (result.toDateString() === new Date().toDateString()) {
            result.setDate(result.getDate() + 7);
        }
        return result.toISOString().split('T')[0];
    };

    const handleMimic = () => {
        if (friends.length === 0) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        const suggestedDate = entry ? getNextSameWeekday(new Date(entry.entryDate)) : undefined;
        // Default to 'hangout' if no linked category found
        const category = linkedWeaveInfo?.category || 'hangout';

        onMimicWeave(friends.map(f => f.id), { date: suggestedDate, category });
    };

    const handleLifeEvent = () => {
        if (friends.length === 0) return;

        if (friends.length === 1) {
            onCreateLifeEvent(friends[0].id);
        } else {
            Alert.alert('Select Friend', 'Who is this life event for?',
                friends.map(f => ({
                    text: f.name,
                    onPress: () => onCreateLifeEvent(f.id)
                } as { text: string; onPress: () => void; style?: 'default' | 'cancel' | 'destructive' }))
                    .concat([{ text: 'Cancel', style: 'cancel', onPress: () => { } }])
            );
        }
    };

    const handleReachOut = () => {
        if (friends.length === 0) return;
        if (friends.length === 1) {
            onReachOut(friends[0].id);
        } else {
            Alert.alert('Select Friend', 'Who do you want to reach out to?',
                friends.map(f => ({
                    text: f.name,
                    onPress: () => onReachOut(f.id)
                } as { text: string; onPress: () => void; style?: 'default' | 'cancel' | 'destructive' }))
                    .concat([{ text: 'Cancel', style: 'cancel', onPress: () => { } }])
            );
        }
    };

    const handleDelete = () => {
        if (!entry) return;
        Alert.alert(
            "Delete Entry",
            "Are you sure you want to delete this journal entry?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await database.write(async () => {
                                // Use the cascading delete method to remove entry and friend links
                                const deleteOp = await entry.prepareDestroyWithChildren();
                                await database.batch(deleteOp);
                            });

                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            onDelete?.(); // Callback for parent to clear selection
                        } catch (error) {
                            logger.error('JournalDetail', 'Error deleting journal entry:', error);
                            Alert.alert('Error', 'Failed to delete entry. Please try again.');
                        }
                    }
                }
            ]
        );
    };


    if (!entry) return null;

    return (
        <>
            <StandardBottomSheet
                visible={isOpen}
                onClose={onClose}
                height="auto"
                title=""
                showCloseButton={false}
            >
                <View className="flex-1">
                    {/* Custom Header */}
                    <View className="px-5 py-3 flex-row justify-end items-center gap-2 border-b border-transparent mb-2">
                        <TouchableOpacity
                            onPress={handleDelete}
                            className="p-2 rounded-full"
                            style={{ backgroundColor: colors.destructive + '15' }}
                        >
                            <Trash2 size={20} color={colors.destructive} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                onEdit(entry);
                            }}
                            className="p-2 rounded-full"
                            style={{ backgroundColor: colors.muted + '20' }}
                        >
                            <Edit3 size={20} color={colors.foreground} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={onClose}
                            className="p-2 rounded-full"
                            style={{ backgroundColor: colors.muted + '20' }}
                        >
                            <X size={20} color={colors.foreground} />
                        </TouchableOpacity>
                    </View>

                    <View className="px-5 pb-2">
                        {/* Header Metadata: Date & Activity */}
                        <View className="flex-row items-center gap-2 mb-2">
                            <Text
                                className="text-xs font-semibold uppercase tracking-wider"
                                style={{ color: colors.foreground, opacity: 0.6, fontFamily: 'Inter_600SemiBold' }}
                            >
                                {new Date(entry.entryDate).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                })}
                            </Text>
                            {linkedWeaveInfo?.category && (
                                <>
                                    <View className="w-1 h-1 rounded-full" style={{ backgroundColor: colors.foreground, opacity: 0.4 }} />
                                    <Text
                                        className="text-xs font-semibold uppercase tracking-wider"
                                        style={{ color: colors.foreground, opacity: 0.6, fontFamily: 'Inter_600SemiBold' }}
                                    >
                                        {linkedWeaveInfo.category}
                                    </Text>
                                </>
                            )}
                        </View>

                        {entry.title ? (
                            <Text
                                className="text-2xl font-bold"
                                style={{ color: colors.foreground, fontFamily: typography.fonts.serifBold }}
                            >
                                {entry.title}
                            </Text>
                        ) : (
                            <Text
                                className="text-2xl font-bold italic"
                                style={{ color: colors.foreground, fontFamily: typography.fonts.serifBold, opacity: 0.6 }}
                            >
                                Untitled Entry
                            </Text>
                        )}
                    </View>

                    <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 40 }}>

                        {/* Main Content */}
                        <Text
                            className="text-base leading-relaxed mb-8 mt-2"
                            style={{ color: colors.foreground, fontFamily: 'Inter_400Regular', lineHeight: 28 }}
                        >
                            {entry.content}
                        </Text>

                        {/* Story Chips */}
                        {entry.storyChips.length > 0 && (
                            <View className="flex-row flex-wrap gap-2 mb-8">
                                {entry.storyChips.map(chip => {
                                    const chipDef = STORY_CHIPS.find(c => c.id === chip.chipId);
                                    if (!chipDef) return null;
                                    return (
                                        <View
                                            key={chip.chipId}
                                            className="px-2.5 py-1 rounded-md border"
                                            style={{
                                                borderColor: colors.border,
                                                backgroundColor: 'transparent'
                                            }}
                                        >
                                            <Text
                                                className="text-xs"
                                                style={{ color: colors.muted, fontFamily: 'Inter_400Regular' }}
                                            >
                                                {chipDef.plainText}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* Intelligence: Vibe Check */}
                        {signals && (
                            <View className="mb-8 p-4 rounded-xl border" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
                                <View className="flex-row items-center gap-2 mb-2">
                                    <Sparkles size={16} color={colors.primary} />
                                    <Text className="text-sm font-semibold" style={{ color: colors.foreground }}>
                                        Vibe Check
                                    </Text>
                                </View>
                                <View className="flex-row items-baseline gap-2">
                                    <Text className="text-2xl">{signals.sentimentLabel === 'positive' || signals.sentimentLabel === 'grateful' ? '☀️' : signals.sentimentLabel === 'tense' || signals.sentimentLabel === 'concerned' ? '🌧️' : '☁️'}</Text>
                                    <Text className="text-sm" style={{ color: colors.muted }}>
                                        This entry feels <Text style={{ color: colors.foreground, fontWeight: '600' }}>{signals.sentimentLabel?.toLowerCase() || 'neutral'}</Text>.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Actions Grid */}
                        <View className="pb-8">
                            <Text className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: colors.muted }}>
                                Actions
                            </Text>

                            <View className="flex-row flex-wrap justify-between gap-y-3">
                                {/* Ask Oracle (Unified Styling) */}
                                <TouchableOpacity
                                    onPress={handleAskOracle}
                                    disabled={isAnalyzing}
                                    className="w-[48%] flex-col items-center justify-center p-4 rounded-2xl border gap-2"
                                    style={{
                                        backgroundColor: colors.primary + '10',
                                        borderColor: colors.primary + '30'
                                    }}
                                >
                                    {isAnalyzing ? (
                                        <Loader2 size={24} color={colors.primary} className="animate-spin" />
                                    ) : (
                                        <WeaveIcon size={24} color={colors.primary} opacity={0.8} />
                                    )}
                                    <Text className="text-sm font-medium text-center" style={{ color: colors.primary }}>
                                        {isAnalyzing ? 'Consulting...' : 'Ask Oracle'}
                                    </Text>
                                </TouchableOpacity>

                                {/* Mimic Weave */}
                                {friends.length > 0 && (
                                    <TouchableOpacity
                                        onPress={handleMimic}
                                        className="w-[48%] flex-col items-center justify-center p-4 rounded-2xl border gap-2"
                                        style={{
                                            backgroundColor: colors.primary + '10',
                                            borderColor: colors.primary + '30'
                                        }}
                                    >
                                        <Copy size={24} color={colors.primary} opacity={0.8} />
                                        <Text className="text-sm font-medium text-center" style={{ color: colors.primary }}>
                                            Mimic Plan
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {/* Life Event */}
                                {friends.length > 0 && (
                                    <TouchableOpacity
                                        onPress={handleLifeEvent}
                                        className="w-[48%] flex-col items-center justify-center p-4 rounded-2xl border gap-2"
                                        style={{
                                            backgroundColor: colors.primary + '10',
                                            borderColor: colors.primary + '30'
                                        }}
                                    >
                                        <Gift size={24} color={colors.primary} opacity={0.8} />
                                        <Text className="text-sm font-medium text-center" style={{ color: colors.primary }}>
                                            Add Milestone
                                        </Text>
                                    </TouchableOpacity>
                                )}

                                {/* Reach Out (formerly Nudge) */}
                                {friends.length > 0 && (
                                    <TouchableOpacity
                                        onPress={handleReachOut}
                                        className="w-[48%] flex-col items-center justify-center p-4 rounded-2xl border gap-2"
                                        style={{
                                            backgroundColor: colors.primary + '10',
                                            borderColor: colors.primary + '30'
                                        }}
                                    >
                                        <MessageCircle size={24} color={colors.primary} opacity={0.8} />
                                        <Text className="text-sm font-medium text-center" style={{ color: colors.primary }}>
                                            Reach Out
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Related Memories (Moved to bottom & simplified) */}
                        {relatedEntries.length > 0 && (
                            <View className="mb-8 pt-4 border-t" style={{ borderColor: colors.border }}>
                                <Text className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: colors.foreground, opacity: 0.8 }}>
                                    Related Memories
                                </Text>
                                <View className="gap-2">
                                    {relatedEntries.map((related) => (
                                        <View
                                            key={related.id}
                                            className="p-3 rounded-xl border flex-row items-center justify-between"
                                            style={{
                                                backgroundColor: colors.card,
                                                borderColor: colors.border,
                                            }}
                                        >
                                            <View className="flex-1 mr-3">
                                                <Text
                                                    className="text-sm font-semibold mb-0.5"
                                                    numberOfLines={1}
                                                    style={{ color: colors.foreground }}
                                                >
                                                    {related.title || 'Untitled Memory'}
                                                </Text>
                                                <Text
                                                    className="text-xs"
                                                    numberOfLines={1}
                                                    style={{ color: colors.foreground }}
                                                >
                                                    {related.content.replace(/\n/g, ' ')}
                                                </Text>
                                            </View>
                                            <Text
                                                className="text-xs font-medium"
                                                style={{ color: colors.foreground, opacity: 0.6 }}
                                            >
                                                {new Date(related.entryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                    </ScrollView>
                </View>
            </StandardBottomSheet>

            <OracleSuggestionSheet
                visible={showOracleSheet}
                onClose={() => setShowOracleSheet(false)}
                suggestions={suggestions}
                onSelect={handleOracleSelect}
            />
        </>
    );
}
