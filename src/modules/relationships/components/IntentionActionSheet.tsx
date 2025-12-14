import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/shared/hooks/useTheme';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import Intention from '@/db/models/Intention';
import FriendModel from '@/db/models/Friend';
import { InteractionCategory } from '@/shared/types/legacy-types';
import { database } from '@/db';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';

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
      <View style={styles.headerContent}>
        {category && <Text style={styles.categoryIcon}>{category.icon}</Text>}
        {intention.description && (
          <Text style={[styles.description, { color: colors['muted-foreground'] }]}>
            {intention.description}
          </Text>
        )}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleSchedule}
          activeOpacity={0.8}
        >
          <Calendar color={colors['primary-foreground']} size={20} />
          <Text style={[styles.actionButtonText, { color: colors['primary-foreground'] }]}>
            Schedule It
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton, { backgroundColor: colors.muted, borderColor: colors.border }]}
          onPress={handleDismissAction}
          activeOpacity={0.8}
        >
          <Text style={[styles.actionButtonText, { color: colors.foreground }]}>
            Dismiss
          </Text>
        </TouchableOpacity>
      </View>
    </AnimatedBottomSheet>
  );
}

const styles = StyleSheet.create({
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  categoryIcon: {
    fontSize: 32,
  },
  description: {
    fontSize: 15,
    flex: 1,
  },
  actions: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButton: {},
  secondaryButton: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
