/**
 * ActivityDots
 * Simple dot-based activity visualization
 * Week view: 7 dots (M-S)
 * Month view: Calendar grid (4-5 weeks)
 */

import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface DayData {
  date: Date;
  count: number;
}

interface ActivityDotsProps {
  data: DayData[];
  period: 'week' | 'month';
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export const ActivityDots: React.FC<ActivityDotsProps> = ({
  data,
  period,
}) => {
  const { tokens } = useTheme();

  if (period === 'week') {
    return <WeekView data={data} tokens={tokens} />;
  }

  return <MonthView data={data} tokens={tokens} />;
};

// Week view: Single row of 7 dots
const WeekView: React.FC<{
  data: DayData[];
  tokens: any;
}> = ({ data, tokens }) => {
  // Ensure we have 7 days, filling with zeros if needed
  const weekData = React.useMemo(() => {
    const result: number[] = new Array(7).fill(0);

    data.forEach((day) => {
      // Get day of week (0 = Sunday in JS, but we want Monday = 0)
      const jsDay = day.date.getDay();
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convert to Monday = 0
      result[dayIndex] = day.count;
    });

    return result;
  }, [data]);

  return (
    <View className="flex-row justify-between py-2">
      {weekData.map((count, index) => (
        <View key={index} className="items-center gap-1.5">
          <ActivityDot count={count} tokens={tokens} />
          <Text
            className="text-[11px] font-inter-medium"
            style={{
              color: tokens.foregroundMuted,
            }}
          >
            {DAY_LABELS[index]}
          </Text>
        </View>
      ))}
    </View>
  );
};

// Month view: Calendar grid
const MonthView: React.FC<{
  data: DayData[];
  tokens: any;
}> = ({ data, tokens }) => {
  // Group data by weeks
  const weeks = React.useMemo(() => {
    if (data.length === 0) return [];

    // Sort by date
    const sorted = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

    // Group into weeks (Monday-Sunday)
    const result: number[][] = [];
    let currentWeek: number[] = [];
    let currentWeekStart: number | null = null;

    sorted.forEach((day) => {
      const jsDay = day.date.getDay();
      const dayIndex = jsDay === 0 ? 6 : jsDay - 1; // Monday = 0

      // Get week start (Monday) for this date
      const weekStart = new Date(day.date);
      weekStart.setDate(weekStart.getDate() - dayIndex);
      weekStart.setHours(0, 0, 0, 0);
      const weekStartTime = weekStart.getTime();

      if (currentWeekStart !== weekStartTime) {
        // New week
        if (currentWeek.length > 0) {
          // Pad previous week to 7 days
          while (currentWeek.length < 7) {
            currentWeek.push(0);
          }
          result.push(currentWeek);
        }
        currentWeek = new Array(dayIndex).fill(0); // Pad start of week
        currentWeekStart = weekStartTime;
      }

      currentWeek.push(day.count);
    });

    // Add final week
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(0);
      }
      result.push(currentWeek);
    }

    return result;
  }, [data]);

  return (
    <View className="gap-1">
      {/* Day labels header */}
      <View className="flex-row justify-between mb-1">
        {DAY_LABELS.map((label, index) => (
          <Text
            key={index}
            className="flex-1 text-center text-[10px] font-inter-medium"
            style={{
              color: tokens.foregroundSubtle,
            }}
          >
            {label}
          </Text>
        ))}
      </View>

      {/* Week rows */}
      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} className="flex-row justify-between">
          {week.map((count, dayIndex) => (
            <View key={dayIndex} className="flex-1 items-center py-1">
              <ActivityDot count={count} tokens={tokens} size="small" />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

// Individual dot component
const ActivityDot: React.FC<{
  count: number;
  tokens: any;
  size?: 'default' | 'small';
}> = ({ count, tokens, size = 'default' }) => {
  const dotSize = size === 'default' ? 16 : 12;

  // No activity — empty dot
  if (count === 0) {
    return (
      <View
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: tokens.borderSubtle,
        }}
      />
    );
  }

  // Has activity — filled dot with intensity based on count
  // 1 weave = 50% opacity, 2 = 70%, 3+ = 100%
  const safeCount = Number.isFinite(count) ? count : 0;
  const opacity = Math.min(0.4 + (safeCount * 0.2), 1);

  return (
    <View
      style={{
        width: dotSize,
        height: dotSize,
        borderRadius: dotSize / 2,
        backgroundColor: tokens.primary,
        opacity,
      }}
    />
  );
};

export default ActivityDots;
