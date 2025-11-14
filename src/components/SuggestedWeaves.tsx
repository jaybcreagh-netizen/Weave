import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Sparkles, X, Calendar, MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useEventSuggestionStore, type EventSuggestion } from '../stores/eventSuggestionStore';
import { useTheme } from '../hooks/useTheme';
import { format, formatDistanceToNow } from 'date-fns';

/**
 * Component to display upcoming event suggestions
 * Shows birthdays, holidays, and other social events as opportunities to weave
 */
export function SuggestedWeaves() {
  const { upcomingEvents, dismissUpcomingEvent } = useEventSuggestionStore();
  const { colors } = useTheme();
  const router = useRouter();

  // Don't render if no suggestions
  if (upcomingEvents.length === 0) {
    return null;
  }

  const handlePlanWeave = (suggestion: EventSuggestion) => {
    const { event } = suggestion;

    // Navigate to PlanWizard with pre-filled data
    // Get matched friend IDs
    const friendIds = event.matchedFriends.map((m) => m.friend.id);

    // Pre-fill interaction form data
    const params = new URLSearchParams({
      type: 'plan',
      friendIds: friendIds.join(','),
      date: event.startDate.toISOString(),
      title: event.title,
      category: event.suggestedCategory || 'event',
    });

    if (event.location) {
      params.append('location', event.location);
    }

    // Navigate to PlanWizard (assuming there's a route for it)
    // For now, just log - you'll need to adjust based on your routing setup
    console.log('[SuggestedWeaves] Planning weave for:', event.title);
    router.push(`/interaction-form?${params.toString()}`);
  };

  const handleDismiss = (eventId: string) => {
    dismissUpcomingEvent(eventId);
  };

  return (
    <View className="mb-4">
      {/* Header */}
      <View className="flex-row items-center gap-2 px-4 mb-3">
        <Sparkles color={colors.primary} size={20} />
        <Text className="text-lg font-lora-bold" style={{ color: colors.foreground }}>
          Upcoming Opportunities
        </Text>
      </View>

      {/* Horizontal scrollable list */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
      >
        {upcomingEvents.map((suggestion) => (
          <SuggestionCard
            key={suggestion.event.id}
            suggestion={suggestion}
            onPlan={() => handlePlanWeave(suggestion)}
            onDismiss={() => handleDismiss(suggestion.event.id)}
            colors={colors}
          />
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * Individual suggestion card
 */
function SuggestionCard({
  suggestion,
  onPlan,
  onDismiss,
  colors,
}: {
  suggestion: EventSuggestion;
  onPlan: () => void;
  onDismiss: () => void;
  colors: any;
}) {
  const { event } = suggestion;

  // Get importance color
  const getImportanceColor = () => {
    switch (event.importance) {
      case 'critical':
        return '#EF4444'; // red
      case 'high':
        return '#F59E0B'; // amber
      case 'medium':
        return '#8B7FD6'; // primary purple
      case 'low':
        return '#6B7280'; // gray
      default:
        return colors.primary;
    }
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

  const friendNames = event.matchedFriends.map((m) => m.friend.name).join(', ');
  const timeUntil = formatDistanceToNow(event.startDate, { addSuffix: true });
  const dateStr = format(event.startDate, 'MMM d');

  return (
    <View
      className="rounded-2xl p-4 w-72"
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      {/* Dismiss button */}
      <TouchableOpacity
        onPress={onDismiss}
        className="absolute top-2 right-2 w-6 h-6 rounded-full items-center justify-center z-10"
        style={{ backgroundColor: colors.muted }}
      >
        <X color={colors['muted-foreground']} size={14} />
      </TouchableOpacity>

      {/* Event type badge */}
      <View className="flex-row items-center gap-2 mb-2">
        <Text className="text-2xl">{getEventEmoji()}</Text>
        <View
          className="px-2 py-1 rounded-full"
          style={{ backgroundColor: `${getImportanceColor()}20` }}
        >
          <Text
            className="text-xs font-inter-semibold"
            style={{ color: getImportanceColor() }}
          >
            {event.eventType.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Event title */}
      <Text
        className="text-base font-inter-semibold mb-1"
        style={{ color: colors.foreground }}
        numberOfLines={2}
      >
        {event.title}
      </Text>

      {/* Friend names */}
      <Text
        className="text-sm font-inter-regular mb-2"
        style={{ color: colors['muted-foreground'] }}
        numberOfLines={1}
      >
        with {friendNames}
      </Text>

      {/* Date info */}
      <View className="flex-row items-center gap-1 mb-1">
        <Calendar color={colors['muted-foreground']} size={14} />
        <Text
          className="text-xs font-inter-regular"
          style={{ color: colors['muted-foreground'] }}
        >
          {dateStr} • {timeUntil}
        </Text>
      </View>

      {/* Location if available */}
      {event.location && (
        <View className="flex-row items-center gap-1 mb-3">
          <MapPin color={colors['muted-foreground']} size={14} />
          <Text
            className="text-xs font-inter-regular"
            style={{ color: colors['muted-foreground'] }}
            numberOfLines={1}
          >
            {event.location}
          </Text>
        </View>
      )}

      {/* Action button */}
      <TouchableOpacity
        onPress={onPlan}
        className="rounded-lg py-2.5 mt-2"
        style={{ backgroundColor: colors.primary }}
      >
        <Text className="text-sm font-inter-semibold text-center text-white">
          Plan a Weave
        </Text>
      </TouchableOpacity>
    </View>
  );
}
