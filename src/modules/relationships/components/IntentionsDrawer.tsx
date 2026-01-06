import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import {
  Sparkles,
  Phone,
  Utensils,
  Users,
  MessageCircle,
  Palette,
  PartyPopper,
  HeartHandshake,
  Star,
  Mic,
} from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { Intention, InteractionCategory } from '@/shared/types/legacy-types';

// Map category IDs to Lucide icons (Partial because not all categories may have icons)
const CATEGORY_ICONS: Partial<Record<InteractionCategory, React.ElementType>> = {
  'text-call': Phone,
  'meal-drink': Utensils,
  'hangout': Users,
  'deep-talk': MessageCircle,
  'activity-hobby': Palette,
  'event-party': PartyPopper,
  'favor-support': HeartHandshake,
  'celebration': Star,
  'voice-note': Mic,
};

interface IntentionsDrawerProps {
  intentions: Intention[];
  isOpen: boolean;
  onClose: () => void;
  onIntentionPress: (intention: Intention) => void;
  onDeleteIntention?: (id: string) => void;
}

/**
 * Drawer that slides up from bottom showing all intentions for a friend
 * Displays intention description, category icon, and date created
 */
export function IntentionsDrawer({
  intentions,
  isOpen,
  onClose,
  onIntentionPress,
  onDeleteIntention,
}: IntentionsDrawerProps) {
  const { colors } = useTheme();

  const handleIntentionPress = (intention: Intention) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onIntentionPress(intention);
    // Note: StandardBottomSheet should be closed by parent if desired, or we can close it here
    onClose();
  };

  const handleLongPress = (intention: Intention) => {
    if (onDeleteIntention) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Delete Intention',
        'Are you sure you want to delete this intention?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              onDeleteIntention(intention.id);
              // Optional: Close drawer if empty? No, keep open to show empty state.
            }
          }
        ]
      );
    }
  };

  return (
    <StandardBottomSheet
      visible={isOpen}
      onClose={onClose}
      snapPoints={['60%', '90%']}
      title="Connection Intentions"
      enableSwipeClose={true}
      scrollable
    >
      <View className="flex-1 px-1 gap-3">
        <View className="mb-4 flex-row items-center gap-2">
          <View
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: colors.primary + '20' }}
          >
            <Sparkles size={20} color={colors.primary} />
          </View>
          <Text className="text-xl font-lora-bold font-semibold" style={{ color: colors.foreground }}>
            Your Intentions
          </Text>
        </View>

        {intentions.length === 0 ? (
          <View className="items-center justify-center py-[60px]">
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-4"
              style={{ backgroundColor: colors.muted }}
            >
              <Sparkles size={28} color={colors['muted-foreground']} />
            </View>
            <Text className="text-base text-center" style={{ color: colors['muted-foreground'] }}>
              No intentions set for this friend yet.
            </Text>
            <Text className="text-sm text-center mt-2 opacity-70" style={{ color: colors['muted-foreground'] }}>
              Add one to remember how you want to connect!
            </Text>
          </View>
        ) : (
          intentions.map((intention) => {
            const categoryKey = intention.interactionCategory as InteractionCategory;
            const IconComponent = categoryKey ? CATEGORY_ICONS[categoryKey] : null;

            // Safety: createdAt might be a timestamp number from WatermelonDB
            let timeAgo = 'Recently';
            try {
              const createdDate = typeof intention.createdAt === 'number'
                ? new Date(intention.createdAt)
                : intention.createdAt;
              if (createdDate && !isNaN(createdDate.getTime())) {
                timeAgo = formatDistanceToNow(createdDate, { addSuffix: true });
              }
            } catch (e) {
              // Fallback if date parsing fails
            }

            return (
              <TouchableOpacity
                key={intention.id}
                className="p-4 rounded-xl border gap-2"
                style={{ backgroundColor: colors.background, borderColor: colors.border }}
                onPress={() => handleIntentionPress(intention)}
                onLongPress={() => handleLongPress(intention)}
                activeOpacity={0.7}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    {IconComponent && (
                      <View
                        className="w-8 h-8 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.primary + '20' }}
                      >
                        <IconComponent size={16} color={colors.primary} />
                      </View>
                    )}
                    <Text className="text-xs font-medium" style={{ color: colors['muted-foreground'] }}>
                      {timeAgo}
                    </Text>
                  </View>
                </View>

                {intention.description ? (
                  <Text className="text-base leading-[22px]" style={{ color: colors.foreground }}>
                    {intention.description}
                  </Text>
                ) : (
                  <Text className="text-base leading-[22px] italic" style={{ color: colors['muted-foreground'] }}>
                    Connect soon
                  </Text>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </StandardBottomSheet>
  );
}
