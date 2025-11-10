/**
 * GraphsTabContent - Enhanced Edition
 * Beautiful visual charts with heat maps, gradients, and portfolio insights
 * Moon/cosmic theme with smooth animations and glassmorphism
 */

import React, { useState, useEffect } from 'react';
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
import { TrendingUp, TrendingDown, Minus, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width: screenWidth } = Dimensions.get('window');

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

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
        <Text style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular', fontSize: 14 }}>
          Loading your data...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Portfolio Health Score */}
      {portfolio && (
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Lora_600SemiBold', marginBottom: 16 }}>
            Network Health
          </Text>
          <PortfolioHealthCard portfolio={portfolio} />
        </View>
      )}

      {/* Year Activity Heatmap */}
      {heatmapData.length > 0 && (
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Lora_600SemiBold', marginBottom: 16 }}>
            Year at a Glance
          </Text>
          <ActivityHeatmap data={heatmapData} />
        </View>
      )}

      {/* Tier Health Visualization */}
      {portfolio && (
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Lora_600SemiBold', marginBottom: 16 }}>
            Tier Health
          </Text>
          <TierHealthRings portfolio={portfolio} />
        </View>
      )}

      {/* Weekly Energy Rhythm */}
      {weeklyRhythm.length > 0 && (
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Lora_600SemiBold', marginBottom: 16 }}>
            Weekly Energy Rhythm
          </Text>
          <WeeklyRhythmRadial data={weeklyRhythm} />
        </View>
      )}

      {/* Battery + Weaves Correlation */}
      {batteryWeaveData.length > 0 && (
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Lora_600SemiBold', marginBottom: 16 }}>
            Energy & Connection
          </Text>
          <BatteryWeaveChart data={batteryWeaveData} />
        </View>
      )}

      {/* Top Friends with Sparkles */}
      {topFriends.length > 0 && (
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Lora_600SemiBold', marginBottom: 12 }}>
            Most Connected
          </Text>
          {topFriends.map((friend, index) => (
            <TouchableOpacity
              key={friend.name}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: index === 0 ? '#3A3E5F' : '#2A2E3F',
                padding: 14,
                borderRadius: 16,
                marginBottom: 8,
                borderWidth: index === 0 ? 1 : 0,
                borderColor: index === 0 ? '#5A5F9E' : 'transparent',
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: index === 0 ? '#7A7EAF' : '#3A3E5F',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#F5F1E8', fontFamily: 'Inter_700Bold' }}>
                    {index + 1}
                  </Text>
                </View>
                <Text style={{ fontSize: 16, color: '#F5F1E8', fontFamily: 'Inter_600SemiBold' }}>
                  {friend.name}
                </Text>
                {index === 0 && <Text style={{ fontSize: 16 }}>✨</Text>}
              </View>
              <Text style={{ fontSize: 14, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>
                {friend.count} weaves
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Archetype Distribution */}
      {Object.keys(archetypeDistribution).length > 0 && (
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Lora_600SemiBold', marginBottom: 12 }}>
            Circle Archetypes
          </Text>
          <ArchetypeDonutChart archetypes={archetypeDistribution} />
        </View>
      )}

      {/* Spacer */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// ============================================
// PORTFOLIO HEALTH CARD
// ============================================
function PortfolioHealthCard({ portfolio }: { portfolio: any }) {
  const healthScore = Math.round(portfolio.overallHealthScore);
  const getHealthColor = (score: number) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#8BC34A';
    if (score >= 40) return '#FFC107';
    return '#FF5722';
  };

  return (
    <LinearGradient
      colors={['#2A2E3F', '#1F2332']}
      style={{
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#3A3E5F',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <View>
          <Text style={{ fontSize: 48, fontWeight: '700', color: getHealthColor(healthScore), fontFamily: 'Lora_700Bold' }}>
            {healthScore}
          </Text>
          <Text style={{ fontSize: 12, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>
            Health Score
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 8 }}>
          <MetricPill label="Thriving" value={portfolio.thrivingFriends} color="#4CAF50" />
          <MetricPill label="Drifting" value={portfolio.driftingFriends} color="#FF9800" />
          <MetricPill label="Total" value={portfolio.totalFriends} color="#7A7EAF" />
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: '#3A3E5F', marginVertical: 12 }} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Inter_600SemiBold' }}>
            {portfolio.recentActivityMetrics.totalInteractions}
          </Text>
          <Text style={{ fontSize: 11, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>
            Last 30 Days
          </Text>
        </View>
        <View style={{ width: 1, height: 40, backgroundColor: '#3A3E5F' }} />
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Inter_600SemiBold' }}>
            {Math.round(portfolio.recentActivityMetrics.diversityScore * 100)}%
          </Text>
          <Text style={{ fontSize: 11, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>
            Diversity
          </Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function MetricPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: `${color}20`, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 12, color: '#F5F1E8', fontFamily: 'Inter_500Medium' }}>
        {label}: {value}
      </Text>
    </View>
  );
}

// ============================================
// ACTIVITY HEATMAP (GitHub-style)
// ============================================
function ActivityHeatmap({ data }: { data: Array<{ date: Date; count: number }> }) {
  const cellSize = 12;
  const cellGap = 3;
  const weeksToShow = 26; // 6 months

  const maxCount = Math.max(...data.map(d => d.count), 1);

  const getHeatColor = (count: number) => {
    if (count === 0) return '#1F2332';
    const intensity = Math.min(count / maxCount, 1);
    if (intensity > 0.75) return '#7A7EAF';
    if (intensity > 0.5) return '#5A5E8F';
    if (intensity > 0.25) return '#4A4E6F';
    return '#3A3E5F';
  };

  // Get last 26 weeks
  const recentData = data.slice(-weeksToShow * 7);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ backgroundColor: '#2A2E3F', borderRadius: 20, padding: 16 }}>
        <View style={{ flexDirection: 'row' }}>
          {Array.from({ length: weeksToShow }).map((_, weekIndex) => (
            <View key={weekIndex} style={{ marginRight: cellGap }}>
              {Array.from({ length: 7 }).map((_, dayIndex) => {
                const dataIndex = weekIndex * 7 + dayIndex;
                const dayData = recentData[dataIndex];
                if (!dayData) return null;

                return (
                  <TouchableOpacity
                    key={dayIndex}
                    onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
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
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, alignItems: 'center' }}>
          <Text style={{ fontSize: 10, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>
            Last 6 months
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 9, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>Less</Text>
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
            <Text style={{ fontSize: 9, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>More</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

// ============================================
// TIER HEALTH RINGS (Concentric Circles)
// ============================================
function TierHealthRings({ portfolio }: { portfolio: any }) {
  const size = Math.min(screenWidth - 80, 280);
  const center = size / 2;
  const maxRadius = size / 2 - 20;

  const tierData = portfolio.tierDistribution || [];
  const sortedTiers = [...tierData].sort((a: any, b: any) => {
    const order: Record<string, number> = { InnerCircle: 0, CloseFriends: 1, Community: 2 };
    return order[a.tier] - order[b.tier];
  });

  const tierColors: Record<string, string> = {
    InnerCircle: '#A56A43', // Warm brown - closest connections
    CloseFriends: '#E58A57', // Friendly orange - important bonds
    Community: '#6C8EAD',    // Calm blue - wider community
  };

  const tierLabels: Record<string, string> = {
    InnerCircle: 'Inner Circle',
    CloseFriends: 'Close Friends',
    Community: 'Community',
  };

  return (
    <View style={{ backgroundColor: '#2A2E3F', borderRadius: 20, padding: 20 }}>
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
              stroke="#3A3E5F"
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
                  stroke="#1F2332"
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
            fill="#F5F1E8"
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
        {sortedTiers.map((tier: any) => (
          <View key={tier.tier} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: tierColors[tier.tier] }} />
              <Text style={{ fontSize: 13, color: '#F5F1E8', fontFamily: 'Inter_500Medium' }}>
                {tierLabels[tier.tier]}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 13, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>
                {Math.round(tier.avgScore)}/100
              </Text>
              <Text style={{ fontSize: 12, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>
                ({tier.count})
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// ============================================
// WEEKLY RHYTHM RADIAL (Enhanced)
// ============================================
function WeeklyRhythmRadial({ data }: { data: any[] }) {
  const size = Math.min(screenWidth - 80, 300);
  const center = size / 2;
  const radius = size / 2 - 40;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxBattery = 5;

  return (
    <View style={{ alignItems: 'center', backgroundColor: '#2A2E3F', borderRadius: 20, padding: 20 }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="radialGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#A78BFA" stopOpacity="0.5" />
            <Stop offset="1" stopColor="#7A7EAF" stopOpacity="0.3" />
          </SvgLinearGradient>
        </Defs>

        {/* Background circles */}
        {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale, i) => (
          <Circle
            key={i}
            cx={center}
            cy={center}
            r={radius * scale}
            stroke="#3A3E5F"
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
              stroke="#3A3E5F"
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
              stroke="#A78BFA"
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
                <G key={`point-${index}`}>
                  <Circle cx={x} cy={y} r={6} fill="#A78BFA" opacity={0.3} />
                  <Circle cx={x} cy={y} r={4} fill="#F5F1E8" />
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
              fill="#8A8F9E"
              textAnchor="middle"
              alignmentBaseline="middle"
              fontFamily="Inter_600SemiBold"
            >
              {dayNames[day.dayOfWeek]}
            </SvgText>
          );
        })}
      </Svg>
      <Text style={{ marginTop: 12, fontSize: 12, color: '#8A8F9E', fontFamily: 'Inter_400Regular', textAlign: 'center' }}>
        Average energy level by day of week
      </Text>
    </View>
  );
}

// ============================================
// BATTERY + WEAVES CHART (Enhanced)
// ============================================
function BatteryWeaveChart({ data }: { data: Array<{ date: Date; battery: number; weaves: number }> }) {
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
    <View style={{ backgroundColor: '#2A2E3F', borderRadius: 20, padding: 20 }}>
      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <SvgLinearGradient id="batteryGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#A78BFA" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#A78BFA" stopOpacity="0.05" />
          </SvgLinearGradient>
          <SvgLinearGradient id="weaveGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#F5C563" stopOpacity="0.4" />
            <Stop offset="1" stopColor="#F5C563" stopOpacity="0.05" />
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
            stroke="#3A3E5F"
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
          stroke="#3A3E5F"
          strokeWidth="2"
        />
        <Line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={chartHeight - padding}
          stroke="#3A3E5F"
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
            stroke="#A78BFA"
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
            stroke="#F5C563"
            strokeWidth="3"
            fill="none"
          />
        )}

        {/* Axis labels */}
        <SvgText x={padding} y={15} fontSize="10" fill="#8A8F9E" fontFamily="Inter_400Regular">
          Energy
        </SvgText>
        <SvgText x={chartWidth - 60} y={chartHeight - 10} fontSize="10" fill="#8A8F9E" fontFamily="Inter_400Regular" textAnchor="end">
          Weeks
        </SvgText>
      </Svg>

      {/* Legend */}
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 24, height: 4, backgroundColor: '#A78BFA', borderRadius: 2 }} />
          <Text style={{ fontSize: 12, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>Energy</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 24, height: 4, backgroundColor: '#F5C563', borderRadius: 2 }} />
          <Text style={{ fontSize: 12, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>Weaves</Text>
        </View>
      </View>
    </View>
  );
}

// ============================================
// ARCHETYPE DONUT CHART
// ============================================
function ArchetypeDonutChart({ archetypes }: { archetypes: Record<string, number> }) {
  const size = Math.min(screenWidth - 80, 260);
  const center = size / 2;
  const outerRadius = size / 2 - 30;
  const innerRadius = outerRadius * 0.6;

  const total = Object.values(archetypes).reduce((sum, count) => sum + count, 0);
  const entries = Object.entries(archetypes).sort((a, b) => b[1] - a[1]);

  const colors = [
    '#7A7EAF', '#A78BFA', '#5A5E8F', '#8B95C9',
    '#6A6E9F', '#9AA3D3', '#4A4E7F', '#7A84B4'
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
    <View style={{ backgroundColor: '#2A2E3F', borderRadius: 20, padding: 20 }}>
      <View style={{ alignItems: 'center', marginBottom: 20 }}>
        <Svg width={size} height={size}>
          {paths.map((p, i) => (
            <Path key={i} d={p.path} fill={p.color} />
          ))}
          <SvgText
            x={center}
            y={center}
            fontSize="28"
            fill="#F5F1E8"
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
            fill="#8A8F9E"
            textAnchor="middle"
            alignmentBaseline="middle"
            fontFamily="Inter_400Regular"
          >
            friends
          </SvgText>
        </Svg>
      </View>

      <View style={{ gap: 8 }}>
        {entries.map(([archetype, count], index) => (
          <View key={archetype} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors[index % colors.length] }} />
              <Text style={{ fontSize: 14, color: '#F5F1E8', fontFamily: 'Inter_500Medium' }}>
                {archetype}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>
              {count} ({Math.round((count / total) * 100)}%)
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
