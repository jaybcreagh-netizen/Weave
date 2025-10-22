/// <reference types="nativewind/types" />
import React from 'react';
import { View, Text } from 'react-native';

interface PrivacyPromiseProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function PrivacyPromise({ icon, title, description }: PrivacyPromiseProps) {
  return (
    <View className="w-full mb-6 bg-white/50 rounded-2xl p-5 border border-gray-100">
      <View className="flex-row items-start">
        <View className="w-12 h-12 bg-emerald-50 rounded-xl justify-center items-center mr-4 shrink-0">
          {icon}
        </View>
        
        <View className="flex-1">
          <Text className="text-lg font-bold text-gray-900 mb-1">{title}</Text>
          <Text className="text-base text-gray-600 leading-relaxed">{description}</Text>
        </View>
      </View>
    </View>
  );
}

// Usage:
// <PrivacyPromise
//   emoji="🔒"
//   title="Encrypted & Private"
//   description="Your data never leaves your device without encryption."
// />