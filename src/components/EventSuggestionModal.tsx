import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { X, Calendar, MapPin, Users } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEventSuggestionStore } from '@/modules/interactions';
import { useTheme } from '@/shared/hooks/useTheme';
import { format } from 'date-fns';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

/**
 * Modal to suggest logging a past calendar event as a weave
 * Shows up when the app detects a recent event with friend matches
 */
export function EventSuggestionModal() {
  const { showingPastEvent, dismissPastEvent, hidePastEventModal } = useEventSuggestionStore();
  const { colors } = useTheme();

  if (!showingPastEvent) {
    return null;
  }

  const { event } = showingPastEvent;
  const friendNames = event.matchedFriends.map((m) => m.friend.name).join(', ');
  const dateStr = format(event.startDate, 'EEEE, MMM d');

  const handleLogWeave = () => {
    // Navigate to interaction form with pre-filled data
    const friendIds = event.matchedFriends.map((m) => m.friend.id);

    const params = new URLSearchParams({
      type: 'log',
      friendIds: friendIds.join(','),
      date: event.startDate.toISOString(),
      title: event.title,
      category: event.suggestedCategory || 'event',
    });

    if (event.location) {
      params.append('location', event.location);
    }

    if (event.notes) {
      params.append('notes', event.notes);
    }

    hidePastEventModal();
    router.push(`/interaction-form?${params.toString()}`);
  };

  const handleDismiss = () => {
    dismissPastEvent(event.id);
    hidePastEventModal();
  };

  const handleNotNow = () => {
    hidePastEventModal();
  };

  // Get event type emoji
  const getEventEmoji = () => {
    switch (event.eventType) {
      case 'birthday':
        return '🎂';
      case 'anniversary':
        return '💝';
      case 'holiday':
        return '🎉';
      case 'meal':
        return '🍽️';
      case 'social':
        return '🎊';
      case 'activity':
        return '🎯';
      default:
        return '📅';
    }
  };

  return (
    <Modal transparent visible animationType="none">
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(150)}
        className="flex-1"
      >
        <BlurView
          intensity={20}
          tint="dark"
          className="flex-1 justify-center items-center px-6"
        >
          <TouchableOpacity
            className="absolute inset-0"
            onPress={handleNotNow}
            activeOpacity={1}
          />

          <Animated.View
            entering={SlideInDown.duration(300).springify()}
            exiting={SlideOutDown.duration(200)}
            className="w-full max-w-md rounded-3xl p-6"
            style={{
              backgroundColor: colors.card,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 10,
            }}
          >
            {/* Close button */}
            <TouchableOpacity
              onPress={handleNotNow}
              className="absolute top-4 right-4 w-8 h-8 rounded-full items-center justify-center z-10"
              style={{ backgroundColor: colors.muted }}
            >
              <X color={colors['muted-foreground']} size={18} />
            </TouchableOpacity>

            {/* Header */}
            <View className="items-center mb-4">
              <View
                className="w-16 h-16 rounded-full items-center justify-center mb-3"
                style={{ backgroundColor: `${colors.primary}20` }}
              >
                <Text className="text-4xl">{getEventEmoji()}</Text>
              </View>
              <Text
                className="text-xl font-lora-bold text-center mb-1"
                style={{ color: colors.foreground }}
              >
                Did you weave?
              </Text>
              <Text
                className="text-sm font-inter-regular text-center"
                style={{ color: colors['muted-foreground'] }}
              >
                We noticed you had a calendar event
              </Text>
            </View>

            {/* Event details */}
            <View
              className="rounded-xl p-4 mb-4"
              style={{ backgroundColor: colors.muted }}
            >
              <Text
                className="text-base font-inter-semibold mb-3"
                style={{ color: colors.foreground }}
              >
                {event.title}
              </Text>

              {/* Friends */}
              <View className="flex-row items-center gap-2 mb-2">
                <Users color={colors['muted-foreground']} size={16} />
                <Text
                  className="text-sm font-inter-regular flex-1"
                  style={{ color: colors['muted-foreground'] }}
                >
                  {friendNames}
                </Text>
              </View>

              {/* Date */}
              <View className="flex-row items-center gap-2 mb-2">
                <Calendar color={colors['muted-foreground']} size={16} />
                <Text
                  className="text-sm font-inter-regular"
                  style={{ color: colors['muted-foreground'] }}
                >
                  {dateStr}
                </Text>
              </View>

              {/* Location */}
              {event.location && (
                <View className="flex-row items-center gap-2">
                  <MapPin color={colors['muted-foreground']} size={16} />
                  <Text
                    className="text-sm font-inter-regular flex-1"
                    style={{ color: colors['muted-foreground'] }}
                    numberOfLines={1}
                  >
                    {event.location}
                  </Text>
                </View>
              )}
            </View>

            {/* Action buttons */}
            <View className="gap-3">
              {/* Log weave button */}
              <TouchableOpacity
                onPress={handleLogWeave}
                className="rounded-xl py-3.5"
                style={{ backgroundColor: colors.primary }}
              >
                <Text className="text-base font-inter-semibold text-center text-white">
                  Log This Weave
                </Text>
              </TouchableOpacity>

              {/* Not now button */}
              <TouchableOpacity
                onPress={handleNotNow}
                className="rounded-xl py-3.5"
                style={{ backgroundColor: colors.muted }}
              >
                <Text
                  className="text-base font-inter-medium text-center"
                  style={{ color: colors.foreground }}
                >
                  Not Now
                </Text>
              </TouchableOpacity>

              {/* Dismiss button */}
              <TouchableOpacity onPress={handleDismiss}>
                <Text
                  className="text-sm font-inter-regular text-center"
                  style={{ color: colors['muted-foreground'] }}
                >
                  Don't suggest this again
                </Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}
