import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { getCategoryMetadata } from '../lib/interaction-categories';
import Intention from '../db/models/Intention';
import { InteractionCategory } from './types';

interface IntentionsDrawerProps {
  intentions: Intention[];
  isOpen: boolean;
  onClose: () => void;
  onIntentionPress: (intention: Intention) => void;
}

const DRAWER_HEIGHT = 400;

/**
 * Drawer that slides up from bottom showing all intentions for a friend
 * Displays intention description, category icon, and date created
 */
export function IntentionsDrawer({
  intentions,
  isOpen,
  onClose,
  onIntentionPress,
}: IntentionsDrawerProps) {
  const { colors, isDarkMode } = useTheme();
  const backdropOpacity = useSharedValue(0);
  const drawerTranslateY = useSharedValue(DRAWER_HEIGHT);

  useEffect(() => {
    if (isOpen) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      drawerTranslateY.value = withSpring(0, { damping: 50, stiffness: 400 });
    }
  }, [isOpen]);

  const animateOut = (callback: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: 150 });
    drawerTranslateY.value = withTiming(DRAWER_HEIGHT, { duration: 200 }, (finished) => {
      if (finished) {
        runOnJS(callback)();
      }
    });
  };

  const handleIntentionPress = (intention: Intention) => {
    animateOut(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onIntentionPress(intention);
    });
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: drawerTranslateY.value }],
  }));

  if (!isOpen) return null;

  return (
    <Modal transparent visible={isOpen} onRequestClose={() => animateOut(onClose)}>
      <View style={StyleSheet.absoluteFill}>
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
            styles.drawer,
            { backgroundColor: colors.muted },
            drawerStyle,
          ]}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerContent}>
              <Text style={styles.headerIcon}>💫</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Connection Intentions
              </Text>
            </View>
            <TouchableOpacity onPress={() => animateOut(onClose)} style={styles.closeButton}>
              <X color={colors['muted-foreground']} size={24} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
            {intentions.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>✨</Text>
                <Text style={[styles.emptyText, { color: colors['muted-foreground'] }]}>
                  No intentions set yet
                </Text>
              </View>
            ) : (
              intentions.map((intention) => {
                const category = intention.interactionCategory
                  ? getCategoryMetadata(intention.interactionCategory as InteractionCategory)
                  : null;
                const timeAgo = formatDistanceToNow(intention.createdAt, { addSuffix: true });

                return (
                  <TouchableOpacity
                    key={intention.id}
                    style={[styles.intentionCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                    onPress={() => handleIntentionPress(intention)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cardHeader}>
                      {category && (
                        <View style={[styles.categoryBadge, { backgroundColor: colors.muted }]}>
                          <Text style={styles.categoryIcon}>{category.icon}</Text>
                        </View>
                      )}
                      <Text style={[styles.timeAgo, { color: colors['muted-foreground'] }]}>
                        {timeAgo}
                      </Text>
                    </View>

                    {intention.description ? (
                      <Text style={[styles.description, { color: colors.foreground }]}>
                        {intention.description}
                      </Text>
                    ) : (
                      <Text style={[styles.description, styles.descriptionPlaceholder, { color: colors['muted-foreground'] }]}>
                        Connect soon
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: DRAWER_HEIGHT,
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    fontSize: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  intentionCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryIcon: {
    fontSize: 18,
  },
  timeAgo: {
    fontSize: 13,
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
  },
  descriptionPlaceholder: {
    fontStyle: 'italic',
  },
});
