/**
 * ReflectionCalendarView
 * Monthly calendar view for navigating weekly reflections
 */

import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import * as Haptics from 'expo-haptics';

interface ReflectionCalendarViewProps {
  reflections: WeeklyReflection[];
  onReflectionSelect: (reflection: WeeklyReflection) => void;
}

export function ReflectionCalendarView({ reflections, onReflectionSelect }: ReflectionCalendarViewProps) {
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());

  // Get month start and end
  const monthStart = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  }, [currentDate]);

  const monthEnd = useMemo(() => {
    return new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  }, [currentDate]);

  // Group reflections by week start date
  const reflectionsByWeek = useMemo(() => {
    const map = new Map<string, WeeklyReflection>();
    reflections.forEach(r => {
      const weekKey = new Date(r.weekStartDate).toDateString();
      map.set(weekKey, r);
    });
    return map;
  }, [reflections]);

  // Generate calendar weeks for current month
  const calendarWeeks = useMemo(() => {
    const weeks: Date[][] = [];
    const firstDay = new Date(monthStart);
    firstDay.setDate(firstDay.getDate() - firstDay.getDay()); // Start from Sunday

    let currentWeek: Date[] = [];
    for (let i = 0; i < 42; i++) { // 6 weeks max
      const day = new Date(firstDay);
      day.setDate(firstDay.getDate() + i);
      currentWeek.push(day);

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    return weeks;
  }, [monthStart]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
      return newDate;
    });
  };

  const getReflectionForWeek = (weekStart: Date): WeeklyReflection | undefined => {
    // Find reflection where weekStart falls within the week
    return reflections.find(r => {
      const reflectionWeekStart = new Date(r.weekStartDate);
      const reflectionWeekEnd = new Date(r.weekEndDate);
      return weekStart >= reflectionWeekStart && weekStart <= reflectionWeekEnd;
    });
  };

  const isCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentDate.getMonth();
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View className="px-5 py-4">
      {/* Month Navigator */}
      <View className="flex-row items-center justify-between mb-4">
        <TouchableOpacity onPress={() => navigateMonth('prev')} className="p-2">
          <ChevronLeft size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text
          className="text-lg font-semibold"
          style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
        >
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </Text>
        <TouchableOpacity onPress={() => navigateMonth('next')} className="p-2">
          <ChevronRight size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Day Headers */}
      <View className="flex-row mb-2">
        {dayNames.map(day => (
          <View key={day} className="flex-1 items-center">
            <Text
              className="text-xs font-medium"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
            >
              {day}
            </Text>
          </View>
        ))}
      </View>

      {/* Calendar Grid */}
      <ScrollView showsVerticalScrollIndicator={false}>
        {calendarWeeks.map((week, weekIndex) => {
          const weekStart = week[0]; // Sunday of this week
          const reflection = getReflectionForWeek(weekStart);
          const hasReflection = !!reflection;
          const isThisMonth = week.some(day => isCurrentMonth(day));

          if (!isThisMonth && !hasReflection) return null; // Skip weeks outside month with no reflections

          return (
            <TouchableOpacity
              key={weekIndex}
              onPress={() => {
                if (hasReflection) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onReflectionSelect(reflection);
                }
              }}
              disabled={!hasReflection}
              activeOpacity={0.7}
              className="mb-3 p-3 rounded-xl"
              style={{
                backgroundColor: hasReflection ? colors.card : colors.muted + '40',
                borderWidth: hasReflection ? 1 : 0,
                borderColor: hasReflection ? colors.border : 'transparent',
                opacity: hasReflection ? 1 : 0.5,
              }}
            >
              <View className="flex-row items-center justify-between mb-2">
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                >
                  {week[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {week[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                {hasReflection && (
                  <View
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: colors.primary }}
                  />
                )}
              </View>

              {hasReflection && reflection && (
                <View className="flex-row gap-2">
                  <View
                    className="px-2 py-1 rounded"
                    style={{ backgroundColor: colors.muted }}
                  >
                    <Text
                      className="text-xs"
                      style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                    >
                      {reflection.totalWeaves} weaves
                    </Text>
                  </View>
                  {reflection.storyChips.length > 0 && (
                    <View
                      className="px-2 py-1 rounded"
                      style={{ backgroundColor: colors.primary + '15' }}
                    >
                      <Text
                        className="text-xs"
                        style={{ color: colors.primary, fontFamily: 'Inter_400Regular' }}
                      >
                        {reflection.storyChips.length} themes
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {!hasReflection && (
                <Text
                  className="text-xs italic"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  No reflection
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}
