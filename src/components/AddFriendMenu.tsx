import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, runOnJS } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { UserPlus, Users, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';

/**
 * @interface AddFriendMenuProps
 * @property {boolean} isOpen - Whether the menu is open.
 * @property {() => void} onClose - Function to call when the menu is closed.
 * @property {() => void} onAddSingle - Function to call when the single friend option is selected.
 * @property {() => void} onAddBatch - Function to call when the batch add option is selected.
 */
interface AddFriendMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSingle: () => void;
  onAddBatch: () => void;
}

const SHEET_HEIGHT = 260;

/**
 * An action sheet menu for adding friends, with options for adding a single friend or batch-adding from contacts.
 *
 * @param {AddFriendMenuProps} props - The props for the component.
 * @returns {React.ReactElement | null} The rendered AddFriendMenu component.
 */
export function AddFriendMenu({
  isOpen,
  onClose,
  onAddSingle,
  onAddBatch,
}: AddFriendMenuProps) {
  const { colors, isDarkMode } = useTheme();
  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(SHEET_HEIGHT);

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

  const handleAddSingle = () => {
    animateOut(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onAddSingle();
    });
  };

  const handleAddBatch = () => {
    animateOut(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onAddBatch();
    });
  };

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  if (!isOpen) return null;

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
          <Text style={[styles.title, { color: colors.foreground }]}>
            Add Friends
          </Text>
          <TouchableOpacity onPress={() => animateOut(onClose)} style={styles.closeButton}>
            <X color={colors['muted-foreground']} size={24} />
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.primary }]}
            onPress={handleAddSingle}
            activeOpacity={0.8}
          >
            <UserPlus color={colors['primary-foreground']} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionButtonText, { color: colors['primary-foreground'] }]}>
                Add Single Friend
              </Text>
              <Text style={[styles.actionButtonSubtext, { color: colors['primary-foreground'], opacity: 0.8 }]}>
                Full profile with all details
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.secondaryButton, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={handleAddBatch}
            activeOpacity={0.8}
          >
            <Users color={colors.foreground} size={20} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.actionButtonText, { color: colors.foreground }]}>
                Batch Add from Contacts
              </Text>
              <Text style={[styles.actionButtonSubtext, { color: colors['muted-foreground'] }]}>
                Quick import, refine later
              </Text>
            </View>
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
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
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
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryButton: {
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
});
