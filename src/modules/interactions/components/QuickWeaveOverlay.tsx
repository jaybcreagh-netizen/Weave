import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { useUIStore } from '@/stores/uiStore';
import { useFriends } from '@/modules/relationships';
import { useCardGesture } from '@/context/CardGestureContext';
import { useTheme } from '@/shared/hooks/useTheme';
import { InteractionCategory } from '@/shared/constants/interaction-categories';

// Compact sizing for sleeker feel
const MENU_RADIUS = 75; // Reduced from 100px
const ITEM_SIZE = 50; // Reduced from 64px
const CENTER_SIZE = 44; // New - iOS standard touch target
const HIGHLIGHT_THRESHOLD = 25; // Reduced from 30px
const SELECTION_THRESHOLD = 40; // Reduced from 45px

interface RadialMenuItem {
  id: InteractionCategory;
  icon: string;
  label: string;
}

// Category metadata mapping
const CATEGORY_METADATA: Record<InteractionCategory, { icon: string; label: string }> = {
  'text-call': { icon: '📞', label: 'Call' },
  'meal-drink': { icon: '🍽️', label: 'Meal' },
  'hangout': { icon: '👥', label: 'Hang' },
  'deep-talk': { icon: '💭', label: 'Talk' },
  'activity-hobby': { icon: '🎨', label: 'Do' },
  'voice-note': { icon: '🎤', label: 'Voice' },
  'event-party': { icon: '🎉', label: 'Event' },
  'favor-support': { icon: '🤝', label: 'Help' },
  'celebration': { icon: '🎊', label: 'Celebrate' },
};

// Default fallback activities
const DEFAULT_ACTIVITIES: InteractionCategory[] = [
  'text-call',
  'meal-drink',
  'hangout',
  'deep-talk',
  'activity-hobby',
  'voice-note',
];

export function QuickWeaveOverlay() {
  const {
    quickWeaveFriendId,
    quickWeaveCenterPoint,
    quickWeaveActivities,
    isQuickWeaveClosing,
    _finishClosingQuickWeave,
  } = useUIStore();
  const allFriends = useFriends();
  const friend = allFriends.find(f => f.id === quickWeaveFriendId);
  const { dragX, dragY, highlightedIndex } = useCardGesture();
  const { colors, isDarkMode } = useTheme();

  const overlayOpacity = useSharedValue(0);
  const menuScale = useSharedValue(0.3);
  const centerPulse = useSharedValue(1);

  // Entrance Animation - Fast and snappy
  useEffect(() => {
    overlayOpacity.value = withTiming(1, { duration: 80 });
    menuScale.value = withTiming(1, { duration: 120 });
    // Very subtle pulse on center
    centerPulse.value = withSequence(
      withTiming(1.05, { duration: 100 }),
      withTiming(1, { duration: 120 })
    );
  }, []);

  // Exit Animation - Fast dismiss
  useEffect(() => {
    if (isQuickWeaveClosing) {
      menuScale.value = withTiming(0.3, { duration: 100 });
      overlayOpacity.value = withTiming(0, { duration: 120 }, (finished) => {
        if (finished) {
          runOnJS(_finishClosingQuickWeave)();
        }
      });
    }
  }, [isQuickWeaveClosing]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const menuContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(menuScale.value, [0.3, 1], [0, 1]),
    transform: [{ scale: menuScale.value }],
  }));

  const centerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: centerPulse.value }],
  }));

  // Early return AFTER all hooks have been called
  if (!quickWeaveCenterPoint || !quickWeaveFriendId || !friend) {
    return null;
  }

  // Use smart-ordered activities or fallback to default
  const orderedCategories = quickWeaveActivities.length > 0
    ? quickWeaveActivities.slice(0, 6) // Take first 6
    : DEFAULT_ACTIVITIES;

  // Map to RadialMenuItem format
  const ACTIVITIES: RadialMenuItem[] = orderedCategories.map(category => ({
    id: category,
    icon: CATEGORY_METADATA[category]?.icon || '❓',
    label: CATEGORY_METADATA[category]?.label || category,
  }));

  // Calculate positions dynamically based on actual activity count
  const itemPositions = ACTIVITIES.map((_, i) => {
    const angle = (i / ACTIVITIES.length) * 2 * Math.PI - Math.PI / 2;
    return {
      x: MENU_RADIUS * Math.cos(angle),
      y: MENU_RADIUS * Math.sin(angle),
      angle,
    };
  });

  const friendInitial = friend.name.charAt(0).toUpperCase();

  return (
    <View className="absolute inset-0" pointerEvents="none">
      <Animated.View style={overlayStyle}>
        <BlurView
          intensity={isDarkMode ? 25 : 15}
          tint={isDarkMode ? 'dark' : 'light'}
          className="absolute inset-0"
        />
      </Animated.View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            width: MENU_RADIUS * 2,
            height: MENU_RADIUS * 2,
            left: quickWeaveCenterPoint.x - MENU_RADIUS,
            top: quickWeaveCenterPoint.y - MENU_RADIUS,
            alignItems: 'center',
            justifyContent: 'center',
          },
          menuContainerStyle,
        ]}
      >
        {/* Center Circle - Anchor Point */}
        <Animated.View
          style={[
            {
              width: CENTER_SIZE,
              height: CENTER_SIZE,
              borderRadius: CENTER_SIZE / 2,
              backgroundColor: isDarkMode ? 'rgba(124, 58, 237, 0.9)' : 'rgba(124, 58, 237, 0.85)',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 6,
              elevation: 4,
              borderWidth: 2,
              borderColor: 'rgba(255, 255, 255, 0.3)',
            },
            centerStyle,
          ]}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: 'white',
              fontFamily: 'Lora_700Bold',
            }}
          >
            {friendInitial}
          </Text>
        </Animated.View>

        {/* Radial Menu Items */}
        {ACTIVITIES.map((item, index) => (
          <MenuItem
            key={item.id}
            item={item}
            index={index}
            position={itemPositions[index]}
            highlightedIndex={highlightedIndex}
            dragX={dragX}
            dragY={dragY}
            isDarkMode={isDarkMode}
            primaryColor={colors.primary}
          />
        ))}
      </Animated.View>
    </View>
  );
}

