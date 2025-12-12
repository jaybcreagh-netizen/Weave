/**
 * CalendarEventsStep
 * 
 * Screen 3 of the Sunday check-in flow (Optional).
 * Only appears if there are unlogged events from the calendar.
 * Allows quick batch-logging of weaves.
 */

import React, { useState } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Calendar, Check, X } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { ScannedEvent } from '@/modules/interactions';
import { ArchetypeIcon } from '@/components/ArchetypeIcon';
import { Archetype } from '@/components/types';
import * as Haptics from 'expo-haptics';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';

// ============================================================================
// TYPES
// ============================================================================

interface CalendarEventsStepProps {
  onNext: (selectedEvents: ScannedEvent[]) => void;
  onSkip: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CalendarEventsStep({ onNext, onSkip }: CalendarEventsStepProps) {
  const { colors } = useTheme();

  // NOTE: This assumes the parent component fetches and passes events, 
  // but for now we'll fetch them here or mock them to match existing structure.
  // The original component didn't receive events as props, it likely used a hook.
  // However, looking at the previous file content, it seems it fetched them internally via `scanWeekForUnloggedEvents`?
  // Actually, wait - let's verify how data flows.
  // Ah, the parent WeeklyReflectionModal fetches events and determines if this step is shown.
  // BUT, this component *also* seems to need the events.
  // The original component used `useQuery` or similar to fetch.
  // Let's assume for this refactor we'll get them via a hook or props.
  // Wait, the original file I viewed (CalendarEventsStepComponent.tsx) had internal state/loading for events.
  // Let's stick to the pattern of having the parent or a hook load data if possible,
  // but if the parent is already scanning, pass them down?
  // Re-reading `WeeklyReflectionModal`... it calls `scanWeekForUnloggedEvents` but doesn't pass the events to this component.
  // This component likely needs to re-fetch or the modal needs to pass them.
  // Let's update this component to accept events or fetch them.
  // For now, let's keep the internal fetching logic if it existed, or better, use the hook.

  // Actually, checking the `WeeklyReflectionModal` refactor...
  // `const eventReview = await scanWeekForUnloggedEvents();`
  // It handles the check.
  // This component should responsibly fetching/displaying.
  // Let's use `scanWeekForUnloggedEvents` again here.

  const [events, setEvents] = useState<ScannedEvent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const scanned = await CalendarService.scanForEvents();
      setEvents(scanned);

      // Auto-select highly confident matches
      const autoSelected = new Set<string>();
      scanned.forEach((e: ScannedEvent) => {
        if (e.confidence > 0.8) {
          autoSelected.add(e.id);
        }
      });
      setSelectedIds(autoSelected);
    } catch (error) {
      console.error('Error loading events:', error);
      Alert.alert('Error', 'Could not access calendar. Please check permissions.');
    } finally {
      setLoading(false);
    }
  };

  const toggleEvent = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const selected = events.filter(e => selectedIds.has(e.id));
    onNext(selected);
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip();
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text variant="caption" className="text-muted-foreground">Scanning calendar...</Text>
      </View>
    );
  }

  const selectedCount = selectedIds.size;

  return (
    <View className="flex-1 justify-between">
      <View className="flex-1">
        <View className="px-4 mb-6">
          <Text variant="h3" className="text-center font-lora-medium mb-2">
            Did you meet up?
          </Text>
          <Text variant="body" className="text-center text-muted-foreground">
            We found these events on your calendar. Select the ones you want to log as weaves.
          </Text>
        </View>

        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {events.map((event, index) => {
            const isSelected = selectedIds.has(event.id);
            const eventDate = new Date(event.date);
            const timeStr = eventDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

            const friendNames = event.matchedFriends?.map(f => f.name).join(', ');

            return (
              <Animated.View
                key={event.id}
                entering={FadeInDown.delay(index * 100).duration(400)}
                className="mb-3 px-1"
              >
                <TouchableOpacity
                  onPress={() => toggleEvent(event.id)}
                  activeOpacity={0.8}
                >
                  <Card
                    className={`p-4 border-2 ${isSelected ? 'border-primary bg-primary/5' : 'border-transparent'}`}
                  >
                    <View className="flex-row items-center">
                      {/* Date/Time Column */}
                      <View className="w-16 items-center justify-center mr-3 border-r border-border pr-3">
                        <Text variant="caption" className="font-bold uppercase text-muted-foreground">
                          {eventDate.toLocaleDateString([], { weekday: 'short' })}
                        </Text>
                        <Text variant="h4" className="font-bold">
                          {eventDate.getDate()}
                        </Text>
                        <Text variant="caption" className="text-xs text-muted-foreground">
                          {timeStr}
                        </Text>
                      </View>

                      {/* Event Details */}
                      <View className="flex-1">
                        <Text variant="h4" className="font-semibold mb-1" numberOfLines={1}>
                          {event.title}
                        </Text>

                        {/* Matched Friends */}
                        {event.matchedFriends && event.matchedFriends.length > 0 && (
                          <View className="flex-row flex-wrap gap-2 mt-1">
                            {event.matchedFriends.map(friend => (
                              <View key={friend.id} className="flex-row items-center bg-muted rounded-full px-2 py-1">
                                <ArchetypeIcon
                                  archetype={friend.archetype as Archetype}
                                  size={12}
                                  color={colors.foreground}
                                />
                                <Text variant="caption" className="ml-1 text-xs">
                                  {friend.name}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>

                      {/* Checkbox */}
                      <View
                        className={`w-6 h-6 rounded-full items-center justify-center border ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground'}`}
                      >
                        {isSelected && <Check size={14} color={colors['primary-foreground']} />}
                      </View>
                    </View>

                    {/* Friend Selection Hint / List */}
                    {(!event.matchedFriends || event.matchedFriends.length === 0) ? (
                      <View className="flex-row items-center gap-2 mt-3">
                        <Users size={14} color={colors.primary} />
                        <Text
                          className="text-sm"
                          style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                        >
                          Tap to select friends
                        </Text>
                      </View>
                    ) : (
                      <View className="flex-row items-center gap-2 mt-3">
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
                  </Card>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>

      {/* Bottom Actions */}
      <View className="pt-4 gap-3">
        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleContinue}
          className="flex-row items-center justify-center px-6 py-4 rounded-xl"
          style={{
            backgroundColor: selectedIds.size > 0 ? colors.primary : colors.muted,
          }}
          disabled={selectedIds.size === 0}
        >
          <Text
            className="text-base font-semibold mr-2"
            style={{
              color: selectedIds.size > 0 ? 'white' : colors['muted-foreground'],
              fontFamily: 'Inter_600SemiBold',
            }}
          >
            {selectedIds.size > 0
              ? `Log ${selectedIds.size} Event${selectedIds.size !== 1 ? 's' : ''}`
              : 'Select Events to Continue'}
          </Text>
          {selectedIds.size > 0 && <ChevronRight size={20} color="white" />}
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
    </View >
  );
}


