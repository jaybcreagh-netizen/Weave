import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, Alert, InteractionManager, ScrollView } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { useTheme } from '@/shared/hooks/useTheme';
import { useRouter } from 'expo-router';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import FriendModel from '@/db/models/Friend';
import JournalEntryFriend from '@/db/models/JournalEntryFriend';
import Interaction from '@/db/models/Interaction';
import JournalSignals from '@/db/models/JournalSignals';
import { Q } from '@nozbe/watermelondb';
import { STORY_CHIPS } from '@/modules/reflection';
import { logger } from '@/shared/services/logger.service';
import { useUIStore } from '@/shared/stores/uiStore';
import * as Haptics from 'expo-haptics';

/**
 * Wait for modal/sheet close animations to complete before opening another modal.
 * Matches the pattern used by Oracle's useActionExecutor.
 */
const waitForSheetClose = (): Promise<void> =>
    new Promise(resolve => {
        InteractionManager.runAfterInteractions(() => {
            setTimeout(resolve, 150);
        });
    });

const SENTIMENT_CONFIG: Record<string, { icon: string; label: string; colorKey: 'success' | 'warning' | 'destructive' | 'muted-foreground' }> = {
    positive: { icon: 'Sun', label: 'Warm & positive', colorKey: 'success' },
    grateful: { icon: 'Heart', label: 'Grateful', colorKey: 'success' },
    concerned: { icon: 'CloudSun', label: 'Mixed feelings', colorKey: 'warning' },
    tense: { icon: 'CloudRain', label: 'Difficult', colorKey: 'destructive' },
    neutral: { icon: 'Cloud', label: 'Neutral', colorKey: 'muted-foreground' },
};

interface JournalEntryDetailSheetProps {
    isOpen: boolean;
    onClose: () => void;
    entry: JournalEntry | null;
    onEdit: (entry: JournalEntry) => void;
    onDelete: () => void;
    onMimicWeave: (friendIds: string[], options?: { date?: string; category?: string }) => void;
    onReflect: (entry: JournalEntry, suggestion?: any, friendContext?: { friendId?: string; friendName?: string }) => void;
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
    const router = useRouter();

    const [friends, setFriends] = useState<FriendModel[]>([]);
    const [linkedWeaveInfo, setLinkedWeaveInfo] = useState<{
        id: string;
        friendName: string;
        title: string;
        category?: string;
    } | null>(null);
    const [signals, setSignals] = useState<JournalSignals | null>(null);
    const [relatedEntries, setRelatedEntries] = useState<JournalEntry[]>([]);

    const handleAskOracle = () => {
        if (!entry) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const primaryFriend = friends[0];
        onReflect(entry, undefined, {
            friendId: primaryFriend?.id,
            friendName: primaryFriend?.name,
        });
    };

