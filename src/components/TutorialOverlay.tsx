import React, { useEffect, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';

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
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Dimmed background */}
        <Animated.View
          style={StyleSheet.absoluteFill}
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(200)}
          pointerEvents="box-none"
        >
          <BlurView
            intensity={isDarkMode ? 40 : 30}
            tint={isDarkMode ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          >
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)' },
              ]}
            />
          </BlurView>
        </Animated.View>

        {/* Spotlight cutout effect */}
        {step.targetPosition && (
          <Animated.View
            style={[
              spotlightStyle,
              {
                borderWidth: 3,
                borderColor: colors.primary,
                backgroundColor: 'transparent',
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 20,
                elevation: 10,
              },
            ]}
            pointerEvents="none"
          />
        )}

        {/* Tooltip */}
        <Animated.View
          style={[
            styles.tooltipContainer,
            getTooltipPosition(step),
          ]}
          entering={FadeIn.delay(100).duration(300).springify()}
          exiting={FadeOut.duration(200)}
        >
          <View style={[styles.tooltip, { backgroundColor: colors.card }]}>
            {/* Progress indicator */}
            {currentStep !== undefined && totalSteps !== undefined && (
              <View style={styles.progressContainer}>
                <Text style={[styles.progressText, { color: colors['muted-foreground'] }]}>
                  {currentStep + 1} of {totalSteps}
                </Text>
              </View>
            )}

            <Text style={[styles.tooltipTitle, { color: colors.foreground }]}>
              {step.title}
            </Text>
            <Text style={[styles.tooltipDescription, { color: colors['muted-foreground'] }]}>
              {step.description}
            </Text>

            {/* Actions */}
            <View style={styles.actionsContainer}>
              {onSkip && (
                <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                  <Text style={[styles.skipButtonText, { color: colors['muted-foreground'] }]}>
                    Skip tour
                  </Text>
                </TouchableOpacity>
              )}

              {step.action ? (
                <TouchableOpacity
                  onPress={step.action.onPress}
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionButtonText}>{step.action.label}</Text>
                </TouchableOpacity>
              ) : onNext ? (
                <TouchableOpacity
                  onPress={handleNext}
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionButtonText}>Next</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Arrow pointer */}
          {step.targetPosition && (
            <View
              style={[
                styles.arrow,
                getArrowStyle(step.tooltipPosition || 'bottom'),
                { borderTopColor: colors.card },
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

function getArrowStyle(position: string): any {
  switch (position) {
    case 'top':
      return styles.arrowBottom;
    case 'bottom':
      return styles.arrowTop;
    case 'left':
      return styles.arrowRight;
    case 'right':
      return styles.arrowLeft;
    default:
      return styles.arrowTop;
  }
}

const styles = StyleSheet.create({
  tooltipContainer: {
    alignItems: 'center',
    zIndex: 1000,
  },
  tooltip: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
    maxWidth: 400,
  },
  progressContainer: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tooltipTitle: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
    marginBottom: 8,
  },
  tooltipDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  skipButton: {
    padding: 8,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  arrow: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
  },
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
    borderBottomColor: 'white',
    marginBottom: -1,
  },
  arrowLeft: {
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'white',
    marginLeft: -1,
  },
  arrowRight: {
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderRightWidth: 10,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: 'white',
    marginRight: -1,
  },
});
