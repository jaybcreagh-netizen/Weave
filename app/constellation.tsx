/**
 * Constellation Full-Screen Route
 * Interactive visualization of your social network
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Network, BarChart3, Info } from 'lucide-react-native';
import { useTheme } from '../src/hooks/useTheme';
import { useUserProfileStore } from '../src/stores/userProfileStore';
import { useFriends } from '../src/hooks/useFriends';
import { ConstellationView } from '../src/components/constellation';
import { useConstellationData, useConstellationStats } from '../src/components/constellation/useConstellationData';
import { ConstellationFilter } from '../src/components/constellation/types';
import { generateSeasonExplanation } from '../src/lib/narrative-generator';
import { startOfDay, subDays } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { database } from '../src/db';
import Interaction from '../src/db/models/Interaction';
import { calculateCurrentScore } from '../src/lib/weave-engine';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type TabType = 'constellation' | 'insights' | 'context';

export default function ConstellationScreen() {
  const router = useRouter();
  const { colors, isDarkMode } = useTheme();
  const { profile, getRecentBatteryAverage, getBatteryTrend } = useUserProfileStore();
  const friends = useFriends();
  const [activeTab, setActiveTab] = useState<TabType>('constellation');
  const [filter, setFilter] = useState<ConstellationFilter>({ mode: 'all' });

  const season = profile?.currentSocialSeason || 'balanced';
  const constellationFriends = useConstellationData(friends);
  const stats = useConstellationStats(constellationFriends);

  // Calculate season data for context
  const [seasonData, setSeasonData] = React.useState<any>(null);

  React.useEffect(() => {
    const calculateSeasonData = async () => {
      if (!profile || friends.length === 0) return;

      const now = startOfDay(new Date()).getTime();
      const sevenDaysAgo = subDays(now, 7).getTime();
      const thirtyDaysAgo = subDays(now, 30).getTime();

      const weavesLast7Days = await database
        .get<Interaction>('interactions')
        .query(Q.where('status', 'completed'), Q.where('interaction_date', Q.gte(sevenDaysAgo)))
        .fetchCount();

      const weavesLast30Days = await database
        .get<Interaction>('interactions')
        .query(Q.where('status', 'completed'), Q.where('interaction_date', Q.gte(thirtyDaysAgo)))
        .fetchCount();

      const friendScores = friends.map(f => calculateCurrentScore(f));
      const avgScoreAllFriends = friendScores.reduce((sum, score) => sum + score, 0) / friendScores.length || 0;

      const innerCircleFriends = friends.filter(f => f.dunbarTier === 'InnerCircle');
      const innerCircleScores = innerCircleFriends.map(f => calculateCurrentScore(f));
      const avgScoreInnerCircle = innerCircleScores.reduce((sum, score) => sum + score, 0) / innerCircleScores.length || 0;

      const momentumCount = friends.filter(
        f => f.momentumScore > 10 && f.momentumLastUpdated > Date.now() - 24 * 60 * 60 * 1000
      ).length;

      const batteryLast7DaysAvg = getRecentBatteryAverage(7);
      const batteryTrend = getBatteryTrend();

      setSeasonData({
        season,
        weavesLast7Days,
        weavesLast30Days,
        avgScoreAllFriends,
        avgScoreInnerCircle,
        momentumCount,
        batteryLast7DaysAvg,
        batteryTrend,
      });
    };

    calculateSeasonData();
  }, [friends, profile, season]);

  const explanation = seasonData ? generateSeasonExplanation(seasonData) : null;

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View
        className="flex-row items-center justify-between px-5 pt-14 pb-4"
        style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="mr-3"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text className="flex-1 font-lora text-2xl font-bold" style={{ color: colors.foreground }}>
          Your Social Network
        </Text>
      </View>

      {/* Tabs */}
      <View
        className="flex-row px-5"
        style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
      >
        <Tab
          icon={Network}
          label="Constellation"
          active={activeTab === 'constellation'}
          onPress={() => setActiveTab('constellation')}
          colors={colors}
        />
        <Tab
          icon={BarChart3}
          label="Insights"
          active={activeTab === 'insights'}
          onPress={() => setActiveTab('insights')}
          colors={colors}
        />
        <Tab
          icon={Info}
          label="Context"
          active={activeTab === 'context'}
          onPress={() => setActiveTab('context')}
          colors={colors}
        />
      </View>

      {/* Content */}
      <View className="flex-1">
        {activeTab === 'constellation' && (
          <ConstellationTab
            friends={constellationFriends}
            season={season}
            filter={filter}
            setFilter={setFilter}
            stats={stats}
            colors={colors}
          />
        )}
        {activeTab === 'insights' && <InsightsTab stats={stats} colors={colors} />}
        {activeTab === 'context' && <ContextTab explanation={explanation} season={season} colors={colors} />}
      </View>
    </View>
  );
}

