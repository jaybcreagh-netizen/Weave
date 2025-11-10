/**
 * GraphsTabContent - Enhanced Edition
 * Beautiful visual charts with heat maps, gradients, and portfolio insights
 * Moon/cosmic theme with smooth animations and glassmorphism
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, Dimensions, TouchableOpacity, Modal, Pressable } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G, Path, Rect, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeInDown, SlideInRight } from 'react-native-reanimated';
import { database } from '../../db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '../../db/models/Friend';
import InteractionModel from '../../db/models/Interaction';
import { getYearMoonData, getYearStats } from '../../lib/year-in-moons-data';
import { usePortfolio } from '../../hooks/usePortfolio';
import { useTheme } from '../../hooks/useTheme';
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: screenWidth } = Dimensions.get('window');

// Theme-aware color palette for graphs
const getGraphTheme = (isDarkMode: boolean) => ({
  // Card backgrounds
  cardBackground: isDarkMode ? '#2A2E3F' : '#FFFFFF',
  cardBackgroundAlt: isDarkMode ? '#1F2332' : '#F8F9FA',
  cardBackgroundDeep: isDarkMode ? '#1a1d2e' : '#E8EAF0',
  cardBorder: isDarkMode ? '#3A3E5F' : '#E0E3E9',

  // Text colors
  textPrimary: isDarkMode ? '#F5F1E8' : '#2D3142',
  textSecondary: isDarkMode ? '#8A8F9E' : '#6C7589',
  textTertiary: isDarkMode ? '#C5CAD3' : '#8B92A6',

  // Chart colors - primary palette
  chartPrimary: isDarkMode ? '#7A7EAF' : '#6366F1', // Purple
  chartSecondary: isDarkMode ? '#A78BFA' : '#8B5CF6', // Lighter purple
  chartTertiary: isDarkMode ? '#5A5E8F' : '#4F46E5', // Deeper purple
  chartAccent: isDarkMode ? '#8B95C9' : '#A5B4FC', // Soft purple

  // Energy/Battery colors
  energyColor: isDarkMode ? '#A78BFA' : '#8B5CF6',
  energyGlow: isDarkMode ? 'rgba(167, 139, 250, 0.3)' : 'rgba(139, 92, 246, 0.2)',

  // Weave/Connection colors
  weaveColor: isDarkMode ? '#F5C563' : '#F59E0B',
  weaveGlow: isDarkMode ? 'rgba(245, 197, 99, 0.3)' : 'rgba(245, 158, 11, 0.2)',

  // Heatmap colors
  heatmapEmpty: isDarkMode ? '#1F2332' : '#F0F2F5',
  heatmapLevel1: isDarkMode ? '#3A3E5F' : '#DDD6FE',
  heatmapLevel2: isDarkMode ? '#4A4E6F' : '#C4B5FD',
  heatmapLevel3: isDarkMode ? '#5A5E8F' : '#A78BFA',
  heatmapLevel4: isDarkMode ? '#7A7EAF' : '#7C3AED',

  // Grid and structure
  gridLine: isDarkMode ? '#3A3E5F' : '#E5E7EB',
  axisLine: isDarkMode ? '#3A3E5F' : '#D1D5DB',

  // Interactive states
  hoverBackground: isDarkMode ? '#3A3E5F' : '#F3F4F6',
  activeBackground: isDarkMode ? '#5A5F9E' : '#E0E7FF',

  // Gradients
  gradientStart: isDarkMode ? '#2A2E3F' : '#FFFFFF',
  gradientEnd: isDarkMode ? '#1F2332' : '#F8F9FA',

  // Health score colors (keep consistent)
  healthHigh: '#4CAF50',
  healthGood: '#8BC34A',
  healthMedium: '#FFC107',
  healthLow: '#FF5722',

  // Tier colors (from constants, adjusted for theme)
  tierInner: isDarkMode ? '#A56A43' : '#8B5A3C',
  tierClose: isDarkMode ? '#E58A57' : '#D97640',
  tierCommunity: isDarkMode ? '#6C8EAD' : '#5A7A9D',

  // Special accent colors
  accentGold: isDarkMode ? '#fbbf24' : '#F59E0B',
  accentPurple: isDarkMode ? '#7A7EAF' : '#7C3AED',

  // Shadow and depth
  shadowColor: isDarkMode ? '#000' : '#6B7280',
  shadowOpacity: isDarkMode ? 0.4 : 0.15,
});

interface GraphsTabContentProps {
  year?: number;
}

interface TooltipData {
  visible: boolean;
  type: 'heatmap' | 'donut' | 'tier' | 'rhythm' | 'friend' | null;
  data: any;
  position?: { x: number; y: number };
}

export function GraphsTabContent({ year = new Date().getFullYear() }: GraphsTabContentProps) {
  const { isDarkMode } = useTheme();
  const graphTheme = useMemo(() => getGraphTheme(isDarkMode), [isDarkMode]);

  const [isLoading, setIsLoading] = useState(true);
  const [weeklyRhythm, setWeeklyRhythm] = useState<any[]>([]);
  const [topFriends, setTopFriends] = useState<Array<{ name: string; count: number }>>([]);
  const [archetypeDistribution, setArchetypeDistribution] = useState<Record<string, number>>({});
  const [batteryWeaveData, setBatteryWeaveData] = useState<Array<{ date: Date; battery: number; weaves: number }>>([]);
  const [heatmapData, setHeatmapData] = useState<Array<{ date: Date; count: number }>>([]);
  const { portfolio } = usePortfolio();
  const [tooltip, setTooltip] = useState<TooltipData>({ visible: false, type: null, data: null });

  useEffect(() => {
    loadGraphData();
  }, [year]);

  const loadGraphData = async () => {
    setIsLoading(true);
    try {
      // 1. Get weekly rhythm from battery data
      const yearData = await getYearMoonData(year);
      const allDays = yearData.flatMap(month => month.days.filter(d => d.hasCheckin));

      if (allDays.length > 0) {
        // Calculate day-of-week averages
        const dayData: Array<{ dayOfWeek: number; avgBattery: number; count: number }> =
          Array.from({ length: 7 }, (_, i) => ({ dayOfWeek: i, avgBattery: 0, count: 0 }));

        allDays.forEach((day) => {
          const dayOfWeek = day.date.getDay(); // 0 = Sunday, 6 = Saturday
          dayData[dayOfWeek].avgBattery += day.batteryLevel;
          dayData[dayOfWeek].count += 1;
        });

        // Calculate averages
        dayData.forEach((day) => {
          if (day.count > 0) {
            day.avgBattery = day.avgBattery / day.count;
          }
        });

        setWeeklyRhythm(dayData);
      }

      // 2. Get battery + weave correlation data (last 90 days)
      const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
      const recentDays = allDays.filter(d => d.date.getTime() > ninetyDaysAgo);

      // Count weaves per day
      const interactions = await database
        .get<InteractionModel>('interactions')
        .query(
          Q.where('interaction_date', Q.gte(ninetyDaysAgo)),
          Q.where('status', 'completed')
        )
        .fetch();

      const weavesByDate = new Map<string, number>();
      interactions.forEach(i => {
        const dateKey = new Date(i.interactionDate).toDateString();
        weavesByDate.set(dateKey, (weavesByDate.get(dateKey) || 0) + 1);
      });

      const correlationData = recentDays.map(d => ({
        date: d.date,
        battery: d.batteryLevel,
        weaves: weavesByDate.get(d.date.toDateString()) || 0,
      }));
      setBatteryWeaveData(correlationData);

      // 3. Build year heatmap (all days with weave counts)
      const yearStart = new Date(year, 0, 1).getTime();
      const yearEnd = new Date(year, 11, 31, 23, 59, 59).getTime();

      const yearInteractions = await database
        .get<InteractionModel>('interactions')
        .query(
          Q.where('interaction_date', Q.gte(yearStart)),
          Q.where('interaction_date', Q.lte(yearEnd)),
          Q.where('status', 'completed')
        )
        .fetch();

      const heatmap: Array<{ date: Date; count: number }> = [];
      for (let d = new Date(yearStart); d <= new Date(yearEnd); d.setDate(d.getDate() + 1)) {
        const dateKey = new Date(d).toDateString();
        const count = weavesByDate.get(dateKey) || 0;
        heatmap.push({ date: new Date(d), count });
      }
      setHeatmapData(heatmap);

      // 4. Get top friends (by interaction count this year)
      const friendInteractionCount = new Map<string, number>();
      for (const interaction of yearInteractions) {
        const interactionFriends = await database
          .get('interaction_friends')
          .query(Q.where('interaction_id', interaction.id))
          .fetch();

        for (const ifriend of interactionFriends) {
          const friendId = (ifriend as any)._raw.friend_id;
          friendInteractionCount.set(friendId, (friendInteractionCount.get(friendId) || 0) + 1);
        }
      }

      // Get friend names and sort
      const friendCounts = await Promise.all(
        Array.from(friendInteractionCount.entries()).map(async ([friendId, count]) => {
          try {
            const friend = await database.get<FriendModel>('friends').find(friendId);
            return { name: friend.name, count };
          } catch {
            return null;
          }
        })
      );

      const validFriendCounts = friendCounts.filter((f): f is { name: string; count: number } => f !== null);
      setTopFriends(validFriendCounts.sort((a, b) => b.count - a.count).slice(0, 5));

      // 5. Get archetype distribution
      const allFriends = await database.get<FriendModel>('friends').query().fetch();
      const archetypes: Record<string, number> = {};
      allFriends.forEach(f => {
        archetypes[f.archetype] = (archetypes[f.archetype] || 0) + 1;
      });
      setArchetypeDistribution(archetypes);

    } catch (error) {
      console.error('Error loading graph data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const showTooltip = (type: TooltipData['type'], data: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTooltip({ visible: true, type, data });
  };

  const hideTooltip = () => {
    setTooltip({ visible: false, type: null, data: null });
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <Text style={{ color: graphTheme.textSecondary, fontFamily: 'Inter_400Regular', fontSize: 14 }}>
          Loading your data...
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Portfolio Health Score */}
        {portfolio && (
          <Animated.View entering={FadeInDown.delay(0)} style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: graphTheme.textPrimary, fontFamily: 'Lora_600SemiBold', marginBottom: 16 }}>
              Network Health
            </Text>
            <PortfolioHealthCard portfolio={portfolio} theme={graphTheme} />
          </Animated.View>
        )}

        {/* Year Activity Heatmap */}
        {heatmapData.length > 0 && (
          <Animated.View entering={FadeInDown.delay(100)} style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: graphTheme.textPrimary, fontFamily: 'Lora_600SemiBold', marginBottom: 8 }}>
              Activity Pattern
            </Text>
            <Text style={{ fontSize: 13, color: graphTheme.textSecondary, fontFamily: 'Inter_400Regular', marginBottom: 16 }}>
              Your logged interactions over the last 16 weeks
            </Text>
            <ActivityHeatmap data={heatmapData} onCellPress={(day) => showTooltip('heatmap', day)} theme={graphTheme} />
          </Animated.View>
        )}

        {/* Tier Health Visualization */}
        {portfolio && (
          <Animated.View entering={FadeInDown.delay(200)} style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: graphTheme.textPrimary, fontFamily: 'Lora_600SemiBold', marginBottom: 16 }}>
              Tier Health
            </Text>
            <TierHealthRings portfolio={portfolio} onTierPress={(tier) => showTooltip('tier', tier)} theme={graphTheme} />
          </Animated.View>
        )}

        {/* Weekly Energy Rhythm */}
        {weeklyRhythm.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300)} style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: graphTheme.textPrimary, fontFamily: 'Lora_600SemiBold', marginBottom: 16 }}>
              Weekly Energy Rhythm
            </Text>
            <WeeklyRhythmRadial data={weeklyRhythm} onDayPress={(day) => showTooltip('rhythm', day)} theme={graphTheme} />
          </Animated.View>
        )}

        {/* Battery + Weaves Correlation */}
        {batteryWeaveData.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400)} style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: graphTheme.textPrimary, fontFamily: 'Lora_600SemiBold', marginBottom: 16 }}>
              Energy & Connection
            </Text>
            <BatteryWeaveChart data={batteryWeaveData} theme={graphTheme} />
          </Animated.View>
        )}

        {/* Top Friends with Sparkles */}
        {topFriends.length > 0 && (
          <Animated.View entering={FadeInDown.delay(500)} style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: graphTheme.textPrimary, fontFamily: 'Lora_600SemiBold', marginBottom: 12 }}>
              Most Connected
            </Text>
            {topFriends.map((friend, index) => (
              <TouchableOpacity
                key={friend.name}
                onPress={() => showTooltip('friend', friend)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: index === 0 ? graphTheme.hoverBackground : graphTheme.cardBackground,
                  padding: 14,
                  borderRadius: 16,
                  marginBottom: 8,
                  borderWidth: index === 0 ? 1 : 0,
                  borderColor: index === 0 ? graphTheme.activeBackground : 'transparent',
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      backgroundColor: index === 0 ? graphTheme.chartPrimary : graphTheme.hoverBackground,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 14, color: '#FFFFFF', fontFamily: 'Inter_700Bold' }}>
                      {index + 1}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 16, color: graphTheme.textPrimary, fontFamily: 'Inter_600SemiBold' }}>
                    {friend.name}
                  </Text>
                  {index === 0 && <Text style={{ fontSize: 16 }}>✨</Text>}
                </View>
                <Text style={{ fontSize: 14, color: graphTheme.textSecondary, fontFamily: 'Inter_400Regular' }}>
                  {friend.count} weaves
                </Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* Archetype Distribution */}
        {Object.keys(archetypeDistribution).length > 0 && (
          <Animated.View entering={FadeInDown.delay(600)} style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: graphTheme.textPrimary, fontFamily: 'Lora_600SemiBold', marginBottom: 12 }}>
              Circle Archetypes
            </Text>
            <ArchetypeDonutChart archetypes={archetypeDistribution} onSegmentPress={(data) => showTooltip('donut', data)} theme={graphTheme} />
          </Animated.View>
        )}

        {/* Spacer */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Tooltip Modal */}
      <TooltipModal tooltip={tooltip} onClose={hideTooltip} theme={graphTheme} />
    </>
  );
}

