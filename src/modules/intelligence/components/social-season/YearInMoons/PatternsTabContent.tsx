/**
 * PatternsTabContent
 * Displays algorithm-detected patterns from battery and weave data
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AlertCircle, Calendar, Zap, Sparkles, Star, Scale, Activity, TrendingUp, TrendingDown, ArrowRight, Gem, Brain, Users } from 'lucide-react-native';
import { detectPatterns, getPatternDataStats, Pattern } from '@/modules/insights';
import { useTheme } from '@/shared/hooks/useTheme';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface PatternsTabContentProps { }

const ICON_MAP: Record<string, React.ElementType> = {
  'calendar': Calendar,
  'zap': Zap,
  'sparkles': Sparkles,
  'star': Star,
  'scale': Scale,
  'activity': Activity,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'arrow-right': ArrowRight,
  'gem': Gem,
  'brain': Brain,
  'users': Users,
};

export function PatternsTabContent({ }: PatternsTabContentProps) {
  const { isDarkMode, tokens } = useTheme();
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [dataStats, setDataStats] = useState<{ batteryDays: number; weaveCount: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ... existing useEffect and helpers ...

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    setIsLoading(true);
    try {
      const [detected, stats] = await Promise.all([
        detectPatterns(),
        getPatternDataStats()
      ]);
      setPatterns(detected);
      setDataStats(stats);
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

  const getPatternIcon = (iconKey: string) => {
    const IconComponent = ICON_MAP[iconKey];
    if (IconComponent) {
      return <IconComponent size={32} color={isDarkMode ? '#F5F1E8' : '#2D3142'} />;
    }
    return <Text className="text-3xl">{iconKey}</Text>;
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
      default:
        // Handle newer types if needed or return capitalized
        return type.charAt(0).toUpperCase() + type.slice(1).replace('_', ' ');
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <ActivityIndicator size="large" color={isDarkMode ? '#F5F1E8' : '#6366F1'} />
        <Text
          className="text-sm mt-4 text-center"
          style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
        >
          Analyzing your patterns...
        </Text>
      </View>
    );
  }

  if (patterns.length === 0) {
    const hasEnoughData = dataStats && dataStats.batteryDays >= 14;

    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-6xl mb-4">{hasEnoughData ? '✨' : '📊'}</Text>
        <Text
          className="text-lg font-semibold text-center mb-2"
          style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_600SemiBold' }}
        >
          {hasEnoughData ? 'No Strong Patterns Yet' : 'Not Enough Data Yet'}
        </Text>
        <Text
          className="text-sm text-center leading-5"
          style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
        >
          {hasEnoughData
            ? "Your rhythm is unique! We haven't detected any strong statistical patterns yet, but keep logging to help us find deeper insights."
            : "Keep checking in your battery levels! We need at least 2 weeks of data to detect meaningful patterns."
          }
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 px-5 py-4"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Header */}
      <View className="mb-6">
        <Text
          className="text-xl font-bold mb-1"
          style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
        >
          Your Energy Patterns
        </Text>
        <Text
          className="text-sm leading-5"
          style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
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
            style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFFFFF' }}
          >
            {/* Header Row: Icon, Title, Type Badge */}
            <View className="flex-row items-start justify-between mb-3">
              <View className="flex-row items-center gap-3 flex-1">
                {getPatternIcon(pattern.icon)}
                <View className="flex-1">
                  <Text
                    className="text-base font-bold mb-0.5"
                    style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
                  >
                    {pattern.title}
                  </Text>
                  <Text
                    className="text-[10px] font-medium uppercase tracking-wider"
                    style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_500Medium' }}
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
                style={{ color: isDarkMode ? '#C5CAD3' : '#6C7589', fontFamily: 'Inter_400Regular' }}
              >
                {pattern.description}
              </Text>
            </View>

            {/* Insight Box */}
            <View
              className="p-3 rounded-xl flex-row items-start gap-2"
              style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#F8F9FA' }}
            >
              <AlertCircle size={16} color={isDarkMode ? '#8A8F9E' : '#6C7589'} style={{ marginTop: 2 }} />
              <Text
                className="text-xs leading-5 flex-1 italic"
                style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Inter_400Regular' }}
              >
                {pattern.insight}
              </Text>
            </View>
          </Animated.View>
        );
      })}

      {/* Footer Note */}
      <View className="mt-4 p-4 rounded-xl" style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFFFFF' }}>
        <Text
          className="text-xs leading-5 text-center"
          style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
        >
          Patterns update as you check in your battery and log weaves. These insights are probabilistic, not prescriptive—use them as gentle guides, not rules.
        </Text>
      </View>
    </ScrollView>
  );
}
