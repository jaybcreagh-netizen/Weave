/**
 * PlannedWeaveDetailSheet
 * A modular view/edit sheet for planned (future) weaves.
 * Shows all plan details with tappable fields for inline editing.
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    Platform,
    StyleSheet,
    ScrollView,
    LayoutAnimation,
} from 'react-native';
import {
    Calendar,
    Clock,
    MapPin,
    Users,
    FileText,
    ChevronRight,
    Trash2,
    X,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { Button } from '@/shared/ui/Button';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import InteractionFriend from '@/db/models/InteractionFriend';
import { InteractionCategory } from '@/shared/types/common';
import { getCategoryMetadata, CATEGORY_METADATA } from '@/shared/constants/interaction-categories';
import { FriendSelector } from '@/modules/relationships/components/FriendSelector';
import { NotesInputField } from '@/shared/components/NotesInputField';
import { CustomCalendar } from '@/shared/components/CustomCalendar';
import * as CalendarService from '../services/calendar.service';
import * as Haptics from 'expo-haptics';

interface PlannedWeaveDetailSheetProps {
    visible: boolean;
    onClose: () => void;
    interaction: Interaction | null;
    onDelete?: (id: string) => Promise<void>;
    onUpdate?: (id: string, updates: Partial<Interaction>) => Promise<void>;
}

// Editable row component
const EditableRow = ({
    icon,
    label,
    value,
    onPress,
    colors,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    onPress: () => void;
    colors: any;
}) => (
    <TouchableOpacity
        onPress={onPress}
        className="flex-row items-center py-4 px-1"
        style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
        activeOpacity={0.7}
    >
        <View className="w-8 items-center">{icon}</View>
        <View className="flex-1 ml-3">
            <Text
                className="text-xs uppercase tracking-wider mb-1"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
            >
                {label}
            </Text>
            <Text
                className="text-base"
                style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}
            >
                {value || 'Not set'}
            </Text>
        </View>
        <ChevronRight size={20} color={colors['muted-foreground']} />
    </TouchableOpacity>
);

export function PlannedWeaveDetailSheet({
    visible,
    onClose,
    interaction,
    onDelete,
    onUpdate,
}: PlannedWeaveDetailSheetProps) {
    const { colors, tokens, typography, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();

    // Local state for edits
    const [date, setDate] = useState<Date>(new Date());
    const [time, setTime] = useState<Date>(new Date());
    const [category, setCategory] = useState<InteractionCategory | null>(null);
    const [location, setLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [participants, setParticipants] = useState<FriendModel[]>([]);

    // Inline editing state
    const [editingField, setEditingField] = useState<'date' | 'time' | null>(null);
    const [tempDate, setTempDate] = useState<Date>(new Date());

    // Other pickers
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showParticipantsPicker, setShowParticipantsPicker] = useState(false);

    const [isSaving, setIsSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    // Load interaction data when it changes
    useEffect(() => {
        if (interaction && visible) {
            const interactionDate = new Date(interaction.interactionDate);
            setDate(interactionDate);
            setTime(interactionDate);
            setDate(interactionDate);
            setTime(interactionDate);
            setEditingField(null);
            setCategory((interaction.interactionCategory || interaction.activity) as InteractionCategory);
            setLocation(interaction.location || '');
            setNotes(interaction.notes || '');
            setHasChanges(false);

            // Load participants
            loadParticipants();
        }
    }, [interaction?.id, visible]);

    const loadParticipants = async () => {
        if (!interaction) return;
        try {
            // Two-step query for many-to-many
            const links = await database
                .get<InteractionFriend>('interaction_friends')
                .query(Q.where('interaction_id', interaction.id))
                .fetch();

            const friendIds = links.map(link => link.friendId);
            if (friendIds.length > 0) {
                const friends = await database
                    .get<FriendModel>('friends')
                    .query(Q.where('id', Q.oneOf(friendIds)))
                    .fetch();
                setParticipants(friends);
            }
        } catch (error) {
            console.error('Error loading participants:', error);
        }
    };

    const handleSave = async () => {
        if (!interaction || !onUpdate) return;

        setIsSaving(true);
        try {
            // Merge date and time
            const finalDate = new Date(date);
            finalDate.setHours(time.getHours(), time.getMinutes(), 0, 0);

            await onUpdate(interaction.id, {
                interactionDate: finalDate,
                interactionCategory: category || undefined,
                activity: category || undefined,
                location: location.trim() || undefined,
                notes: notes.trim() || undefined,
            });

            // Update calendar event if exists
            if (interaction.calendarEventId) {
                try {
                    // Build calendar-friendly data with proper formatting (matching create format)
                    const friendNames = participants.map(f => f.name).join(', ') || 'friends';
                    const categoryMeta = category ? getCategoryMetadata(category) : null;
                    const categoryLabel = categoryMeta?.label || category || 'Weave';

                    // Build title: use interaction title if available, otherwise category + friends
                    const eventTitle = interaction.title
                        ? interaction.title
                        : `${categoryLabel} with ${friendNames}`;

                    // Build formatted notes matching create format
                    const eventNotes = [
                        `Planned weave with ${friendNames}`,
                        '',
                        `Activity: ${categoryLabel}`,
                        location.trim() ? `Location: ${location.trim()}` : null,
                        '',
                        notes.trim() ? `Notes:\n${notes.trim()}` : null,
                        '',
                        '---',
                        'Created by Weave'
                    ].filter(Boolean).join('\n');

                    await CalendarService.updateWeaveCalendarEvent(interaction.calendarEventId, {
                        title: eventTitle,
                        date: finalDate,
                        location: location.trim(),
                        notes: eventNotes,
                    });
                } catch (calendarError) {
                    console.warn('Failed to update calendar event:', calendarError);
                }
            }

            setHasChanges(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
        } catch (error) {
            console.error('Error saving planned weave:', error);
            Alert.alert('Error', 'Failed to save changes. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = () => {
        if (!interaction || !onDelete) return;

        Alert.alert(
            'Cancel Plan',
            'Are you sure you want to cancel this planned weave?',
            [
                { text: 'Keep It', style: 'cancel' },
                {
                    text: 'Cancel Plan',
                    style: 'destructive',
                    onPress: async () => {
                        await onDelete(interaction.id);
                        onClose();
                    },
                },
            ]
        );
    };

    const handleFieldChange = () => {
        setHasChanges(true);
    };

    const toggleField = (field: 'date' | 'time') => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        if (editingField === field) {
            setEditingField(null);
        } else {
            // Initialize temp date
            setTempDate(field === 'date' ? date : time);
            setEditingField(field);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
    };

    const handleInlineSave = (field: 'date' | 'time') => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

        if (field === 'date') {
            const newDate = new Date(tempDate);
            // Keep original time
            newDate.setHours(time.getHours(), time.getMinutes());
            setDate(newDate);
            setTime(newDate); // Sync them
        } else {
            const newTime = new Date(tempDate);
            const newDate = new Date(date);
            newDate.setHours(newTime.getHours(), newTime.getMinutes());
            setDate(newDate);
            setTime(newDate);
        }

        setEditingField(null);
        handleFieldChange();
    };

    // Get category display info
    const categoryMeta = category ? getCategoryMetadata(category) : null;
    const CategoryIcon = categoryMeta?.iconComponent;

    if (!interaction) return null;

    return (
        <>
            <AnimatedBottomSheet
                visible={visible}
                onClose={onClose}
                height="full"
                scrollable
                title="Plan Details"
            >
                <View className="px-4 pt-2 pb-6">
                    {/* Date Row */}
                    <EditableRow
                        icon={<Calendar size={20} color={tokens.primary} />}
                        label="Date"
                        value={format(date, 'EEEE, MMMM d, yyyy')}
                        onPress={() => toggleField('date')}
                        colors={colors}
                    />

                    {/* Inline Date Picker */}
                    {editingField === 'date' && (
                        <View className="mb-4 bg-muted/30 rounded-xl overflow-hidden border border-border">
                            <DateTimePicker
                                value={tempDate}
                                mode="date"
                                display="inline"
                                onChange={(event, selectedDate) => {
                                    if (selectedDate) setTempDate(selectedDate);
                                }}
                                accentColor={colors.primary}
                                textColor={colors.foreground}
                            />
                            <View className="flex-row border-t border-border">
                                <TouchableOpacity
                                    className="flex-1 p-3 items-center"
                                    onPress={() => {
                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                        setEditingField(null);
                                    }}
                                >
                                    <Text style={{ color: colors.mutedForeground }}>Cancel</Text>
                                </TouchableOpacity>
                                <View style={{ width: 1, backgroundColor: colors.border }} />
                                <TouchableOpacity
                                    className="flex-1 p-3 items-center"
                                    onPress={() => handleInlineSave('date')}
                                >
                                    <Text style={{ color: colors.primary, fontWeight: '600' }}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Time Row */}
                    <EditableRow
                        icon={<Clock size={20} color={tokens.primary} />}
                        label="Time"
                        value={format(time, 'h:mm a')}
                        onPress={() => toggleField('time')}
                        colors={colors}
                    />

                    {/* Inline Time Picker */}
                    {editingField === 'time' && (
                        <View className="mb-4 bg-muted/30 rounded-xl overflow-hidden border border-border">
                            <DateTimePicker
                                value={tempDate} // Use tempDate which tracks the time edit
                                mode="time"
                                display="spinner"
                                onChange={(event, selectedDate) => {
                                    if (selectedDate) setTempDate(selectedDate);
                                }}
                                textColor={colors.foreground}
                                style={{ height: 180 }}
                            />
                            <View className="flex-row border-t border-border">
                                <TouchableOpacity
                                    className="flex-1 p-3 items-center"
                                    onPress={() => {
                                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                        setEditingField(null);
                                    }}
                                >
                                    <Text style={{ color: colors.mutedForeground }}>Cancel</Text>
                                </TouchableOpacity>
                                <View style={{ width: 1, backgroundColor: colors.border }} />
                                <TouchableOpacity
                                    className="flex-1 p-3 items-center"
                                    onPress={() => handleInlineSave('time')}
                                >
                                    <Text style={{ color: colors.primary, fontWeight: '600' }}>Done</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Activity Type Row */}
                    <EditableRow
                        icon={
                            CategoryIcon ? (
                                <CategoryIcon size={20} color={tokens.primary} />
                            ) : (
                                <Calendar size={20} color={tokens.primary} />
                            )
                        }
                        label="Activity Type"
                        value={categoryMeta?.label || 'Select activity'}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowCategoryPicker(true);
                        }}
                        colors={colors}
                    />

                    {/* Location Row */}
                    <EditableRow
                        icon={<MapPin size={20} color={tokens.primary} />}
                        label="Location"
                        value={location || 'Add location'}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            Alert.prompt(
                                'Location',
                                'Where will you meet?',
                                [
                                    { text: 'Cancel', style: 'cancel' },
                                    {
                                        text: 'Save',
                                        onPress: (text) => {
                                            if (text !== undefined) {
                                                setLocation(text);
                                                handleFieldChange();
                                            }
                                        },
                                    },
                                ],
                                'plain-text',
                                location
                            );
                        }}
                        colors={colors}
                    />

                    {/* Participants Row */}
                    <EditableRow
                        icon={<Users size={20} color={tokens.primary} />}
                        label="With"
                        value={
                            participants.length > 0
                                ? participants.map(f => f.name).join(', ')
                                : 'Add friends'
                        }
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowParticipantsPicker(true);
                        }}
                        colors={colors}
                    />

                    {/* Notes Row */}
                    <View
                        className="py-4 px-1"
                        style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                    >
                        <View className="flex-row items-start">
                            <View className="w-8 items-center pt-1">
                                <FileText size={20} color={tokens.primary} />
                            </View>
                            <View className="flex-1 ml-3">
                                <NotesInputField
                                    value={notes}
                                    onChangeText={(text) => {
                                        setNotes(text);
                                        handleFieldChange();
                                    }}
                                    placeholder="Add notes..."
                                    label="Notes"
                                />
                            </View>
                        </View>
                    </View>

                    {/* Action Buttons */}
                    <View className="mt-8 gap-3">
                        {hasChanges && (
                            <Button
                                label="Save Changes"
                                onPress={handleSave}
                                loading={isSaving}
                            />
                        )}

                        <TouchableOpacity
                            onPress={handleDelete}
                            className="flex-row items-center justify-center py-4 rounded-xl"
                            style={{ backgroundColor: colors.destructive + '15' }}
                        >
                            <Trash2 size={18} color={colors.destructive} />
                            <Text
                                className="ml-2 font-medium"
                                style={{ color: colors.destructive, fontFamily: 'Inter_500Medium' }}
                            >
                                Cancel Plan
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Category Picker Modal */}
                {showCategoryPicker && (
                    <View
                        className="absolute inset-0 p-4"
                        style={{ backgroundColor: colors.background }}
                    >
                        <View className="flex-row justify-between items-center mb-4">
                            <Text
                                className="text-lg font-semibold"
                                style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                            >
                                Select Activity
                            </Text>
                            <TouchableOpacity onPress={() => setShowCategoryPicker(false)}>
                                <Text style={{ color: tokens.primary }}>Done</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="flex-row flex-wrap gap-2">
                            {Object.entries(CATEGORY_METADATA).map(([key, meta]) => {
                                const isSelected = category === key;
                                const Icon = meta.iconComponent;
                                return (
                                    <TouchableOpacity
                                        key={key}
                                        onPress={() => {
                                            setCategory(key as InteractionCategory);
                                            handleFieldChange();
                                            // Don't close immediately, let them see selection
                                            // setShowCategoryPicker(false); 
                                            // Actually user might want to confirm, but 'Done' button exists.
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                        className="p-2 rounded-xl items-center justify-center"
                                        style={{
                                            width: '31%', // 3 column grid
                                            height: 90,
                                            backgroundColor: colors.card,
                                            borderWidth: isSelected ? 2 : 1,
                                            borderColor: isSelected ? tokens.primary : colors.border,
                                        }}
                                    >
                                        <Icon size={28} color={tokens.primary} style={{ marginBottom: 4 }} />
                                        <Text
                                            className="text-xs text-center leading-tight"
                                            style={{
                                                color: colors.foreground,
                                                fontFamily: 'Inter_500Medium',
                                            }}
                                            numberOfLines={2}
                                        >
                                            {meta.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Participants Picker */}
                <FriendSelector
                    visible={showParticipantsPicker}
                    onClose={() => setShowParticipantsPicker(false)}
                    selectedFriends={participants}
                    onSelectionChange={(friends: FriendModel[]) => {
                        setParticipants(friends);
                        handleFieldChange();
                    }}
                    asModal
                />
            </AnimatedBottomSheet>

            {/* Android Picker fallback if needed, but simplified for now */}
            {Platform.OS === 'android' && editingField && (
                <DateTimePicker
                    value={tempDate}
                    mode={editingField === 'date' ? 'date' : 'time'}
                    display="default"
                    onChange={(event, selectedTime) => {
                        if (selectedTime) {
                            setTempDate(selectedTime);
                            // Auto save on Android for simplicity or add handler
                            // But for now let's just mimic iOS flow or rely on inline if supported
                            if (event.type === 'set') {
                                // Logic to save... 
                                // Actually better to keep inline state
                                handleInlineSave(editingField);
                            } else {
                                setEditingField(null);
                            }
                        } else {
                            setEditingField(null);
                        }
                    }}
                />
            )}
        </>
    );
}
