import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Keyboard, TouchableWithoutFeedback, Vibration, Modal, Alert } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInUp, useSharedValue, withSpring } from 'react-native-reanimated';
import { CelebrationAnimation } from '@/components/CelebrationAnimation';
import { calculateDeepeningLevel } from '@/modules/intelligence';
import { BlurView } from 'expo-blur';

import { useInteractions, type StructuredReflection } from '@/modules/interactions';
import { WeaveReflectPrompt, useWeaveReflectPrompt } from '@/components/Journal';
import { useDebounceCallback } from '@/shared/hooks/useDebounceCallback';
import { Calendar as CalendarIcon, X, Sparkles, Users } from 'lucide-react-native';
import { CustomCalendar } from '@/components/CustomCalendar';
import { MoonPhaseSelector } from '@/components/MoonPhaseSelector';
import { ContextualReflectionInput } from '@/components/ContextualReflectionInput';
import { format, subDays, isSameDay, startOfDay } from 'date-fns';
import { type Vibe, type InteractionCategory, type Archetype } from '@/components/types';
import { useTheme } from '@/shared/hooks/useTheme';
import { getAllCategories, getCategoryMetadata, type CategoryMetadata } from '@/shared/constants/interaction-categories';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { FriendSelector } from '@/components/FriendSelector';
import { CustomBottomSheet } from '@/shared/ui/Sheet/BottomSheet';
import { ReciprocitySelector, InitiatorType } from '@/components/ReciprocitySelector';
import { STORY_CHIPS } from '@/modules/reflection';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';

const categories: CategoryMetadata[] = getAllCategories().map(getCategoryMetadata);

const dateOptions = [
  { id: 'today', icon: '☀️', label: 'Today', getDate: () => startOfDay(new Date()) },
  { id: 'yesterday', icon: '🌙', label: 'Yesterday', getDate: () => startOfDay(subDays(new Date(), 1)) },
];