// Tab component
interface TabProps {
  icon: React.FC<any>;
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
}

const Tab: React.FC<TabProps> = ({ icon: Icon, label, active, onPress, colors }) => (
  <TouchableOpacity className="flex-1 flex-row items-center justify-center gap-1.5 py-3" onPress={onPress}>
    <Icon size={18} color={active ? colors.primary : colors['muted-foreground']} />
    <Text
      className="text-sm"
      style={{
        color: active ? colors.primary : colors['muted-foreground'],
        fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
      }}
    >
      {label}
    </Text>
    {active && (
      <View
        className="absolute bottom-0 left-0 right-0 h-0.5"
        style={{ backgroundColor: colors.primary }}
      />
    )}
  </TouchableOpacity>
);

// Constellation Tab
interface ConstellationTabProps {
  friends: any[];
  season: any;
  filter: ConstellationFilter;
  setFilter: (filter: ConstellationFilter) => void;
  stats: any;
  colors: any;
}

const ConstellationTab: React.FC<ConstellationTabProps> = ({
  friends,
  season,
  filter,
  setFilter,
  stats,
  colors,
}) => (
  <View className="flex-1 p-4">
    {/* Constellation Canvas - fills available space */}
    <View className="flex-1 rounded-2xl overflow-hidden mb-3 bg-black">
      <ConstellationView
        friends={friends}
        season={season}
        filter={filter}
        width={SCREEN_WIDTH - 32}
        height={SCREEN_HEIGHT - 280} // Account for header + tabs + stats + filters
      />
    </View>

    {/* Stats bar */}
    <View className="flex-row justify-around p-3 rounded-xl mb-3" style={{ backgroundColor: colors.muted }}>
      <Text className="font-inter-medium text-xs" style={{ color: colors.foreground }}>
        ● {stats.byTier.InnerCircle} Inner
      </Text>
      <Text className="font-inter-medium text-xs" style={{ color: colors.foreground }}>
        ● {stats.byTier.CloseFriends} Close
      </Text>
      <Text className="font-inter-medium text-xs" style={{ color: colors.foreground }}>
        ● {stats.byTier.Community} Community
      </Text>
    </View>

    {/* Filter chips */}
    <View className="flex-row gap-2 mb-3">
      <FilterChip label="All" active={filter.mode === 'all'} onPress={() => setFilter({ mode: 'all' })} colors={colors} />
      <FilterChip
        label="Fading"
        active={filter.mode === 'fading'}
        onPress={() => setFilter({ mode: 'fading' })}
        colors={colors}
        count={stats.health.fading}
      />
      <FilterChip
        label="Momentum"
        active={filter.mode === 'momentum'}
        onPress={() => setFilter({ mode: 'momentum' })}
        colors={colors}
        count={stats.health.momentum}
      />
    </View>

    {/* Instructions */}
    <Text className="font-inter text-xs text-center" style={{ color: colors['muted-foreground'] }}>
      Pinch to zoom • Pan to explore • Double-tap to reset
    </Text>
  </View>
);

// Filter chip
interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
  count?: number;
}

const FilterChip: React.FC<FilterChipProps> = ({ label, active, onPress, colors, count }) => (
  <TouchableOpacity
    className="px-3 py-1.5 rounded-full border"
    style={{
      backgroundColor: active ? colors.primary : colors.muted,
      borderColor: active ? colors.primary : colors.border,
    }}
    onPress={onPress}
  >
    <Text
      className="text-xs"
      style={{
        color: active ? colors['primary-foreground'] : colors.foreground,
        fontFamily: active ? 'Inter_600SemiBold' : 'Inter_400Regular',
      }}
    >
      {label}
      {count !== undefined && count > 0 && ` (${count})`}
    </Text>
  </TouchableOpacity>
);

