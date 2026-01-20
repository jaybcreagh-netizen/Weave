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
    Modal,
    StyleSheet,
    ScrollView,
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
import { BlurView } from 'expo-blur';
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

    // Picker visibility states
    const [showDateTimePicker, setShowDateTimePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [tempDate, setTempDate] = useState<Date>(new Date());
    const [tempTime, setTempTime] = useState<Date>(new Date());
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
            setTempDate(interactionDate);
            setTempTime(interactionDate);
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

    const openDateTimePicker = () => {
        setTempDate(date);
        setTempTime(time);
        setShowDateTimePicker(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const saveDateTimeChanges = () => {
        const newDate = new Date(tempDate);
        newDate.setHours(tempTime.getHours(), tempTime.getMinutes(), 0, 0);
        setDate(newDate);
        setTime(newDate);
        setShowDateTimePicker(false);
        setShowTimePicker(false);
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
                        onPress={openDateTimePicker}
                        colors={colors}
                    />

                    {/* Time Row */}
                    <EditableRow
                        icon={<Clock size={20} color={tokens.primary} />}
                        label="Time"
                        value={format(time, 'h:mm a')}
                        onPress={openDateTimePicker}
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

            {/* Date/Time Picker Modal - Proper modal overlay */}
            <Modal
                visible={showDateTimePicker}
                transparent
                animationType="fade"
                onRequestClose={() => setShowDateTimePicker(false)}
            >
                <BlurView
                    intensity={isDarkMode ? 40 : 60}
                    tint={isDarkMode ? 'dark' : 'light'}
                    style={StyleSheet.absoluteFill}
                >
                    <TouchableOpacity
                        className="flex-1 justify-center items-center p-5"
                        activeOpacity={1}
                        onPress={() => setShowDateTimePicker(false)}
                    >
                        <Animated.View
                            entering={FadeInUp.duration(200).springify()}
                            className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl"
                            style={{ backgroundColor: colors.background }}
                            onStartShouldSetResponder={() => true}
                        >
                            {/* Header */}
                            <View
                                className="flex-row justify-between items-center px-5 py-4"
                                style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
                            >
                                <Text
                                    className="text-xl font-semibold"
                                    style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                                >
                                    Reschedule
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setShowDateTimePicker(false)}
                                    className="p-2 -mr-2"
                                >
                                    <X size={24} color={colors['muted-foreground']} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView className="px-5 py-4" style={{ maxHeight: 500 }}>
                                {/* Date Selection */}
                                <Text
                                    className="text-sm font-medium mb-3"
                                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                                >
                                    Select Date
                                </Text>
                                <CustomCalendar
                                    selectedDate={tempDate}
                                    onDateSelect={(selectedDate) => {
                                        const newDate = new Date(selectedDate);
                                        newDate.setHours(tempTime.getHours(), tempTime.getMinutes());
                                        setTempDate(newDate);
                                    }}
                                    minDate={new Date()}
                                />

                                {/* Time Selection */}
                                <View className="mt-6">
                                    <Text
                                        className="text-sm font-medium mb-3"
                                        style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                                    >
                                        Select Time
                                    </Text>

                                    {Platform.OS === 'ios' ? (
                                        <View
                                            className="rounded-xl overflow-hidden"
                                            style={{ backgroundColor: colors.muted }}
                                        >
                                            <DateTimePicker
                                                value={tempTime}
                                                mode="time"
                                                display="spinner"
                                                onChange={(event, selectedTime) => {
                                                    if (selectedTime) {
                                                        setTempTime(selectedTime);
                                                    }
                                                }}
                                                style={{ height: 150 }}
                                            />
                                        </View>
                                    ) : (
                                        <TouchableOpacity
                                            onPress={() => setShowTimePicker(true)}
                                            className="p-4 rounded-xl flex-row justify-between items-center"
                                            style={{ backgroundColor: colors.muted }}
                                        >
                                            <View className="flex-row items-center gap-3">
                                                <Clock size={20} color={tokens.primary} />
                                                <Text
                                                    className="text-base"
                                                    style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}
                                                >
                                                    {format(tempTime, 'h:mm a')}
                                                </Text>
                                            </View>
                                            <ChevronRight size={20} color={colors['muted-foreground']} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </ScrollView>

                            {/* Action Buttons */}
                            <View
                                className="px-5 py-4 gap-3"
                                style={{
                                    borderTopWidth: 1,
                                    borderTopColor: colors.border,
                                    paddingBottom: insets.bottom + 16,
                                }}
                            >
                                <Button
                                    label="Confirm"
                                    onPress={saveDateTimeChanges}
                                />
                                <Button
                                    label="Cancel"
                                    variant="ghost"
                                    onPress={() => setShowDateTimePicker(false)}
                                />
                            </View>
                        </Animated.View>
                    </TouchableOpacity>
                </BlurView>
            </Modal>

            {/* Android Time Picker (shown separately) */}
            {Platform.OS === 'android' && showTimePicker && (
                <DateTimePicker
                    value={tempTime}
                    mode="time"
                    display="default"
                    onChange={(event, selectedTime) => {
                        setShowTimePicker(false);
                        if (event.type === 'set' && selectedTime) {
                            setTempTime(selectedTime);
                        }
                    }}
                />
            )}
        </>
    );
}