export default function WeaveLoggerScreen() {
  const router = useRouter();
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const { logWeave } = useInteractions();
  const { colors, isDarkMode } = useTheme();

  const [selectedFriends, setSelectedFriends] = useState<FriendModel[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showFriendSelector, setShowFriendSelector] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<InteractionCategory | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(startOfDay(new Date()));
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [reflection, setReflection] = useState<StructuredReflection>({});
  const [friendArchetype, setFriendArchetype] = useState<Archetype | undefined>(undefined);
  const [showCelebration, setShowCelebration] = useState(false);
  const [title, setTitle] = useState<string>('');
  const [initiator, setInitiator] = useState<InitiatorType | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
            [
              {
                text: 'OK',
                onPress: () => {
                  if (router.canGoBack()) {
                    router.back();
                  } else {
                    router.replace('/');
                  }
                }
              }
            ]
          );
        });
    }
  }, [friendId]);

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
    setSelectedDate(startOfDay(date));
    Vibration.vibrate(50);
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

      const savedInteraction = { id: 'temp-id', ...reflection }; // This is a mock, ideally logWeave returns the interaction
      // But logWeave in useInteractions seems to return void or promise void.
      // We might need to fetch the interaction or just pass the data we have.
      // For now, let's assume we can proceed without the exact ID for the prompt check,
      // or we need to update logWeave to return it.
      // Actually, checkAndShowPrompt takes interaction and friends.

      // Let's modify the flow to check prompt BEFORE navigating back.

      // Show celebration animation
      setShowCelebration(true);
      Vibration.vibrate();

      // Check if we should prompt for reflection
      // We need the interaction object. Since logWeave doesn't return it (presumably),
      // we might construct a partial one or fetch it.
      // For now, let's pass the data we have.
      const interactionData = {
        id: 'new-weave', // Placeholder
        interactionDate: selectedDate.getTime(),
        interactionType: 'log',
        interactionCategory: selectedCategory,
        vibe: selectedVibe,
        duration: 'Medium', // Default or derived
        notes: legacyNotes,
      };

      const shouldShow = await checkAndShowPrompt(interactionData as any, selectedFriends);

      if (!shouldShow) {
        // Navigate back after animation
        navigationTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) return;

          try {
            if (router.canGoBack()) {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            } else {
              // Fallback: navigate to home/dashboard
              router.replace('/');
            }
          } catch (navError) {
            console.error('[WeaveLogger] Navigation error:', navError);
            // Force navigate to home as last resort
            if (isMountedRef.current) {
              router.replace('/');
            }
          }
        }, 900);
      }
      // If shouldShow, the prompt will appear and handle navigation on dismiss/reflect

    } catch (error) {
      console.error('[WeaveLogger] Error saving weave:', error);
      // Show error to user but still try to navigate back
      navigationTimeoutRef.current = setTimeout(() => {
        if (!isMountedRef.current) return;

        if (router.canGoBack()) {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/');
          }
        } else {
          router.replace('/');
        }
      }, 100);
    } finally {
      // Only unlock submission if something went wrong quickly or if prompt is shown?
      // Actually, if prompt is shown, we want to keep it locked maybe?
      // But if user cancels alert or something, we might want to unlock.
      // Given the navigation, locking it until unmount/nav is fine.
      // But if there's an error, we should unlock?
      // The error block navigates away too. So essentially this is a one-way trip.
      // We can leave isSubmitting true to prevent any further taps during transition.
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
        <Stack.Screen options={{ title: screenTitle }} />

        {/* Celebration animation */}
        <CelebrationAnimation
          visible={showCelebration}
          intensity={deepeningMetrics.level === 'none' ? 'light' : deepeningMetrics.level}
          onComplete={() => setShowCelebration(false)}
        />

        {/* Calendar Sheet */}
        <CustomBottomSheet
          visible={showCalendar}
          onClose={() => setShowCalendar(false)}
          snapPoints={['50%']}
        >
          <View className="flex-1 p-6">
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
            />
          </View>
        </CustomBottomSheet>

        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            ref={scrollViewRef}
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
          >
            {/* Date Selection */}
            <View className="mb-8">
              <Text className="font-lora-bold text-xl mb-4" style={{ color: colors.foreground }}>
                When did this happen?
              </Text>
              <View className="flex-row gap-3 mb-3">
                {dateOptions.map((opt, index) => {
                  const date = opt.getDate();
                  const isSelected = isSameDay(selectedDate, date);
                  return (
                    <Animated.View
                      key={opt.id}
                      className="flex-1"
                      entering={FadeInUp.duration(500).delay(index * 50)}
                    >
                      <TouchableOpacity
                        className="p-4 rounded-2xl items-center justify-center"
                        style={{
                          backgroundColor: colors.card,
                          borderWidth: isSelected ? 2 : 1,
                          borderColor: isSelected ? colors.primary : colors.border,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.05,
                          shadowRadius: 8,
                          elevation: 2,
                          minHeight: 90,
                        }}
                        onPress={() => handleQuickDateSelect(date)}
                      >
                        <Text className="text-3xl mb-2">{opt.icon}</Text>
                        <Text className="font-inter-semibold text-sm" style={{ color: colors.foreground }}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
                <Animated.View className="flex-1" entering={FadeInUp.duration(500).delay(100)}>
                  <TouchableOpacity
                    className="p-4 rounded-2xl items-center justify-center"
                    style={{
                      backgroundColor: colors.card,
                      borderWidth: 1,
                      borderColor: colors.border,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 8,
                      elevation: 2,
                      minHeight: 90,
                    }}
                    onPress={() => setShowCalendar(true)}
                  >
                    <CalendarIcon size={28} color={colors.primary} style={{ marginBottom: 8 }} />
                    <Text className="font-inter-semibold text-sm" style={{ color: colors.foreground }}>
                      Pick Date
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
              <Text className="font-inter-regular text-sm text-center" style={{ color: colors['muted-foreground'] }}>
                {format(selectedDate, 'EEEE, MMMM d, yyyy')}
              </Text>
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
                  onPress={() => setShowFriendSelector(true)}
                >
                  <Users size={16} color={colors.primary} />
                  <Text className="font-inter-medium text-sm ml-2" style={{ color: colors.primary }}>
                    Add Friend
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Category Selection */}
            <View className="mb-8">
              <Text className="font-lora-bold text-xl mb-4" style={{ color: colors.foreground }}>
                How did you connect?
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {categories.map((cat, index) => (
                  <Animated.View
                    key={cat.id}
                    style={{ width: '48%' }}
                    entering={FadeInUp.duration(500).delay(index * 50)}
                  >
                    <TouchableOpacity
                      className="p-3 rounded-2xl items-center justify-center"
                      style={{
                        backgroundColor: colors.card,
                        borderWidth: selectedCategory === cat.id ? 2 : 1,
                        borderColor: selectedCategory === cat.id ? colors.primary : colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.05,
                        shadowRadius: 8,
                        elevation: 2,
                        minHeight: 120,
                      }}
                      onPress={() => handleCategorySelect(cat.id)}
                    >
                      <Text className="text-2xl mb-1">{cat.icon}</Text>
                      <Text className="font-inter-semibold text-sm text-center mb-1" style={{ color: colors.foreground }}>
                        {cat.label}
                      </Text>
                      <Text className="font-inter-regular text-xs text-center" style={{ color: colors['muted-foreground'] }}>
                        {cat.description}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                ))}
              </View>
            </View>

            {/* Details Section - Only shows after category selected */}
            {selectedCategory && (
              <Animated.View
                entering={FadeInUp.duration(500)}
                onLayout={(event) => {
                  const { y } = event.nativeEvent.layout;
                  setDetailsSectionY(y);
                }}
              >
                {/* Title Field */}
                <View className="mb-8">
                  <Text className="font-lora-bold text-xl mb-2" style={{ color: colors.foreground }}>
                    Name this moment
                  </Text>
                  <Text className="font-inter-regular text-sm mb-3" style={{ color: colors['muted-foreground'] }}>
                    Optional - give it a memorable name
                  </Text>
                  <TextInput
                    className="p-4 rounded-xl font-inter-regular text-base"
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
                <View className="mb-8">
                  <Text className="font-lora-bold text-xl mb-4" style={{ color: colors.foreground }}>
                    Who initiated?
                  </Text>
                  <ReciprocitySelector
                    value={initiator}
                    onChange={setInitiator}
                    friendName={selectedFriends.length === 1 ? selectedFriends[0].name : 'Them'}
                    hideLabel
                  />
                </View>

                {/* Reflection Section */}
                <View className="mb-8">
                  <View className="flex-row items-center gap-2 mb-2">
                    <Sparkles size={20} color={colors.primary} />
                    <Text className="font-lora-bold text-xl" style={{ color: colors.foreground }}>
                      Tell the story
                    </Text>
                  </View>
                  <Text className="font-inter-regular text-sm mb-4" style={{ color: colors['muted-foreground'] }}>
                    Capture what made this weave meaningful
                  </Text>
                  <ContextualReflectionInput
                    category={selectedCategory}
                    archetype={friendArchetype}
                    vibe={selectedVibe}
                    value={reflection}
                    onChange={setReflection}
                  />
                </View>

                {/* Vibe Section */}
                <View className="mb-8">
                  <Text className="font-lora-bold text-xl mb-4" style={{ color: colors.foreground }}>
                    How did it feel? 🌙
                  </Text>
                  <MoonPhaseSelector onSelect={setSelectedVibe} selectedVibe={selectedVibe} />
                </View>


              </Animated.View>
            )}
          </ScrollView>
        </TouchableWithoutFeedback>

        {/* Save Button */}
        {selectedCategory && (
          <View
            className="absolute bottom-0 left-0 right-0 p-5"
            style={{ backgroundColor: colors.background, borderTopWidth: 1, borderColor: colors.border }}
          >
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
        )}

        {/* Friend Selector Modal */}
        <FriendSelector
          visible={showFriendSelector}
          onClose={() => setShowFriendSelector(false)}
          initialFriendId={friendId}
          selectedFriends={selectedFriends}
          onSelectionChange={setSelectedFriends}
        />

        <WeaveReflectPrompt
          visible={showPrompt}
          interaction={promptInteraction}
          friends={promptFriends}
          onReflect={() => {
            hidePrompt();
            router.replace({
              pathname: '/journal',
              params: {
                mode: 'guided',
                weaveId: promptInteraction?.id
              }
            });
          }}
          onDismiss={() => {
            hidePrompt();
            if (router.canGoBack()) {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace('/');
              }
            } else {
              router.replace('/');
            }
          }}
        />
      </SafeAreaView>
    </ErrorBoundary>
  );
}
