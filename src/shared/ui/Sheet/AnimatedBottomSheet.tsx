import React, { useEffect, useCallback, ReactNode, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  StyleSheet,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  WithSpringConfig,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  SHEET_HEIGHTS,
  SHEET_SPRING_CONFIG,
  SHEET_TIMING,
  BACKDROP_OPACITY,
  BLUR_INTENSITY,
  SHEET_BORDER_RADIUS,
  SheetHeight,
} from './constants';

export interface AnimatedBottomSheetRef {
  close: () => void;
}

interface AnimatedBottomSheetProps {
  /**
   * Whether the sheet is visible
   */
  visible: boolean;

  /**
   * Callback when the sheet requests to close
   */
  onClose: () => void;

  /**
   * Sheet height variant
   * @default 'form'
   */
  height?: SheetHeight;

  /**
   * Custom height as percentage (0-1) - overrides height variant
   */
  customHeight?: number;

  /**
   * Whether to show blur backdrop
   * @default true
   */
  blurBackdrop?: boolean;

  /**
   * Whether tapping backdrop closes the sheet
   * @default true
   */
  closeOnBackdropPress?: boolean;

  /**
   * Whether to dismiss keyboard when backdrop is pressed
   * @default true
   */
  dismissKeyboardOnBackdropPress?: boolean;

  /**
   * Optional title for the header
   */
  title?: string;

  /**
   * Whether to show close button in header
   */
  showCloseButton?: boolean;

  /**
   * Callback fired after close animation completes
   */
  onCloseComplete?: () => void;

  /**
   * Sheet content
   */
  children: ReactNode;

  /**
   * Test ID for testing
   */
  testID?: string;

  /**
   * Optional footer component to render at the bottom of the sheet
   */
  footerComponent?: ReactNode;

  /**
   * Whether the sheet has unsaved changes.
   * If true, attempting to close the sheet (via backdrop press or close button)
   * will trigger a confirmation alert.
   * @default false
   */
  hasUnsavedChanges?: boolean;

  /**
   * Custom message to display in the unsaved changes alert
   * @default "Discard Changes? You have unsaved changes. Are you sure you want to discard them?"
   */
  confirmCloseMessage?: string;

  /**
   * Custom spring animation config
   */
  springConfig?: WithSpringConfig;
}

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native-gesture-handler';

export const AnimatedBottomSheet = forwardRef<AnimatedBottomSheetRef, AnimatedBottomSheetProps & { scrollable?: boolean }>(({
  visible,
  onClose,
  height = 'form',
  customHeight,
  blurBackdrop = true,
  closeOnBackdropPress = true,
  dismissKeyboardOnBackdropPress = true,
  title,
  showCloseButton = true,
  onCloseComplete,
  children,
  testID,
  scrollable = false,
  footerComponent,
  hasUnsavedChanges = false,
  confirmCloseMessage = 'Discard Changes? You have unsaved changes. Are you sure you want to discard them?',
  springConfig,
}, ref) => {
  const { colors, isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  // Calculate sheet height (reactive to screen dimension changes)
  const heightPercentage = customHeight ?? parseFloat(SHEET_HEIGHTS[height]) / 100;
  const sheetHeight = screenHeight * heightPercentage;

  // Animation values
  const sheetTranslateY = useSharedValue(sheetHeight);
  const backdropOpacity = useSharedValue(0);

  // Animate in when visible
  useEffect(() => {
    if (visible) {
      backdropOpacity.value = withTiming(BACKDROP_OPACITY.visible, {
        duration: SHEET_TIMING.backdropFade,
      });
      sheetTranslateY.value = withSpring(0, springConfig || SHEET_SPRING_CONFIG);
    }
  }, [visible, springConfig]);

  // Animated styles
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  // Animate out and then call onClose
  const animateOut = useCallback(
    (callback?: () => void) => {
      if (dismissKeyboardOnBackdropPress) {
        Keyboard.dismiss();
      }

      backdropOpacity.value = withTiming(BACKDROP_OPACITY.hidden, {
        duration: SHEET_TIMING.backdropFade,
      });

      sheetTranslateY.value = withTiming(
        sheetHeight,
        { duration: SHEET_TIMING.sheetExit },
        (finished) => {
          if (finished) {
            if (callback) {
              runOnJS(callback)();
            }
            if (onCloseComplete) {
              runOnJS(onCloseComplete)();
            }
          }
        }
      );
    },
    [sheetHeight, dismissKeyboardOnBackdropPress, onCloseComplete]
  );

  useImperativeHandle(ref, () => ({
    close: () => {
      animateOut(onClose);
    }
  }));

  const handleAttemptClose = useCallback(() => {
    if (hasUnsavedChanges) {
      Alert.alert(
        'Discard Changes?',
        confirmCloseMessage,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => animateOut(onClose),
          },
        ]
      );
    } else {
      animateOut(onClose);
    }
  }, [hasUnsavedChanges, confirmCloseMessage, animateOut, onClose]);

  const handleBackdropPress = useCallback(() => {
    if (closeOnBackdropPress) {
      handleAttemptClose();
    }
  }, [closeOnBackdropPress, handleAttemptClose]);

  const handleClosePress = useCallback(() => {
    handleAttemptClose();
  }, [handleAttemptClose]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={handleClosePress}
      testID={testID}
    >
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <Animated.View className="absolute inset-0" style={backdropStyle}>
            {blurBackdrop ? (
              <BlurView
                intensity={isDarkMode ? BLUR_INTENSITY.dark : BLUR_INTENSITY.light}
                tint={isDarkMode ? 'dark' : 'light'}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: isDarkMode
                      ? 'rgba(0, 0, 0, 0.6)'
                      : 'rgba(0, 0, 0, 0.4)',
                  },
                ]}
              />
            )}
          </Animated.View>
        </TouchableWithoutFeedback>

        {/* Sheet */}
        <Animated.View
          className="absolute bottom-0 left-0 right-0 shadow-lg"
          style={[
            {
              height: sheetHeight,
              backgroundColor: colors.card,
              borderTopLeftRadius: SHEET_BORDER_RADIUS,
              borderTopRightRadius: SHEET_BORDER_RADIUS,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 16,
              elevation: 16,
            },
            sheetStyle,
          ]}
        >
          {/* Handle indicator */}
          <View
            className="w-10 h-1 rounded-full self-center mt-2"
            style={{ backgroundColor: colors.border }}
          />

          {/* Header with optional title and close button */}
          {(title || showCloseButton) && (
            <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
              {title ? (
                <Text
                  className="text-xl font-lora-bold flex-1 mr-4"
                  style={{ color: colors.foreground }}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              ) : (
                <View className="flex-1" />
              )}
              {showCloseButton && (
                <TouchableOpacity
                  onPress={handleClosePress}
                  className="p-1"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                >
                  <X size={24} color={colors['muted-foreground']} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Content */}
          {scrollable ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingBottom: footerComponent ? 0 : Math.max(insets.bottom + 24, 40)
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View
              className="flex-1 px-4"
              style={{ paddingBottom: footerComponent ? 0 : Math.max(insets.bottom + 24, 40) }}
            >
              {children}
            </View>
          )}

          {/* Footer */}
          {footerComponent && (
            <View
              className="px-4 pt-4 border-t"
              style={{ borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }}
            >
              {footerComponent}
            </View>
          )}

        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

