/**
 * CalendarEventsStep
 * Shows unlogged calendar events for batch logging during weekly reflection
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Calendar, MapPin, Users, Check, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { scanWeekForUnloggedEvents, type WeeklyEventReview } from '../../lib/weekly-event-review';
import { ScannedEvent } from '../../lib/event-scanner';
import { format } from 'date-fns';
import Animated, { FadeIn } from 'react-native-reanimated';

interface CalendarEventsStepProps {
  onNext: (selectedEvents: ScannedEvent[]) => void;
  onSkip: () => void;
}

export function CalendarEventsStep({ onNext, onSkip }: CalendarEventsStepProps) {
  const { colors } = useTheme();
  const [review, setReview] = useState<WeeklyEventReview | null>(null);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setIsLoading(true);
    try {
      const data = await scanWeekForUnloggedEvents();
      setReview(data);

      // Auto-select non-ambiguous events
      const autoSelect = new Set<string>();
      data.events.forEach(event => {
        // Auto-select events that have clear friend matches (not ambiguous)
        if (event.matchedFriends.length > 0 && !event.extractedNames.includes('(needs selection)')) {
          autoSelect.add(event.id);
        }
      });
      setSelectedEventIds(autoSelect);
    } catch (error) {
      console.error('[CalendarEventsStep] Error loading events:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleEvent = (eventId: string) => {
    setSelectedEventIds(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  const handleContinue = () => {
    if (!review) return;

    const selected = review.events.filter(e => selectedEventIds.has(e.id));
    onNext(selected);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text
          className="text-sm mt-4 text-center"
          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
        >
          Scanning your calendar...
        </Text>
      </View>
    );
  }

  if (!review || review.events.length === 0) {
    // No events found - skip to next step
    return (
      <View className="flex-1 items-center justify-center px-6">
        <View
          className="w-16 h-16 rounded-full items-center justify-center mb-4"
          style={{ backgroundColor: `${colors.primary}20` }}
        >
          <Calendar size={28} color={colors.primary} />
        </View>
        <Text
          className="text-xl font-semibold text-center mb-2"
          style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
        >
          All Caught Up
        </Text>
        <Text
          className="text-base text-center mb-8"
          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
        >
          No calendar events to review this week.
        </Text>
        <TouchableOpacity
          onPress={onSkip}
          className="px-8 py-3 rounded-xl"
          style={{ backgroundColor: colors.primary }}
        >
          <Text
            className="text-base font-semibold text-white"
            style={{ fontFamily: 'Inter_600SemiBold' }}
          >
            Continue
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const selectedCount = selectedEventIds.size;

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="mb-4">
        <View className="flex-row items-center gap-2 mb-2">
          <Calendar size={20} color={colors.primary} />
          <Text
            className="text-sm font-medium"
            style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}
          >
            {review.events.length} Event{review.events.length !== 1 ? 's' : ''} Found
          </Text>
        </View>
        <Text
          className="text-base"
          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
        >
          We noticed these events with friends. Tap to log them.
        </Text>
      </View>

      {/* Events List */}
      <ScrollView
        className="flex-1 mb-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {review.events.map((event, index) => {
          const isSelected = selectedEventIds.has(event.id);
          const isAmbiguous = event.extractedNames.includes('(needs selection)');
          const friendNames = event.matchedFriends.map(m => m.friend.name).join(', ');
          const dateStr = format(event.startDate, 'EEEE, MMM d');

          return (
            <Animated.View
              key={event.id}
              entering={FadeIn.delay(index * 100)}
            >
              <TouchableOpacity
                onPress={() => toggleEvent(event.id)}
                className="mb-3 p-4 rounded-xl"
                style={{
                  backgroundColor: isSelected ? `${colors.primary}10` : colors.card,
                  borderWidth: 1.5,
                  borderColor: isSelected ? colors.primary : colors.border,
                }}
              >
                {/* Checkbox and Title */}
                <View className="flex-row items-start gap-3 mb-2">
                  <View
                    className="w-6 h-6 rounded-md items-center justify-center mt-0.5"
                    style={{
                      backgroundColor: isSelected ? colors.primary : 'transparent',
                      borderWidth: isSelected ? 0 : 2,
                      borderColor: colors.border,
                    }}
                  >
                    {isSelected && <Check size={16} color="white" strokeWidth={3} />}
                  </View>

                  <View className="flex-1">
                    <Text
                      className="text-base font-semibold mb-1"
                      style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                    >
                      {event.title}
                    </Text>

                    {/* Date */}
                    <View className="flex-row items-center gap-2 mb-1">
                      <Calendar size={14} color={colors['muted-foreground']} />
                      <Text
                        className="text-sm"
                        style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                      >
                        {dateStr}
                      </Text>
                    </View>

                    {/* Friends or Ambiguous Tag */}
                    {isAmbiguous ? (
                      <View className="flex-row items-center gap-2">
                        <Users size={14} color={colors.primary} />
                        <Text
                          className="text-sm"
                          style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                        >
                          Tap to select friends
                        </Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-2">
                        <Users size={14} color={colors['muted-foreground']} />
                        <Text
                          className="text-sm"
                          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                        >
                          {friendNames}
                        </Text>
                      </View>
                    )}

                    {/* Location */}
                    {event.location && (
                      <View className="flex-row items-center gap-2 mt-1">
                        <MapPin size={14} color={colors['muted-foreground']} />
                        <Text
                          className="text-sm"
                          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                          numberOfLines={1}
                        >
                          {event.location}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Bottom Actions */}
      <View className="pt-4 gap-3">
        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleContinue}
          className="flex-row items-center justify-center px-6 py-4 rounded-xl"
          style={{
            backgroundColor: selectedCount > 0 ? colors.primary : colors.muted,
          }}
          disabled={selectedCount === 0}
        >
          <Text
            className="text-base font-semibold mr-2"
            style={{
              color: selectedCount > 0 ? 'white' : colors['muted-foreground'],
              fontFamily: 'Inter_600SemiBold',
            }}
          >
            {selectedCount > 0
              ? `Log ${selectedCount} Event${selectedCount !== 1 ? 's' : ''}`
              : 'Select Events to Continue'}
          </Text>
          {selectedCount > 0 && <ChevronRight size={20} color="white" />}
        </TouchableOpacity>

        {/* Skip Button */}
        <TouchableOpacity
          onPress={onSkip}
          className="items-center py-3"
        >
          <Text
            className="text-sm"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            Skip for now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
