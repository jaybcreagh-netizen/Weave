import React, { useState } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  interpolate,
  withSpring,
  useDerivedValue,
  useAnimatedReaction,
  type SharedValue,
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
} from 'lucide-react-native';

import { useQuickWeave } from '@/modules/interactions/hooks/useQuickWeave';
import { useUIStore } from '@/shared/stores/uiStore';
import { useCardGesture } from '@/shared/context/CardGestureContext';
import { useTheme } from '@/shared/hooks/useTheme';
import { InteractionCategory } from '@/shared/types/legacy-types';
import { CachedImage } from '@/shared/ui/CachedImage';

// Compact sizing for sleeker feel
const MENU_RADIUS = 88;
const ITEM_SIZE = 50;
const CENTER_SIZE = 44;
const HIGHLIGHT_THRESHOLD = 25;

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
  const quickWeaveActivities = useUIStore(state => state.quickWeaveActivities);
  const isInteractive = useUIStore(state => state.isQuickWeaveInteractive);

  // We still use these global stores as fallback/logic notifiers, but visual drive is purely UI thread
  const {
    dragX,
    dragY,
    highlightedIndex,
    overlayCenter,
    isLongPressActive,
    cardMetadata,
    activeCardId,
    forceClose,
  } = useCardGesture();

  const { handleInteractionSelection } = useQuickWeave(); // Need this for tap handling

  const { colors, isDarkMode } = useTheme();

  // Re-render tracking removed for production performance

  // Use derived value for opacity and scale based on isLongPressActive
  // This ensures instant response on the UI thread without waiting for React renders
  const menuScale = useDerivedValue(() => {
    return isLongPressActive.value
      ? withSpring(1, { damping: 40, stiffness: 300 })
      : withTiming(0.3, { duration: 150 });
  });

  const overlayOpacity = useDerivedValue(() => {
    return isLongPressActive.value
      ? withTiming(1, { duration: 100 })
      : withTiming(0, { duration: 150 });
  });

  // Calculate dynamic data
  const orderedCategories = quickWeaveActivities.length > 0
    ? quickWeaveActivities.slice(0, 6)
    : DEFAULT_ACTIVITIES;

  const ACTIVITIES: RadialMenuItem[] = orderedCategories.map(category => ({
    id: category,
    icon: CATEGORY_METADATA[category]?.icon || HelpCircle,
    label: CATEGORY_METADATA[category]?.label || category,
  }));

  const itemPositions = ACTIVITIES.map((_, i) => {
    const angle = (i / ACTIVITIES.length) * 2 * Math.PI - Math.PI / 2;
    return {
      x: MENU_RADIUS * Math.cos(angle),
      y: MENU_RADIUS * Math.sin(angle),
      angle,
    };
  });

  // Styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
    // Hide completely when closed to let touches pass through
    display: overlayOpacity.value === 0 ? 'none' : 'flex',
  }));

  const menuContainerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(menuScale.value, [0.3, 1], [0, 1]),
    transform: [{ scale: menuScale.value }],
    left: overlayCenter.value.x - MENU_RADIUS,
    top: overlayCenter.value.y - MENU_RADIUS,
  }));

  const handleItemPress = (index: number) => {
    if (!activeCardId.value) return;
    const friendId = activeCardId.value;

    // Trigger selection
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    handleInteractionSelection(index, friendId);

    // Force close gesture state
    forceClose();
  };

  const handleBackdropPress = () => {
    forceClose();
  };

  return (
    <Animated.View
      className="absolute inset-0 z-50 pointer-events-none"
      style={containerStyle}
      pointerEvents={isInteractive ? 'box-none' : 'none'}
    >
      {/* Backdrop for click mode */}
      {isInteractive && (
        <React.Fragment>
          <View
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onTouchEnd={(e) => {
              // Simple touch handling for backdrop
              e.stopPropagation();
              handleBackdropPress();
            }}
          />
          {/* Blur is already there, but we need to ensure it doesn't block if we put something over it */}
        </React.Fragment>
      )}

      <View className="absolute inset-0" pointerEvents="none">
        <BlurView
          intensity={isDarkMode ? 25 : 15}
          tint={isDarkMode ? 'dark' : 'light'}
          style={{ flex: 1 }}
        />
      </View>

      <Animated.View
        style={[
          {
            position: 'absolute',
            width: MENU_RADIUS * 2,
            height: MENU_RADIUS * 2,
            alignItems: 'center',
            justifyContent: 'center',
          },
          menuContainerStyle,
        ]}
        pointerEvents={isInteractive ? 'box-none' : 'none'}
      >
        {/* Center Circle */}
        <View
          style={{
            width: CENTER_SIZE,
            height: CENTER_SIZE,
            borderRadius: CENTER_SIZE / 2,
            backgroundColor: isDarkMode ? '#282828' : '#FFFFFF',
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
          }}
        >
          <InitialDisplay
            activeCardId={activeCardId}
            metadata={cardMetadata}
            isDarkMode={isDarkMode}
            colors={colors}
          />
        </View>

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
            onPress={isInteractive ? () => handleItemPress(index) : undefined}
          />
        ))}
      </Animated.View>
    </Animated.View>
  );
}