function MenuItem({
  item,
  index,
  position,
  highlightedIndex,
  dragX,
  dragY,
  isDarkMode,
  primaryColor,
}: {
  item: RadialMenuItem;
  index: number;
  position: { x: number; y: number; angle: number };
  highlightedIndex: Animated.SharedValue<number>;
  dragX: Animated.SharedValue<number>;
  dragY: Animated.SharedValue<number>;
  isDarkMode: boolean;
  primaryColor: string;
}) {
  const { x: finalX, y: finalY } = position;

  const animatedStyle = useAnimatedStyle(() => {
    const isHighlighted = highlightedIndex.value === index;
    const dragDistance = Math.sqrt(dragX.value ** 2 + dragY.value ** 2);
    const hasDragged = dragDistance > HIGHLIGHT_THRESHOLD;

    // Subtle scale - snappy, not bouncy
    const targetScale = isHighlighted && hasDragged ? 1.12 : 1;
    const scale = withTiming(targetScale, { duration: 100 });

    // Clearer opacity states
    const targetOpacity = hasDragged ? (isHighlighted ? 1 : 0.5) : 0.85;
    const opacity = withTiming(targetOpacity, { duration: 80 });

    return {
      opacity,
      transform: [
        { translateX: finalX },
        { translateY: finalY },
        { scale },
      ],
    };
  });

  const itemBgStyle = useAnimatedStyle(() => {
    const isHighlighted = highlightedIndex.value === index;
    const dragDistance = Math.sqrt(dragX.value ** 2 + dragY.value ** 2);
    const hasDragged = dragDistance > HIGHLIGHT_THRESHOLD;

    // Keep it clean - white/frosted always, just slightly brighter when highlighted
    const backgroundColor = isHighlighted && hasDragged
      ? isDarkMode
        ? 'rgba(255, 255, 255, 0.25)' // Slightly brighter frosted
        : 'rgba(255, 255, 255, 1)' // Pure white
      : isDarkMode
      ? 'rgba(255, 255, 255, 0.15)' // Frosted glass
      : 'rgba(255, 255, 255, 0.95)'; // Near white

    return {
      backgroundColor: withTiming(backgroundColor, { duration: 80 }),
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const isHighlighted = highlightedIndex.value === index;
    const dragDistance = Math.sqrt(dragX.value ** 2 + dragY.value ** 2);
    const hasDragged = dragDistance > HIGHLIGHT_THRESHOLD;

    // Always visible, subtle highlight
    const targetOpacity = isHighlighted && hasDragged ? 1 : 0.75;

    return {
      opacity: withTiming(targetOpacity, { duration: 80 }),
    };
  });

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: MENU_RADIUS - ITEM_SIZE / 2,
          top: MENU_RADIUS - ITEM_SIZE / 2,
          width: ITEM_SIZE,
          height: ITEM_SIZE,
          alignItems: 'center',
          justifyContent: 'center',
        },
        animatedStyle,
      ]}
    >
      {/* Item Circle with Icon */}
      <Animated.View
        style={[
          {
            width: ITEM_SIZE,
            height: ITEM_SIZE,
            borderRadius: ITEM_SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: isDarkMode ? 0.3 : 0.15,
            shadowRadius: 6,
            elevation: 4,
            borderWidth: 1.5,
            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.05)',
          },
          itemBgStyle,
        ]}
      >
        <Text style={{ fontSize: 26, textAlign: 'center' }}>
          {item.icon}
        </Text>
      </Animated.View>

      {/* Always-visible compact label */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: ITEM_SIZE + 4,
            alignItems: 'center',
            justifyContent: 'center',
          },
          labelStyle,
        ]}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'white',
            letterSpacing: 0.2,
            textAlign: 'center',
            textShadowColor: 'rgba(0, 0, 0, 0.5)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
