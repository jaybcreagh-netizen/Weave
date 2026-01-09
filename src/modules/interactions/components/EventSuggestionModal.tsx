import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { FriendSelector } from '@/modules/relationships/components/FriendSelector';
import type FriendModel from '@/db/models/Friend';
import { X, Calendar, MapPin, Users, Pencil } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useEventSuggestions, useDismissSuggestion, type EventSuggestion } from '../hooks/useEventSuggestions';
import { useTheme } from '@/shared/hooks/useTheme';
import { format } from 'date-fns';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';

export function EventSuggestionModal() {
  // Defer scanning to avoid startup contention
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 5000);
    return () => clearTimeout(timer);
  }, []);

  const { data } = useEventSuggestions({ enabled: isReady });
  const { mutate: dismissSuggestion } = useDismissSuggestion();
  const { colors } = useTheme();

  // Local UI state for the modal
  const [showingPastEvent, setShowingPastEvent] = useState<EventSuggestion | null>(null);
  const [isFriendSelectorVisible, setIsFriendSelectorVisible] = useState(false);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  // Effect to automatically show the first available past event
  useEffect(() => {
    const nextEvent = data?.pastEvents?.find(e => !processedIds.has(e.event.id));
    if (nextEvent && !showingPastEvent) {
      setShowingPastEvent(nextEvent);
    }
  }, [data?.pastEvents, showingPastEvent, processedIds]);

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

    console.log('[EventSuggestionModal] Logging weave, marking processed:', event.id);
    setProcessedIds(prev => new Set(prev).add(event.id));
    dismissSuggestion(event.id);

    console.log('[EventSuggestionModal] Dismissing modal');
    setShowingPastEvent(null);
    // Allow the modal to close/unmount before navigating to prevent gesture blocking issues
    setTimeout(() => {
      router.push(`/weave-logger?${params.toString()}`);
    }, 100);
  };

  const handleFriendsChanged = (selectedFriends: FriendModel[]) => {
    setShowingPastEvent({
      ...showingPastEvent,
      event: {
        ...event,
        matchedFriends: selectedFriends.map((friend) => ({
          friend,
          matchType: 'manual',
          confidence: 1.0,
        })),
      },
    });
  };

  const handleDismiss = () => {
    setProcessedIds(prev => new Set(prev).add(event.id));
    dismissSuggestion(event.id);
    setShowingPastEvent(null);
  };

  const handleNotNow = () => {
    setProcessedIds(prev => new Set(prev).add(event.id));
    setShowingPastEvent(null);
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
                <View className="flex-1 flex-row items-center justify-between">
                  <Text
                    className="text-sm font-inter-regular flex-1 mr-2"
                    style={{ color: colors['muted-foreground'] }}
                    numberOfLines={1}
                  >
                    {friendNames || 'No friends matched'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setIsFriendSelectorVisible(true)}
                    className="p-1 rounded-full"
                    style={{ backgroundColor: colors.card }}
                  >
                    <Pencil size={12} color={colors.primary} />
                  </TouchableOpacity>
                </View>
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

        {/* Friend Selector Modal */}
        <FriendSelector
          visible={isFriendSelectorVisible}
          onClose={() => setIsFriendSelectorVisible(false)}
          selectedFriends={event.matchedFriends.map(m => m.friend)}
          onSelectionChange={handleFriendsChanged}
          asModal={true}
        />
      </Animated.View>
    </Modal>
  );
}
