/**
 * PatternsTabContent
 * Displays algorithm-detected patterns from battery and weave data
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AlertCircle } from 'lucide-react-native';
import { detectPatterns, Pattern } from '../../lib/pattern-detection';

interface PatternsTabContentProps {}

export function PatternsTabContent({}: PatternsTabContentProps) {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    setIsLoading(true);
    try {
      const detected = await detectPatterns();
      setPatterns(detected);
    } catch (error) {
      console.error('Error detecting patterns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getConfidenceBadgeColor = (confidence: Pattern['confidence']) => {
    switch (confidence) {
      case 'high':
        return { bg: '#10B98120', text: '#10B981' }; // Green
      case 'medium':
        return { bg: '#F59E0B20', text: '#F59E0B' }; // Orange
      case 'low':
        return { bg: '#8A8F9E20', text: '#8A8F9E' }; // Gray
    }
  };

  const getTypeLabel = (type: Pattern['type']) => {
    switch (type) {
      case 'cyclical':
        return 'Cyclical';
      case 'correlation':
        return 'Correlation';
      case 'best_days':
        return 'Best Days';
      case 'consistency':
        return 'Consistency';
      case 'trend':
        return 'Trend';
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <ActivityIndicator size="large" color="#F5F1E8" />
        <Text
          className="text-sm mt-4 text-center"
          style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}
        >
          Analyzing your patterns...
        </Text>
      </View>
    );
  }

  if (patterns.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-6xl mb-4">📊</Text>
        <Text
          className="text-lg font-semibold text-center mb-2"
          style={{ color: '#F5F1E8', fontFamily: 'Lora_600SemiBold' }}
        >
          Not Enough Data Yet
        </Text>
        <Text
          className="text-sm text-center leading-5"
          style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}
        >
          Keep checking in your battery levels! We need at least 2 weeks of data to detect meaningful patterns.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 px-5 py-4"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 24 }}
    >
      {/* Header */}
      <View className="mb-6">
        <Text
          className="text-xl font-bold mb-1"
          style={{ color: '#F5F1E8', fontFamily: 'Lora_700Bold' }}
        >
          Your Energy Patterns
        </Text>
        <Text
          className="text-sm leading-5"
          style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}
        >
          Algorithm-detected insights from your battery and connection history
        </Text>
      </View>

      {/* Pattern Cards */}
      {patterns.map((pattern, index) => {
        const confidenceColors = getConfidenceBadgeColor(pattern.confidence);

        return (
          <Animated.View
            key={pattern.id}
            entering={FadeInDown.delay(index * 100)}
            className="mb-4 p-4 rounded-2xl"
            style={{ backgroundColor: '#2A2E3F' }}
          >
            {/* Header Row: Icon, Title, Type Badge */}
            <View className="flex-row items-start justify-between mb-3">
              <View className="flex-row items-center gap-2 flex-1">
                <Text className="text-3xl">{pattern.icon}</Text>
                <View className="flex-1">
                  <Text
                    className="text-base font-bold mb-0.5"
                    style={{ color: '#F5F1E8', fontFamily: 'Lora_700Bold' }}
                  >
                    {pattern.title}
                  </Text>
                  <Text
                    className="text-[10px] font-medium uppercase tracking-wider"
                    style={{ color: '#8A8F9E', fontFamily: 'Inter_500Medium' }}
                  >
                    {getTypeLabel(pattern.type)}
                  </Text>
                </View>
              </View>

              {/* Confidence Badge */}
              <View
                className="px-2 py-1 rounded-full"
                style={{ backgroundColor: confidenceColors.bg }}
              >
                <Text
                  className="text-[10px] font-semibold uppercase"
                  style={{ color: confidenceColors.text, fontFamily: 'Inter_600SemiBold' }}
                >
                  {pattern.confidence}
                </Text>
              </View>
            </View>

            {/* Description */}
            <View className="mb-3">
              <Text
                className="text-sm leading-5"
                style={{ color: '#C5CAD3', fontFamily: 'Inter_400Regular' }}
              >
                {pattern.description}
              </Text>
            </View>

            {/* Insight Box */}
            <View
              className="p-3 rounded-xl flex-row items-start gap-2"
              style={{ backgroundColor: '#1a1d2e' }}
            >
              <AlertCircle size={16} color="#8A8F9E" style={{ marginTop: 2 }} />
              <Text
                className="text-xs leading-5 flex-1 italic"
                style={{ color: '#F5F1E8', fontFamily: 'Inter_400Regular' }}
              >
                {pattern.insight}
              </Text>
            </View>
          </Animated.View>
        );
      })}

      {/* Footer Note */}
      <View className="mt-4 p-4 rounded-xl" style={{ backgroundColor: '#2A2E3F' }}>
        <Text
          className="text-xs leading-5 text-center"
          style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}
        >
          Patterns update as you check in your battery and log weaves. These insights are probabilistic, not prescriptive—use them as gentle guides, not rules.
        </Text>
      </View>
    </ScrollView>
  );
}
