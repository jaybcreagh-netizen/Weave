import React from 'react';
import { View, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { HomeWidgetConfig, HomeWidgetProps } from './HomeWidgetBase';
import { useTheme } from '@/shared/hooks/useTheme';

export interface WidgetGridItem {
  id: string;
  component: React.ComponentType<HomeWidgetProps>;
  config: HomeWidgetConfig;
  position: number;
  visible: boolean;
  props?: HomeWidgetProps; // Additional props to pass to widget
}

interface HomeWidgetGridProps {
  widgets: WidgetGridItem[];
  refreshing?: boolean;
}

/**
 * Animated wrapper for individual widgets
 * Handles staggered fade-in animation on mount
 */
const AnimatedWidget: React.FC<{
  item: WidgetGridItem;
  index: number;
}> = ({ item, index }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  React.useEffect(() => {
    // Staggered animation: each widget delays by 80ms
    opacity.value = withDelay(index * 80, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(index * 80, withTiming(0, { duration: 400 }));
  }, [index]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const WidgetComponent = item.component;

  return (
    <Animated.View
      className={item.config.fullWidth ? "w-full" : "w-[48%]"}
      style={animatedStyle}
    >
      <WidgetComponent {...(item.props || {})} />
    </Animated.View>
  );
};

/**
 * HomeWidgetGrid
 *
 * Manages layout and rendering of dashboard widgets
 * Supports responsive grid with full-width and half-width widgets
 */
export const HomeWidgetGrid: React.FC<HomeWidgetGridProps> = ({
  widgets,
  refreshing = false,
}) => {
  const { layout } = useTheme();

  // Filter visible widgets and sort by position
  const visibleWidgets = widgets
    .filter(w => w.visible)
    .sort((a, b) => a.position - b.position);

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-5 pt-4 pb-8"
      showsVerticalScrollIndicator={false}
    >
      {/* Render widgets in a flexible row layout */}
      <View
        className="flex-row flex-wrap justify-between"
        style={{ rowGap: layout.cardGap }}
      >
        {visibleWidgets.map((item, index) => (
          <AnimatedWidget key={item.id} item={item} index={index} />
        ))}
      </View>
    </ScrollView>
  );
};

