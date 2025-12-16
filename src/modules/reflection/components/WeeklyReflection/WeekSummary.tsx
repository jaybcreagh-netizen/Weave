/**
 * WeekSummary Component
 * Shows celebration stats for the week
 */

import React from 'react';
import { View, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TrendingUp, Users, Activity, ArrowUp, ArrowDown, Minus, Heart, Sparkles, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { WeeklySummary } from '@/modules/reflection';
import { format } from 'date-fns';
import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';

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
      <View className="mb-6 mt-2">
        <Text variant="h2" className="text-center mb-2 font-lora-bold">
          Your Week in Weaving
        </Text>
        <Text
          variant="caption"
          className="text-center font-inter-regular text-muted-foreground"
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
          <Text className="text-4xl text-center mb-3">
            {summary.totalWeaves >= 10 ? '🌟' : summary.totalWeaves >= 5 ? '✨' : '🌱'}
          </Text>
          <Text
            variant="h3"
            className="text-center mb-2 font-lora-semibold text-primary"
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
            variant="body"
            className="text-center leading-5 font-inter-regular text-muted-foreground"
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
          className="mb-8 p-6 rounded-2xl bg-muted"
        >
          <Text className="text-4xl text-center mb-3">🌙</Text>
          <Text
            variant="h3"
            className="text-center mb-2 font-lora-semibold"
          >
            A quiet week
          </Text>
          <Text
            variant="body"
            className="text-center leading-5 font-inter-regular text-muted-foreground"
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
          >
            <Card className="flex-row items-center p-4 border border-border bg-card">
              <View
                className="w-12 h-12 rounded-full items-center justify-center mr-4"
                style={{ backgroundColor: stat.color + '20' }}
              >
                <stat.icon size={24} color={stat.color} />
              </View>
              <View className="flex-1">
                <Text
                  variant="caption"
                  className="mb-1 font-inter-regular text-muted-foreground"
                >
                  {stat.label}
                </Text>
                <View className="flex-row items-baseline gap-2">
                  <Text variant="h2" className="font-lora-bold">
                    {stat.value}
                  </Text>
                  {stat.subValue && (
                    <Text
                      variant="caption"
                      className="font-inter-regular text-muted-foreground"
                    >
                      {stat.subValue}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          </Animated.View>
        ))}
      </View>

      {/* Comparison Insights (vs Last Week) */}
      {summary.comparison && (
        <Animated.View
          entering={FadeInDown.delay(500)}
          className="mb-6 p-4 rounded-xl bg-muted"
        >
          <Text
            className="text-sm mb-3 font-inter-semibold"
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
                className="text-xs ml-2 font-inter-regular"
                style={{
                  color: summary.comparison.weavesChange > 0 ? '#10b981' :
                    summary.comparison.weavesChange < 0 ? '#ef4444' :
                      colors['muted-foreground'],
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
                className="text-xs ml-2 font-inter-regular"
                style={{
                  color: summary.comparison.friendsChange > 0 ? '#10b981' :
                    summary.comparison.friendsChange < 0 ? '#ef4444' :
                      colors['muted-foreground'],
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
            <Card className="flex-row items-center p-4 border border-border bg-card">
              <Heart size={20} color={colors.primary} />
              <View className="flex-1 ml-3">
                <Text
                  variant="caption"
                  className="mb-1 font-inter-regular text-muted-foreground"
                >
                  💪 Most consistent
                </Text>
                <Text
                  variant="body"
                  className="font-inter-semibold"
                >
                  {summary.patterns.mostConsistentFriend.name} ({summary.patterns.mostConsistentFriend.weaveCount} weaves)
                </Text>
              </View>
            </Card>
          )}

          {/* Rising Connection */}
          {summary.patterns.risingConnection && (
            <Card className="flex-row items-center p-4 border border-border bg-card">
              <Sparkles size={20} color="#10b981" />
              <View className="flex-1 ml-3">
                <Text
                  variant="caption"
                  className="mb-1 font-inter-regular text-muted-foreground"
                >
                  🌟 Strongest connection
                </Text>
                <Text
                  variant="body"
                  className="font-inter-semibold"
                >
                  {summary.patterns.risingConnection.name}
                </Text>
              </View>
            </Card>
          )}

          {/* Needs Attention */}
          {summary.patterns.needsAttention && summary.patterns.needsAttention > 0 && (
            <Card className="flex-row items-center p-4 border border-border bg-card">
              <AlertCircle size={20} color="#f59e0b" />
              <View className="flex-1 ml-3">
                <Text
                  variant="caption"
                  className="mb-1 font-inter-regular text-muted-foreground"
                >
                  💭 Needs attention
                </Text>
                <Text
                  variant="body"
                  className="font-inter-semibold"
                >
                  {summary.patterns.needsAttention} friend{summary.patterns.needsAttention > 1 ? 's' : ''}
                </Text>
              </View>
            </Card>
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
            className="text-sm font-inter-semibold mb-2"
          >
            Your Weave Health
          </Text>
          <View className="flex-row items-center">
            <Text
              className="text-4xl mr-3 font-lora-bold"
              style={{
                color: summary.socialHealth.score >= 70 ? '#10b981' :
                  summary.socialHealth.score >= 50 ? '#f59e0b' :
                    '#ef4444',
              }}
            >
              {summary.socialHealth.score}%
            </Text>
            <Text
              variant="caption"
              className="flex-1 font-inter-regular text-muted-foreground"
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
          variant="body"
          className="font-inter-semibold text-primary-foreground"
        >
          {summary.missedFriends.length > 0 ? 'See Who Needs Attention' : 'Continue'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
