/// <reference types="nativewind/types" />
import React from 'react';
import { View, Text } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay
} from 'react-native-reanimated';

interface AnimatedThoughtBubblesProps {
  phrases: string[];
}

/**
 * AnimatedThoughtBubbles - Staggered diagonal layout with floating animation
 * Creates a cascading effect from top-left to bottom-right
 */
export function AnimatedThoughtBubbles({ phrases }: AnimatedThoughtBubblesProps) {
  return (
    <View className="w-full items-center justify-center my-8 px-4">
      {phrases.map((phrase, index) => {
        // Stagger positioning: diagonal cascade
        const alignment = index % 2 === 0 ? 'flex-start' : 'flex-end';
        const marginOffset = index * 8; // Slight vertical offset for cascade effect

        return (
          <Animated.View
            key={index}
            entering={FadeInUp.delay(index * 400).duration(800).springify()}
            exiting={FadeOut.duration(400)}
            style={{
              width: '100%',
              alignItems: alignment,
              marginTop: marginOffset,
              marginBottom: 8,
            }}
          >
            <FloatingBubble phrase={phrase} delay={index * 200} index={index} />
          </Animated.View>
        );
      })}
    </View>
  );
}

const FloatingBubble = ({ phrase, delay, index }: { phrase: string; delay: number; index: number }) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withDelay(
          delay,
          withRepeat(
            withSequence(
              withTiming(-8, { duration: 2000 + index * 200 }), // Vary duration per bubble
              withTiming(0, { duration: 2000 + index * 200 })
            ),
            -1, // Infinite repeat
            true
          )
        ),
      },
    ],
  }));

  return (
    <Animated.View
      style={animatedStyle}
      className="bg-card rounded-2xl py-3 px-5 shadow-md border border-border"
    >
      <Text className="text-base text-muted-foreground italic font-inter-regular">
        {phrase}
      </Text>
    </Animated.View>
  );
};
