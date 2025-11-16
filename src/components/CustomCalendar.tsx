import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useTheme } from '@/shared/hooks/useTheme';
import { format, startOfDay } from 'date-fns';

interface CustomCalendarProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  minDate?: Date;
  plannedDates?: Date[]; // Dates with planned interactions
}

export function CustomCalendar({ selectedDate, onDateSelect, minDate, plannedDates = [] }: CustomCalendarProps) {
  const { colors, isDarkMode } = useTheme();

  // Convert planned dates to marked dates object
  const markedDates = useMemo(() => {
    const marked: Record<string, any> = {};

    // Mark planned dates with dots
    plannedDates.forEach(date => {
      const dateString = format(startOfDay(date), 'yyyy-MM-dd');
      marked[dateString] = {
        marked: true,
        dotColor: colors.primary,
      };
    });

    // Mark selected date
    if (selectedDate) {
      const selectedString = format(startOfDay(selectedDate), 'yyyy-MM-dd');
      marked[selectedString] = {
        ...marked[selectedString],
        selected: true,
        selectedColor: colors.primary,
        selectedTextColor: isDarkMode ? colors.background : '#FFFFFF',
      };
    }

    return marked;
  }, [selectedDate, plannedDates, colors, isDarkMode]);

  const handleDayPress = (day: DateData) => {
    const date = new Date(day.year, day.month - 1, day.day);
    onDateSelect(startOfDay(date));
  };

  return (
    <View>
      <Calendar
        current={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : undefined}
        minDate={minDate ? format(minDate, 'yyyy-MM-dd') : undefined}
        onDayPress={handleDayPress}
        markedDates={markedDates}
        theme={{
          calendarBackground: 'transparent',
          textSectionTitleColor: colors['muted-foreground'],
          selectedDayBackgroundColor: colors.primary,
          selectedDayTextColor: isDarkMode ? colors.background : '#FFFFFF',
          todayTextColor: colors.primary,
          dayTextColor: colors.foreground,
          textDisabledColor: colors['muted-foreground'] + '50',
          dotColor: colors.primary,
          selectedDotColor: isDarkMode ? colors.background : '#FFFFFF',
          arrowColor: colors.primary,
          monthTextColor: colors.foreground,
          indicatorColor: colors.primary,
          textDayFontFamily: 'Inter_400Regular',
          textMonthFontFamily: 'Lora_700Bold',
          textDayHeaderFontFamily: 'Inter_600SemiBold',
          textDayFontSize: 16,
          textMonthFontSize: 18,
          textDayHeaderFontSize: 12,
        }}
        style={{
          borderRadius: 16,
          padding: 8,
        }}
      />
    </View>
  );
}
