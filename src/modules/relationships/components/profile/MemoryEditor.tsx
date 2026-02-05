import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { format, startOfDay } from 'date-fns';
import { X } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet, StandardBottomSheet } from '@/shared/ui/Sheet';
import { CustomCalendar } from '@/shared/components/CustomCalendar';
import { database } from '@/db';
import FriendMemory, { FriendMemoryType } from '@/db/models/FriendMemory';
import FriendMemoryCandidate from '@/db/models/FriendMemoryCandidate';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { deriveMemoryTemporalMetadata } from '@/modules/relationships/services/memory-life-event.service';

interface MemoryEditorProps {
    visible: boolean;
    onClose: () => void;
    onCandidateResolved?: (candidateId: string, resolution: 'approved' | 'dismissed') => boolean | void;
    friendId: string;
    memory?: FriendMemory | null;
    candidate?: FriendMemoryCandidate | null;
    prefill?: {
        type?: FriendMemoryType;
        title?: string;
        content?: string;
        source?: 'oracle';
    } | null;
}

const MEMORY_TYPES: Array<{ value: FriendMemoryType; label: string }> = [
    { value: 'interest', label: 'Interest' },
    { value: 'preference', label: 'Preference' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'milestone', label: 'Milestone' },
    { value: 'activity_win', label: 'Activity Win' },
    { value: 'avoid', label: 'Avoid' },
    { value: 'context', label: 'Context' },
    { value: 'general', label: 'General' },
];

const SUGGESTED_TAGS = [
    'trip',
    'upcoming',
    'birthday',
    'milestone',
    'family',
    'work',
    'health',
    'food',
    'activity',
    'gift',
];