    const loadData = async () => {
        if (!entry) return;

        try {
            const links = await database.get<JournalEntryFriend>('journal_entry_friends')
                .query(Q.where('journal_entry_id', entry.id))
                .fetch();

            const friendModels = await Promise.all(
                links.map(link => database.get<FriendModel>('friends').find(link.friendId))
            );
            setFriends(friendModels);

            if (entry.linkedWeaveId) {
                const interaction = await database.get<Interaction>('interactions').find(entry.linkedWeaveId);
                setLinkedWeaveInfo({
                    id: interaction.id,
                    friendName: 'Weave',
                    title: interaction.title || interaction.activity || 'Interaction',
                    category: interaction.interactionCategory || interaction.interactionType,
                });
            }

            const signalRecords = await database.get<JournalSignals>('journal_signals')
                .query(Q.where('journal_entry_id', entry.id))
                .fetch();
            if (signalRecords.length > 0) {
                setSignals(signalRecords[0]);
            }

            if (friendModels.length > 0) {
                const friendIds = friendModels.map(f => f.id);
                const relatedLinks = await database.get<JournalEntryFriend>('journal_entry_friends')
                    .query(
                        Q.where('friend_id', Q.oneOf(friendIds)),
                        Q.take(50)
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
        }
    }, [entry, isOpen]);

    const getNextSameWeekday = (date: Date): string => {
        const result = new Date();
        result.setDate(result.getDate() + ((date.getDay() + 7 - result.getDay()) % 7));
        if (result.toDateString() === new Date().toDateString()) {
            result.setDate(result.getDate() + 7);
        }
        return result.toISOString().split('T')[0];
    };

    const handleMimic = () => {
        if (friends.length === 0) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const suggestedDate = entry ? getNextSameWeekday(new Date(entry.entryDate)) : undefined;
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

    const handleUpdateProfile = () => {
        if (friends.length === 0) return;
        if (friends.length === 1) {
            onClose();
            router.push({
                pathname: '/edit-friend',
                params: { friendId: friends[0].id }
            });
            return;
        }

        Alert.alert('Select Friend', 'Whose profile should we update?',
            friends.map(f => ({
                text: f.name,
                onPress: () => {
                    onClose();
                    router.push({
                        pathname: '/edit-friend',
                        params: { friendId: f.id }
                    });
                }
            } as { text: string; onPress: () => void; style?: 'default' | 'cancel' | 'destructive' }))
                .concat([{ text: 'Cancel', style: 'cancel', onPress: () => { } }])
        );
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
                                const deleteOp = await entry.prepareDestroyWithChildren();
                                await database.batch(deleteOp);
                            });
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            onDelete?.();
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

    const sentimentKey = signals?.sentimentLabel || 'neutral';
    const sentiment = SENTIMENT_CONFIG[sentimentKey] || SENTIMENT_CONFIG.neutral;
    const sentimentColor = colors[sentiment.colorKey];
    const hasSentiment = signals && sentimentKey !== 'neutral';

    const friendLabel = friends.length > 0
        ? friends.map(f => f.name.split(' ')[0]).join(' & ')
        : null;

    // Build smart action items or default actions
    const actionItems: { icon: string; label: string; onPress: () => void }[] = [];

    if (entry.smartActions && entry.smartActions.length > 0) {
        for (const action of entry.smartActions as any[]) {
            const iconMap: Record<string, string> = {
                mimic_plan: 'Repeat',
                schedule_event: 'CalendarPlus',
                create_intention: 'Target',
                reach_out: 'MessageCircle',
                update_profile: 'UserPen',
                add_memory: 'BookmarkPlus',
            };

            // Guard: friendId from LLM may be a name, not a DB ID
            const rawFriendId = action.data?.friendId;
            const isValidId = rawFriendId && (
                /^[a-zA-Z0-9_-]{16}$/.test(rawFriendId) || /^[0-9a-fA-F-]{36}$/.test(rawFriendId)
            );
            const resolvedFriendId = isValidId ? rawFriendId : friends[0]?.id;

            const buildHandler = (type: string): () => void => {
                switch (type) {
                    case 'mimic_plan':
                    case 'schedule_event':
                        return () => {
                            if (resolvedFriendId) {
                                onClose();
                                waitForSheetClose().then(() => {
                                    useUIStore.getState().openPlanWizard({
                                        friendId: resolvedFriendId,
                                        prefillData: {
                                            title: action.label,
                                            date: action.data?.date ? new Date(action.data.date) : undefined,
                                            category: action.data?.activity || undefined,
                                        },
                                    });
                                });
                            } else if (friends.length > 0) {
                                handleMimic();
                            } else {
                                Alert.alert('No friend tagged', 'Tag a friend in this entry to plan a weave with them.');
                            }
                        };
                    case 'create_intention':
                        return () => {
                            if (resolvedFriendId) {
                                onClose();
                                waitForSheetClose().then(() => {
                                    useUIStore.getState().openIntentionForm({
                                        friendId: resolvedFriendId,
                                        initialText: action.label,
                                    });
                                });
                            }
                        };
                    case 'add_memory':
                    case 'update_profile':
                        return () => {
                            if (resolvedFriendId) {
                                onClose();
                                waitForSheetClose().then(() => {
                                    router.push({
                                        pathname: '/friend-profile',
                                        params: {
                                            friendId: resolvedFriendId,
                                            action: 'add_memory',
                                            memorySource: 'journal',
                                            memoryNotes: action.data?.note || '',
                                        }
                                    });
                                });
                            }
                        };
                    case 'reach_out':
                        return handleReachOut;
                    default:
                        return () => { };
                }
            };

            actionItems.push({
                icon: iconMap[action.type] || 'Sparkles',
                label: action.label,
                onPress: buildHandler(action.type),
            });
        }
    } else {
        actionItems.push({ icon: 'Sparkles', label: 'Ask Oracle', onPress: handleAskOracle });
        if (friends.length > 0 || linkedWeaveInfo) {
            actionItems.push({ icon: 'Repeat', label: 'Do again', onPress: handleMimic });
        }
        if (friends.length > 0) {
            actionItems.push({ icon: 'MessageCircle', label: 'Reach out', onPress: handleReachOut });
        }
    }

    return (
        <StandardBottomSheet
            visible={isOpen}
            onClose={onClose}
            height="full"
            title=""
            showCloseButton={false}
            disableContentPanning={true}
        >
            <View className="flex-1">
                {/* Header actions */}
                <View className="px-5 pt-2 pb-1 flex-row justify-end items-center gap-1.5">
                    <TouchableOpacity
                        onPress={handleDelete}
                        className="p-2 rounded-full"
                        style={{ backgroundColor: colors.destructive + '10' }}
                    >
                        <Icon name="Trash2" size={18} color={colors.destructive} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            onEdit(entry);
                        }}
                        className="p-2 rounded-full"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Icon name="Pencil" size={18} color={colors.foreground} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={onClose}
                        className="p-2 rounded-full"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Icon name="X" size={18} color={colors.foreground} />
                    </TouchableOpacity>
                </View>

