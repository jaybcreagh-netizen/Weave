/// <reference types="nativewind/types" />
import React from 'react';
import { View, Text } from 'react-native';

interface TierCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function TierCard({ icon, title, description }: TierCardProps) {
  return (
    <View 
      className="flex-row items-center bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-3"
    >
      <View className="w-14 h-14 rounded-full justify-center items-center mr-4 bg-gray-100">
        {icon}
      </View>
      
      <View className="flex-1">
        <Text className="text-lg font-bold text-gray-800 mb-1">{title}</Text>
        <Text className="text-base text-gray-600 leading-snug">{description}</Text>
      </View>
    </View>
  );
}