import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetPosition?: { x: number; y: number; width: number; height: number };
  tooltipPosition?: 'top' | 'bottom' | 'left' | 'right';
  action?: {
    label: string;
    onPress: () => void;
  };
  highlightRadius?: number;
}

interface TutorialOverlayProps {
  visible: boolean;
  step: TutorialStep;
  onNext?: () => void;
  onSkip?: () => void;
  currentStep?: number;
  totalSteps?: number;
}

/**
 * TutorialOverlay - Creates an overlay with spotlight effect and contextual tooltip
 * Used for interactive onboarding that highlights real UI elements
 */
export function TutorialOverlay({
  visible,
  step,
  onNext,
  onSkip,
  currentStep,
  totalSteps,
}: TutorialOverlayProps) {
  const { colors, isDarkMode } = useTheme();
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (visible && step.targetPosition) {
      // Pulse animation for spotlight
      pulseScale.value = withSequence(
        withSpring(1.05, { damping: 10 }),
        withSpring(1, { damping: 10 })
      );
    }
  }, [visible, step.id]);

  const spotlightStyle = useAnimatedStyle(() => {
    if (!step.targetPosition) return {};

    return {
      position: 'absolute',
      left: step.targetPosition.x - 8,
      top: step.targetPosition.y - 8,
      width: step.targetPosition.width + 16,
      height: step.targetPosition.height + 16,
      borderRadius: step.highlightRadius || 16,
      transform: [{ scale: pulseScale.value }],
    };
  });

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNext?.();
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onSkip?.();
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <View className="absolute inset-0" pointerEvents="box-none">
        {/* Dimmed background - much lighter and allows touches through */}
        <Animated.View
          className="absolute inset-0"
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          pointerEvents="none"
        >
          <View
            className="absolute inset-0"
            style={{ backgroundColor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)' }}
          />
        </Animated.View>

        {/* Spotlight border - non-blocking */}
        {step.targetPosition && (
          <Animated.View
            style={[
              spotlightStyle,
              {
                borderWidth: 2,
                borderColor: colors.primary,
                backgroundColor: 'transparent',
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 12,
                elevation: 10,
              },
            ]}
            pointerEvents="none"
          />
        )}

        {/* Tooltip */}
        <Animated.View
          className="items-center z-[1000]"
          style={getTooltipPosition(step)}
          entering={FadeIn.delay(100).duration(300).springify()}
          exiting={FadeOut.duration(200)}
        >
          <View
            className="rounded-2xl p-5 shadow-2xl max-w-[400px]"
            style={{
              backgroundColor: colors.card,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 16,
              elevation: 16,
            }}
          >
            {/* Progress indicator */}
            {currentStep !== undefined && totalSteps !== undefined && (
              <View className="self-start mb-2">
                <Text
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: colors['muted-foreground'] }}
                >
                  {currentStep + 1} of {totalSteps}
                </Text>
              </View>
            )}

            <Text
              className="text-xl font-bold font-lora-bold mb-2"
              style={{ color: colors.foreground }}
            >
              {step.title}
            </Text>
            <Text
              className="text-base leading-6 mb-4"
              style={{ color: colors['muted-foreground'] }}
            >
              {step.description}
            </Text>

            {/* Actions */}
            <View className="flex-row justify-between items-center gap-3">
              {onSkip && (
                <TouchableOpacity onPress={handleSkip} className="p-2">
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors['muted-foreground'] }}
                  >
                    Skip tour
                  </Text>
                </TouchableOpacity>
              )}

              {step.action ? (
                <TouchableOpacity
                  onPress={step.action.onPress}
                  className="flex-1 py-3 px-6 rounded-xl items-center"
                  style={{ backgroundColor: colors.primary }}
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-base font-semibold">{step.action.label}</Text>
                </TouchableOpacity>
              ) : onNext ? (
                <TouchableOpacity
                  onPress={handleNext}
                  className="flex-1 py-3 px-6 rounded-xl items-center"
                  style={{ backgroundColor: colors.primary }}
                  activeOpacity={0.8}
                >
                  <Text className="text-white text-base font-semibold">Next</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Arrow pointer */}
          {step.targetPosition && (
            <View
              className="w-0 h-0 bg-transparent border-solid"
              style={[
                getArrowStyle(step.tooltipPosition || 'bottom'),
                {
                  // Overriding border color for the arrow direction based on card color
                  ...(step.tooltipPosition === 'bottom' ? { borderTopColor: colors.card } : {}),
                  ...(step.tooltipPosition === 'top' ? { borderBottomColor: colors.card } : {}),
                  ...(step.tooltipPosition === 'left' ? { borderRightColor: colors.card } : {}),
                  ...(step.tooltipPosition === 'right' ? { borderLeftColor: colors.card } : {}),
                },
              ]}
            />
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function getTooltipPosition(step: TutorialStep): any {
  if (!step.targetPosition) {
    // Centered if no target
    return {
      position: 'absolute',
      bottom: 100,
      left: 20,
      right: 20,
    };
  }

  const position = step.tooltipPosition || 'bottom';
  const target = step.targetPosition;

  switch (position) {
    case 'top':
      return {
        position: 'absolute',
        bottom: '100%',
        left: Math.max(20, target.x - 100),
        right: Math.max(20, target.x + target.width - 100),
        marginBottom: target.y - 20,
      };
    case 'bottom':
      return {
        position: 'absolute',
        top: target.y + target.height + 20,
        left: 20,
        right: 20,
      };
    case 'left':
      return {
        position: 'absolute',
        right: '100%',
        top: target.y,
        marginRight: 20,
        maxWidth: 200,
      };
    case 'right':
      return {
        position: 'absolute',
        left: target.x + target.width + 20,
        top: target.y,
        maxWidth: 200,
      };
    default:
      return {
        position: 'absolute',
        top: target.y + target.height + 20,
        left: 20,
        right: 20,
      };
  }
}

const legacyStyles = {
  arrowTop: {
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  arrowBottom: {
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginBottom: -1,
  },
  arrowLeft: {
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: -1,
  },
  arrowRight: {
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginRight: -1,
  }
};

function getArrowStyle(position: string): any {
  switch (position) {
    case 'top':
      return legacyStyles.arrowBottom;
    case 'bottom':
      return legacyStyles.arrowTop;
    case 'left':
      return legacyStyles.arrowRight;
    case 'right':
      return legacyStyles.arrowLeft;
    default:
      return legacyStyles.arrowTop;
  }
}
