/**
 * GraphsTabContent
 * Visual charts and graphs for Year in Moons
 * Moon/cosmic theme with battery trends, weekly rhythms, and friend analytics
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Dimensions } from 'react-native';
import Svg, { Circle, Line, Text as SvgText, G, Path, Rect } from 'react-native-svg';
import { database } from '../../db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '../../db/models/Friend';
import InteractionModel from '../../db/models/Interaction';
import WeeklyReflection from '../../db/models/WeeklyReflection';
import { getYearMoonData, getYearStats } from '../../lib/year-in-moons-data';
import { STORY_CHIPS } from '../../lib/story-chips';

const { width: screenWidth } = Dimensions.get('window');

interface GraphsTabContentProps {
  year?: number;
}

export function GraphsTabContent({ year = new Date().getFullYear() }: GraphsTabContentProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [weeklyRhythm, setWeeklyRhythm] = useState<any[]>([]);
  const [topFriends, setTopFriends] = useState<Array<{ name: string; count: number }>>([]);
  const [archetypeDistribution, setArchetypeDistribution] = useState<Record<string, number>>({});
  const [batteryWeaveData, setBatteryWeaveData] = useState<Array<{ date: Date; battery: number; weaves: number }>>([]);
  const [storyChipThemes, setStoryChipThemes] = useState<Array<{ chipId: string; label: string; count: number }>>([]);
  const [depthScoreData, setDepthScoreData] = useState<Array<{ month: string; reflectionRate: number }>>([]);

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

      // 3. Get top friends (by interaction count this year)
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

      // 4. Get archetype distribution
      const allFriends = await database.get<FriendModel>('friends').query().fetch();
      const archetypes: Record<string, number> = {};
      allFriends.forEach(f => {
        archetypes[f.archetype] = (archetypes[f.archetype] || 0) + 1;
      });
      setArchetypeDistribution(archetypes);

      // 5. Get story chip themes from interactions and weekly reflections
      const chipCounts: Record<string, number> = {};

      // From interactions
      interactions.forEach(interaction => {
        if (interaction.reflection?.chips) {
          interaction.reflection.chips.forEach((chip: { chipId: string }) => {
            chipCounts[chip.chipId] = (chipCounts[chip.chipId] || 0) + 1;
          });
        }
      });

      // From weekly reflections
      const weeklyReflections = await database
        .get<WeeklyReflection>('weekly_reflections')
        .query(
          Q.where('week_end_date', Q.gte(yearStart)),
          Q.where('week_end_date', Q.lte(yearEnd))
        )
        .fetch();

      weeklyReflections.forEach(reflection => {
        reflection.storyChips.forEach(chip => {
          chipCounts[chip.chipId] = (chipCounts[chip.chipId] || 0) + 1;
        });
      });

      // Convert to array and sort by count
      const themes = Object.entries(chipCounts)
        .map(([chipId, count]) => {
          const chip = STORY_CHIPS.find(c => c.id === chipId);
          return chip ? { chipId, label: chip.plainText, count } : null;
        })
        .filter((t): t is { chipId: string; label: string; count: number } => t !== null)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8); // Top 8 themes

      setStoryChipThemes(themes);

      // 6. Calculate depth score (reflection completion rate) by month
      const monthlyReflectionRate: Array<{ month: string; reflectionRate: number }> = [];

      for (let month = 0; month < 12; month++) {
        const monthStart = new Date(year, month, 1).getTime();
        const monthEnd = new Date(year, month + 1, 0, 23, 59, 59).getTime();

        const monthInteractions = await database
          .get<InteractionModel>('interactions')
          .query(
            Q.where('interaction_date', Q.gte(monthStart)),
            Q.where('interaction_date', Q.lte(monthEnd)),
            Q.where('status', 'completed')
          )
          .fetch();

        if (monthInteractions.length > 0) {
          const withReflections = monthInteractions.filter(i =>
            i.reflection && i.reflection.chips && i.reflection.chips.length > 0
          ).length;

          const rate = (withReflections / monthInteractions.length) * 100;
          const monthName = new Date(year, month, 1).toLocaleString('en-US', { month: 'short' });
          monthlyReflectionRate.push({ month: monthName, reflectionRate: rate });
        }
      }

      setDepthScoreData(monthlyReflectionRate);

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

      {/* Top Friends */}
      {topFriends.length > 0 && (
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Lora_600SemiBold', marginBottom: 12 }}>
            Most Connected
          </Text>
          {topFriends.map((friend, index) => (
            <View
              key={friend.name}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#2A2E3F',
                padding: 12,
                borderRadius: 12,
                marginBottom: 8,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 20, color: '#F5F1E8', fontFamily: 'Inter_600SemiBold' }}>
                  {index + 1}
                </Text>
                <Text style={{ fontSize: 15, color: '#F5F1E8', fontFamily: 'Inter_500Medium' }}>
                  {friend.name}
                </Text>
              </View>
              <Text style={{ fontSize: 14, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>
                {friend.count} weaves
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Archetype Distribution */}
      {Object.keys(archetypeDistribution).length > 0 && (
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Lora_600SemiBold', marginBottom: 12 }}>
            Circle Archetypes
          </Text>
          {Object.entries(archetypeDistribution)
            .sort((a, b) => b[1] - a[1])
            .map(([archetype, count]) => (
              <View
                key={archetype}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#2A2E3F',
                  padding: 12,
                  borderRadius: 12,
                  marginBottom: 8,
                }}
              >
                <Text style={{ fontSize: 15, color: '#F5F1E8', fontFamily: 'Inter_500Medium' }}>
                  {archetype}
                </Text>
                <Text style={{ fontSize: 14, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>
                  {count} {count === 1 ? 'friend' : 'friends'}
                </Text>
              </View>
            ))}
        </View>
      )}

      {/* Themes Over Time */}
      {storyChipThemes.length > 0 && (
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Lora_600SemiBold', marginBottom: 16 }}>
            Your Connection Themes
          </Text>
          <ThemesBarChart data={storyChipThemes} />
        </View>
      )}

      {/* Depth Score Trend */}
      {depthScoreData.length > 0 && (
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#F5F1E8', fontFamily: 'Lora_600SemiBold', marginBottom: 16 }}>
            Reflection Depth
          </Text>
          <DepthScoreChart data={depthScoreData} />
        </View>
      )}

      {/* Spacer */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

// Weekly Rhythm Radial Chart Component
function WeeklyRhythmRadial({ data }: { data: any[] }) {
  const size = Math.min(screenWidth - 80, 300);
  const center = size / 2;
  const radius = size / 2 - 40;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const maxBattery = 5;

  return (
    <View style={{ alignItems: 'center', backgroundColor: '#2A2E3F', borderRadius: 20, padding: 20 }}>
      <Svg width={size} height={size}>
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

        {/* Data polygon */}
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
              fill="#7A7EAF"
              fillOpacity={0.3}
              stroke="#A78BFA"
              strokeWidth="2"
            />
            {/* Data points */}
            {data.map((day, index) => {
              const angle = (index / data.length) * 2 * Math.PI - Math.PI / 2;
              const value = day.avgBattery || 0;
              const distance = (value / maxBattery) * radius;
              const x = center + Math.cos(angle) * distance;
              const y = center + Math.sin(angle) * distance;
              return (
                <Circle
                  key={`point-${index}`}
                  cx={x}
                  cy={y}
                  r={4}
                  fill="#F5F1E8"
                />
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
              fontFamily="Inter_500Medium"
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

// Battery + Weaves Correlation Chart Component
function BatteryWeaveChart({ data }: { data: Array<{ date: Date; battery: number; weaves: number }> }) {
  const chartWidth = screenWidth - 80;
  const chartHeight = 200;
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

        {/* Battery line (purple) */}
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

        {/* Weaves line (gold) */}
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
          <View style={{ width: 20, height: 3, backgroundColor: '#A78BFA', borderRadius: 2 }} />
          <Text style={{ fontSize: 12, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>Energy</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 20, height: 3, backgroundColor: '#F5C563', borderRadius: 2 }} />
          <Text style={{ fontSize: 12, color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}>Weaves</Text>
        </View>
      </View>
    </View>
  );
}

// Themes Bar Chart Component
function ThemesBarChart({ data }: { data: Array<{ chipId: string; label: string; count: number }> }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);

  return (
    <View style={{ backgroundColor: '#2A2E3F', borderRadius: 20, padding: 20 }}>
      {data.map((theme, index) => {
        const barWidth = (theme.count / maxCount) * 100;

        return (
          <View key={theme.chipId} style={{ marginBottom: index < data.length - 1 ? 12 : 0 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 13, color: '#F5F1E8', fontFamily: 'Inter_500Medium', flex: 1 }}>
                {theme.label}
              </Text>
              <Text style={{ fontSize: 13, color: '#8A8F9E', fontFamily: 'Inter_400Regular', marginLeft: 8 }}>
                {theme.count}
              </Text>
            </View>
            <View style={{ height: 8, backgroundColor: '#3A3E5F', borderRadius: 4, overflow: 'hidden' }}>
              <View
                style={{
                  height: '100%',
                  width: `${barWidth}%`,
                  backgroundColor: '#A78BFA',
                  borderRadius: 4,
                }}
              />
            </View>
          </View>
        );
      })}
      <Text style={{ marginTop: 12, fontSize: 12, color: '#8A8F9E', fontFamily: 'Inter_400Regular', textAlign: 'center' }}>
        Most common moments and feelings this year
      </Text>
    </View>
  );
}

// Depth Score Chart Component
function DepthScoreChart({ data }: { data: Array<{ month: string; reflectionRate: number }> }) {
  const chartWidth = screenWidth - 80;
  const chartHeight = 180;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const barWidth = (chartWidth - padding.left - padding.right) / data.length - 4;

  return (
    <View style={{ backgroundColor: '#2A2E3F', borderRadius: 20, padding: 20 }}>
      <Svg width={chartWidth} height={chartHeight}>
        {/* Y-axis labels */}
        {[0, 25, 50, 75, 100].map((value, i) => {
          const y = chartHeight - padding.bottom - (value / 100) * (chartHeight - padding.top - padding.bottom);
          return (
            <G key={value}>
              <Line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                stroke="#3A3E5F"
                strokeWidth="1"
                opacity={0.3}
              />
              <SvgText
                x={padding.left - 8}
                y={y}
                fontSize="10"
                fill="#8A8F9E"
                textAnchor="end"
                alignmentBaseline="middle"
                fontFamily="Inter_400Regular"
              >
                {value}%
              </SvgText>
            </G>
          );
        })}

        {/* Bars */}
        {data.map((d, i) => {
          const barHeight = (d.reflectionRate / 100) * (chartHeight - padding.top - padding.bottom);
          const x = padding.left + i * (barWidth + 4);
          const y = chartHeight - padding.bottom - barHeight;

          return (
            <G key={d.month}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="#F5C563"
                rx={2}
              />
              <SvgText
                x={x + barWidth / 2}
                y={chartHeight - padding.bottom + 12}
                fontSize="10"
                fill="#8A8F9E"
                textAnchor="middle"
                fontFamily="Inter_400Regular"
              >
                {d.month}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <Text style={{ marginTop: 12, fontSize: 12, color: '#8A8F9E', fontFamily: 'Inter_400Regular', textAlign: 'center' }}>
        Percentage of weaves with reflections by month
      </Text>
    </View>
  );
}
