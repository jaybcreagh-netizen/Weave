/**
 * ArchetypeCarouselPicker Component
 *
 * Beautiful immersive carousel for archetype selection.
 * Educational design that helps users understand each archetype holistically.
 * 
 * Features:
 * - Full-width snap cards with large tarot icons
 * - Rich content: name, essence, description, traits, care style
 * - Smooth Reanimated animations
 * - Haptic feedback on page change
 * - NativeWind styling with design tokens
 */

import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  Pressable,
  Dimensions,
  Platform,
  ViewToken,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolation,
  FadeIn,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/shared/hooks/useTheme';
import { type Archetype } from '@/shared/types/common';
import { archetypeData, ARCHETYPE_GRADIENTS } from '@/shared/constants/constants';
import { Text } from '@/shared/ui/Text';
import { ArchetypeIcon } from './ArchetypeIcon';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;
const CARD_MARGIN = 24;

interface ArchetypeCarouselPickerProps {
  selectedArchetype: Archetype;
  onSelect: (archetype: Archetype) => void;
}

// All available archetypes (including Lovers)
const ARCHETYPES: Archetype[] = [
  'Sun',
  'Hermit',
  'Emperor',
  'Empress',
  'HighPriestess',
  'Fool',
  'Magician',
  'Lovers',
];

// Trait pill component
function TraitPill({ trait, gradient }: { trait: string; gradient: string[] }) {
  const { colors } = useTheme();

  return (
    <View
      className="px-3 py-1.5 rounded-full mr-2 mb-2"
      style={{ backgroundColor: gradient[0] + '20' }}
    >
      <Text
        variant="caption"
        weight="medium"
        style={{ color: gradient[0] }}
      >
        {trait}
      </Text>
    </View>
  );
}

// Individual archetype card
function ArchetypeCard({
  archetype,
  isSelected,
  onSelect,
  scrollX,
  index,
}: {
  archetype: Archetype;
  isSelected: boolean;
  onSelect: () => void;
  scrollX: Animated.SharedValue<number>;
  index: number;
}) {
  const { colors } = useTheme();
  const data = archetypeData[archetype];
  const gradient = ARCHETYPE_GRADIENTS[archetype] || ['#6b7280', '#4b5563'];

  // Card animation based on scroll position
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.9, 1, 0.9],
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.6, 1, 0.6],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }],
      opacity,
    };
  });

  // Border glow animation for selected state
  const borderStyle = useAnimatedStyle(() => {
    return {
      borderWidth: withSpring(isSelected ? 3 : 1),
      borderColor: isSelected ? gradient[0] : colors.border,
    };
  });

  if (!data) return null;

  return (
    <View
      style={{ width: SCREEN_WIDTH, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onSelect}
        >
          <Animated.View
            className="rounded-3xl overflow-hidden"
            style={[
              {
                width: CARD_WIDTH,
                backgroundColor: colors.card,
                shadowColor: isSelected ? gradient[0] : '#000',
                shadowOffset: { width: 0, height: isSelected ? 12 : 4 },
                shadowOpacity: isSelected ? 0.3 : 0.1,
                shadowRadius: isSelected ? 20 : 10,
                elevation: isSelected ? 12 : 4,
              },
              borderStyle,
            ]}
          >
            {/* Gradient background overlay */}
            <LinearGradient
              colors={[gradient[0] + (isSelected ? '30' : '15'), 'transparent']}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 200,
              }}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />

            {/* Tarot Icon Section */}
            <View className="items-center pt-8 pb-6">
              <View
                className="rounded-2xl items-center justify-center"
                style={{
                  width: 140,
                  height: 200,
                  backgroundColor: colors.background,
                  shadowColor: gradient[0],
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 12,
                  elevation: 4,
                }}
              >
                <ArchetypeIcon
                  archetype={archetype}
                  width={130}
                  height={190}
                  color={colors.foreground}
                />
              </View>
            </View>

            {/* Content Section */}
            <View className="px-6 pb-6">
              {/* Name */}
              <Text
                variant="h2"
                weight="bold"
                className="text-center mb-1"
                style={{ fontFamily: 'Lora_700Bold' }}
              >
                {data.name}
              </Text>

              {/* Essence */}
              <Text
                variant="body"
                weight="semibold"
                className="text-center mb-4 uppercase tracking-wider"
                style={{ color: gradient[0], fontSize: 13 }}
              >
                {data.essence}
              </Text>

              {/* Description */}
              <Text
                variant="body"
                className="text-center mb-5 leading-relaxed"
                style={{ color: colors['muted-foreground'] }}
              >
                {data.description}
              </Text>

              {/* Trait Pills */}
              <View className="flex-row flex-wrap justify-center mb-4">
                {data.traits.slice(0, 4).map((trait) => (
                  <TraitPill key={trait} trait={trait} gradient={gradient} />
                ))}
              </View>

              {/* Care Style */}
              <View
                className="rounded-xl py-3 px-4"
                style={{ backgroundColor: colors.background }}
              >
                <Text
                  variant="caption"
                  className="text-center"
                  style={{ color: colors['muted-foreground'] }}
                >
                  Connection Style
                </Text>
                <Text
                  variant="body"
                  weight="semibold"
                  className="text-center mt-1"
                  style={{ color: gradient[0] }}
                >
                  {data.careStyle}
                </Text>
              </View>
            </View>
          </Animated.View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// Pagination dot component
