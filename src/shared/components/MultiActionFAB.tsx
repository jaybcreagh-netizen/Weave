import React, { useCallback } from 'react';
import { View, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { Plus, X, PenLine, CalendarPlus, UserPlus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type FABAction = 'log-weave' | 'plan-weave' | 'add-friend';

interface MultiActionFABProps {
  onAction: (action: FABAction) => void;
}

interface ActionItem {
  id: FABAction;
  label: string;
  icon: React.ElementType;
}

const ACTIONS: ActionItem[] = [
  { id: 'log-weave', label: 'Log Weave', icon: PenLine },
  { id: 'plan-weave', label: 'Plan Weave', icon: CalendarPlus },
  { id: 'add-friend', label: 'Add Friend', icon: UserPlus },
];

const SPRING_CONFIG = {
  damping: 15,
  stiffness: 150,
  mass: 0.8,
};

export function MultiActionFAB({ onAction }: MultiActionFABProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useTheme();
  const expanded = useSharedValue(0);

  const toggleExpanded = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    expanded.value = withSpring(expanded.value === 0 ? 1 : 0, SPRING_CONFIG);
  }, [expanded]);

  const collapse = useCallback(() => {
    expanded.value = withSpring(0, SPRING_CONFIG);
  }, [expanded]);

  const handleAction = useCallback(
    (action: FABAction) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      collapse();
      // Small delay so animation starts before navigation
      setTimeout(() => onAction(action), 100);
    },
    [collapse, onAction]
  );

  // Main FAB rotation animation
  const mainFabStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(expanded.value, [0, 1], [0, 135])}deg` },
    ],
  }));

  // Backdrop fade animation
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0, 1], [0, 1]),
    pointerEvents: expanded.value > 0.5 ? 'auto' : 'none',
  }));

  // Action items container animation
  const actionsContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(expanded.value, [0, 0.5, 1], [0, 0, 1]),
    transform: [
      {
        translateY: interpolate(
          expanded.value,
          [0, 1],
          [20, 0],
          Extrapolation.CLAMP
        ),
      },
    ],
  }));

  const fabBackgroundColor = isDarkMode ? colors.accent : colors.primary;
  const fabIconColor = isDarkMode ? colors['accent-foreground'] : colors['primary-foreground'];

  return (
    <>
      {/* Backdrop */}
      <AnimatedPressable
        style={[styles.backdrop, backdropStyle]}
        onPress={collapse}
      />

      {/* Actions Menu */}
      <Animated.View
        style={[
          styles.actionsContainer,
          { bottom: insets.bottom + 100 },
          actionsContainerStyle,
        ]}
      >
        {ACTIONS.map((action, index) => (
          <ActionButton
            key={action.id}
            action={action}
            index={index}
            expanded={expanded}
            onPress={() => handleAction(action.id)}
            colors={colors}
            isDarkMode={isDarkMode}
          />
        ))}
      </Animated.View>

      {/* Main FAB */}
      <TouchableOpacity
        onPress={toggleExpanded}
        activeOpacity={0.8}
        style={[
          styles.fab,
          {
            bottom: insets.bottom + 24,
            backgroundColor: fabBackgroundColor,
            shadowColor: isDarkMode ? colors.accent : '#000',
          },
        ]}
      >
        <Animated.View style={mainFabStyle}>
          <Plus color={fabIconColor} size={28} strokeWidth={2.5} />
        </Animated.View>
      </TouchableOpacity>
    </>
  );
}

interface ActionButtonProps {
  action: ActionItem;
  index: number;
  expanded: Animated.SharedValue<number>;
  onPress: () => void;
  colors: Record<string, string>;
  isDarkMode: boolean;
}

function ActionButton({
  action,
  index,
  expanded,
  onPress,
  colors,
  isDarkMode,
}: ActionButtonProps) {
  const Icon = action.icon;

  // Staggered animation for each action item
  const animatedStyle = useAnimatedStyle(() => {
    const delay = index * 0.1;
    const adjustedProgress = Math.max(0, Math.min(1, (expanded.value - delay) / (1 - delay)));

    return {
      opacity: interpolate(adjustedProgress, [0, 1], [0, 1]),
      transform: [
        {
          translateX: interpolate(
            adjustedProgress,
            [0, 1],
            [20, 0],
            Extrapolation.CLAMP
          ),
        },
        {
          scale: interpolate(
            adjustedProgress,
            [0, 1],
            [0.8, 1],
            Extrapolation.CLAMP
          ),
        },
      ],
    };
  });

  return (
    <Animated.View style={[styles.actionRow, animatedStyle]}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={styles.actionTouchable}
      >
        <View
          style={[
            styles.actionLabel,
            {
              backgroundColor: isDarkMode ? colors.card : colors.background,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[styles.actionText, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {action.label}
          </Text>
        </View>
        <View
          style={[
            styles.actionIcon,
            {
              backgroundColor: isDarkMode ? colors.accent : colors.primary,
              shadowColor: isDarkMode ? colors.accent : '#000',
            },
          ]}
        >
          <Icon
            color={isDarkMode ? colors['accent-foreground'] : colors['primary-foreground']}
            size={22}
          />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 40,
  },
  actionsContainer: {
    position: 'absolute',
    right: 24,
    zIndex: 50,
    gap: 12,
  },
  actionRow: {
    alignItems: 'flex-end',
  },
  actionTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionLabel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  fab: {
    position: 'absolute',
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
});
