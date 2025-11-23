import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react-native';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
  format,
  isToday,
  isSameMonth,
  isSameDay,
  isAfter,
  isBefore,
  startOfDay,
  isFuture,
} from 'date-fns';
import { useTheme } from '@/shared/hooks/useTheme';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

interface Interaction {
  id: string;
  interactionDate: Date;
  status: string;
  title?: string;
  activity?: string;
  interactionCategory?: string;
}

interface GlobalYearCalendarProps {
  interactions: Interaction[];
  onDateSelect: (date: Date, interactions: Interaction[]) => void;
}

export function GlobalYearCalendar({ interactions, onDateSelect }: GlobalYearCalendarProps) {
  const { colors } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const firstDayOfMonth = startOfMonth(currentMonth);
  const lastDayOfMonth = endOfMonth(currentMonth);

  const days = eachDayOfInterval({
    start: startOfWeek(firstDayOfMonth),
    end: endOfWeek(lastDayOfMonth),
  });

  // Group interactions by date for efficient lookup
  const interactionsByDate = useMemo(() => {
    const map = new Map<string, Interaction[]>();
    interactions.forEach((interaction) => {
      const dateKey = format(startOfDay(new Date(interaction.interactionDate)), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(interaction);
    });
    return map;
  }, [interactions]);

  // Get interaction counts and types for a date
  const getDateInfo = (date: Date) => {
    const dateKey = format(startOfDay(date), 'yyyy-MM-dd');
    const dayInteractions = interactionsByDate.get(dateKey) || [];

    const completed = dayInteractions.filter(i => i.status === 'completed').length;
    const planned = dayInteractions.filter(i =>
      i.status === 'planned' || i.status === 'pending_confirm'
    ).length;

    return { total: dayInteractions.length, completed, planned, interactions: dayInteractions };
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  return (
    <View className="flex-1">
      {/* Header with Month/Year and Navigation */}
      <View
        className="flex-row justify-between items-center px-5 py-4 border-b"
        style={{ borderColor: colors.border }}
      >
        <TouchableOpacity
          onPress={prevMonth}
          className="p-2 rounded-full"
          style={{ backgroundColor: colors.muted }}
        >
          <ChevronLeft color={colors.foreground} size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={goToToday}
          className="px-4 py-2 rounded-full"
          style={{ backgroundColor: colors.secondary }}
        >
          <Text
            className="text-base font-semibold"
            style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
          >
            {format(currentMonth, 'MMMM yyyy')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={nextMonth}
          className="p-2 rounded-full"
          style={{ backgroundColor: colors.muted }}
        >
          <ChevronRight color={colors.foreground} size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1">
        {/* Day headers */}
        <View className="flex-row px-2 py-3 border-b" style={{ borderColor: colors.border }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
            <View key={`header-${idx}`} className="flex-1 items-center">
              <Text
                className="text-xs font-medium"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
              >
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        <View className="flex-row flex-wrap px-2 py-2">
          {days.map((day, idx) => {
            const dateInfo = getDateInfo(day);
            const today = isToday(day);
            const inCurrentMonth = isSameMonth(day, currentMonth);
            const future = isFuture(startOfDay(day));

            return (
              <TouchableOpacity
                key={`day-${idx}`}
                onPress={() => {
                  if (dateInfo.total > 0) {
                    onDateSelect(day, dateInfo.interactions);
                  }
                }}
                disabled={dateInfo.total === 0}
                className="items-center justify-center"
                style={{
                  width: '14.28%',
                  aspectRatio: 1,
                  opacity: inCurrentMonth ? 1 : 0.4,
                }}
              >
                {/* Day circle */}
                <View
                  className="items-center justify-center rounded-full"
                  style={{
                    width: 40,
                    height: 40,
                    backgroundColor: today ? colors.secondary : 'transparent',
                  }}
                >
                  <Text
                    className="text-sm font-medium"
                    style={{
                      color: today ? colors.primary : colors.foreground,
                      fontFamily: 'Inter_500Medium',
                    }}
                  >
                    {format(day, 'd')}
                  </Text>
                </View>

                {/* Interaction indicators - thread dots */}
                {dateInfo.total > 0 && (
                  <View className="flex-row gap-1 absolute bottom-1">
                    {dateInfo.completed > 0 && (
                      <View
                        className="rounded-full"
                        style={{
                          width: 5,
                          height: 5,
                          backgroundColor: colors['weave-vibrant'] || '#10b981',
                        }}
                      />
                    )}
                    {dateInfo.planned > 0 && (
                      <View
                        className="rounded-full"
                        style={{
                          width: 5,
                          height: 5,
                          backgroundColor: colors.accent,
                        }}
                      />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View
          className="mx-5 my-4 p-4 rounded-2xl"
          style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
        >
          <View className="flex-row items-center justify-center gap-6">
            <View className="flex-row items-center gap-2">
              <View
                className="rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: colors['weave-vibrant'] || '#10b981',
                }}
              />
              <Text
                className="text-xs"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                Completed
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <View
                className="rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: colors.accent,
                }}
              />
              <Text
                className="text-xs"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                Planned
              </Text>
            </View>
          </View>
        </View>

        {/* Stats */}
        <View className="px-5 pb-6">
          <View
            className="p-4 rounded-2xl"
            style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
          >
            <Text
              className="text-center text-lg font-bold mb-2"
              style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
            >
              {format(currentMonth, 'MMMM')} Overview
            </Text>
            <View className="flex-row justify-around mt-2">
              <View className="items-center">
                <Text
                  className="text-2xl font-bold"
                  style={{ color: colors.primary, fontFamily: 'Lora_700Bold' }}
                >
                  {Array.from(interactionsByDate.values())
                    .filter(ints => {
                      const date = new Date(ints[0].interactionDate);
                      return isSameMonth(date, currentMonth);
                    })
                    .reduce((sum, ints) => sum + ints.filter(i => i.status === 'completed').length, 0)}
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Weaves Logged
                </Text>
              </View>
              <View className="items-center">
                <Text
                  className="text-2xl font-bold"
                  style={{ color: colors.accent, fontFamily: 'Lora_700Bold' }}
                >
                  {Array.from(interactionsByDate.values())
                    .filter(ints => {
                      const date = new Date(ints[0].interactionDate);
                      return isSameMonth(date, currentMonth);
                    })
                    .reduce((sum, ints) => sum + ints.filter(i =>
                      i.status === 'planned' || i.status === 'pending_confirm'
                    ).length, 0)}
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Plans Ahead
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