function PaginationDot({
  index,
  currentIndex,
  archetype,
}: {
  index: number;
  currentIndex: number;
  archetype: Archetype;
}) {
  const { colors } = useTheme();
  const isActive = index === currentIndex;
  const gradient = ARCHETYPE_GRADIENTS[archetype] || ['#6b7280', '#4b5563'];

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withSpring(isActive ? 24 : 8),
      backgroundColor: withTiming(isActive ? gradient[0] : colors.border),
    };
  });

  return (
    <Animated.View
      className="h-2 rounded-full mx-1"
      style={animatedStyle}
    />
  );
}

export function ArchetypeCarouselPicker({
  selectedArchetype,
  onSelect,
}: ArchetypeCarouselPickerProps) {
  const { colors } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useSharedValue(0);
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, ARCHETYPES.indexOf(selectedArchetype))
  );

  // Scroll to selected archetype on mount
  useEffect(() => {
    const newIndex = ARCHETYPES.indexOf(selectedArchetype);
    if (newIndex !== -1 && newIndex !== currentIndex) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: newIndex, animated: false });
        setCurrentIndex(newIndex);
      }, 100);
    }
  }, []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const newIndex = viewableItems[0].index;
        if (newIndex !== currentIndex) {
          setCurrentIndex(newIndex);
          if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }
        }
      }
    },
    [currentIndex]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleSelect = (archetype: Archetype) => {
    onSelect(archetype);
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  };

  return (
    <Animated.View entering={FadeIn.duration(300)} className="flex-1">
      {/* Helper text */}
      <Text
        variant="caption"
        className="text-center mb-4 px-6"
        style={{ color: colors['muted-foreground'] }}
      >
        Swipe to explore • Tap to select
      </Text>

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={ARCHETYPES}
        renderItem={({ item, index }) => (
          <ArchetypeCard
            archetype={item}
            isSelected={item === selectedArchetype}
            onSelect={() => handleSelect(item)}
            scrollX={scrollX}
            index={index}
          />
        )}
        keyExtractor={(item) => item}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => {
          scrollX.value = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="center"
        contentContainerStyle={{ paddingVertical: 8 }}
      />

      {/* Pagination */}
      <View className="flex-row justify-center items-center mt-6 mb-4">
        {ARCHETYPES.map((archetype, index) => (
          <PaginationDot
            key={archetype}
            index={index}
            currentIndex={currentIndex}
            archetype={archetype}
          />
        ))}
      </View>
    </Animated.View>
  );
}
