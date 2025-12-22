import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Keyboard, TouchableWithoutFeedback, Vibration, Alert, Modal, Platform, KeyboardAvoidingView } from 'react-native';
import { BlurView } from 'expo-blur';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useSharedValue, withSpring } from 'react-native-reanimated';

import { calculateDeepeningLevel } from '@/modules/intelligence';
import { useUIStore } from '@/shared/stores/uiStore';

import { useInteractions, type StructuredReflection } from '@/modules/interactions';
import { WeaveReflectPrompt, useWeaveReflectPrompt } from '@/modules/journal';
import { useDebounceCallback } from '@/shared/hooks/useDebounceCallback';
import { Calendar as CalendarIcon, X, Sparkles, Users, ChevronLeft, Clock, Sun, Moon, LucideIcon } from 'lucide-react-native';
import { CustomCalendar } from '@/shared/components/CustomCalendar';
import { MoonPhaseSelector } from '@/modules/intelligence';
import { ContextualReflectionInput } from '@/modules/reflection';
import { format, subDays, isSameDay, startOfDay } from 'date-fns';
import { type Vibe, type InteractionCategory, type Archetype } from '@/shared/types/legacy-types';
import { useTheme } from '@/shared/hooks/useTheme';
import { getAllCategories, getCategoryMetadata, type CategoryMetadata } from '@/shared/constants/interaction-categories';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import { ReciprocitySelector, InitiatorType, FriendPickerSheet } from '@/modules/relationships';
import DateTimePicker from '@react-native-community/datetimepicker';

import { STORY_CHIPS } from '@/modules/reflection';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

const categories: CategoryMetadata[] = getAllCategories().map(getCategoryMetadata);

const dateOptions: { id: string; icon: LucideIcon; label: string; getDate: () => Date }[] = [
    { id: 'today', icon: Sun, label: 'Today', getDate: () => startOfDay(new Date()) },
    { id: 'yesterday', icon: Moon, label: 'Yesterday', getDate: () => startOfDay(subDays(new Date(), 1)) },
];

interface WeaveLoggerScreenProps {
    /** Pre-selected friend ID (optional) */
    friendId?: string;
    /** Pre-selected date (optional) */
    date?: string;
    /** Pre-selected category (optional) */
    category?: InteractionCategory;
    /** Pre-filled notes (optional) */
    notes?: string;
    /** Pre-filled title (optional) */
    title?: string;
    /** Callback when the user wants to navigate back */
    onBack: () => void;
    /** Callback when weave is saved and user should navigate to home */
    onNavigateHome: () => void;
    /** Callback to navigate to journal for reflection */
    onNavigateToJournal: (weaveId?: string) => void;
}

