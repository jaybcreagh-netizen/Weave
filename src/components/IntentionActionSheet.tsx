import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Calendar, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/shared/hooks/useTheme';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import Intention from '@/db/models/Intention';
import FriendModel from '@/db/models/Friend';
import { InteractionCategory } from './types';
import { database } from '@/db';

interface IntentionActionSheetProps {
  intention: Intention | null;
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (intention: Intention, friend: FriendModel) => void;
  onDismiss: (intention: Intention) => void;
}

const SHEET_HEIGHT = 280;

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
  const { colors, isDarkMode } = useTheme();
  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(SHEET_HEIGHT);
  const [friend, setFriend] = useState<FriendModel | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      sheetTranslateY.value = withSpring(0, { damping: 50, stiffness: 400 });
    }
  }, [isOpen]);

  const animateOut = (callback: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: 150 });
    sheetTranslateY.value = withTiming(SHEET_HEIGHT, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(callback)();
      }
    });
  };

  const handleSchedule = () => {
    if (intention && friend) {
      animateOut(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onSchedule(intention, friend);
      });
    }
  };

  const handleDismiss = () => {
    if (intention) {
      animateOut(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onDismiss(intention);
      });
    }
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  if (!isOpen || !intention || !friend) return null;

  const category = intention.interactionCategory
    ? getCategoryMetadata(intention.interactionCategory as InteractionCategory)
    : null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={() => animateOut(onClose)}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            backdropStyle,
            { backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.6)' : 'rgba(0, 0, 0, 0.4)' }
          ]}
        >
          <BlurView intensity={isDarkMode ? 20 : 10} tint={isDarkMode ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        </Animated.View>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.card },
          sheetStyle,
        ]}
        pointerEvents="box-none"
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerContent}>
            {category && <Text style={styles.categoryIcon}>{category.icon}</Text>}
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Connection with {friend.name}
              </Text>
              {intention.description && (
                <Text style={[styles.description, { color: colors['muted-foreground'] }]}>
                  {intention.description}
                </Text>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={() => animateOut(onClose)} style={styles.closeButton}>
            <X color={colors['muted-foreground']} size={24} />
          </TouchableOpacity>
        </View>

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
            onPress={handleDismiss}
            activeOpacity={0.8}
          >
            <Text style={[styles.actionButtonText, { color: colors.foreground }]}>
              Dismiss
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  categoryIcon: {
    fontSize: 32,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 15,
  },
  closeButton: {
    padding: 4,
  },
  actions: {
    padding: 24,
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
