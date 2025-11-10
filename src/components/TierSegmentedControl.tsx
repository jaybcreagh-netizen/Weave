import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, LayoutChangeEvent } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { tierColors, isTierAtCapacity } from '../lib/constants';

interface TierSegmentedControlProps {
  activeTier: 'inner' | 'close' | 'community';
  onTierChange: (tier: 'inner' | 'close' | 'community') => void;
  counts: {
    inner: number;
    close: number;
    community: number;
  };
}

type TierType = 'inner' | 'close' | 'community';

const TIERS: TierType[] = ['inner', 'close', 'community'];

const TIER_LABELS = {
  inner: 'Inner',
  close: 'Close',
  community: 'Community',
};

const TIER_COLOR_MAP = {
  inner: tierColors.InnerCircle,
  close: tierColors.CloseFriends,
  community: tierColors.Community,
};

const TIER_MAX = {
  inner: 5,
  close: 15,
  community: 50,
};

export function TierSegmentedControl({
  activeTier,
  onTierChange,
  counts,
}: TierSegmentedControlProps) {
  const { colors, isDarkMode } = useTheme();
  const [tabWidth, setTabWidth] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const indicatorPosition = useSharedValue(0);
  const indicatorWidth = useSharedValue(0);

  // Calculate the active tier index
  const activeIndex = TIERS.indexOf(activeTier);

  // Update indicator position when active tier changes
  useEffect(() => {
    if (tabWidth > 0) {
      const targetPosition = activeIndex * tabWidth;
      indicatorPosition.value = withTiming(targetPosition, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
      indicatorWidth.value = withTiming(tabWidth, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
    }
  }, [activeIndex, tabWidth]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width } = event.nativeEvent.layout;
    setContainerWidth(width);
    const calculatedTabWidth = (width - 4) / 3; // Subtract padding, divide by 3 tabs
    setTabWidth(calculatedTabWidth);

    // Set initial position without animation
    if (indicatorPosition.value === 0 && calculatedTabWidth > 0) {
      indicatorPosition.value = activeIndex * calculatedTabWidth;
      indicatorWidth.value = calculatedTabWidth;
    }
  };

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorPosition.value }],
    width: indicatorWidth.value,
  }));

  const handlePress = (tier: TierType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onTierChange(tier);
  };

  const containerBg = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)';
  const activeBg = isDarkMode ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.9)';
  const activeTextColor = isDarkMode ? '#1a1625' : '#3C3C3C';
  const inactiveTextColor = isDarkMode ? colors['muted-foreground'] : '#8A8A8A';

  return (
    <View
      onLayout={handleLayout}
      className="mx-4 mt-3 mb-3 h-[34px] rounded-weave-container p-0.5"
      style={{ backgroundColor: containerBg }}
    >
      {/* Sliding Active Indicator */}
      <Animated.View
        className="absolute h-[30px] rounded-lg"
        style={[
          indicatorStyle,
          {
            backgroundColor: activeBg,
            top: 2,
            left: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: isDarkMode ? 0.2 : 0.1,
            shadowRadius: 3,
            elevation: 2,
          },
        ]}
      />

      {/* Tab Segments */}
      <View className="flex-1 flex-row">
        {TIERS.map((tier, index) => {
          const isActive = tier === activeTier;
          const tierColor = TIER_COLOR_MAP[tier];
          const atCapacity = isTierAtCapacity(counts[tier], tier);
          const overCapacity = counts[tier] > TIER_MAX[tier];

          return (
            <Pressable
              key={tier}
              onPress={() => handlePress(tier)}
              className="flex-1 items-center justify-center flex-row gap-1.5"
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
              })}
            >
              {/* Tier color indicator dot - changes to warning color when at capacity */}
              <View
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: atCapacity ? (overCapacity ? '#EF4444' : '#F59E0B') : tierColor,
                  opacity: isActive ? 0.9 : 0.4,
                }}
              />
              <Text
                className="text-sm font-semibold"
                style={{
                  color: isActive ? activeTextColor : inactiveTextColor,
                  opacity: isActive ? 1 : 0.7,
                }}
              >
                {TIER_LABELS[tier]} ({counts[tier]}/{TIER_MAX[tier]})
              </Text>
              {/* Warning indicator when at/over capacity */}
              {atCapacity && (
                <Text style={{ fontSize: 10, opacity: isActive ? 0.7 : 0.4 }}>
                  {overCapacity ? '⚠️' : '⚡'}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
