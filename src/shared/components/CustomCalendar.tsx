import React, { useMemo } from 'react';
import { View } from 'react-native';
import { Calendar, DateData } from 'react-native-calendars';
import { useTheme } from '@/shared/hooks/useTheme';
import { format, startOfDay } from 'date-fns';

interface CustomCalendarProps {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  minDate?: Date;
  plannedDates?: Date[]; // Dates with planned interactions (blue dot)
  completedDates?: Date[]; // Dates with completed interactions (green dot)
}

export function CustomCalendar({
  selectedDate,
  onDateSelect,
  minDate,
  plannedDates = [],
  completedDates = []
}: CustomCalendarProps) {
  const { colors, isDarkMode } = useTheme();

  // Track the currently visible month
  // Initialize with selectedDate if available, otherwise minDate or today
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    if (selectedDate) return format(selectedDate, 'yyyy-MM-dd');
    if (minDate) return format(minDate, 'yyyy-MM-dd');
    return format(new Date(), 'yyyy-MM-dd');
  });

  // Update current month when selectedDate changes externally
  React.useEffect(() => {
    if (selectedDate) {
      setCurrentMonth(format(selectedDate, 'yyyy-MM-dd'));
    }
  }, [selectedDate]);

  // Convert dates to marked dates object with multi-dot support
  const markedDates = useMemo(() => {
    const marked: Record<string, any> = {};

    // Helper to add a dot to a date
    const addDot = (dateString: string, color: string, key: string) => {
      if (!marked[dateString]) {
        marked[dateString] = { dots: [] };
      }
      if (!marked[dateString].dots) {
        marked[dateString].dots = [];
      }
      // Avoid duplicate dots
      if (!marked[dateString].dots.some((d: any) => d.key === key)) {
        marked[dateString].dots.push({ key, color });
      }
    };

    // Mark completed dates with green dot
    completedDates.forEach(date => {
      const dateString = format(startOfDay(date), 'yyyy-MM-dd');
      addDot(dateString, '#22c55e', 'completed'); // Green for completed
    });

    // Mark planned dates with primary color dot
    plannedDates.forEach(date => {
      const dateString = format(startOfDay(date), 'yyyy-MM-dd');
      addDot(dateString, colors.primary, 'planned'); // Primary color for planned
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
  }, [selectedDate, plannedDates, completedDates, colors, isDarkMode]);

  const handleDayPress = (day: DateData) => {
    const date = new Date(day.year, day.month - 1, day.day);
    onDateSelect(startOfDay(date));
  };

  return (
    <View>
      <Calendar
        // Use local state for the visible month
        current={currentMonth}
        // Update local state when user navigates
        onMonthChange={(month: DateData) => {
          setCurrentMonth(month.dateString);
        }}
        minDate={minDate ? format(minDate, 'yyyy-MM-dd') : undefined}
        onDayPress={handleDayPress}
        markedDates={markedDates}
        markingType="multi-dot"
        enableSwipeMonths={true}
        hideArrows={false}
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
