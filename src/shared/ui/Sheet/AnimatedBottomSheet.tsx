import React, { useEffect, useCallback, ReactNode, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
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
   * @default true
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
}

/**
 * AnimatedBottomSheet - Reanimated-based bottom sheet for custom animation control
 *
 * Use this when you need:
 * - Custom animation sequences
 * - Control over close animation completion
 * - Integration with existing Reanimated animations
 *
 * For most use cases, prefer StandardBottomSheet which uses @gorhom/bottom-sheet
 * for native gesture handling.
 *
 * @example
 * <AnimatedBottomSheet
 *   visible={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onCloseComplete={() => resetForm()}
 *   height="form"
 *   title="Quick Rating"
 * >
 *   <RatingForm />
 * </AnimatedBottomSheet>
 */
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
      sheetTranslateY.value = withSpring(0, SHEET_SPRING_CONFIG);
    }
  }, [visible]);

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
      onRequestClose={handleClosePress}
      testID={testID}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Backdrop */}
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <Animated.View style={[styles.backdrop, backdropStyle]}>
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
          style={[
            styles.sheet,
            { height: sheetHeight, backgroundColor: colors.card },
            sheetStyle,
          ]}
        >
          {/* Handle indicator */}
          <View
            style={[styles.handleIndicator, { backgroundColor: colors.border }]}
          />

          {/* Header with optional title and close button */}
          {(title || showCloseButton) && (
            <View style={styles.header}>
              {title ? (
                <Text
                  style={[styles.title, { color: colors.foreground }]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              ) : (
                <View style={{ flex: 1 }} />
              )}
              {showCloseButton && (
                <TouchableOpacity
                  onPress={handleClosePress}
                  style={styles.closeButton}
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
            <View style={[styles.content, { paddingBottom: footerComponent ? 0 : Math.max(insets.bottom + 24, 40) }]}>
              {children}
            </View>
          )}

          {/* Footer */}
          {footerComponent && (
            <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
              {footerComponent}
            </View>
          )}

        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: SHEET_BORDER_RADIUS,
    borderTopRightRadius: SHEET_BORDER_RADIUS,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16,
  },
  handleIndicator: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Lora_700Bold',
    fontWeight: '700',
    flex: 1,
    marginRight: 16,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
