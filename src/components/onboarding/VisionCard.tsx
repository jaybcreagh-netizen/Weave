/// <reference types="nativewind/types" />
import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

interface VisionCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function VisionCard({ icon, title, description }: VisionCardProps) {
  const cardWidth = width - 48;

  return (
    <Animated.View 
      entering={FadeIn.duration(600)}
      style={{ width: cardWidth }} 
      className="items-center justify-center px-6 py-8"
    >
      {/* Icon container with subtle glow */}
      <View 
        className="w-20 h-20 rounded-2xl justify-center items-center mb-6 shadow-sm bg-primary/10"
      >
        {icon}
      </View>
      
      <Text className="text-2xl font-bold text-center text-gray-800 mb-3">
        {title}
      </Text>
      
      <Text className="text-lg text-gray-600 text-center leading-relaxed">
        {description}
      </Text>
    </Animated.View>
  );
}

// Usage example:
// <VisionCard
//   icon="☕"
//   title="You remember the little things"
//   description="Sarah's new job. Alex's book recommendation..."
//   accentColor="#10b981" // emerald
// />