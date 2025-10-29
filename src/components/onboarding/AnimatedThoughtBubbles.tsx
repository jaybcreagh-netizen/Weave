/// <reference types="nativewind/types" />
import React from 'react';
import { View, Text } from 'react-native';
import Animated, { 
  FadeInUp, 
  FadeOut,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence
} from 'react-native-reanimated';

interface AnimatedThoughtBubblesProps {
  phrases: string[];
}

export function AnimatedThoughtBubbles({ phrases }: AnimatedThoughtBubblesProps) {
  return (
    <View className="w-full items-center justify-center my-8">
      {phrases.map((phrase, index) => {
        return (
          <Animated.View
            key={index}
            entering={FadeInUp.delay(index * 600).duration(800).springify()}
            exiting={FadeOut.duration(400)}
            style={{ marginVertical: 8 }}
          >
            <FloatingBubble phrase={phrase} delay={index * 200} />
          </Animated.View>
        );
      })}
    </View>
  );
}

const FloatingBubble = ({ phrase, delay }: { phrase: string; delay: number }) => {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withRepeat(
          withSequence(
            withTiming(-10, { duration: 2000 }),
            withTiming(0, { duration: 2000 })
          ),
          -1, // Infinite repeat
          true
        ),
      },
    ],
  }));

  return (
    <Animated.View 
      style={animatedStyle}
      className="bg-gray-100 rounded-2xl py-3 px-4 shadow-md"
    >
      <Text className="text-base text-gray-600 italic">
        {phrase}
      </Text>
    </Animated.View>
  );
};