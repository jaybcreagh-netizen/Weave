import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek, format, isToday, isSameMonth, isSameDay, isAfter } from 'date-fns';

interface CalendarViewProps {
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  maxDate?: Date;
}

export function CalendarView({ onDateSelect, selectedDate, maxDate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { tokens } = useTheme();

  const firstDayOfMonth = startOfMonth(currentMonth);
  const lastDayOfMonth = endOfMonth(currentMonth);

  const days = eachDayOfInterval({
    start: startOfWeek(firstDayOfMonth),
    end: endOfWeek(lastDayOfMonth),
  });

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)));
  };

  const canGoToNextMonth = !maxDate || isSameMonth(currentMonth, maxDate) || !isAfter(firstDayOfMonth, maxDate);

  return (
    <View className="p-4 bg-card rounded-2xl border border-border">
      <View className="flex-row justify-between items-center pb-4">
        <TouchableOpacity onPress={prevMonth} className="p-2">
          <ChevronLeft color={tokens.foreground} size={20} />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-foreground">{format(currentMonth, 'MMMM yyyy')}</Text>
        <TouchableOpacity onPress={nextMonth} disabled={!canGoToNextMonth} className="p-2">
          <ChevronRight color={!canGoToNextMonth ? tokens.foregroundMuted : tokens.foreground} size={20} />
        </TouchableOpacity>
      </View>

      <View className="flex-row justify-around pb-2 border-b border-border">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Text key={day} className="text-xs text-muted-foreground w-[14.28%] text-center">{day}</Text>
        ))}
      </View>

      <View className="flex-row flex-wrap justify-around pt-2">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isDisabled = maxDate ? isAfter(day, maxDate) && !isSameDay(day, maxDate) : false;
          const isCurrentMonth = isSameMonth(day, currentMonth);

          return (
            <TouchableOpacity
              key={day.toString()}
              disabled={isDisabled}
              className={`
                w-[14.28%] aspect-square items-center justify-center rounded-full
                ${isToday(day) ? 'bg-secondary' : ''}
                ${isSelected ? 'bg-primary' : ''}
                ${isDisabled ? 'opacity-30' : ''}
              `}
              onPress={() => onDateSelect(day)}
            >
              <Text
                className={`
                  text-base
                  ${isSelected ? 'text-background' : 'text-foreground'}
                  ${!isCurrentMonth ? 'text-muted-foreground opacity-50' : ''}
                  ${isDisabled ? 'text-muted-foreground' : ''}
                `}
              >
                {format(day, 'd')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

