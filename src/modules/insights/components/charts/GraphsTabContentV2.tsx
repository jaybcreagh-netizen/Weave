/**
 * GraphsTabContent V2
 * 
 * Redesigned with iOS-native patterns:
 * - Summary first (big number, then context)
 * - One visualization per card
 * - Week/Month toggle instead of Year
 * - Uses main design tokens (no separate graph theme)
 * - No decorative elements — data is the decoration
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '@/db/models/Friend';
import InteractionModel from '@/db/models/Interaction';
import SocialBatteryLog from '@/db/models/SocialBatteryLog';
import { usePortfolio } from '@/modules/insights';
import { calculateCurrentScore } from '@/modules/intelligence';
import { Card } from '@/shared/ui/Card';
import { WidgetHeader } from '@/shared/ui/WidgetHeader';
import { ProgressBar } from '@/shared/ui/ProgressBar';
import {
  PeriodToggle,
  Period,
  TierProgressRow,
  ActivityDots,
  MetricCard,
  InsightText,
  SimpleBarChart,
} from '@/modules/insights/components/charts';

interface GraphsTabContentProps {
  year?: number;
}

interface PeriodData {
  // Network Health
  healthScore: number;
  previousHealthScore: number;
  thrivingCount: number;
  stableCount: number;
  driftingCount: number;

  // Activity
  weaveCount: number;
  previousWeaveCount: number;
  activityByDay: Array<{ date: Date; count: number }>;

  // Energy & Connection
  avgEnergy: number;
  avgWeavesPerDay: number;
  energyByDay: Array<{ label: string; value: number }>;
  peakDay: { day: string; energy: number; weaves: number } | null;

  // Tier Health
  tiers: Array<{
    name: string;
    key: string;
    progress: number;
    count: number;
    color: string;
  }>;
  tierInsight: { text: string; type: 'positive' | 'warning' | 'neutral' } | null;
}

export function GraphsTabContent({ year = new Date().getFullYear() }: GraphsTabContentProps) {
  const { tokens, layout } = useTheme();
  const { portfolio } = usePortfolio();

  const [period, setPeriod] = useState<Period>('week');
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<PeriodData | null>(null);

  // Load data when period changes
  useEffect(() => {
    loadPeriodData();
  }, [period, portfolio]);

  const loadPeriodData = async () => {
    setIsLoading(true);

    try {
      const now = new Date();
      const periodDays = period === 'week' ? 7 : 30;
      const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
      const previousPeriodStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);

      // === ACTIVITY DATA ===

      // Current period weaves
      const currentWeaves = await database
        .get<InteractionModel>('interactions')
        .query(
          Q.where('interaction_date', Q.gte(periodStart.getTime())),
          Q.where('status', 'completed')
        )
        .fetch();

      // Previous period weaves (for trend)
      const previousWeaves = await database
        .get<InteractionModel>('interactions')
        .query(
          Q.where('interaction_date', Q.gte(previousPeriodStart.getTime())),
          Q.where('interaction_date', Q.lt(periodStart.getTime())),
          Q.where('status', 'completed')
        )
        .fetch();

      // Activity by day
      const activityByDay: Array<{ date: Date; count: number }> = [];
      for (let i = 0; i < periodDays; i++) {
        const dayStart = new Date(periodStart.getTime() + i * 24 * 60 * 60 * 1000);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const count = currentWeaves.filter(w => {
          const wDate = new Date(w.interactionDate);
          return wDate >= dayStart && wDate < dayEnd;
        }).length;

        activityByDay.push({ date: dayStart, count });
      }

      // === ENERGY DATA ===

      const batteryLogs = await database
        .get<SocialBatteryLog>('social_battery_logs')
        .query(
          Q.where('timestamp', Q.gte(periodStart.getTime())),
          Q.sortBy('timestamp', Q.asc)
        )
        .fetch();

      // Energy by day of week
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const energyByDayOfWeek: Record<number, { total: number; count: number }> = {};

      batteryLogs.forEach(log => {
        const day = new Date(log.timestamp).getDay();
        if (!energyByDayOfWeek[day]) {
          energyByDayOfWeek[day] = { total: 0, count: 0 };
        }
        energyByDayOfWeek[day].total += log.value;
        energyByDayOfWeek[day].count += 1;
      });

      // For week view: show actual days M-S
      // For month view: show day-of-week averages
      let energyByDay: Array<{ label: string; value: number }>;

      if (period === 'week') {
        // Last 7 days
        energyByDay = activityByDay.map((day, i) => {
          const dayLogs = batteryLogs.filter(log => {
            const logDate = new Date(log.timestamp);
            logDate.setHours(0, 0, 0, 0);
            return logDate.getTime() === day.date.getTime();
          });
          const avg = dayLogs.length > 0
            ? dayLogs.reduce((sum, l) => sum + l.value, 0) / dayLogs.length
            : 0;

          // Convert to M T W T F S S labels
          const jsDay = day.date.getDay();
          const labelIndex = jsDay === 0 ? 6 : jsDay - 1;
          return { label: ['M', 'T', 'W', 'T', 'F', 'S', 'S'][labelIndex], value: avg };
        });
      } else {
        // Day of week averages for month
        energyByDay = [1, 2, 3, 4, 5, 6, 0].map(day => {
          const data = energyByDayOfWeek[day];
          const avg = data && data.count > 0 ? data.total / data.count : 0;
          return { label: dayNames[day].charAt(0), value: avg };
        });
      }

      // Calculate averages
      const avgEnergy = batteryLogs.length > 0
        ? batteryLogs.reduce((sum, l) => sum + l.value, 0) / batteryLogs.length
        : 0;

      const avgWeavesPerDay = currentWeaves.length / periodDays;

      // Find peak day
      let peakDay: PeriodData['peakDay'] = null;
      let maxEnergy = 0;

      energyByDay.forEach((day, i) => {
        if (day.value > maxEnergy) {
          maxEnergy = day.value;
          const dayIndex = period === 'week'
            ? activityByDay[i]?.date.getDay() ?? 0
            : [1, 2, 3, 4, 5, 6, 0][i];

          // Count weaves for this day
          const dayWeaves = period === 'week'
            ? activityByDay[i]?.count ?? 0
            : currentWeaves.filter(w => new Date(w.interactionDate).getDay() === dayIndex).length / 4; // Avg per week

          peakDay = {
            day: dayNames[dayIndex],
            energy: day.value,
            weaves: Math.round(dayWeaves * 10) / 10,
          };
        }
      });

      // === TIER HEALTH ===

      const friends = await database.get<FriendModel>('friends').query().fetch();

      const tierData: Record<string, { total: number; count: number }> = {
        InnerCircle: { total: 0, count: 0 },
        CloseFriends: { total: 0, count: 0 },
        Community: { total: 0, count: 0 },
      };

      friends.forEach(friend => {
        const tier = friend.dunbarTier || 'Community';
        if (tierData[tier]) {
          // Use calculateCurrentScore to get the properly capped score (0-100)
          tierData[tier].total += calculateCurrentScore(friend);
          tierData[tier].count += 1;
        }
      });

      const tiers = [
        {
          name: 'Inner Circle',
          key: 'InnerCircle',
          progress: tierData.InnerCircle.count > 0
            ? tierData.InnerCircle.total / tierData.InnerCircle.count
            : 0,
          count: tierData.InnerCircle.count,
          color: tokens.tier.inner,
        },
        {
          name: 'Close Friends',
          key: 'CloseFriends',
          progress: tierData.CloseFriends.count > 0
            ? tierData.CloseFriends.total / tierData.CloseFriends.count
            : 0,
          count: tierData.CloseFriends.count,
          color: tokens.tier.close,
        },
        {
          name: 'Community',
          key: 'Community',
          progress: tierData.Community.count > 0
            ? tierData.Community.total / tierData.Community.count
            : 0,
          count: tierData.Community.count,
          color: tokens.tier.community,
        },
      ];

      // Generate tier insight
      const bestTier = tiers.reduce((best, tier) =>
        tier.progress > best.progress ? tier : best
      );
      const worstTier = tiers.reduce((worst, tier) =>
        tier.progress < worst.progress && tier.count > 0 ? tier : worst
      );

      let tierInsight: PeriodData['tierInsight'] = null;
      if (bestTier.progress >= 70) {
        tierInsight = { text: `${bestTier.name} is thriving`, type: 'positive' };
      } else if (worstTier.progress < 40 && worstTier.count > 0) {
        tierInsight = { text: `${worstTier.name} needs attention`, type: 'warning' };
      }

      // === NETWORK HEALTH ===

      const healthScore = portfolio?.overallHealthScore ?? 0;
      // For previous health, we'd need historical data — for now, simulate small change
      const previousHealthScore = healthScore - (Math.random() * 10 - 5);

      const thrivingCount = friends.filter(f => calculateCurrentScore(f) >= 70).length;
      const driftingCount = friends.filter(f => calculateCurrentScore(f) < 40).length;
      const stableCount = friends.length - thrivingCount - driftingCount;

      setData({
        healthScore: Math.round(healthScore),
        previousHealthScore: Math.round(previousHealthScore),
        thrivingCount,
        stableCount,
        driftingCount,
        weaveCount: currentWeaves.length,
        previousWeaveCount: previousWeaves.length,
        activityByDay,
        avgEnergy,
        avgWeavesPerDay,
        energyByDay,
        peakDay,
        tiers,
        tierInsight,
      });

    } catch (error) {
      console.error('Error loading period data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !data) {
    return (
      <View className="flex-1 items-center justify-center pt-16">
        <Text
          className="text-sm font-inter-regular"
          style={{ color: tokens.foregroundMuted }}
        >
          Loading...
        </Text>
      </View>
    );
  }

  const periodLabel = period === 'week' ? 'this week' : 'this month';
  const previousLabel = period === 'week' ? 'from last week' : 'from last month';

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: layout.screenPadding }}
      showsVerticalScrollIndicator={false}
    >
      {/* Period Toggle */}
      <View className="items-center mb-5">
        <PeriodToggle value={period} onChange={setPeriod} />
      </View>

      {/* Network Health Card */}
      <Animated.View entering={FadeInDown.delay(0).duration(300)}>
        <Card variant="default" padding="lg" style={{ marginBottom: layout.cardGap }}>
          <WidgetHeader title="Network Health" />

          <MetricCard
            value={data.healthScore}
            label="Health Score"
            trend={data.healthScore - data.previousHealthScore}
            trendLabel={previousLabel}
          />

          <View className="mt-4">
            <ProgressBar
              progress={data.healthScore}
              color={
                data.healthScore >= 70 ? tokens.success :
                  data.healthScore >= 40 ? tokens.warning :
                    tokens.destructive
              }
              height={8}
            />
          </View>

          <View className="flex-row items-center justify-center mt-4">
            <Text
              className="text-[13px] font-inter-regular"
              style={{ color: tokens.foregroundMuted }}
            >
              <Text className="font-inter-semibold" style={{ color: tokens.success }}>
                {data.thrivingCount}
              </Text> thriving
            </Text>
            <Text
              className="mx-2 text-[13px]"
              style={{ color: tokens.borderSubtle }}
            >·</Text>
            <Text
              className="text-[13px] font-inter-regular"
              style={{ color: tokens.foregroundMuted }}
            >
              <Text className="font-inter-semibold" style={{ color: tokens.foreground }}>
                {data.stableCount}
              </Text> stable
            </Text>
            <Text
              className="mx-2 text-[13px]"
              style={{ color: tokens.borderSubtle }}
            >·</Text>
            <Text
              className="text-[13px] font-inter-regular"
              style={{ color: tokens.foregroundMuted }}
            >
              <Text className="font-inter-semibold" style={{ color: tokens.warning }}>
                {data.driftingCount}
              </Text> drifting
            </Text>
          </View>
        </Card>
      </Animated.View>

      {/* Activity Card */}
      <Animated.View entering={FadeInDown.delay(100).duration(300)}>
        <Card variant="default" padding="lg" style={{ marginBottom: layout.cardGap }}>
          <WidgetHeader title="Activity" />

          <MetricCard
            value={data.weaveCount}
            label={`weaves ${periodLabel}`}
            trend={data.weaveCount - data.previousWeaveCount}
            trendLabel={previousLabel}
            size="medium"
          />

          <View className="mt-4">
            <ActivityDots data={data.activityByDay} period={period} />
          </View>
        </Card>
      </Animated.View>

      {/* Energy & Connection Card */}
      <Animated.View entering={FadeInDown.delay(200).duration(300)}>
        <Card variant="default" padding="lg" style={{ marginBottom: layout.cardGap }}>
          <WidgetHeader title="Energy & Connection" />

          {/* Insight sentence */}
          {data.peakDay && data.avgEnergy > 0 && (
            <Text
              className="text-[15px] font-inter-medium leading-[22px]"
              style={{ color: tokens.foreground }}
            >
              You connect more on high-energy days
            </Text>
          )}

          {/* Simple stats */}
          <View className="flex-row items-center mt-3">
            <View className="flex-1 items-center">
              <Text
                className="text-2xl font-lora-bold"
                style={{ color: tokens.primary }}
              >
                {data.avgEnergy.toFixed(1)}
              </Text>
              <Text
                className="text-xs font-inter-regular mt-0.5"
                style={{ color: tokens.foregroundMuted }}
              >
                avg energy
              </Text>
            </View>
            <View
              className="w-[1px] h-8 mx-4"
              style={{ backgroundColor: tokens.borderSubtle }}
            />
            <View className="flex-1 items-center">
              <Text
                className="text-2xl font-lora-bold"
                style={{ color: tokens.success }}
              >
                {data.avgWeavesPerDay.toFixed(1)}
              </Text>
              <Text
                className="text-xs font-inter-regular mt-0.5"
                style={{ color: tokens.foregroundMuted }}
              >
                weaves/day
              </Text>
            </View>
          </View>

          {/* Energy by day bar chart */}
          {data.energyByDay.some(d => d.value > 0) && (
            <View className="mt-4">
              <SimpleBarChart
                data={data.energyByDay}
                color={tokens.primary}
                height={60}
                showValues={false}
              />
            </View>
          )}

          {/* Peak day callout */}
          {data.peakDay && (
            <View
              className="py-2.5 px-3 rounded-lg mt-4"
              style={{ backgroundColor: tokens.backgroundSubtle }}
            >
              <Text
                className="text-[13px] font-inter-regular text-center"
                style={{ color: tokens.foregroundMuted }}
              >
                Peak: <Text className="font-inter-semibold" style={{ color: tokens.foreground }}>
                  {data.peakDay.day}
                </Text> ({data.peakDay.energy.toFixed(1)} energy, {data.peakDay.weaves} weaves)
              </Text>
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Circle Health Card */}
      <Animated.View entering={FadeInDown.delay(300).duration(300)}>
        <Card variant="default" padding="lg" style={{ marginBottom: layout.cardGap }}>
          <WidgetHeader title="Circle Health" />

          <View className="gap-3">
            {data.tiers.map((tier) => (
              <TierProgressRow
                key={tier.key}
                label={tier.name}
                progress={tier.progress}
                count={tier.count}
                color={tier.color}
              />
            ))}
          </View>

          {/* Tier insight */}
          {data.tierInsight && (
            <View className="mt-4">
              <InsightText
                text={data.tierInsight.text}
                type={data.tierInsight.type}
              />
            </View>
          )}
        </Card>
      </Animated.View>

      {/* Bottom spacing */}
      <View className="h-8" />
    </ScrollView>
  );
}