export function WeaveLoggerScreen({
    friendId,
    date,
    category,
    notes,
    title: initialTitle,
    onBack,
    onNavigateHome,
    onNavigateToJournal
}: WeaveLoggerScreenProps) {
    const { logWeave } = useInteractions();
    const { colors, isDarkMode } = useTheme();
    const { showToast } = useUIStore();

    const [selectedFriends, setSelectedFriends] = useState<FriendModel[]>([]);
    const [showCalendar, setShowCalendar] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showFriendPicker, setShowFriendPicker] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<InteractionCategory | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
    const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
    const [reflection, setReflection] = useState<StructuredReflection>({});
    const [friendArchetype, setFriendArchetype] = useState<Archetype | undefined>(undefined);
    const [title, setTitle] = useState<string>('');
    const [initiator, setInitiator] = useState<InitiatorType | undefined>(undefined);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [calendarDates, setCalendarDates] = useState<{ planned: Date[]; completed: Date[] }>({ planned: [], completed: [] });

    const {
        showPrompt,
        checkAndShowPrompt,
        hidePrompt,
        promptInteraction,
        promptFriends
    } = useWeaveReflectPrompt();

    const scrollViewRef = useRef<ScrollView>(null);
    const scale = useSharedValue(1);
    const [detailsSectionY, setDetailsSectionY] = useState(0);
    const isMountedRef = useRef(true);
    const navigationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
            if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
            }
        };
    }, []);

    // Scroll to reflection section when keyboard opens
    useEffect(() => {
        const keyboardShowEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const subscription = Keyboard.addListener(keyboardShowEvent, () => {
            // Only scroll if we have a details section rendered (category selected)
            if (detailsSectionY > 0 && selectedCategory) {
                // Scroll to show the reflection section with some context above
                // Add offset to keep vibe selector visible above the text input
                setTimeout(() => {
                    scrollViewRef.current?.scrollTo({
                        y: detailsSectionY + 350, // Position text box just above keyboard
                        animated: true
                    });
                }, 100);
            }
        });

        return () => subscription.remove();
    }, [detailsSectionY, selectedCategory]);

    // Fetch friend's data and set as initial selected friend
    useEffect(() => {
        if (friendId) {
            database.get<FriendModel>(FriendModel.table)
                .find(friendId)
                .then(friend => {
                    setSelectedFriends([friend]);
                    setFriendArchetype(friend.archetype as Archetype);
                })
                .catch(err => {
                    console.error('Error fetching friend:', err);
                    Alert.alert(
                        'Error',
                        'Could not load friend details. Please try again.',
                        [{ text: 'OK', onPress: onBack }]
                    );
                });
        }
    }, [friendId, onBack]);

    // Fetch interaction dates for calendar indicators
    useEffect(() => {
        const loadCalendarDates = async () => {
            try {
                // Fetch all interactions for the last 3 months and next month
                const threeMonthsAgo = subDays(new Date(), 90);
                const oneMonthAhead = new Date();
                oneMonthAhead.setMonth(oneMonthAhead.getMonth() + 1);

                const allInteractions = await database
                    .get<Interaction>('interactions')
                    .query(
                        Q.where('interaction_date', Q.gte(threeMonthsAgo.getTime())),
                        Q.where('interaction_date', Q.lte(oneMonthAhead.getTime()))
                    )
                    .fetch();

                const planned: Date[] = [];
                const completed: Date[] = [];

                allInteractions.forEach(interaction => {
                    const date = startOfDay(interaction.interactionDate);
                    if (interaction.status === 'planned') {
                        planned.push(date);
                    } else if (interaction.status === 'completed') {
                        completed.push(date);
                    }
                });

                setCalendarDates({ planned, completed });
            } catch (error) {
                console.error('Error loading calendar dates:', error);
            }
        };

        loadCalendarDates();
    }, []);

    // Initialize from other params
    useEffect(() => {
        // Date
        if (date) {
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
                setSelectedDate(startOfDay(parsedDate));
            }
        }

        // Category
        if (category) {
            const isValid = getAllCategories().includes(category);
            if (isValid) {
                setSelectedCategory(category);
            }
        }

        // Notes
        if (notes) {
            setReflection(prev => ({
                ...prev,
                customNotes: notes
            }));
        }

        // Title
        if (initialTitle) {
            setTitle(initialTitle);
        }
    }, [date, category, notes, initialTitle]);

    // Auto-scroll to details section when category is selected
    useEffect(() => {
        if (selectedCategory && detailsSectionY > 0) {
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: detailsSectionY - 50, animated: true });
            }, 300);
        }
    }, [selectedCategory, detailsSectionY]);

    const handleCategorySelect = (category: InteractionCategory) => {
        setSelectedCategory(category);
        Vibration.vibrate(50);
        scale.value = withSpring(0.95, { damping: 15 });
        setTimeout(() => {
            scale.value = withSpring(1, { damping: 15 });
        }, 100);
    };

    const handleDateSelect = (date: Date) => {
        setSelectedDate(startOfDay(date));
        setShowCalendar(false);
    };

    const handleQuickDateSelect = (date: Date) => {
        // Preserve time from current selection if we're picking "Today", 
        // otherwise reset to end of day or similar? actually user probably expects "Yesterday" to be yesterday but maybe preserve time?
        // Simpler: Just set the date part, keep time? Or standard startOfDay? 
        // Existing logic was startOfDay. Let's start with startOfDay but maybe if they picked a time before...
        // Recommendation: If they pick date text, reset to default time unless they edit it.
        // Actually, let's stick to startOfDay for "Yesterday" etc to be safe, but "Today" could be now?
        // Let's stick to startOfDay logic which was there, they can add time if they want.
        setSelectedDate(startOfDay(date));
        Vibration.vibrate(50);
    };

    const handleTimeChange = (event: any, selectedTime?: Date) => {
        if (Platform.OS === 'android') {
            setShowTimePicker(false);
        }
        if (selectedTime) {
            // Merge time into selectedDate
            const newDate = new Date(selectedDate);
            newDate.setHours(selectedTime.getHours());
            newDate.setMinutes(selectedTime.getMinutes());
            setSelectedDate(newDate);
        }
    };


    const handleSave = useDebounceCallback(async () => {
        if (!selectedCategory || selectedFriends.length === 0 || !selectedDate || isSubmitting) return;

        setIsSubmitting(true);
        try {
            // Build legacy notes field from chips + custom notes for backward compatibility
            const legacyNotes = [
                ...(reflection.chips || []).map(chip => {
                    const storyChip = STORY_CHIPS.find((s: any) => s.id === chip.chipId);
                    if (!storyChip) return '';

                    let text = storyChip.template;

                    if (storyChip.components) {
                        Object.entries(storyChip.components).forEach(([componentId, component]: [string, any]) => {
                            const value = chip.componentOverrides[componentId] || component.original;
                            text = text.replace(`{${componentId}}`, value);
                        });
                    }

                    return text;
                }),
                reflection.customNotes || '',
            ]
                .filter(Boolean)
                .join(' ');

            await logWeave({
                friendIds: selectedFriends.map(f => f.id),
                category: selectedCategory,
                activity: selectedCategory,
                notes: legacyNotes,
                date: selectedDate,
                type: 'log',
                status: 'completed',
                mode: 'one-on-one',
                vibe: selectedVibe,
                reflection,
                title: title.trim() || undefined,
                initiator,
            });

            const interactionData = {
                id: 'new-weave',
                interactionDate: selectedDate.getTime(),
                interactionType: 'log',
                interactionCategory: selectedCategory,
                vibe: selectedVibe,
                duration: 'Medium',
                notes: legacyNotes,
            };

            Vibration.vibrate();

            // Show sparkles popup
            showToast("Weave logged", selectedFriends.length === 1 ? selectedFriends[0].name : (selectedFriends.length > 1 ? 'Friends' : 'Friend'));

            const shouldShow = await checkAndShowPrompt(interactionData as any, selectedFriends);

            if (!shouldShow) {
                navigationTimeoutRef.current = setTimeout(() => {
                    if (!isMountedRef.current) return;
                    onBack();
                }, 900);
            }
        } catch (error) {
            console.error('[WeaveLogger] Error saving weave:', error);
            navigationTimeoutRef.current = setTimeout(() => {
                if (!isMountedRef.current) return;
                onBack();
            }, 100);
        }
    });

    const deepeningMetrics = calculateDeepeningLevel(reflection);

    const screenTitle = selectedFriends.length === 0
        ? 'Log a Weave'
        : selectedFriends.length === 1
            ? `Weave with ${selectedFriends[0].name}`
            : selectedFriends.length === 2
                ? `Weave with ${selectedFriends[0].name} & ${selectedFriends[1].name}`
                : `Weave with ${selectedFriends.length} friends`;

    return (
        <ErrorBoundary>
            <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
                >
                    <Stack.Screen options={{ title: screenTitle }} />

                    {/* Custom Header with Back Button */}
                    <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800" style={{ borderBottomColor: colors.border }}>
                        <TouchableOpacity
                            onPress={onBack}
                            className="p-2 -ml-2 rounded-full"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <ChevronLeft size={24} color={colors.foreground} />
                        </TouchableOpacity>
                        <Text
                            className="flex-1 text-center font-lora-bold text-lg mx-2"
                            style={{ color: colors.foreground }}
                            numberOfLines={1}
                        >
                            {screenTitle}
                        </Text>
                        <View className="w-8" />
                    </View>



                    {/* Calendar Modal (centered popup, matching Plan Weave style) */}
                    {showCalendar && (
                        <Modal
                            visible={true}
                            transparent
                            animationType="none"
                            onRequestClose={() => setShowCalendar(false)}
                        >
                            <BlurView intensity={isDarkMode ? 20 : 40} tint={isDarkMode ? 'dark' : 'light'} className="flex-1">
                                <TouchableOpacity
                                    className="flex-1 justify-center items-center px-5"
                                    activeOpacity={1}
                                    onPress={() => setShowCalendar(false)}
                                >
                                    <Animated.View
                                        entering={FadeInUp.duration(200).springify()}
                                        className="w-full max-w-md rounded-3xl p-6"
                                        style={{
                                            backgroundColor: colors.background,
                                            shadowColor: '#000',
                                            shadowOffset: { width: 0, height: 20 },
                                            shadowOpacity: 0.25,
                                            shadowRadius: 30,
                                            elevation: 20,
                                        }}
                                        onStartShouldSetResponder={() => true}
                                    >
                                        {/* Header */}
                                        <View className="flex-row justify-between items-center mb-4">
                                            <Text className="font-lora-bold text-xl" style={{ color: colors.foreground }}>
                                                Pick a Date
                                            </Text>
                                            <TouchableOpacity onPress={() => setShowCalendar(false)} className="p-2 -mr-2">
                                                <X color={colors['muted-foreground']} size={22} />
                                            </TouchableOpacity>
                                        </View>

                                        <CustomCalendar
                                            selectedDate={selectedDate}
                                            onDateSelect={handleDateSelect}
                                            minDate={undefined}
                                            maxDate={new Date()}
                                            plannedDates={calendarDates.planned}
                                            completedDates={calendarDates.completed}
                                        />
                                    </Animated.View>
                                </TouchableOpacity>
                            </BlurView>
                        </Modal>
                    )}

                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <ScrollView
                            ref={scrollViewRef}
                            className="flex-1"
                            contentContainerStyle={{ paddingBottom: 180, paddingHorizontal: 20 }}
                            keyboardShouldPersistTaps="handled"
                            keyboardDismissMode="interactive"
                        >
                            {/* Date Selection */}
                            <View className="mb-5">
                                <Text className="font-lora-bold text-lg mb-2" style={{ color: colors.foreground }}>
                                    When?
                                </Text>
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ gap: 10, paddingRight: 20 }}
                                >
                                    {dateOptions.map((opt, index) => {
                                        const date = opt.getDate();
                                        const isSelected = isSameDay(selectedDate, date);
                                        return (
                                            <Animated.View
                                                key={opt.id}
                                                entering={FadeInUp.duration(500).delay(index * 50)}
                                            >
                                                <TouchableOpacity
                                                    className="px-4 py-3 rounded-full flex-row items-center justify-center border"
                                                    style={{
                                                        backgroundColor: isSelected ? colors.primary + '20' : colors.card,
                                                        borderColor: isSelected ? colors.primary : colors.border,
                                                    }}
                                                    onPress={() => handleQuickDateSelect(date)}
                                                >
                                                    <opt.icon size={18} color={colors.primary} style={{ marginRight: 8 }} />
                                                    <Text
                                                        className={`font-inter-medium text-sm ${isSelected ? 'text-primary' : ''}`}
                                                        style={{ color: isSelected ? colors.primary : colors.foreground }}
                                                    >
                                                        {opt.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            </Animated.View>
                                        );
                                    })}
                                    <Animated.View entering={FadeInUp.duration(500).delay(100)}>
                                        <TouchableOpacity
                                            className="px-4 py-3 rounded-full flex-row items-center justify-center border"
                                            style={{
                                                backgroundColor: colors.card,
                                                borderColor: colors.border,
                                            }}
                                            onPress={() => setShowCalendar(true)}
                                        >
                                            <CalendarIcon size={16} color={colors.primary} style={{ marginRight: 6 }} />
                                            <Text className="font-inter-medium text-sm" style={{ color: colors.foreground }}>
                                                {format(selectedDate, 'MMM d')}
                                            </Text>
                                        </TouchableOpacity>
                                    </Animated.View>
                                </ScrollView>

                                {/* Time Display / Picker */}
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    contentContainerStyle={{ paddingHorizontal: 0, marginTop: 8 }}
                                >
                                    <TouchableOpacity
                                        className="px-3 py-2 rounded-full flex-row items-center justify-center border mr-2"
                                        style={{
                                            backgroundColor: colors.card,
                                            borderColor: colors.border,
                                        }}
                                        onPress={() => setShowTimePicker(true)}
                                    >
                                        <Clock size={14} color={colors['muted-foreground']} style={{ marginRight: 6 }} />
                                        <Text className="font-inter-medium text-xs" style={{ color: colors.foreground }}>
                                            {format(selectedDate, 'h:mm a')}
                                        </Text>
                                    </TouchableOpacity>
                                </ScrollView>

                                {/* Hidden Time Picker (iOS Modal / Android Dialog) */}
                                {showTimePicker && (
                                    Platform.OS === 'ios' ? (
                                        <Modal
                                            transparent
                                            animationType="fade"
                                            visible={showTimePicker}
                                            onRequestClose={() => setShowTimePicker(false)}
                                        >
                                            <View className="flex-1 justify-end bg-black/50">
                                                <View className="bg-white dark:bg-gray-900 pb-safe">
                                                    <View className="flex-row justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
                                                        <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                                                            <Text className="text-gray-500 font-inter-medium">Cancel</Text>
                                                        </TouchableOpacity>
                                                        <Text className="font-lora-bold text-lg dark:text-white">Set Time</Text>
                                                        <TouchableOpacity onPress={() => setShowTimePicker(false)}>
                                                            <Text className="text-primary font-inter-bold">Done</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                    <DateTimePicker
                                                        value={selectedDate}
                                                        mode="time"
                                                        display="spinner"
                                                        onChange={handleTimeChange}
                                                        textColor={isDarkMode ? '#fff' : '#000'}
                                                    />
                                                </View>
                                            </View>
                                        </Modal>
                                    ) : (
                                        <DateTimePicker
                                            value={selectedDate}
                                            mode="time"
                                            display="default"
                                            onChange={handleTimeChange}
                                        />
                                    )
                                )}
                            </View>

                            {/* Friend Selection */}
                            <View className="mb-8">
                                <Text className="font-lora-bold text-xl mb-4" style={{ color: colors.foreground }}>
                                    Who was there?
                                </Text>

                                {/* Selected friends display */}
                                <View className="flex-row flex-wrap gap-2 mb-3">
                                    {selectedFriends.map((friend, index) => (
                                        <View
                                            key={friend.id}
                                            className="flex-row items-center px-3 py-2 rounded-full"
                                            style={{
                                                backgroundColor: colors.primary + '20',
                                                borderWidth: 1,
                                                borderColor: colors.primary + '40',
                                            }}
                                        >
                                            <Text className="font-inter-medium text-sm" style={{ color: colors.foreground }}>
                                                {friend.name}
                                            </Text>
                                            {index !== 0 && selectedFriends.length > 1 && (
                                                <TouchableOpacity
                                                    className="ml-2"
                                                    onPress={() => setSelectedFriends(selectedFriends.filter(f => f.id !== friend.id))}
                                                >
                                                    <X size={14} color={colors.foreground} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    ))}

                                    {/* Add Friend Button */}
                                    <TouchableOpacity
                                        className="flex-row items-center px-3 py-2 rounded-full"
                                        style={{
                                            backgroundColor: colors.card,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                        }}
                                        onPress={() => setShowFriendPicker(true)}
                                    >
                                        <Users size={16} color={colors.primary} />
                                        <Text className="font-inter-medium text-sm ml-2" style={{ color: colors.primary }}>
                                            Add Friend
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Category Selection */}
                            <View className="mb-5">
                                <Text className="font-lora-bold text-lg mb-2" style={{ color: colors.foreground }}>
                                    Context
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {categories.map((cat, index) => (
                                        <Animated.View
                                            key={cat.id}
                                            style={{ width: '31%' }}
                                            entering={FadeInUp.duration(500).delay(index * 30)}
                                        >
                                            <TouchableOpacity
                                                className="p-2 rounded-xl items-center justify-center"
                                                style={{
                                                    backgroundColor: colors.card,
                                                    borderWidth: selectedCategory === cat.id ? 2 : 1,
                                                    borderColor: selectedCategory === cat.id ? colors.primary : colors.border,
                                                    height: 90,
                                                }}
                                                onPress={() => handleCategorySelect(cat.id)}
                                            >
                                                <cat.iconComponent size={28} color={colors.primary} style={{ marginBottom: 4 }} />
                                                <Text
                                                    className="font-inter-medium text-xs text-center leading-tight"
                                                    style={{ color: colors.foreground }}
                                                    numberOfLines={2}
                                                >
                                                    {cat.label}
                                                </Text>
                                            </TouchableOpacity>
                                        </Animated.View>
                                    ))}
                                </View>
                            </View>

                            {/* Details Section - Only shows after category selected */}
                            {!!selectedCategory && (
                                <Animated.View
                                    entering={FadeInUp.duration(500)}
                                    onLayout={(event) => {
                                        const { y } = event.nativeEvent.layout;
                                        setDetailsSectionY(y);
                                    }}
                                >
                                    {/* Title Field */}
                                    <View className="mb-3">
                                        <Text className="text-xs font-inter-semibold text-muted-foreground mb-1.5 uppercase tracking-wider" style={{ color: colors['muted-foreground'] }}>
                                            Name this moment
                                        </Text>
                                        <TextInput
                                            className="p-3 rounded-xl font-inter-medium text-sm"
                                            style={{
                                                backgroundColor: colors.card,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                color: colors.foreground,
                                            }}
                                            placeholder='e.g., "Coffee at Blue Bottle"'
                                            placeholderTextColor={colors['muted-foreground']}
                                            value={title}
                                            onChangeText={setTitle}
                                        />
                                    </View>

                                    {/* Reciprocity Section */}
                                    <View className="mb-3">
                                        <Text className="text-xs font-inter-semibold text-muted-foreground mb-1.5 uppercase tracking-wider" style={{ color: colors['muted-foreground'] }}>
                                            Initiated By
                                        </Text>
                                        <ReciprocitySelector
                                            value={initiator}
                                            onChange={setInitiator}
                                            friendName={selectedFriends.length === 1 ? selectedFriends[0].name : 'Them'}
                                            hideLabel
                                        />
                                    </View>

                                    {/* Vibe Section */}
                                    <View className="mb-3">
                                        <Text className="text-xs font-inter-semibold text-muted-foreground mb-1.5 uppercase tracking-wider" style={{ color: colors['muted-foreground'] }}>
                                            Vibe
                                        </Text>
                                        <MoonPhaseSelector onSelect={setSelectedVibe} selectedVibe={selectedVibe} />
                                    </View>

                                    {/* Reflection Section */}
                                    <View className="mb-4">
                                        <Text className="text-xs font-inter-semibold text-muted-foreground mb-1.5 uppercase tracking-wider" style={{ color: colors['muted-foreground'] }}>
                                            Notes
                                        </Text>
                                        <ContextualReflectionInput
                                            category={selectedCategory}
                                            archetype={friendArchetype}
                                            vibe={selectedVibe}
                                            value={reflection}
                                            onChange={setReflection}
                                        />
                                    </View>

                                    {/* Save Button - Inside scroll area */}
                                    <View className="mt-6 mb-4">
                                        <TouchableOpacity
                                            className="p-4 rounded-xl items-center"
                                            style={{
                                                backgroundColor: isSubmitting ? colors.muted : colors.primary,
                                                shadowColor: '#000',
                                                shadowOffset: { width: 0, height: 4 },
                                                shadowOpacity: 0.1,
                                                shadowRadius: 12,
                                                elevation: 8,
                                            }}
                                            onPress={handleSave}
                                            disabled={isSubmitting}
                                        >
                                            <Text className="font-inter-semibold text-base" style={{ color: isSubmitting ? colors['muted-foreground'] : colors['primary-foreground'] }}>
                                                {isSubmitting ? 'Saving...' : 'Save Weave'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </Animated.View>
                            )}
                        </ScrollView>
                    </TouchableWithoutFeedback>



                    {/* Friend Picker Sheet */}
                    <FriendPickerSheet
                        visible={showFriendPicker}
                        onClose={() => setShowFriendPicker(false)}
                        onSelectFriend={(friend) => setSelectedFriends(prev => [...prev, friend])}
                        title="Add to Weave"
                        disabledIds={selectedFriends.map(f => f.id)}
                    />

                    <WeaveReflectPrompt
                        visible={showPrompt}
                        interaction={promptInteraction}
                        friends={promptFriends}
                        onReflect={() => {
                            hidePrompt();
                            onNavigateToJournal(promptInteraction?.id);
                        }}
                        onDismiss={() => {
                            hidePrompt();
                            onBack();
                        }}
                    />
                </KeyboardAvoidingView>
            </SafeAreaView>
        </ErrorBoundary>
    );
}
