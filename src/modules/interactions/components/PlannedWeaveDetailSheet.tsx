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
} from 'react-native';
import {
    Calendar,
    Clock,
    MapPin,
    Users,
    FileText,
    ChevronRight,
    Trash2,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
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
import { FriendSelector } from '@/modules/relationships';
import { NotesInputField } from '@/shared/components/NotesInputField';
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
    const { colors, tokens, typography } = useTheme();

    // Local state for edits
    const [date, setDate] = useState<Date>(new Date());
    const [time, setTime] = useState<Date>(new Date());
    const [category, setCategory] = useState<InteractionCategory | null>(null);
    const [location, setLocation] = useState('');
    const [notes, setNotes] = useState('');
    const [participants, setParticipants] = useState<FriendModel[]>([]);

    // Picker visibility states
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
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
                    await CalendarService.updateWeaveCalendarEvent(interaction.calendarEventId, {
                        date: finalDate,
                        location: location.trim(),
                        notes: notes.trim(),
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

    // Get category display info
    const categoryMeta = category ? getCategoryMetadata(category) : null;
    const CategoryIcon = categoryMeta?.iconComponent;

    if (!interaction) return null;

    return (
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
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowDatePicker(true);
                    }}
                    colors={colors}
                />

                {/* Time Row */}
                <EditableRow
                    icon={<Clock size={20} color={tokens.primary} />}
                    label="Time"
                    value={format(time, 'h:mm a')}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setShowTimePicker(true);
                    }}
                    colors={colors}
                />

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

            {/* Date Picker */}
            {showDatePicker && (
                <DateTimePicker
                    value={date}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (selectedDate) {
                            setDate(selectedDate);
                            handleFieldChange();
                        }
                    }}
                />
            )}

            {/* Time Picker */}
            {showTimePicker && (
                <DateTimePicker
                    value={time}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, selectedTime) => {
                        setShowTimePicker(Platform.OS === 'ios');
                        if (selectedTime) {
                            setTime(selectedTime);
                            handleFieldChange();
                        }
                    }}
                />
            )}

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
                                        setShowCategoryPicker(false);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    className="px-4 py-3 rounded-xl flex-row items-center gap-2"
                                    style={{
                                        backgroundColor: isSelected ? tokens.primary : colors.muted,
                                        borderWidth: isSelected ? 0 : 1,
                                        borderColor: colors.border,
                                    }}
                                >
                                    <Icon size={18} color={isSelected ? '#fff' : colors.foreground} />
                                    <Text
                                        style={{
                                            color: isSelected ? '#fff' : colors.foreground,
                                            fontFamily: 'Inter_500Medium',
                                        }}
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
    );
}
