import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { theme } from '../theme';
import { eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek, format, isToday, isSameMonth, isSameDay, isAfter } from 'date-fns';

interface CalendarViewProps {
  onDateSelect: (date: Date) => void;
  selectedDate: Date;
  maxDate?: Date;
}

export function CalendarView({ onDateSelect, selectedDate, maxDate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
          <ChevronLeft color={theme.colors.foreground} size={20} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>{format(currentMonth, 'MMMM yyyy')}</Text>
        <TouchableOpacity onPress={nextMonth} disabled={!canGoToNextMonth} style={styles.navButton}>
          <ChevronRight color={!canGoToNextMonth ? theme.colors.muted : theme.colors.foreground} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.daysHeaderRow}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Text key={day} style={styles.dayHeaderCell}>{day}</Text>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isDisabled = maxDate ? isAfter(day, maxDate) && !isSameDay(day, maxDate) : false;

          return (
            <TouchableOpacity
              key={day.toString()}
              disabled={isDisabled}
              style={[
                styles.dayCell,
                isToday(day) && styles.dayToday,
                isSelected && styles.daySelected,
                isDisabled && styles.dayDisabled,
              ]}
              onPress={() => onDateSelect(day)}
            >
              <Text style={[
                styles.dayText,
                !isSameMonth(day, currentMonth) && styles.dayOutside,
                isSelected && styles.daySelectedText,
                isDisabled && styles.dayDisabledText,
              ]}>
                {format(day, 'd')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: theme.spacing.md,
  },
  navButton: {
    padding: theme.spacing.sm,
  },
  headerLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.foreground,
  },
  daysHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderColor: theme.colors.border,
  },
  dayHeaderCell: {
    fontSize: 12,
    color: theme.colors['muted-foreground'],
    width: '14.28%',
    textAlign: 'center',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    paddingTop: theme.spacing.sm,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999, // Make it a circle
  },
  dayToday: {
    backgroundColor: theme.colors.secondary,
  },
  daySelected: {
    backgroundColor: theme.colors.primary,
  },
  dayDisabled: {
    opacity: 0.3,
  },
  dayText: {
    fontSize: 16,
    color: theme.colors.foreground,
  },
  daySelectedText: {
    color: theme.colors.background,
  },
  dayOutside: {
    color: theme.colors['muted-foreground'],
    opacity: 0.5,
  },
  dayDisabledText: {
      color: theme.colors['muted-foreground'],
  }
});
