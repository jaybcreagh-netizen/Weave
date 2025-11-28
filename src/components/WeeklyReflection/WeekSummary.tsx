/**
 * WeekSummary Component
 * Shows celebration stats for the week
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TrendingUp, Users, Activity, ArrowUp, ArrowDown, Minus, Heart, Sparkles, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { WeeklySummary } from '@/modules/reflection';
import { format } from 'date-fns';

interface WeekSummaryProps {
  summary: WeeklySummary;
  onNext: () => void;
}

export function WeekSummary({ summary, onNext }: WeekSummaryProps) {
  const { colors } = useTheme();

  const stats = [
    {
      icon: Activity,
      label: 'Weaves Logged',
      value: summary.totalWeaves,
      color: colors.primary,
    },
    {
      icon: Users,
      label: 'Friends Connected',
      value: summary.friendsContacted,
      color: colors.accent,
    },
    {
      icon: TrendingUp,
      label: 'Top Activity',
      value: summary.topActivity,
      subValue: `${summary.topActivityCount}×`,
      color: colors.secondary,
    },
  ];

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View className="mb-6">
        <Text
          className="text-2xl font-bold mb-2 text-center"
          style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
        >
          Your Week in Weaving
        </Text>
        <Text
          className="text-sm text-center"
          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
        >
          {format(summary.weekStartDate, 'MMM d')} - {format(summary.weekEndDate, 'MMM d, yyyy')}
        </Text>
      </View>

      {/* Celebration Message */}
      {summary.totalWeaves > 0 ? (
        <Animated.View
          entering={FadeInDown.delay(100)}
          className="mb-8 p-6 rounded-2xl"
          style={{ backgroundColor: colors.primary + '15' }}
        >
          <Text
            className="text-4xl text-center mb-3"
          >
            {summary.totalWeaves >= 10 ? '🌟' : summary.totalWeaves >= 5 ? '✨' : '🌱'}
          </Text>
          <Text
            className="text-lg font-semibold text-center mb-2"
            style={{ color: colors.primary, fontFamily: 'Lora_600SemiBold' }}
          >
            {summary.totalWeaves >= 10
              ? 'Outstanding work!'
              : summary.totalWeaves >= 5
                ? 'Great job connecting!'
                : summary.totalWeaves > 0
                  ? 'Every weave matters!'
                  : 'Ready to start weaving?'}
          </Text>
          <Text
            className="text-sm text-center leading-5"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            {summary.totalWeaves >= 10
              ? 'You maintained 10+ connections this week. Your weave is thriving.'
              : summary.totalWeaves >= 5
                ? 'You stayed connected with multiple friends. Keep building momentum.'
                : summary.totalWeaves > 0
                  ? 'You took time to nurture your relationships. That takes intention.'
                  : 'This week is a fresh start. Who will you connect with?'}
          </Text>
        </Animated.View>
      ) : (
        <Animated.View
          entering={FadeInDown.delay(100)}
          className="mb-8 p-6 rounded-2xl"
          style={{ backgroundColor: colors.muted }}
        >
          <Text className="text-4xl text-center mb-3">🌙</Text>
          <Text
            className="text-lg font-semibold text-center mb-2"
            style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
          >
            A quiet week
          </Text>
          <Text
            className="text-sm text-center leading-5"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            Sometimes we need rest. When you're ready, your friends are waiting.
          </Text>
        </Animated.View>
      )}

      {/* Stats Grid */}
      <View className="gap-3 mb-6">
        {stats.map((stat, index) => (
          <Animated.View
            key={stat.label}
            entering={FadeInDown.delay(200 + index * 100)}
            className="flex-row items-center p-4 rounded-xl"
            style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
          >
            <View
              className="w-12 h-12 rounded-full items-center justify-center mr-4"
              style={{ backgroundColor: stat.color + '20' }}
            >
              <stat.icon size={24} color={stat.color} />
            </View>
            <View className="flex-1">
              <Text
                className="text-xs mb-1"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                {stat.label}
              </Text>
              <View className="flex-row items-baseline gap-2">
                <Text
                  className="text-2xl font-bold"
                  style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
                >
                  {stat.value}
                </Text>
                {stat.subValue && (
                  <Text
                    className="text-sm"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    {stat.subValue}
                  </Text>
                )}
              </View>
            </View>
          </Animated.View>
        ))}
      </View>

      {/* Comparison Insights (vs Last Week) */}
      {summary.comparison && (
        <Animated.View
          entering={FadeInDown.delay(500)}
          className="mb-6 p-4 rounded-xl"
          style={{ backgroundColor: colors.muted }}
        >
          <Text
            className="text-sm font-semibold mb-3"
            style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
          >
            📈 This Week vs Last Week
          </Text>
          <View className="gap-2">
            {/* Weaves comparison */}
            <View className="flex-row items-center">
              {summary.comparison.weavesChange > 0 ? (
                <ArrowUp size={16} color="#10b981" />
              ) : summary.comparison.weavesChange < 0 ? (
                <ArrowDown size={16} color="#ef4444" />
              ) : (
                <Minus size={16} color={colors['muted-foreground']} />
              )}
              <Text
                className="text-xs ml-2"
                style={{
                  color: summary.comparison.weavesChange > 0 ? '#10b981' :
                    summary.comparison.weavesChange < 0 ? '#ef4444' :
                      colors['muted-foreground'],
                  fontFamily: 'Inter_400Regular'
                }}
              >
                {summary.comparison.weavesChange > 0 ? '+' : ''}{summary.comparison.weavesChange} weaves
                {summary.comparison.weavesChange > 0 ? ' from last week' : ' vs last week'}
              </Text>
            </View>
            {/* Friends comparison */}
            <View className="flex-row items-center">
              {summary.comparison.friendsChange > 0 ? (
                <ArrowUp size={16} color="#10b981" />
              ) : summary.comparison.friendsChange < 0 ? (
                <ArrowDown size={16} color="#ef4444" />
              ) : (
                <Minus size={16} color={colors['muted-foreground']} />
              )}
              <Text
                className="text-xs ml-2"
                style={{
                  color: summary.comparison.friendsChange > 0 ? '#10b981' :
                    summary.comparison.friendsChange < 0 ? '#ef4444' :
                      colors['muted-foreground'],
                  fontFamily: 'Inter_400Regular'
                }}
              >
                {summary.comparison.friendsChange > 0 ? '+' : ''}{summary.comparison.friendsChange} friends contacted
              </Text>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Pattern Recognition */}
      {summary.patterns && (
        <Animated.View
          entering={FadeInDown.delay(600)}
          className="mb-6 gap-3"
        >
          {/* Most Consistent Friend */}
          {summary.patterns.mostConsistentFriend && summary.patterns.mostConsistentFriend.weaveCount > 1 && (
            <View
              className="flex-row items-center p-4 rounded-xl"
              style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
            >
              <Heart size={20} color={colors.primary} />
              <View className="flex-1 ml-3">
                <Text
                  className="text-xs mb-1"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  💪 Most consistent
                </Text>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                >
                  {summary.patterns.mostConsistentFriend.name} ({summary.patterns.mostConsistentFriend.weaveCount} weaves)
                </Text>
              </View>
            </View>
          )}

          {/* Rising Connection */}
          {summary.patterns.risingConnection && (
            <View
              className="flex-row items-center p-4 rounded-xl"
              style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
            >
              <Sparkles size={20} color="#10b981" />
              <View className="flex-1 ml-3">
                <Text
                  className="text-xs mb-1"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  🌟 Strongest connection
                </Text>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                >
                  {summary.patterns.risingConnection.name}
                </Text>
              </View>
            </View>
          )}

          {/* Needs Attention */}
          {summary.patterns.needsAttention && summary.patterns.needsAttention > 0 && (
            <View
              className="flex-row items-center p-4 rounded-xl"
              style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
            >
              <AlertCircle size={20} color="#f59e0b" />
              <View className="flex-1 ml-3">
                <Text
                  className="text-xs mb-1"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  💭 Needs attention
                </Text>
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                >
                  {summary.patterns.needsAttention} friend{summary.patterns.needsAttention > 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      )}

      {/* Social Health Score */}
      {summary.socialHealth && (
        <Animated.View
          entering={FadeInDown.delay(700)}
          className="mb-8 p-5 rounded-xl"
          style={{
            backgroundColor: summary.socialHealth.score >= 70 ? '#10b98120' :
              summary.socialHealth.score >= 50 ? '#f59e0b20' :
                '#ef444420'
          }}
        >
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
          >
            Your Weave Health
          </Text>
          <View className="flex-row items-center">
            <Text
              className="text-4xl font-bold mr-3"
              style={{
                color: summary.socialHealth.score >= 70 ? '#10b981' :
                  summary.socialHealth.score >= 50 ? '#f59e0b' :
                    '#ef4444',
                fontFamily: 'Lora_700Bold'
              }}
            >
              {summary.socialHealth.score}%
            </Text>
            <Text
              className="text-sm flex-1"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
            >
              Average of all your friendship scores
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Continue Button */}
      <TouchableOpacity
        onPress={onNext}
        className="py-4 rounded-xl items-center"
        style={{ backgroundColor: colors.primary }}
      >
        <Text
          className="text-base font-semibold"
          style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
        >
          {summary.missedFriends.length > 0 ? 'See Who Needs Attention' : 'Continue'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
