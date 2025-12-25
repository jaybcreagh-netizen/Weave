import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Calendar, MessageCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/shared/hooks/useTheme';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import Intention from '@/db/models/Intention';
import FriendModel from '@/db/models/Friend';
import { InteractionCategory } from '@/shared/types/legacy-types';
import { database } from '@/db';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { useReachOut, ContactLinker } from '@/modules/messaging';

interface IntentionActionSheetProps {
  intention: Intention | null;
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (intention: Intention, friend: FriendModel) => void;
  onDismiss: (intention: Intention) => void;
}

/**
 * Action sheet for acting on an intention
 * Options: Schedule it (convert to planned weave) or Dismiss
 */
export function IntentionActionSheet({
  intention,
  isOpen,
  onClose,
  onSchedule,
  onDismiss,
}: IntentionActionSheetProps) {
  const { colors } = useTheme();
  const [friend, setFriend] = useState<FriendModel | null>(null);
  const [showContactLinker, setShowContactLinker] = useState(false);
  const { reachOut } = useReachOut();

  // Track the pending action to execute after close animation
  const pendingActionRef = useRef<'schedule' | 'dismiss' | 'close' | null>(null);

  // Load friend data through the join table
  useEffect(() => {
    if (intention) {
      const loadFriend = async () => {
        const intentionFriends = await database
          .get('intention_friends')
          .query(Q.where('intention_id', intention.id))
          .fetch();

        if (intentionFriends.length > 0) {
          const friendRecord = await (intentionFriends[0] as any).friend.fetch();
          setFriend(friendRecord);
        }
      };
      loadFriend();
    }
  }, [intention]);

  const handleSchedule = () => {
    pendingActionRef.current = 'schedule';
    onClose();
  };

  const handleDismissAction = () => {
    pendingActionRef.current = 'dismiss';
    onClose();
  };

  const handleReachOut = async () => {
    if (!friend) return;

    // Check if friend has contact info
    const hasContactInfo = friend.phoneNumber || friend.email;

    if (!hasContactInfo) {
      // Show contact linker
      setShowContactLinker(true);
      return;
    }

    // Reach out directly
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const result = await reachOut(friend, intention?.description);

    if (result.success) {
      // Close the sheet after successful reach out
      onClose();
    }
  };

  const handleClose = () => {
    pendingActionRef.current = 'close';
    onClose();
  };

  const handleCloseComplete = () => {
    if (!intention || !friend) return;

    if (pendingActionRef.current === 'schedule') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onSchedule(intention, friend);
    } else if (pendingActionRef.current === 'dismiss') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onDismiss(intention);
    }

    pendingActionRef.current = null;
  };

  if (!intention || !friend) return null;

  const category = intention.interactionCategory
    ? getCategoryMetadata(intention.interactionCategory as InteractionCategory)
    : null;

  return (
    <AnimatedBottomSheet
      visible={isOpen}
      onClose={handleClose}
      onCloseComplete={handleCloseComplete}
      height="action"
      title={`Connection with ${friend.name}`}
    >
      {/* Category and Description */}
      <View className="flex-row items-center gap-3 mb-4">
        {category && <Text className="text-3xl">{category.icon}</Text>}
        {intention.description && (
          <Text className="text-[15px] flex-1" style={{ color: colors['muted-foreground'] }}>
            {intention.description}
          </Text>
        )}
      </View>

      {/* Actions */}
      <View className="gap-3">
        <TouchableOpacity
          className="flex-row items-center justify-center gap-3 py-4 rounded-xl shadow-sm elevation-4"
          style={{ backgroundColor: colors.primary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }}
          onPress={handleSchedule}
          activeOpacity={0.8}
        >
          <Calendar color={colors['primary-foreground']} size={20} />
          <Text className="text-base font-semibold" style={{ color: colors['primary-foreground'] }}>
            Schedule It
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center justify-center gap-3 py-4 rounded-xl shadow-sm elevation-4"
          style={{ backgroundColor: colors.accent || colors.secondary, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }}
          onPress={handleReachOut}
          activeOpacity={0.8}
        >
          <MessageCircle color={colors['accent-foreground'] || colors['secondary-foreground']} size={20} />
          <Text className="text-base font-semibold" style={{ color: colors['accent-foreground'] || colors['secondary-foreground'] }}>
            Reach Out
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center justify-center gap-3 py-4 rounded-xl shadow-sm elevation-4 border"
          style={{ backgroundColor: colors.muted, borderColor: colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8 }}
          onPress={handleDismissAction}
          activeOpacity={0.8}
        >
          <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
            Dismiss
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contact Linker Sheet */}
      {friend && (
        <ContactLinker
          visible={showContactLinker}
          onClose={() => setShowContactLinker(false)}
          friend={friend}
          onLinked={() => {
            setShowContactLinker(false);
            // After linking, try to reach out
            handleReachOut();
          }}
        />
      )}
    </AnimatedBottomSheet>
  );
}