                <BottomSheetScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
                    {/* Date & friend context */}
                    <View className="px-6 pt-2">
                        <View className="flex-row items-center gap-1.5 mb-3">
                            <Text
                                variant="caption"
                                weight="semibold"
                                style={{ color: colors['muted-foreground'], fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase' }}
                            >
                                {new Date(entry.entryDate).toLocaleDateString(undefined, {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric'
                                }).toUpperCase()}
                            </Text>
                            {friendLabel && (
                                <>
                                    <View className="w-0.5 h-0.5 rounded-full" style={{ backgroundColor: colors['muted-foreground'] }} />
                                    <Text
                                        variant="caption"
                                        style={{ color: colors['muted-foreground'], fontSize: 11 }}
                                    >
                                        with {friendLabel}
                                    </Text>
                                </>
                            )}
                            {hasSentiment && (
                                <>
                                    <View className="w-0.5 h-0.5 rounded-full" style={{ backgroundColor: colors['muted-foreground'] }} />
                                    <Icon name={sentiment.icon as any} size={11} color={sentimentColor} />
                                    <Text
                                        variant="caption"
                                        style={{ color: sentimentColor, fontSize: 11 }}
                                    >
                                        {sentiment.label}
                                    </Text>
                                </>
                            )}
                        </View>

                        {/* Title */}
                        {entry.title ? (
                            <Text
                                variant="h2"
                                style={{ color: colors.foreground, fontFamily: typography.fonts.serifBold, fontSize: 24, lineHeight: 30, marginBottom: 16 }}
                            >
                                {entry.title}
                            </Text>
                        ) : (
                            <Text
                                variant="h2"
                                style={{ color: colors['muted-foreground'], fontFamily: typography.fonts.serifBold, fontSize: 24, lineHeight: 30, marginBottom: 16, fontStyle: 'italic' }}
                            >
                                Untitled Entry
                            </Text>
                        )}
                    </View>

                    {/* Content — the hero */}
                    <View className="px-6 mb-6">
                        <Text
                            variant="body"
                            style={{ color: colors.foreground, fontSize: 16, lineHeight: 28 }}
                        >
                            {entry.content}
                        </Text>
                    </View>

                    {/* Story chips (if any) */}
                    {entry.storyChips.length > 0 && (
                        <View className="px-6 mb-6">
                            <View className="flex-row flex-wrap gap-1.5">
                                {entry.storyChips.map(chip => {
                                    const chipDef = STORY_CHIPS.find(c => c.id === chip.chipId);
                                    if (!chipDef) return null;
                                    return (
                                        <View
                                            key={chip.chipId}
                                            className="px-2.5 py-1 rounded-full"
                                            style={{ backgroundColor: colors.muted }}
                                        >
                                            <Text
                                                variant="caption"
                                                style={{ color: colors['muted-foreground'], fontSize: 11 }}
                                            >
                                                {chipDef.plainText}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Linked weave — subtle reference */}
                    {linkedWeaveInfo && (
                        <View className="px-6 mb-6">
                            <View
                                className="flex-row items-center gap-2.5 px-3.5 py-2.5 rounded-xl"
                                style={{ backgroundColor: colors.muted }}
                            >
                                <Icon name="Link" size={13} color={colors['muted-foreground']} />
                                <Text
                                    variant="caption"
                                    style={{ color: colors['muted-foreground'], fontSize: 12, flex: 1 }}
                                    numberOfLines={1}
                                >
                                    {linkedWeaveInfo.title}
                                </Text>
                                {linkedWeaveInfo.category && (
                                    <Text
                                        variant="caption"
                                        style={{ color: colors['muted-foreground'], fontSize: 11, textTransform: 'capitalize' }}
                                    >
                                        {linkedWeaveInfo.category.replace(/-/g, ' ')}
                                    </Text>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Actions — compact horizontal pills */}
                    {actionItems.length > 0 && (
                        <View className="px-6 mb-6">
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 8 }}
                            >
                                {actionItems.map((item, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                            item.onPress();
                                        }}
                                        className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-full"
                                        style={{
                                            backgroundColor: colors.card,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <Icon name={item.icon as any} size={14} color={colors.primary} />
                                        <Text
                                            variant="caption"
                                            weight="medium"
                                            style={{ color: colors.foreground, fontSize: 13 }}
                                        >
                                            {item.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Related memories — warm thread */}
                    {relatedEntries.length > 0 && (
                        <View className="px-6 pt-4" style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
                            <View className="flex-row items-center gap-1.5 mb-3">
                                <Icon name="BookOpen" size={11} color={colors['muted-foreground']} />
                                <Text
                                    variant="caption"
                                    weight="semibold"
                                    style={{ color: colors['muted-foreground'], fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}
                                >
                                    Related memories
                                </Text>
                            </View>
                            <View className="gap-2">
                                {relatedEntries.map((related) => (
                                    <View
                                        key={related.id}
                                        className="py-2.5 flex-row items-start justify-between"
                                        style={{ borderBottomWidth: 1, borderBottomColor: colors.border + '60' }}
                                    >
                                        <View className="flex-1 mr-3">
                                            <Text
                                                variant="body"
                                                weight="medium"
                                                style={{ color: colors.foreground, fontSize: 14, marginBottom: 2 }}
                                                numberOfLines={1}
                                            >
                                                {related.title || 'Untitled'}
                                            </Text>
                                            <Text
                                                variant="caption"
                                                style={{ color: colors['muted-foreground'], fontSize: 12 }}
                                                numberOfLines={1}
                                            >
                                                {related.content.replace(/\n/g, ' ')}
                                            </Text>
                                        </View>
                                        <Text
                                            variant="caption"
                                            style={{ color: colors['muted-foreground'], fontSize: 11, marginTop: 2 }}
                                        >
                                            {new Date(related.entryDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </BottomSheetScrollView>
            </View>
        </StandardBottomSheet>
    );
}
