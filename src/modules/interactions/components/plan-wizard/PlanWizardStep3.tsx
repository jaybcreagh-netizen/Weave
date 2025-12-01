import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Platform } from 'react-native';
import { ChevronDown, ChevronUp, Clock, Users } from 'lucide-react-native';
import { format } from 'date-fns';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '@/shared/hooks/useTheme';
import { PlanFormData } from '../PlanWizard';
import FriendModel from '@/db/models/Friend';
import { PlanSuggestion } from '@/modules/interactions';
import { FriendSelector } from '@/components/FriendSelector';
import { ReciprocitySelector } from '@/components/ReciprocitySelector';

interface PlanWizardStep3Props {
  formData: Partial<PlanFormData>;
  onUpdate: (updates: Partial<PlanFormData>) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  friend: FriendModel;
  suggestion: PlanSuggestion | null;
  selectedFriends: FriendModel[];
  onFriendsSelect: (friends: FriendModel[]) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  'text-call': 'Chat',
  'meal-drink': 'Meal',
  'hangout': 'Hangout',
  'deep-talk': 'Deep Talk',
  'activity-hobby': 'Activity',
  'event-party': 'Event',
  'favor-support': 'Support',
  'celebration': 'Celebration',
};

export function PlanWizardStep3({
  formData,
  onUpdate,
  onSubmit,
  isSubmitting,
  friend,
  suggestion,
  selectedFriends,
  onFriendsSelect,
}: PlanWizardStep3Props) {
  const { colors } = useTheme();
  const [showDetails, setShowDetails] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showFriendSelection, setShowFriendSelection] = useState(false);

  const categoryLabel = formData.category ? CATEGORY_LABELS[formData.category] : 'Time together';
  const dateText = formData.date ? format(formData.date, 'EEEE, MMM d') : '';

  return (
    <View className="px-5 py-6">
      {/* Summary */}
      <View
        className="p-4 rounded-2xl mb-6"
        style={{ backgroundColor: colors.muted }}
      >
        <Text className="font-inter-medium text-sm" style={{ color: colors['muted-foreground'] }}>
          Planning
        </Text>
        <Text className="font-lora-bold text-xl mt-1" style={{ color: colors.foreground }}>
          {categoryLabel} with {selectedFriends.map(f => f.name).join(', ')}
        </Text>
        <Text className="font-inter-regular text-base mt-1" style={{ color: colors.foreground }}>
          {dateText}
        </Text>
      </View>

      {/* Add Others Button */}
      <TouchableOpacity
        onPress={() => setShowFriendSelection(true)}
        className="flex-row items-center justify-center py-3 px-4 rounded-xl mb-6"
        style={{ backgroundColor: colors.secondary }}
      >
        <Users size={20} color={colors.foreground} />
        <Text className="font-inter-semibold text-base ml-3" style={{ color: colors.foreground }}>
          Add Others
        </Text>
      </TouchableOpacity>

      {/* Title input */}
      <Text className="font-inter-semibold text-base mb-2" style={{ color: colors.foreground }}>
        Give it a title? <Text style={{ color: colors['muted-foreground'] }}>(optional)</Text>
      </Text>
      <TextInput
        value={formData.title}
        onChangeText={title => onUpdate({ title })}
        placeholder={`e.g., Birthday ${categoryLabel.toLowerCase()}, Catch-up coffee`}
        placeholderTextColor={colors['muted-foreground']}
        className="p-4 rounded-xl mb-6 font-inter-regular text-base"
        style={{ backgroundColor: colors.muted, color: colors.foreground }}
      />

      {/* Collapsible details section */}
      <TouchableOpacity
        onPress={() => setShowDetails(!showDetails)}
        className="flex-row items-center justify-between py-3 mb-3"
      >
        <Text className="font-inter-semibold text-base" style={{ color: colors.foreground }}>
          Add more specifics <Text style={{ color: colors['muted-foreground'] }}>(optional)</Text>
        </Text>
        {showDetails ? (
          <ChevronUp size={20} color={colors['muted-foreground']} />
        ) : (
          <ChevronDown size={20} color={colors['muted-foreground']} />
        )}
      </TouchableOpacity>

      {showDetails && (
        <View className="mb-6">
          {/* Time picker */}
          <View className="flex-row items-center justify-between mb-2">
            <Text className="font-inter-semibold text-sm" style={{ color: colors.foreground }}>
              What time?
            </Text>
            {formData.time && (
              <TouchableOpacity onPress={() => onUpdate({ time: undefined })}>
                <Text className="font-inter-medium text-sm" style={{ color: colors.primary }}>
                  Clear
                </Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setShowTimePicker(true)}
            className="p-4 rounded-xl mb-4 flex-row items-center justify-between"
            style={{ backgroundColor: colors.muted }}
          >
            <View className="flex-row items-center">
              <Clock size={20} color={colors['muted-foreground']} />
              <Text className="font-inter-regular text-base ml-3" style={{ color: formData.time ? colors.foreground : colors['muted-foreground'] }}>
                {formData.time ? format(formData.time, 'h:mm a') : 'Add a time'}
              </Text>
            </View>
          </TouchableOpacity>

          {showTimePicker && (
            <View className="mb-4">
              <DateTimePicker
                value={formData.time || new Date()}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, time) => {
                  setShowTimePicker(Platform.OS === 'ios');
                  if (time && event.type === 'set') {
                    onUpdate({ time });
                  }
                  // On Android, close picker after selection
                  if (Platform.OS === 'android') {
                    setShowTimePicker(false);
                  }
                }}
              />
              {/* iOS: Add Done button to dismiss picker */}
              {Platform.OS === 'ios' && (
                <TouchableOpacity
                  onPress={() => setShowTimePicker(false)}
                  className="py-3 px-6 rounded-full items-center self-center mt-2"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Text className="font-inter-semibold text-base text-white">Done</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Location with history */}
          <Text className="font-inter-semibold text-sm mb-2" style={{ color: colors.foreground }}>
            Where?
          </Text>

          {/* Recent locations */}
          {suggestion?.recentLocations && suggestion.recentLocations.length > 0 && (
            <View className="mb-3">
              <Text className="font-inter-regular text-xs mb-2" style={{ color: colors['muted-foreground'] }}>
                You've been here before:
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {suggestion.recentLocations.map((location: string, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => onUpdate({ location })}
                    className="px-3 py-2 rounded-full"
                    style={{
                      backgroundColor: formData.location === location ? `${colors.primary}20` : colors.muted,
                      borderWidth: formData.location === location ? 1 : 0,
                      borderColor: colors.primary,
                    }}
                  >
                    <Text
                      className="font-inter-medium text-sm"
                      style={{ color: formData.location === location ? colors.primary : colors.foreground }}
                    >
                      {location}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <TextInput
            value={formData.location}
            onChangeText={location => onUpdate({ location })}
            placeholder="e.g., Blue Bottle Coffee, Their place"
            placeholderTextColor={colors['muted-foreground']}
            className="p-4 rounded-xl mb-4 font-inter-regular text-base"
            style={{ backgroundColor: colors.muted, color: colors.foreground }}
          />

          {/* Reciprocity Section */}
          <Text className="font-inter-semibold text-sm mb-2" style={{ color: colors.foreground }}>
            Who initiated?
          </Text>
          <ReciprocitySelector
            value={formData.initiator}
            onChange={(initiator) => onUpdate({ initiator })}
            friendName={selectedFriends.length === 1 ? selectedFriends[0].name : 'Them'}
            hideLabel
          />

          {/* Notes */}
          <Text className="font-inter-semibold text-sm mb-2" style={{ color: colors.foreground }}>
            Notes
          </Text>
          <TextInput
            value={formData.notes}
            onChangeText={notes => onUpdate({ notes })}
            placeholder="e.g., Discuss her new job, Bring birthday gift"
            placeholderTextColor={colors['muted-foreground']}
            multiline
            numberOfLines={3}
            className="p-4 rounded-xl font-inter-regular text-base"
            style={{
              backgroundColor: colors.muted,
              color: colors.foreground,
              textAlignVertical: 'top',
            }}
          />


        </View>
      )}

      {/* Create button */}
      <TouchableOpacity
        onPress={onSubmit}
        disabled={isSubmitting}
        className="py-4 rounded-full items-center mt-4"
        style={{
          backgroundColor: colors.primary,
          opacity: isSubmitting ? 0.6 : 1,
        }}
      >
        <Text className="font-inter-semibold text-base text-white">
          {isSubmitting ? 'Creating Plan...' : 'Create Plan'}
        </Text>
      </TouchableOpacity>

      <FriendSelector
        visible={showFriendSelection}
        onClose={() => setShowFriendSelection(false)}
        initialFriendId={friend.id}
        selectedFriends={selectedFriends}
        onSelectionChange={onFriendsSelect}
        asModal={true}
      />
    </View>
  );
}