function normalizeTag(tag: string): string {
    return tag
        .trim()
        .toLowerCase()
        .replace(/^#/, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-_]/g, '')
        .slice(0, 24);
}

function toSortedUniqueTags(tags: string[]): string[] {
    return Array.from(new Set(tags.map(normalizeTag).filter(Boolean))).sort();
}

export function MemoryEditor({
    visible,
    onClose,
    onCandidateResolved,
    friendId,
    memory,
    candidate,
    prefill,
}: MemoryEditorProps) {
    const { colors } = useTheme();
    const [type, setType] = useState<FriendMemoryType>('general');
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [effectiveDate, setEffectiveDate] = useState<Date | null>(null);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (!visible) {
            setShowDatePicker(false);
            return;
        }

        if (memory) {
            setType(memory.type);
            setTitle(memory.title);
            setContent(memory.content);
            setTags(memory.tags);
            setEffectiveDate(typeof memory.effectiveDate === 'number' ? new Date(memory.effectiveDate) : null);
            setTagInput('');
            return;
        }

        if (candidate) {
            setType(candidate.type);
            setTitle(candidate.title);
            setContent(candidate.content);
            setTags([]);
            const inferredTemporal = deriveMemoryTemporalMetadata(candidate.type, candidate.title, candidate.content);
            setEffectiveDate(
                typeof inferredTemporal.effectiveDate === 'number'
                    ? new Date(inferredTemporal.effectiveDate)
                    : null
            );
            setTagInput('');
            return;
        }

        if (prefill) {
            setType(prefill.type || 'general');
            setTitle(prefill.title || '');
            setContent(prefill.content || '');
            setTags([]);
            const inferredTemporal = deriveMemoryTemporalMetadata(
                prefill.type || 'general',
                prefill.title || '',
                prefill.content || '',
            );
            setEffectiveDate(
                typeof inferredTemporal.effectiveDate === 'number'
                    ? new Date(inferredTemporal.effectiveDate)
                    : null
            );
            setTagInput('');
            return;
        }

        setType('general');
        setTitle('');
        setContent('');
        setTags([]);
        setEffectiveDate(null);
        setTagInput('');
    }, [visible, memory, candidate, prefill]);

    const hasUnsavedChanges = useMemo(() => {
        if (!visible) return false;

        if (!memory) {
            if (candidate) {
                return (
                    title !== candidate.title
                    || content !== candidate.content
                    || type !== candidate.type
                    || !!effectiveDate
                    || tags.length > 0
                );
            }

            if (prefill) {
                return (
                    title !== (prefill.title || '')
                    || content !== (prefill.content || '')
                    || type !== (prefill.type || 'general')
                    || !!effectiveDate
                    || tags.length > 0
                );
            }

            return title.trim().length > 0 || content.trim().length > 0 || type !== 'general' || !!effectiveDate || tags.length > 0;
        }

        return (
            memory.type !== type
            || memory.title !== title
            || memory.content !== content
            || ((typeof memory.effectiveDate === 'number' ? memory.effectiveDate : null) !== (effectiveDate ? startOfDay(effectiveDate).getTime() : null))
            || JSON.stringify(toSortedUniqueTags(memory.tags)) !== JSON.stringify(toSortedUniqueTags(tags))
        );
    }, [visible, memory, candidate, prefill, type, title, content, effectiveDate, tags]);

    const handleSave = async () => {
        const normalizedContent = content.trim();
        if (!normalizedContent) {
            Alert.alert('Add Details', 'Please add memory details before saving.');
            return;
        }

        const fallbackTitle = normalizedContent.length > 56
            ? `${normalizedContent.slice(0, 56)}...`
            : normalizedContent;
        const normalizedTitle = (title.trim() || fallbackTitle);
        const normalizedTags = toSortedUniqueTags(tags);
        const temporal = deriveMemoryTemporalMetadata(
            type,
            normalizedTitle,
            normalizedContent,
            {
                selectedEffectiveDate: effectiveDate ? startOfDay(effectiveDate).getTime() : null,
                existingEffectiveDate: memory?.effectiveDate,
            },
        );

        setIsSaving(true);

        try {
            if (memory) {
                await database.write(async () => {
                    await memory.update(rec => {
                        rec.type = type;
                        rec.title = normalizedTitle;
                        rec.content = normalizedContent;
                        rec.tagsRaw = normalizedTags.length ? JSON.stringify(normalizedTags) : undefined;
                        rec.effectiveDate = temporal.effectiveDate;
                        rec.expiresAt = temporal.expiresAt;
                        rec.updatedAt = new Date();
                    });
                });
            } else {
                const wasEditedFromSuggestion = !!candidate && (
                    candidate.title !== normalizedTitle
                    || candidate.content !== normalizedContent
                    || candidate.type !== type
                );

                await database.write(async () => {
                    await database.get<FriendMemory>('friend_memories').create(rec => {
                        rec.friendId = friendId;
                        rec.type = type;
                        rec.title = normalizedTitle;
                        rec.content = normalizedContent;
                        rec.tagsRaw = normalizedTags.length ? JSON.stringify(normalizedTags) : undefined;
                        rec.source = candidate
                            ? 'journal_ai'
                            : prefill?.source === 'oracle'
                                ? 'oracle_action'
                                : 'manual';
                        if (candidate?.sourceEntryId) {
                            rec.sourceEntryId = candidate.sourceEntryId;
                        }
                        if (typeof candidate?.confidence === 'number') {
                            rec.confidence = Math.max(0, Math.min(1, candidate.confidence));
                        }
                        rec.effectiveDate = temporal.effectiveDate;
                        rec.expiresAt = temporal.expiresAt;
                        rec.isArchived = false;
                        rec.updatedAt = new Date();
                    });

                    if (candidate) {
                        await candidate.update(rec => {
                            rec.status = 'approved';
                            rec.reviewedAt = Date.now();
                            rec.updatedAt = new Date();
                            rec.title = normalizedTitle;
                            rec.content = normalizedContent;
                            rec.type = type;
                        });
                    }
                });

                if (candidate) {
                    trackEvent(AnalyticsEvents.MEMORY_CANDIDATE_APPROVED, {
                        source: candidate.source,
                        memory_type: type,
                        via: 'editor',
                        edited: wasEditedFromSuggestion,
                    });

                    const shouldClose = onCandidateResolved?.(candidate.id, 'approved');
                    if (shouldClose === false) {
                        return;
                    }
                }
            }

            onClose();
        } catch (error) {
            Alert.alert('Save Failed', 'Could not save memory. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleArchive = () => {
        if (!memory) return;

        Alert.alert(
            'Archive Memory',
            'This memory will be hidden from the profile.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Archive',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await database.write(async () => {
                                await memory.update(rec => {
                                    rec.isArchived = true;
                                    rec.updatedAt = new Date();
                                });
                            });
                            onClose();
                        } catch (error) {
                            Alert.alert('Archive Failed', 'Could not archive memory. Please try again.');
                        }
                    }
                }
            ]
        );
    };

    const handleDismissCandidate = () => {
        if (!candidate || memory) return;

        Alert.alert(
            'Dismiss Suggestion',
            'You can always add this memory later if needed.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Dismiss',
                    style: 'destructive',
                    onPress: async () => {
                        setIsSaving(true);
                        try {
                            await database.write(async () => {
                                await candidate.update(rec => {
                                    rec.status = 'dismissed';
                                    rec.reviewedAt = Date.now();
                                    rec.updatedAt = new Date();
                                });
                            });

                            trackEvent(AnalyticsEvents.MEMORY_CANDIDATE_DISMISSED, {
                                source: candidate.source,
                                memory_type: candidate.type,
                                via: 'editor',
                            });

                            const shouldClose = onCandidateResolved?.(candidate.id, 'dismissed');
                            if (shouldClose === false) {
                                return;
                            }

                            onClose();
                        } catch (error) {
                            Alert.alert('Dismiss Failed', 'Could not dismiss this suggestion. Please try again.');
                        } finally {
                            setIsSaving(false);
                        }
                    },
                },
            ],
        );
    };

    const handleAddTag = () => {
        const normalized = normalizeTag(tagInput);
        if (!normalized) {
            setTagInput('');
            return;
        }
        setTags(prev => toSortedUniqueTags([...prev, normalized]));
        setTagInput('');
    };

    const handleToggleSuggestedTag = (tag: string) => {
        const normalized = normalizeTag(tag);
        if (!normalized) return;
        setTags(prev => {
            if (prev.includes(normalized)) {
                return prev.filter(existing => existing !== normalized);
            }
            return toSortedUniqueTags([...prev, normalized]);
        });
    };

    const showDateSection = type === 'upcoming' || type === 'milestone' || !!effectiveDate;

    const handleDateSelect = (date: Date) => {
        setEffectiveDate(startOfDay(date));
        setShowDatePicker(false);
    };

    return (
        <>
            <StandardBottomSheet
                visible={visible}
                onClose={onClose}
                height="full"
                scrollable
                title={memory ? 'Edit Memory' : candidate ? 'Review Memory Suggestion' : 'Add Memory'}
                hasUnsavedChanges={hasUnsavedChanges}
                footerComponent={(
                    <View className="flex-row gap-3">
                        {memory ? (
                            <TouchableOpacity
                                onPress={handleArchive}
                                className="flex-1 py-3 px-6 rounded-full items-center"
                                style={{ backgroundColor: colors.destructive }}
                            >
                                <Text className="font-inter-semibold text-base text-white">Archive</Text>
                            </TouchableOpacity>
                        ) : null}
                        {!memory && candidate ? (
                            <TouchableOpacity
                                onPress={handleDismissCandidate}
                                disabled={isSaving}
                                className="flex-1 py-3 px-6 rounded-full items-center"
                                style={{ backgroundColor: colors.muted, opacity: isSaving ? 0.6 : 1 }}
                            >
                                <Text className="font-inter-semibold text-base" style={{ color: colors['muted-foreground'] }}>
                                    Dismiss
                                </Text>
                            </TouchableOpacity>
                        ) : null}
                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={isSaving}
                            className="flex-1 py-3 px-6 rounded-full items-center"
                            style={{ backgroundColor: colors.primary, opacity: isSaving ? 0.6 : 1 }}
                        >
                            <Text className="font-inter-semibold text-base text-white">
                                {isSaving ? 'Saving...' : candidate ? 'Approve' : 'Save'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            >
                <View className="pb-8">
                    <Text className="font-inter-semibold text-sm mb-2" style={{ color: colors.foreground }}>
                        Type
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                        <View className="flex-row gap-2">
                            {MEMORY_TYPES.map((memoryType) => (
                                <TouchableOpacity
                                    key={memoryType.value}
                                    onPress={() => setType(memoryType.value)}
                                    className="px-3 py-2 rounded-xl"
                                    style={{
                                        backgroundColor: type === memoryType.value ? `${colors.primary}22` : colors.muted,
                                        borderWidth: type === memoryType.value ? 1 : 0,
                                        borderColor: `${colors.primary}66`,
                                    }}
                                >
                                    <Text
                                        className="font-inter-semibold text-xs"
                                        style={{ color: type === memoryType.value ? colors.primary : colors.foreground }}
                                    >
                                        {memoryType.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    <Text className="font-inter-semibold text-sm mb-2" style={{ color: colors.foreground }}>
                        Title
                    </Text>
                    <TextInput
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Short headline for this memory"
                        placeholderTextColor={colors['muted-foreground']}
                        className="p-4 rounded-xl mb-4 font-inter-regular text-base"
                        style={{ backgroundColor: colors.muted, color: colors.foreground }}
                    />

                    <Text className="font-inter-semibold text-sm mb-2" style={{ color: colors.foreground }}>
                        Details
                    </Text>
                    <TextInput
                        value={content}
                        onChangeText={setContent}
                        placeholder="e.g., Loves low-key coffee catchups on Saturday mornings"
                        placeholderTextColor={colors['muted-foreground']}
                        multiline
                        textAlignVertical="top"
                        className="p-4 rounded-xl font-inter-regular text-base"
                        style={{
                            backgroundColor: colors.muted,
                            color: colors.foreground,
                            minHeight: 140,
                        }}
                    />

                    {showDateSection && (
                        <View className="mt-4">
                            <View className="mb-2 flex-row items-center justify-between">
                                <Text className="font-inter-semibold text-sm" style={{ color: colors.foreground }}>
                                    Date (Optional)
                                </Text>
                                {effectiveDate && (
                                    <TouchableOpacity
                                        onPress={() => setEffectiveDate(null)}
                                        className="rounded-full px-2 py-1"
                                        style={{ backgroundColor: colors.muted }}
                                    >
                                        <Text className="font-inter-medium text-[11px]" style={{ color: colors['muted-foreground'] }}>
                                            Clear
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowDatePicker(true)}
                                className="rounded-xl px-3 py-3"
                                style={{ backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border }}
                            >
                                <Text className="font-inter-medium text-sm" style={{ color: effectiveDate ? colors.foreground : colors['muted-foreground'] }}>
                                    {effectiveDate ? format(effectiveDate, 'EEE, MMM d, yyyy') : 'Pick a date'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <Text className="font-inter-semibold text-sm mt-4 mb-2" style={{ color: colors.foreground }}>
                        Tags
                    </Text>
                    <View className="mb-2 flex-row flex-wrap gap-2">
                        {SUGGESTED_TAGS.map((suggestedTag) => {
                            const isActive = tags.includes(suggestedTag);
                            return (
                                <TouchableOpacity
                                    key={suggestedTag}
                                    onPress={() => handleToggleSuggestedTag(suggestedTag)}
                                    className="rounded-full px-3 py-1.5"
                                    style={{
                                        backgroundColor: isActive ? `${colors.primary}22` : colors.muted,
                                        borderWidth: isActive ? 1 : 0,
                                        borderColor: `${colors.primary}55`,
                                    }}
                                >
                                    <Text
                                        className="font-inter-medium text-[11px]"
                                        style={{ color: isActive ? colors.primary : colors['muted-foreground'] }}
                                    >
                                        #{suggestedTag}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                    <View className="mb-2 flex-row items-center gap-2">
                        <TextInput
                            value={tagInput}
                            onChangeText={setTagInput}
                            placeholder="Add custom tag"
                            placeholderTextColor={colors['muted-foreground']}
                            className="flex-1 rounded-xl px-3 py-2 font-inter-regular text-sm"
                            style={{ backgroundColor: colors.muted, color: colors.foreground }}
                            onSubmitEditing={handleAddTag}
                        />
                        <TouchableOpacity
                            onPress={handleAddTag}
                            className="rounded-xl px-3 py-2"
                            style={{ backgroundColor: colors.primary }}
                        >
                            <Text className="font-inter-semibold text-xs text-white">Add</Text>
                        </TouchableOpacity>
                    </View>

                    {tags.length > 0 && (
                        <View className="mb-1 flex-row flex-wrap gap-2">
                            {tags.map(tag => (
                                <TouchableOpacity
                                    key={tag}
                                    onPress={() => handleToggleSuggestedTag(tag)}
                                    className="rounded-full px-3 py-1.5"
                                    style={{ backgroundColor: `${colors.primary}16`, borderWidth: 1, borderColor: `${colors.primary}35` }}
                                >
                                    <Text className="font-inter-medium text-[11px]" style={{ color: colors.primary }}>
                                        #{tag} ×
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    <Text className="font-inter-regular text-xs mt-3" style={{ color: colors['muted-foreground'] }}>
                        Keep this specific and useful so Oracle can ground suggestions in real context.
                    </Text>
                </View>
            </StandardBottomSheet>

            <AnimatedBottomSheet
                visible={showDatePicker}
                onClose={() => setShowDatePicker(false)}
                height="form"
            >
                <View className="flex-1">
                    <View className="flex-row items-center justify-between px-6 pt-2 mb-3">
                        <Text className="font-lora-bold text-xl" style={{ color: colors.foreground }}>
                            Pick a Date
                        </Text>
                        <TouchableOpacity onPress={() => setShowDatePicker(false)} className="p-2 -mr-2">
                            <X size={22} color={colors['muted-foreground']} />
                        </TouchableOpacity>
                    </View>
                    <View className="px-4">
                        <CustomCalendar
                            selectedDate={effectiveDate || startOfDay(new Date())}
                            onDateSelect={handleDateSelect}
                        />
                    </View>
                </View>
            </AnimatedBottomSheet>
        </>
    );
}