// Insights Tab
interface InsightsTabProps {
  stats: any;
  colors: any;
}

const InsightsTab: React.FC<InsightsTabProps> = ({ stats, colors }) => (
  <ScrollView className="flex-1 p-5">
    <Text className="font-lora text-lg font-bold mb-4" style={{ color: colors.foreground }}>
      Network Health
    </Text>

    {/* Tier breakdown */}
    <View className="gap-3 mb-6">
      <StatRow label="Inner Circle" value={stats.byTier.InnerCircle} total={stats.total} colors={colors} />
      <StatRow label="Close Friends" value={stats.byTier.CloseFriends} total={stats.total} colors={colors} />
      <StatRow label="Community" value={stats.byTier.Community} total={stats.total} colors={colors} />
    </View>

    {/* Health breakdown */}
    <Text className="font-lora text-lg font-bold mb-4" style={{ color: colors.foreground }}>
      Relationship Health
    </Text>
    <View className="gap-3">
      <HealthStat label="Thriving" value={stats.health.thriving} color="#34D399" colors={colors} />
      <HealthStat label="Fading" value={stats.health.fading} color="#F87171" colors={colors} />
      <HealthStat label="Momentum" value={stats.health.momentum} color="#FFD700" colors={colors} />
    </View>

    <Text className="font-inter text-sm text-center mt-6" style={{ color: colors['muted-foreground'] }}>
      More detailed graphs and patterns coming soon...
    </Text>
  </ScrollView>
);

// Context Tab
interface ContextTabProps {
  explanation: any;
  season: string;
  colors: any;
}

const ContextTab: React.FC<ContextTabProps> = ({ explanation, season, colors }) => (
  <ScrollView className="flex-1 p-5">
    {explanation ? (
      <>
        <Text className="font-lora text-xl font-bold mb-4" style={{ color: colors.foreground }}>
          {explanation.headline}
        </Text>

        {explanation.reasons.length > 0 && (
          <View className="mb-5 gap-2">
            <Text
              className="font-inter-semibold text-xs uppercase tracking-wide mb-2"
              style={{ color: colors['muted-foreground'] }}
            >
              Based on:
            </Text>
            {explanation.reasons.map((reason: string, index: number) => (
              <View key={index} className="flex-row gap-2">
                <Text className="font-inter-semibold text-base leading-5" style={{ color: colors.primary }}>
                  •
                </Text>
                <Text className="flex-1 font-inter text-sm leading-5" style={{ color: colors.foreground }}>
                  {reason}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View className="p-4 rounded-xl" style={{ backgroundColor: colors.muted }}>
          <Text className="font-inter text-sm leading-5" style={{ color: colors.foreground }}>
            {explanation.insight}
          </Text>
        </View>
      </>
    ) : (
      <Text className="font-inter text-sm text-center mt-6" style={{ color: colors['muted-foreground'] }}>
        Season context loading...
      </Text>
    )}
  </ScrollView>
);

// Helper components
const StatRow: React.FC<{ label: string; value: number; total: number; colors: any }> = ({
  label,
  value,
  total,
  colors,
}) => {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <View className="flex-row items-center gap-3">
      <Text className="font-inter-medium text-sm w-24" style={{ color: colors.foreground }}>
        {label}
      </Text>
      <View className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
        <View
          className="h-full rounded-full"
          style={{ width: `${percentage}%`, backgroundColor: colors.primary }}
        />
      </View>
      <Text className="font-inter-semibold text-sm w-8 text-right" style={{ color: colors.foreground }}>
        {value}
      </Text>
    </View>
  );
};

const HealthStat: React.FC<{ label: string; value: number; color: string; colors: any }> = ({
  label,
  value,
  color,
  colors,
}) => (
  <View className="flex-row items-center gap-3">
    <View className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
    <Text className="flex-1 font-inter-medium text-sm" style={{ color: colors.foreground }}>
      {label}
    </Text>
    <Text className="font-inter-semibold text-base" style={{ color: colors.foreground }}>
      {value}
    </Text>
  </View>
);
