import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, interpolate, withSpring, withTiming } from 'react-native-reanimated';
import { theme } from '../theme';

// Define the shape of a single menu item
export interface RadialMenuItem {
  id: string;
  icon: string;
}

// The props for our new component
interface MenuItemProps {
  item: RadialMenuItem;
  index: number;
  totalItems: number;
  radius: number;
  progress: Animated.SharedValue<number>;
  highlightedIndex: Animated.SharedValue<number>;
}

const ITEM_SIZE = 70;

const MENU_RADIUS = 100;

// Optimized menu item component
function MenuItem({
  item,
  index,
  highlightedIndex,
  menuScale
}: {
  item: RadialMenuItem;
  index: number;
  highlightedIndex: Animated.SharedValue<number>;
  menuScale: Animated.SharedValue<number>;
}) {
  const angle = (index / ACTIVITIES.length) * 2 * Math.PI - Math.PI / 2;
  const finalX = MENU_RADIUS * Math.cos(angle);
  const finalY = MENU_RADIUS * Math.sin(angle);

  const animatedStyle = useAnimatedStyle(() => {
    const isHighlighted = highlightedIndex.value === index;
    
    // Entry animation
    const x = finalX * menuScale.value;
    const y = finalY * menuScale.value;
    
    // Highlight scale - snappy, no spring
    const scale = withTiming(isHighlighted ? 1.15 : 1, { duration: 120 });
    const opacity = withTiming(isHighlighted ? 1 : 0.75, { duration: 120 });

    return {
      opacity,
      transform: [
        { translateX: MENU_RADIUS + x - ITEM_SIZE / 2 },
        { translateY: MENU_RADIUS + y - ITEM_SIZE / 2 },
        { scale },
      ],
    };
  });
  const labelAnimatedStyle = useAnimatedStyle(() => {
    'worklet';
    const isHighlighted = highlightedIndex.value === index;
    return {
      opacity: withTiming(isHighlighted ? 1 : 0, { duration: 200 }),
      transform: [
        { translateY: withSpring(isHighlighted ? 0 : 10, { damping: 10 }) }
      ],
    };
  });

  return (
    <Animated.View style={[styles.itemWrapper, animatedStyle]}>
      <View style={styles.itemContainer}>
        <Text style={styles.itemIcon}>{item.icon}</Text>
      </View>
      <Animated.View style={[styles.labelContainer, labelAnimatedStyle]}>
        <Text style={styles.itemLabel}>{item.id}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  itemWrapper: {
    position: 'absolute', // This is crucial for the stacking/centering layout
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContainer: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    borderRadius: ITEM_SIZE / 2,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 3,
    borderColor: theme.colors.primary,
  },
  itemIcon: {
    fontSize: 32,
  },
  labelContainer: {
    position: 'absolute',
    top: ITEM_SIZE + 8,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
  },
});