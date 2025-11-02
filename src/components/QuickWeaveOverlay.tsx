import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, interpolate, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';

import { useUIStore } from '../stores/uiStore';
import { useFriends } from '../hooks/useFriends';
import { useCardGesture } from '../context/CardGestureContext';
import { useTheme } from '../hooks/useTheme';
import { type InteractionCategory } from './types';

const { width, height } = Dimensions.get('window');
const MENU_RADIUS = 100;
const ITEM_SIZE = 64;
const HIGHLIGHT_THRESHOLD = 30;
const SELECTION_THRESHOLD = 45;

interface RadialMenuItem {
  id: InteractionCategory;
  icon: string;
  label: string;
}

const ACTIVITIES: RadialMenuItem[] = [
  { id: 'meal-drink', icon: '🍽️', label: 'Meal' },
  { id: 'text-call', icon: '📞', label: 'Call' },
  { id: 'hangout', icon: '👥', label: 'Hangout' },
  { id: 'deep-talk', icon: '💭', label: 'Deep Talk' },
  { id: 'activity-hobby', icon: '🎨', label: 'Activity' },
  { id: 'voice-note', icon: '🎤', label: 'Voice Note' },
];

const itemPositions = ACTIVITIES.map((_, i) => {
  const angle = (i / ACTIVITIES.length) * 2 * Math.PI - Math.PI / 2;
  return {
    x: MENU_RADIUS * Math.cos(angle),
    y: MENU_RADIUS * Math.sin(angle),
    angle,
  };
});

export function QuickWeaveOverlay() {
  const {
    quickWeaveFriendId,
    quickWeaveCenterPoint,
    isQuickWeaveClosing,
    _finishClosingQuickWeave,
  } = useUIStore();
  const allFriends = useFriends();
  const friend = allFriends.find(f => f.id === quickWeaveFriendId);
  const { dragX, dragY, highlightedIndex } = useCardGesture();
  const { colors, isDarkMode } = useTheme();

  const overlayOpacity = useSharedValue(0);
  const menuScale = useSharedValue(0.3);

  // Entrance Animation
  useEffect(() => {
    // Shortened blur-in duration for a crisper feel.
    overlayOpacity.value = withTiming(1, { duration: 20 });
    // Significantly increased stiffness for a very fast, snappy pop-in animation.
    menuScale.value = withSpring(1, { damping: 100, stiffness: 600 });
  }, []);

  // Exit Animation
  useEffect(() => {
    if (isQuickWeaveClosing) {
      // Shortened exit duration for a faster dismiss.
      menuScale.value = withTiming(0, { duration: 70 });
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

  // Early return AFTER all hooks have been called
  if (!quickWeaveCenterPoint || !quickWeaveFriendId || !friend) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={overlayStyle}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View
        style={[
          styles.menuContainer,
          {
            left: quickWeaveCenterPoint.x - MENU_RADIUS,
            top: quickWeaveCenterPoint.y - MENU_RADIUS,
          },
          menuContainerStyle,
        ]}
      >
        {/* Header label above menu */}
        <View style={styles.headerLabel}>
          <Text style={[styles.headerLabelText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : colors.foreground }]}>
            Log a weave
          </Text>
          <Text style={[styles.headerFriendName, { color: isDarkMode ? 'white' : colors.foreground }]}>
            {friend.name}
          </Text>
        </View>

        {ACTIVITIES.map((item, index) => (
          <MenuItem
            key={item.id}
            item={item}
            index={index}
            highlightedIndex={highlightedIndex}
            dragX={dragX}
            dragY={dragY}
          />
        ))}
      </Animated.View>
    </View>
  );
}

function MenuItem({
  item,
  index,
  highlightedIndex,
  dragX,
  dragY,
}: {
  item: RadialMenuItem;
  index: number;
  highlightedIndex: Animated.SharedValue<number>;
  dragX: Animated.SharedValue<number>;
  dragY: Animated.SharedValue<number>;
}) {
  const {x: finalX, y: finalY} = itemPositions[index];

  const animatedStyle = useAnimatedStyle(() => {
    const isHighlighted = highlightedIndex.value === index;
    const dragDistance = Math.sqrt(dragX.value**2 + dragY.value**2);
    const hasDragged = dragDistance > HIGHLIGHT_THRESHOLD;

    const targetScale = isHighlighted && hasDragged ? 1.08 : 1;
    // Reduced bounciness with higher damping for smoother feel
    const scale = withSpring(targetScale, { damping: 15, stiffness: 400 });

    const targetOpacity = hasDragged ? (isHighlighted ? 1 : 0.75) : 0.6;
    const opacity = withTiming(targetOpacity, { duration: 50 });

    return {
      opacity,
      transform: [
        { translateX: finalX },
        { translateY: finalY },
        { scale },
      ],
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const isHighlighted = highlightedIndex.value === index;
    const dragDistance = Math.sqrt(dragX.value**2 + dragY.value**2);
    const hasDragged = dragDistance > SELECTION_THRESHOLD;
    const shouldShow = isHighlighted && hasDragged;

    return {
      opacity: withTiming(shouldShow ? 1 : 0, { duration: 100 }),
      transform: [
        { translateY: withTiming(shouldShow ? 0 : 8, { duration: 100 }) },
        { scale: withTiming(shouldShow ? 1 : 0.9, { duration: 100 }) }
      ],
    };
  });

  return (
    <Animated.View style={[styles.itemWrapper, animatedStyle]}>
      <View style={styles.itemCircle}>
        <Text style={styles.itemIcon}>{item.icon}</Text>
      </View>
      <Animated.View style={[styles.labelContainer, labelStyle]}>
        <View style={styles.labelInner}>
          <Text style={styles.labelText} numberOfLines={1}>{item.label}</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 15, 25, 0.65)',
  },
  menuContainer: {
    position: 'absolute',
    width: MENU_RADIUS * 2,
    height: MENU_RADIUS * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    position: 'absolute',
    top: -MENU_RADIUS - 15,
    alignItems: 'center',
    width: 200,
  },
  headerLabelText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerFriendName: {
    fontSize: 24,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
  },
  itemWrapper: {
    position: 'absolute',
    left: MENU_RADIUS - ITEM_SIZE / 2,  // Center the item at the menu center
    top: MENU_RADIUS - ITEM_SIZE / 2,
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemCircle: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: ITEM_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  itemIcon: {
    fontSize: 30,
    textAlign: 'center',
  },
  labelContainer: {
    position: 'absolute',
    top: ITEM_SIZE + 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
  },
  labelInner: {
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3C3C3C',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});