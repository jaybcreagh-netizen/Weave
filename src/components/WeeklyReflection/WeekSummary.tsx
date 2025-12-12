/**
 * WeekSummary
 * 
 * Used in Dashboard to show a summary card of the previous weekly reflection
 * or prompts to start a new one if available.
 */

import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { BarChart, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { ExtendedWeeklySummary } from '@/modules/reflection';

interface WeekSummaryProps {
  summary?: ExtendedWeeklySummary;
  onPress?: () => void;
  isReflectionReady?: boolean;
}

export function WeekSummary({ summary, onPress, isReflectionReady }: WeekSummaryProps) {
  const { colors } = useTheme();

  // Loading or empty state
  if (!summary && !isReflectionReady) {
    return (
      <Card className="p-4 bg-card/50">
        <View className="flex-row items-center gap-3">
          <View className="w-10 h-10 rounded-full bg-muted animate-pulse" />
          <View className="gap-2 flex-1">
            <View className="h-4 w-1/3 bg-muted rounded animate-pulse" />
            <View className="h-3 w-1/2 bg-muted rounded animate-pulse" />
          </View>
        </View>
      </Card>
    );
  }

  // Reflection Ready State
  if (isReflectionReady) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        <Card className="p-0 overflow-hidden border-primary/20">
          <View className="absolute inset-0 bg-primary/5" />
          <View className="p-5 flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <Text variant="h4" className="text-primary font-bold mb-1">
                Reflection Ready
              </Text>
              <Text variant="body" className="text-muted-foreground text-sm">
                Your weekly friendship check-in is ready. Take 2 minutes to reflect.
              </Text>
            </View>
            <View className="w-10 h-10 rounded-full bg-primary/10 items-center justify-center">
              <ArrowRight size={20} color={colors.primary} />
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  }

  if (!summary) return null;

  // Comparison logic
  const comparison = summary.comparison;
  const isUp = comparison && comparison.weavesChange > 0;
  const isDown = comparison && comparison.weavesChange < 0;

  return (
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
        </Animated.View >
      )
}

{/* Stats Grid */ }
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

{/* Comparison Insights (vs Last Week) */ }
{
  summary.comparison && (
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
  )
}

{/* Pattern Recognition */ }
{
  summary.patterns && (
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
  )
}

{/* Social Health Score */ }
{
  summary.socialHealth && (
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
  )
}

{/* Continue Button */ }
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
    </ScrollView >
  );
}
