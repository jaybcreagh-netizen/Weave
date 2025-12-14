import React, { useEffect } from 'react';
import { View, Text, Platform } from 'react-native';
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
import {
  Phone,
  Utensils,
  Users,
  MessageCircle,
  Palette,
  Mic,
  PartyPopper,
  HeartHandshake,
  Star,
  HelpCircle,
  Moon,
  Heart,
  Dumbbell,
  Laptop,
  Plane
} from 'lucide-react-native';

import { useUIStore } from '@/shared/stores/uiStore';
import { useCardGesture } from '@/shared/context/CardGestureContext';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { InteractionCategory } from '@/shared/types/legacy-types';

// Compact sizing for sleeker feel
const MENU_RADIUS = 88; // Increased from 75px (was 100px originally)
const ITEM_SIZE = 50;
const CENTER_SIZE = 44;
const HIGHLIGHT_THRESHOLD = 25;
const SELECTION_THRESHOLD = 40;

interface RadialMenuItem {
  id: InteractionCategory;
  icon: React.ElementType;
  label: string;
}

// Category metadata mapping
const CATEGORY_METADATA: Record<InteractionCategory, { icon: React.ElementType; label: string }> = {
  'text-call': { icon: Phone, label: 'Call' },
  'meal-drink': { icon: Utensils, label: 'Meal' },
  'hangout': { icon: Users, label: 'Hang' },
  'deep-talk': { icon: MessageCircle, label: 'Talk' },
  'activity-hobby': { icon: Palette, label: 'Do' },
  'voice-note': { icon: Mic, label: 'Voice' },
  'event-party': { icon: PartyPopper, label: 'Event' },
  'favor-support': { icon: HeartHandshake, label: 'Help' },
  'celebration': { icon: Star, label: 'Celebrate' },
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
  const [allFriends, setAllFriends] = React.useState<FriendModel[]>([]);
  const friend = allFriends.find(f => f.id === quickWeaveFriendId);
  const { dragX, dragY, highlightedIndex } = useCardGesture();
  const { colors, isDarkMode } = useTheme();

  useEffect(() => {
    const subscription = database
      .get<FriendModel>('friends')
      .query(Q.sortBy('created_at', Q.desc))
      .observe()
      .subscribe(setAllFriends);

    return () => subscription.unsubscribe();
  }, []);

  const overlayOpacity = useSharedValue(0);
  const menuScale = useSharedValue(0.3);
  const centerPulse = useSharedValue(1);

  // Entrance Animation - Fast and snappy
  useEffect(() => {
    if (quickWeaveFriendId) {
      overlayOpacity.value = withTiming(1, { duration: 200 });
      menuScale.value = withSpring(1, { damping: 12, stiffness: 100 });
    } else if (!isQuickWeaveClosing) {
      overlayOpacity.value = 0;
      menuScale.value = 0.8;
    }
  }, [quickWeaveFriendId, isQuickWeaveClosing]);

  // Exit Animation - Fast dismiss
  useEffect(() => {
    if (isQuickWeaveClosing) {
      menuScale.value = withTiming(0.3, { duration: 60 });
      overlayOpacity.value = withTiming(0, { duration: 80 }, (finished) => {
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
    icon: CATEGORY_METADATA[category]?.icon || HelpCircle,
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
              // Softened center circle
              backgroundColor: isDarkMode ? 'rgba(40, 40, 40, 0.6)' : 'rgba(255, 255, 255, 0.6)',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'absolute',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
              borderWidth: 1,
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
              overflow: 'hidden', // For BlurView if we wanted it inside, but background color is enough for "soft"
            },
            centerStyle,
          ]}
        >
          {/* Optional: Add BlurView inside for extra softness if supported */}
          {Platform.OS === 'ios' && (
            <BlurView
              intensity={20}
              tint={isDarkMode ? 'dark' : 'light'}
              style={{ position: 'absolute', width: '100%', height: '100%' }}
            />
          )}
          <Text
            style={{
              fontSize: 18,
              fontWeight: '700',
              color: isDarkMode ? 'white' : colors.foreground, // Adapted to theme
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
  const IconComponent = item.icon;

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
        <IconComponent
          size={24}
          color={primaryColor}
          strokeWidth={2}
        />
      </Animated.View>

      {/* Label with Backdrop Blur */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: ITEM_SIZE + 6,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            borderRadius: 8,
          },
          labelStyle,
        ]}
      >
        <BlurView
          intensity={isDarkMode ? 30 : 20}
          tint={isDarkMode ? 'dark' : 'light'}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backgroundColor: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)',
          }}
        />
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.95)' : 'rgba(0, 0, 0, 0.8)',
            letterSpacing: 0.2,
            textAlign: 'center',
            paddingHorizontal: 8,
            paddingVertical: 2,
          }}
          numberOfLines={1}
        >
          {item.label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