// ============================================
// PORTFOLIO HEALTH CARD
// ============================================
function PortfolioHealthCard({ portfolio, theme }: { portfolio: any; theme: ReturnType<typeof getGraphTheme> }) {
  const healthScore = Math.round(portfolio.overallHealthScore);
  const getHealthColor = (score: number) => {
    if (score >= 80) return theme.healthHigh;
    if (score >= 60) return theme.healthGood;
    if (score >= 40) return theme.healthMedium;
    return theme.healthLow;
  };

  return (
    <LinearGradient
      colors={[theme.gradientStart, theme.gradientEnd]}
      style={{
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: theme.cardBorder,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 48, fontWeight: '700', color: getHealthColor(healthScore), fontFamily: 'Lora_700Bold' }}>
            {healthScore}
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>
            Health Score
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <MetricPill label="Thriving" value={portfolio.thrivingFriends} color={theme.healthHigh} theme={theme} />
          <MetricPill label="Drifting" value={portfolio.driftingFriends} color="#FF9800" theme={theme} />
          <MetricPill label="Total" value={portfolio.totalFriends} color={theme.chartPrimary} theme={theme} />
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: theme.gridLine, marginVertical: 12 }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: theme.textPrimary, fontFamily: 'Inter_600SemiBold' }}>
            {portfolio.recentActivityMetrics.totalInteractions}
          </Text>
          <Text style={{ fontSize: 11, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>
            Last 30 Days
          </Text>
        </View>
        <View style={{ width: 1, height: 40, backgroundColor: theme.gridLine }} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: theme.textPrimary, fontFamily: 'Inter_600SemiBold' }}>
            {Math.round(portfolio.recentActivityMetrics.diversityScore * 100)}%
          </Text>
          <Text style={{ fontSize: 11, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>
            Diversity
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function MetricPill({ label, value, color, theme }: { label: string; value: number; color: string; theme: ReturnType<typeof getGraphTheme> }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${color}20`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: theme.textPrimary, fontFamily: 'Inter_500Medium' }}>
        {label}: {value}
      </Text>
    </View>
  );
}

// ============================================
// ACTIVITY HEATMAP (GitHub-style)
// ============================================
function ActivityHeatmap({
  data,
  onCellPress,
  theme
}: {
  data: Array<{ date: Date; count: number }>;
  onCellPress: (day: any) => void;
  theme: ReturnType<typeof getGraphTheme>;
}) {
  const weeksToShow = 16; // 4 months
  const cellGap = 3;

  // Calculate cell size to fill the width: (screenWidth - scrollViewPadding - cardPadding - gaps) / weeks
  // screenWidth - 40 (scrollView padding) - 40 (card padding) - (16-1)*3 (gaps between weeks) = available width
  // Then divide by 16 weeks
  const availableWidth = screenWidth - 40 - 40 - (weeksToShow - 1) * cellGap;
  const cellSize = Math.floor(availableWidth / weeksToShow);

  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getHeatColor = (count: number) => {
    if (count === 0) return theme.heatmapEmpty;
    const intensity = Math.min(count / maxCount, 1);
    if (intensity > 0.75) return theme.heatmapLevel4;
    if (intensity > 0.5) return theme.heatmapLevel3;
    if (intensity > 0.25) return theme.heatmapLevel2;
    return theme.heatmapLevel1;
  };

  // Get last 16 weeks
  const recentData = data.slice(-weeksToShow * 7);

  return (
    <View style={{ backgroundColor: theme.cardBackground, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {Array.from({ length: weeksToShow }).map((_, weekIndex) => (
          <View key={weekIndex}>
            {Array.from({ length: 7 }).map((_, dayIndex) => {
              const dataIndex = weekIndex * 7 + dayIndex;
              const dayData = recentData[dataIndex];
              if (!dayData) return <View key={dayIndex} style={{ width: cellSize, height: cellSize + cellGap }} />;

              return (
                <TouchableOpacity
                  key={dayIndex}
                  onPress={() => onCellPress(dayData)}
                  style={{
                    width: cellSize,
                    height: cellSize,
                    backgroundColor: getHeatColor(dayData.count),
                    borderRadius: 2,
                    marginBottom: cellGap,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
      {/* Legend */}
      <View style={{ marginTop: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 9, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>Less</Text>
              {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
                <View
                  key={i}
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: getHeatColor(intensity * maxCount),
                    borderRadius: 2,
                  }}
                />
              ))}
              <Text style={{ fontSize: 9, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>More</Text>
            </View>
            <Text style={{ fontSize: 9, color: theme.textTertiary, fontFamily: 'Inter_400Regular' }}>
              Tap any day for details
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ============================================
// TIER HEALTH RINGS (Concentric Circles)
// ============================================
function TierHealthRings({
  portfolio,
  onTierPress,
  theme
}: {
  portfolio: any;
  onTierPress: (tier: any) => void;
  theme: ReturnType<typeof getGraphTheme>;
}) {
  const size = Math.min(screenWidth - 80, 280);
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  const tierData = portfolio.tierDistribution || [];
  const sortedTiers = [...tierData].sort((a: any, b: any) => {
    const order: Record<string, number> = { InnerCircle: 0, CloseFriends: 1, Community: 2 };
    return order[a.tier] - order[b.tier];
  });

  const tierColors: Record<string, string> = {
    InnerCircle: theme.tierInner,
    CloseFriends: theme.tierClose,
    Community: theme.tierCommunity,
  };

  const tierLabels: Record<string, string> = {
    InnerCircle: 'Inner Circle',
    CloseFriends: 'Close Friends',
    Community: 'Community',
  };

  return (
    <View style={{ backgroundColor: theme.cardBackground, borderRadius: 20, padding: 20 }}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Svg width={size} height={size}>
          <Defs>
            {sortedTiers.map((tier: any, index: number) => (
              <SvgLinearGradient key={tier.tier} id={`grad-${tier.tier}`} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={tierColors[tier.tier]} stopOpacity="0.8" />
                <Stop offset="1" stopColor={tierColors[tier.tier]} stopOpacity="0.4" />
              </SvgLinearGradient>
            ))}
          </Defs>

          {/* Background circles */}
          {[1, 0.66, 0.33].map((scale, i) => (
            <Circle
              key={i}
              cx={center}
              cy={center}
              r={maxRadius * scale}
              stroke={theme.gridLine}
              strokeWidth="1"
              fill="none"
              opacity={0.3}
            />
          ))}

          {/* Tier rings */}
          {sortedTiers.map((tier: any, index: number) => {
            const radius = maxRadius * (1 - index * 0.33);
            const healthPercent = tier.avgScore / 100;
            const strokeWidth = 20;

            return (
              <G key={tier.tier}>
                {/* Background ring */}
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={theme.cardBackgroundAlt}
                  strokeWidth={strokeWidth}
                  fill="none"
                />
                {/* Health ring */}
                <Circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={`url(#grad-${tier.tier})`}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * radius * healthPercent} ${2 * Math.PI * radius}`}
                  strokeLinecap="round"
                  rotation="-90"
                  origin={`${center}, ${center}`}
                />
              </G>
            );
          })}

          {/* Center score */}
          <SvgText
            x={center}
            y={center}
            fontSize="32"
            fill={theme.textPrimary}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontFamily="Lora_700Bold"
          >
            {Math.round(portfolio.overallHealthScore)}
          </SvgText>
        </Svg>
      </View>

      {/* Legend */}
      <View style={{ gap: 8 }}>
        {sortedTiers.map((tier: any) => {
          const totalFriends = sortedTiers.reduce((sum: number, t: any) => sum + t.count, 0);
          const percentage = totalFriends > 0 ? (tier.count / totalFriends) * 100 : 0;

          return (
            <TouchableOpacity
              key={tier.tier}
              onPress={() => onTierPress({ tier: tier.tier, avgScore: tier.avgScore, count: tier.count, percentage })}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tierColors[tier.tier] }} />
                <Text style={{ fontSize: 13, color: theme.textPrimary, fontFamily: 'Inter_500Medium' }}>
                  {tierLabels[tier.tier]}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>
                  {Math.round(tier.avgScore)}/100
                </Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>
                  ({tier.count})
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ============================================
// WEEKLY RHYTHM RADIAL (Enhanced)
// ============================================
function WeeklyRhythmRadial({
  data,
  onDayPress,
  theme
}: {
  data: any[];
  onDayPress: (day: any) => void;
  theme: ReturnType<typeof getGraphTheme>;
}) {
  const size = Math.min(screenWidth - 80, 300);
  const center = size / 2;
  const radius = size / 2 - 40;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxBattery = 5;

  return (
    <View style={{ alignItems: 'center', backgroundColor: theme.cardBackground, borderRadius: 20, padding: 20 }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="radialGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.energyColor} stopOpacity="0.5" />
            <Stop offset="1" stopColor={theme.chartPrimary} stopOpacity="0.3" />
          </SvgLinearGradient>
        </Defs>

        {/* Background circles */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale, i) => (
          <Circle
            key={i}
            cx={center}
            cy={center}
            r={radius * scale}
            stroke={theme.gridLine}
            strokeWidth="1"
            fill="none"
            opacity={0.3}
          />
        ))}

        {/* Radial lines */}
        {data.map((_, index) => {
          const angle = (index / data.length) * 2 * Math.PI - Math.PI / 2;
          const x2 = center + Math.cos(angle) * radius;
          const y2 = center + Math.sin(angle) * radius;
          return (
            <Line
              key={`line-${index}`}
              x1={center}
              y1={center}
              x2={x2}
              y2={y2}
              stroke={theme.gridLine}
              strokeWidth="1"
              opacity={0.3}
            />
          );
        })}

        {/* Data polygon with gradient fill */}
        {data.length > 0 && (
          <G>
            <Path
              d={data.map((day, index) => {
                const angle = (index / data.length) * 2 * Math.PI - Math.PI / 2;
                const value = day.avgBattery || 0;
                const distance = (value / maxBattery) * radius;
                const x = center + Math.cos(angle) * distance;
                const y = center + Math.sin(angle) * distance;
                return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
              }).join(' ') + ' Z'}
              fill="url(#radialGrad)"
              stroke={theme.energyColor}
              strokeWidth="2.5"
            />
            {/* Data points with glow */}
            {data.map((day, index) => {
              const angle = (index / data.length) * 2 * Math.PI - Math.PI / 2;
              const value = day.avgBattery || 0;
              const distance = (value / maxBattery) * radius;
              const x = center + Math.cos(angle) * distance;
              const y = center + Math.sin(angle) * distance;
              return (
                <G key={`point-${index}`} onPress={() => onDayPress(day)}>
                  <Circle cx={x} cy={y} r={6} fill={theme.energyColor} opacity={0.3} />
                  <Circle cx={x} cy={y} r={4} fill={theme.textPrimary} />
                </G>
              );
            })}
          </G>
        )}

        {/* Day labels */}
        {data.map((day, index) => {
          const angle = (index / data.length) * 2 * Math.PI - Math.PI / 2;
          const labelDistance = radius + 25;
          const x = center + Math.cos(angle) * labelDistance;
          const y = center + Math.sin(angle) * labelDistance;
          return (
            <SvgText
              key={`label-${index}`}
              x={x}
              y={y}
              fontSize="12"
              fill={theme.textSecondary}
              textAnchor="middle"
              alignmentBaseline="middle"
              fontFamily="Inter_600SemiBold"
            >
              {dayNames[day.dayOfWeek]}
            </SvgText>
          );
        })}
      </Svg>
      <Text style={{ marginTop: 12, fontSize: 12, color: theme.textSecondary, fontFamily: 'Inter_400Regular', textAlign: 'center' }}>
        Average energy level by day of week
      </Text>
    </View>
  );
}

// ============================================
// BATTERY + WEAVES CHART (Enhanced)
// ============================================
function BatteryWeaveChart({
  data,
  theme
}: {
  data: Array<{ date: Date; battery: number; weaves: number }>;
  theme: ReturnType<typeof getGraphTheme>;
}) {
  const chartWidth = screenWidth - 80;
  const chartHeight = 220;
  const padding = 40;

  const maxWeaves = Math.max(...data.map(d => d.weaves), 1);
  const maxBattery = 5;

  // Calculate weekly averages to reduce noise
  const weeklyData: Array<{ week: number; avgBattery: number; avgWeaves: number }> = [];
  const weeks = Math.ceil(data.length / 7);

  for (let i = 0; i < weeks; i++) {
    const weekData = data.slice(i * 7, (i + 1) * 7);
    if (weekData.length > 0) {
      const avgBattery = weekData.reduce((sum, d) => sum + d.battery, 0) / weekData.length;
      const avgWeaves = weekData.reduce((sum, d) => sum + d.weaves, 0) / weekData.length;
      weeklyData.push({ week: i, avgBattery, avgWeaves });
    }
  }

  return (
    <View style={{ backgroundColor: theme.cardBackground, borderRadius: 20, padding: 20 }}>
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <SvgLinearGradient id="batteryGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.energyColor} stopOpacity="0.4" />
            <Stop offset="1" stopColor={theme.energyColor} stopOpacity="0.05" />
          </SvgLinearGradient>
          <SvgLinearGradient id="weaveGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.weaveColor} stopOpacity="0.4" />
            <Stop offset="1" stopColor={theme.weaveColor} stopOpacity="0.05" />
          </SvgLinearGradient>
        </Defs>

        {/* Grid lines */}
        {[0.25, 0.5, 0.75].map((ratio, i) => (
          <Line
            key={i}
            x1={padding}
            y1={chartHeight - padding - (chartHeight - 2 * padding) * ratio}
            x2={chartWidth - padding}
            y2={chartHeight - padding - (chartHeight - 2 * padding) * ratio}
            stroke={theme.gridLine}
            strokeWidth="1"
            opacity={0.3}
            strokeDasharray="4 4"
          />
        ))}

        {/* Axes */}
        <Line
          x1={padding}
          y1={chartHeight - padding}
          x2={chartWidth - padding}
          y2={chartHeight - padding}
          stroke={theme.axisLine}
          strokeWidth="2"
        />
        <Line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={chartHeight - padding}
          stroke={theme.axisLine}
          strokeWidth="2"
        />

        {/* Battery area fill */}
        {weeklyData.length > 1 && (
          <Path
            d={
              weeklyData.map((w, i) => {
                const x = padding + (i / (weeklyData.length - 1)) * (chartWidth - 2 * padding);
                const y = chartHeight - padding - (w.avgBattery / maxBattery) * (chartHeight - 2 * padding);
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
              }).join(' ') +
              ` L ${chartWidth - padding} ${chartHeight - padding} L ${padding} ${chartHeight - padding} Z`
            }
            fill="url(#batteryGrad)"
          />
        )}

        {/* Battery line */}
        {weeklyData.length > 1 && (
          <Path
            d={weeklyData.map((w, i) => {
              const x = padding + (i / (weeklyData.length - 1)) * (chartWidth - 2 * padding);
              const y = chartHeight - padding - (w.avgBattery / maxBattery) * (chartHeight - 2 * padding);
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ')}
            stroke={theme.energyColor}
            strokeWidth="3"
            fill="none"
          />
        )}

        {/* Weaves area fill */}
        {weeklyData.length > 1 && (
          <Path
            d={
              weeklyData.map((w, i) => {
                const x = padding + (i / (weeklyData.length - 1)) * (chartWidth - 2 * padding);
                const y = chartHeight - padding - (w.avgWeaves / maxWeaves) * (chartHeight - 2 * padding);
                return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
              }).join(' ') +
              ` L ${chartWidth - padding} ${chartHeight - padding} L ${padding} ${chartHeight - padding} Z`
            }
            fill="url(#weaveGrad)"
          />
        )}

        {/* Weaves line */}
        {weeklyData.length > 1 && (
          <Path
            d={weeklyData.map((w, i) => {
              const x = padding + (i / (weeklyData.length - 1)) * (chartWidth - 2 * padding);
              const y = chartHeight - padding - (w.avgWeaves / maxWeaves) * (chartHeight - 2 * padding);
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
            }).join(' ')}
            stroke={theme.weaveColor}
            strokeWidth="3"
            fill="none"
          />
        )}

        {/* Axis labels */}
        <SvgText x={padding} y={15} fontSize="10" fill={theme.textSecondary} fontFamily="Inter_400Regular">
          Energy
        </SvgText>
        <SvgText x={chartWidth - 60} y={chartHeight - 10} fontSize="10" fill={theme.textSecondary} fontFamily="Inter_400Regular" textAnchor="end">
          Weeks
        </SvgText>
      </Svg>

      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 24, height: 4, backgroundColor: theme.energyColor, borderRadius: 2 }} />
          <Text style={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>Energy</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 24, height: 4, backgroundColor: theme.weaveColor, borderRadius: 2 }} />
          <Text style={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>Weaves</Text>
        </View>
      </View>
    </View>
  );
}

// ============================================
// ARCHETYPE DONUT CHART
// ============================================
function ArchetypeDonutChart({
  archetypes,
  onSegmentPress,
  theme
}: {
  archetypes: Record<string, number>;
  onSegmentPress: (data: any) => void;
  theme: ReturnType<typeof getGraphTheme>;
}) {
  const size = Math.min(screenWidth - 80, 260);
  const center = size / 2;
  const outerRadius = size / 2 - 30;
  const innerRadius = outerRadius * 0.6;

  const total = Object.values(archetypes).reduce((sum, count) => sum + count, 0);
  const entries = Object.entries(archetypes).sort((a, b) => b[1] - a[1]);

  const colors = [
    theme.chartPrimary, theme.chartSecondary, theme.chartTertiary, theme.chartAccent,
    theme.accentPurple, theme.energyColor, theme.weaveColor, theme.activeBackground
  ];

  let currentAngle = -Math.PI / 2;

  const paths = entries.map(([archetype, count], index) => {
    const percentage = count / total;
    const angle = percentage * 2 * Math.PI;
    const endAngle = currentAngle + angle;

    const x1 = center + Math.cos(currentAngle) * outerRadius;
    const y1 = center + Math.sin(currentAngle) * outerRadius;
    const x2 = center + Math.cos(endAngle) * outerRadius;
    const y2 = center + Math.sin(endAngle) * outerRadius;
    const x3 = center + Math.cos(endAngle) * innerRadius;
    const y3 = center + Math.sin(endAngle) * innerRadius;
    const x4 = center + Math.cos(currentAngle) * innerRadius;
    const y4 = center + Math.sin(currentAngle) * innerRadius;

    const largeArc = angle > Math.PI ? 1 : 0;

    const path = `
      M ${x1} ${y1}
      A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2}
      L ${x3} ${y3}
      A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}
      Z
    `;

    const result = { path, color: colors[index % colors.length], archetype, count, percentage };
    currentAngle = endAngle;
    return result;
  });

  return (
    <View style={{ backgroundColor: theme.cardBackground, borderRadius: 20, padding: 20 }}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Svg width={size} height={size}>
          {paths.map((p, i) => (
            <G key={i} onPress={() => onSegmentPress({ archetype: p.archetype, count: p.count, percentage: p.percentage, color: p.color })}>
              <Path d={p.path} fill={p.color} />
            </G>
          ))}
          <SvgText
            x={center}
            y={center}
            fontSize="28"
            fill={theme.textPrimary}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontFamily="Lora_700Bold"
          >
            {total}
          </SvgText>
          <SvgText
            x={center}
            y={center + 20}
            fontSize="11"
            fill={theme.textSecondary}
            textAnchor="middle"
            alignmentBaseline="middle"
            fontFamily="Inter_400Regular"
          >
            friends
          </SvgText>
        </Svg>
      </View>

      <View style={{ gap: 8 }}>
        {entries.map(([archetype, count], index) => {
          const percentage = (count / total);
          return (
            <TouchableOpacity
              key={archetype}
              onPress={() => onSegmentPress({ archetype, count, percentage, color: colors[index % colors.length] })}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors[index % colors.length] }} />
                <Text style={{ fontSize: 14, color: theme.textPrimary, fontFamily: 'Inter_500Medium' }}>
                  {archetype}
                </Text>
              </View>
              <Text style={{ fontSize: 13, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>
                {count} ({Math.round(percentage * 100)}%)
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ============================================
// TOOLTIP MODAL
// ============================================
function TooltipModal({ tooltip, onClose, theme }: { tooltip: TooltipData; onClose: () => void; theme: ReturnType<typeof getGraphTheme> }) {
  if (!tooltip.visible || !tooltip.data) return null;

  const renderContent = () => {
    switch (tooltip.type) {
      case 'heatmap':
        return (
          <>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.textPrimary, fontFamily: 'Lora_700Bold', marginBottom: 8 }}>
              {tooltip.data.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '700', color: theme.chartPrimary, fontFamily: 'Lora_700Bold', marginBottom: 4 }}>
              {tooltip.data.count}
            </Text>
            <Text style={{ fontSize: 14, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>
              {tooltip.data.count === 0 ? 'No weaves' : tooltip.data.count === 1 ? 'weave logged' : 'weaves logged'}
            </Text>
          </>
        );

      case 'rhythm':
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return (
          <>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.textPrimary, fontFamily: 'Lora_700Bold', marginBottom: 8 }}>
              {dayNames[tooltip.data.dayOfWeek]}
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '700', color: theme.energyColor, fontFamily: 'Lora_700Bold', marginBottom: 4 }}>
              {tooltip.data.avgBattery.toFixed(1)}/5
            </Text>
            <Text style={{ fontSize: 14, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>
              Average energy level
            </Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'Inter_400Regular', marginTop: 8 }}>
              Based on {tooltip.data.count} check-ins
            </Text>
          </>
        );

      case 'tier':
        const tierLabels: Record<string, string> = {
          InnerCircle: 'Inner Circle',
          CloseFriends: 'Close Friends',
          Community: 'Community',
        };
        return (
          <>
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.textPrimary, fontFamily: 'Lora_700Bold', marginBottom: 8 }}>
              {tierLabels[tooltip.data.tier]}
            </Text>
            <Text style={{ fontSize: 32, fontWeight: '700', color: theme.chartPrimary, fontFamily: 'Lora_700Bold', marginBottom: 4 }}>
              {Math.round(tooltip.data.avgScore)}
            </Text>
            <Text style={{ fontSize: 14, color: theme.textSecondary, fontFamily: 'Inter_400Regular', marginBottom: 8 }}>
              Average health score
            </Text>
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '600', color: theme.textPrimary, fontFamily: 'Inter_600SemiBold' }}>
                  {tooltip.data.count}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>
                  friends
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 18, fontWeight: '600', color: theme.textPrimary, fontFamily: 'Inter_600SemiBold' }}>
                  {tooltip.data.percentage.toFixed(0)}%
                </Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>
                  of network
                </Text>
              </View>
            </View>
          </>
        );

      case 'friend':
        return (
          <>
            <Text style={{ fontSize: 24, fontWeight: '700', color: theme.textPrimary, fontFamily: 'Lora_700Bold', marginBottom: 16 }}>
              {tooltip.data.name}
            </Text>
            <Text style={{ fontSize: 48, fontWeight: '700', color: theme.chartPrimary, fontFamily: 'Lora_700Bold', marginBottom: 4 }}>
              {tooltip.data.count}
            </Text>
            <Text style={{ fontSize: 16, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>
              weaves this year
            </Text>
            <View style={{ marginTop: 16, padding: 12, backgroundColor: theme.cardBackgroundDeep, borderRadius: 12 }}>
              <Text style={{ fontSize: 13, color: theme.textTertiary, fontFamily: 'Inter_400Regular', textAlign: 'center' }}>
                Your most frequent connection this year!
              </Text>
            </View>
          </>
        );

      case 'donut':
        return (
          <>
            <Text style={{ fontSize: 24, fontWeight: '700', color: theme.textPrimary, fontFamily: 'Lora_700Bold', marginBottom: 8 }}>
              {tooltip.data.archetype}
            </Text>
            <Text style={{ fontSize: 48, fontWeight: '700', color: tooltip.data.color, fontFamily: 'Lora_700Bold', marginBottom: 4 }}>
              {tooltip.data.count}
            </Text>
            <Text style={{ fontSize: 16, color: theme.textSecondary, fontFamily: 'Inter_400Regular' }}>
              {tooltip.data.count === 1 ? 'friend' : 'friends'} • {Math.round(tooltip.data.percentage * 100)}% of circle
            </Text>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <Modal visible={tooltip.visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1 }} onPress={onClose}>
        <BlurView intensity={20} style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Animated.View entering={FadeIn.duration(200)}>
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: theme.cardBackground,
                borderRadius: 24,
                padding: 32,
                minWidth: 280,
                maxWidth: 320,
                borderWidth: 1,
                borderColor: theme.cardBorder,
                shadowColor: theme.shadowColor,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: theme.shadowOpacity,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <TouchableOpacity
                onPress={onClose}
                style={{ position: 'absolute', top: 16, right: 16, padding: 8 }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={theme.textSecondary} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center' }}>
                {renderContent()}
              </View>
            </Pressable>
          </Animated.View>
        </BlurView>
      </Pressable>
    </Modal>
  );
}
