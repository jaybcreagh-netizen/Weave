import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, X, Clock } from 'lucide-react-native';
import { format, differenceInDays } from 'date-fns';
import { useTheme } from '../hooks/useTheme';
import Interaction from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';
import FriendModel from '../db/models/Friend';
import { confirmPlan, cancelPlan } from '../lib/plan-lifecycle-manager';
import { useRouter } from 'expo-router';

interface PlanConfirmationCardProps {
  plan: Interaction;
  onConfirmed?: () => void;
  onCancelled?: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  'text-call': '💬',
  'meal-drink': '🍽️',
  'hangout': '👥',
  'deep-talk': '💭',
  'activity-hobby': '🚶',
  'event-party': '🎉',
  'favor-support': '🤝',
  'celebration': '🎊',
};

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

export function PlanConfirmationCard({ plan, onConfirmed, onCancelled }: PlanConfirmationCardProps) {
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();
  const [friendNames, setFriendNames] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load friend names
  React.useEffect(() => {
    loadFriendNames();
  }, [plan.id]);

  const loadFriendNames = async () => {
    try {
      const interactionFriends = await plan.interactionFriends.fetch();
      const friends: FriendModel[] = [];

      for (const jf of interactionFriends) {
        const friend = await jf.friend.fetch();
        if (friend) friends.push(friend);
      }

      setFriendNames(friends.map(f => f.name));
    } catch (error) {
      console.error('Error loading friend names:', error);
    }
  };

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      await confirmPlan(plan.id);
      onConfirmed?.();

      // Prompt for reflection
      Alert.alert(
        'Great!',
        'Want to add a reflection about how it went?',
        [
          { text: 'Skip for Now', style: 'cancel' },
          {
            text: 'Add Reflection',
            onPress: () => {
              // Navigate to reflection flow (EditReflectionModal via interaction detail)
              // For now, we'll just log it
              console.log('Open reflection for:', plan.id);
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error confirming plan:', error);
      Alert.alert('Error', 'Failed to confirm plan');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'What happened?',
      'Let us know so we can help you stay connected',
      [
        { text: 'Never mind', style: 'cancel' },
        {
          text: 'Plans Changed',
          onPress: async () => {
            setIsProcessing(true);
            try {
              await cancelPlan(plan.id);
              onCancelled?.();
            } catch (error) {
              console.error('Error cancelling plan:', error);
              Alert.alert('Error', 'Failed to cancel plan');
            } finally {
              setIsProcessing(false);
            }
          },
        },
        {
          text: 'Reschedule',
          onPress: async () => {
            setIsProcessing(true);
            try {
              await cancelPlan(plan.id);
              onCancelled?.();
              // TODO: Open PlanWizard with prefilled data
              console.log('Open wizard to reschedule');
            } catch (error) {
              console.error('Error handling reschedule:', error);
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  };

  const categoryIcon = CATEGORY_ICONS[plan.interactionCategory || ''] || '🧵';
  const categoryLabel = CATEGORY_LABELS[plan.interactionCategory || ''] || 'Time together';
  const friendList = friendNames.join(', ');
  const daysAgo = differenceInDays(new Date(), plan.interactionDate);
  const dateText =
    daysAgo === 0 ? 'Today' : daysAgo === 1 ? 'Yesterday' : format(plan.interactionDate, 'EEE, MMM d');

  return (
    <View
      className="rounded-2xl overflow-hidden mb-4 mx-5"
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.card,
      }}
    >
      {/* Subtle gradient top bar */}
      <LinearGradient
        colors={isDarkMode ? ['rgba(139, 92, 246, 0.1)', 'rgba(59, 130, 246, 0.1)'] : ['rgba(139, 92, 246, 0.05)', 'rgba(59, 130, 246, 0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="px-4 py-3 flex-row items-center"
      >
        <Clock size={16} color={colors['muted-foreground']} />
        <Text className="ml-2 font-inter-medium text-sm" style={{ color: colors['muted-foreground'] }}>
          {dateText}
        </Text>
      </LinearGradient>

      {/* Content */}
      <View className="p-4">
        <View className="flex-row items-center mb-2">
          <Text className="text-2xl mr-2">{categoryIcon}</Text>
          <View className="flex-1">
            <Text className="font-lora-bold text-base" style={{ color: colors.foreground }}>
              {plan.title || `${categoryLabel} with ${friendList}`}
            </Text>
            {plan.title && (
              <Text className="font-inter-regular text-sm mt-0.5" style={{ color: colors['muted-foreground'] }}>
                {categoryLabel} with {friendList}
              </Text>
            )}
          </View>
        </View>

        {plan.location && (
          <Text className="font-inter-regular text-sm mb-3" style={{ color: colors['muted-foreground'] }}>
            📍 {plan.location}
          </Text>
        )}

        {/* Question */}
        <Text className="font-inter-semibold text-base mb-3" style={{ color: colors.foreground }}>
          Did this happen?
        </Text>

        {/* Action buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={handleConfirm}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-xl flex-row items-center justify-center"
            style={{
              backgroundColor: colors.primary,
              opacity: isProcessing ? 0.6 : 1,
            }}
          >
            <Check size={18} color="#FFFFFF" />
            <Text className="ml-2 font-inter-semibold text-base text-white">Yes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleCancel}
            disabled={isProcessing}
            className="flex-1 py-3 rounded-xl flex-row items-center justify-center"
            style={{
              backgroundColor: colors.muted,
              opacity: isProcessing ? 0.6 : 1,
            }}
          >
            <X size={18} color={colors.foreground} />
            <Text className="ml-2 font-inter-semibold text-base" style={{ color: colors.foreground }}>
              No
            </Text>
          </TouchableOpacity>
        </View>

        {/* Skip button */}
        <TouchableOpacity
          onPress={() => {
            // Just dismiss for now, will show again tomorrow
            onCancelled?.();
          }}
          className="mt-3 py-2"
        >
          <Text className="font-inter-regular text-sm text-center" style={{ color: colors['muted-foreground'] }}>
            Ask me later
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