// Separate component to handle the Reanimated text logic cleanly
// Using useAnimatedReaction instead of useDerivedValue to avoid excessive re-renders
const InitialDisplay = React.memo(function InitialDisplay({ activeCardId, metadata, isDarkMode, colors }: any) {
  const [initial, setInitial] = useState('•');
  const [avatar, setAvatar] = useState<string | null>(null);

  // Only update state when the value actually changes
  useAnimatedReaction(
    () => {
      const id = activeCardId.value;
      return (id && metadata.value[id])
        ? { initial: metadata.value[id].initial, avatar: metadata.value[id].avatar }
        : { initial: '•', avatar: null };
    },
    (currentValue, previousValue) => {
      if (!previousValue ||
        currentValue.initial !== previousValue.initial ||
        currentValue.avatar !== previousValue.avatar) {
        runOnJS(setInitial)(currentValue.initial);
        runOnJS(setAvatar)(currentValue.avatar ?? null);
      }
    },
    []
  );

  if (avatar && avatar.trim().length > 0) {
    return (
      <View style={{ width: '100%', height: '100%', borderRadius: 999, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <CachedImage
          source={{ uri: avatar }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          fallbackIcon={
            <View style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? '#282828' : '#FFFFFF' }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '700',
                  color: isDarkMode ? 'white' : colors.foreground,
                  fontFamily: 'Lora_700Bold',
                }}
              >
                {initial}
              </Text>
            </View>
          }
        />
        {/* Dark overlay for better contrast against white icons if needed */}
        <View style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: isDarkMode ? 'rgba(0,0,0,0.1)' : 'transparent',
          borderRadius: 999
        }} />
      </View>
    );
  }

  return (
    <Text
      style={{
        fontSize: 18,
        fontWeight: '700',
        color: isDarkMode ? 'white' : colors.foreground,
        fontFamily: 'Lora_700Bold',
      }}
    >
      {initial}
    </Text>
  );
});

function MenuItem({
  item,
  index,
  position,
  highlightedIndex,
  dragX,
  dragY,
  isDarkMode,
  primaryColor,
  onPress,
}: {
  item: RadialMenuItem;
  index: number;
  position: { x: number; y: number; angle: number };
  highlightedIndex: SharedValue<number>;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  isDarkMode: boolean;
  primaryColor: string;
  onPress?: () => void;
}) {
  const { x: finalX, y: finalY } = position;
  const IconComponent = item.icon;

  const animatedStyle = useAnimatedStyle(() => {
    const isHighlighted = highlightedIndex.value === index;
    const dragDistance = Math.sqrt(dragX.value ** 2 + dragY.value ** 2);
    const hasDragged = dragDistance > HIGHLIGHT_THRESHOLD;

    const targetScale = isHighlighted && hasDragged ? 1.12 : 1;
    const scale = withTiming(targetScale, { duration: 100 });

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

    // Use solid colors for efficient shadow calculation
    const backgroundColor = isHighlighted && hasDragged
      ? isDarkMode
        ? '#4A4A4A'  // Solid equivalent of rgba(255, 255, 255, 0.25) on dark bg
        : '#FFFFFF'
      : isDarkMode
        ? '#3A3A3A'  // Solid equivalent of rgba(255, 255, 255, 0.15) on dark bg
        : '#F5F5F5'; // Solid equivalent of rgba(255, 255, 255, 0.95)

    return {
      backgroundColor: withTiming(backgroundColor, { duration: 80 }),
    };
  });

  const labelStyle = useAnimatedStyle(() => {
    const isHighlighted = highlightedIndex.value === index;
    const dragDistance = Math.sqrt(dragX.value ** 2 + dragY.value ** 2);
    const hasDragged = dragDistance > HIGHLIGHT_THRESHOLD;

    const targetOpacity = isHighlighted && hasDragged ? 1 : 0.75;

    return {
      opacity: withTiming(targetOpacity, { duration: 80 }),
    };
  });

  const Content = (
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

  if (onPress) {
    // We wrap content in a view that handles the press.
    // Since content positions itself absolutely, we need to handle that carefully.
    // Actually, Content uses absolute positioning relative to parent.
    // If we wrap it, the wrapper needs to be absolute?
    // Better: Make the wrapper absolute and put content inside.
    return (
      <View
        style={{
          position: 'absolute',
          left: MENU_RADIUS - ITEM_SIZE / 2,
          top: MENU_RADIUS - ITEM_SIZE / 2,
          width: ITEM_SIZE,
          height: ITEM_SIZE,
          zIndex: 100 // Ensure it sits on top for touches
        }}
        onTouchEnd={(e) => {
          e.stopPropagation();
          onPress();
        }}
      >
        {/* 
               We need to adjust the content's positioning because we just moved the 'absolute' logic 
               to the wrapper. The original Content had:
               left: MENU_RADIUS - ITEM_SIZE / 2 ...
               
               If we keep Content as is, it will be absolute INSIDE this absolute wrapper.
               So we should reset left/top in Content?
               
               Actually, MenuItem renders an Animated.View with style including:
               transform: [translateX: finalX, translateY: finalY]
               
               This translation moves it from the center origin (MENU_RADIUS, MENU_RADIUS) to the target ring.
               
               Wait, the original code:
               left: MENU_RADIUS - ITEM_SIZE / 2,
               top: MENU_RADIUS - ITEM_SIZE / 2,
               
               This places the item at the CENTER of the menu container.
               Then `transform` moves it out by `finalX`/`finalY`.
               
               If I wrap it, I should just make the wrapper have the hit slop or be large enough?
               Or simply attach the touch handler to the Animated.View?
               
               Animated.View from Reanimated doesn't always support onPress directly if it's just a View.
               But it supports `onTouchEnd`.
             */
        }
        {/* 
                Actually, simpler approach:
                Pass `onTouchEnd` to the Animated.View directly if I can.
                But `MenuItem` returns `Animated.View`.
             */}
        <Animated.View
          style={[
            {
              width: ITEM_SIZE,
              height: ITEM_SIZE,
              alignItems: 'center',
              justifyContent: 'center',
            },
            animatedStyle,
          ]}
        >
          <View onTouchEnd={(e) => { e.stopPropagation(); onPress(); }}>
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
          </View>

          {/* Label (separately positioned) */}
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
      </View>
    );
  }

  return Content;
}
