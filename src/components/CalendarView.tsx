import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { theme } from '../theme';
import { eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek, format, isToday, isSameMonth, isSameDay } from 'date-fns';

interface CalendarViewProps {
  onDateSelect: (date: Date) => void;
}

export function CalendarView({ onDateSelect }: CalendarViewProps) {
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

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
          <ChevronLeft color={theme.colors.foreground} size={20} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>{format(currentMonth, 'MMMM yyyy')}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
          <ChevronRight color={theme.colors.foreground} size={20} />
        </TouchableOpacity>
      </View>

      <View style={styles.daysHeaderRow}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <Text key={day} style={styles.dayHeaderCell}>{day}</Text>
        ))}
      </View>

      <View style={styles.daysGrid}>
        {days.map((day) => (
          <TouchableOpacity
            key={day.toString()}
            style={[
              styles.dayCell,
              isToday(day) && styles.dayToday,
              // Add isSelected style later
            ]}
            onPress={() => onDateSelect(day)}
          >
            <Text style={[
              styles.dayText,
              !isSameMonth(day, currentMonth) && styles.dayOutside,
            ]}>
              {format(day, 'd')}
            </Text>
          </TouchableOpacity>
        ))}
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
  dayText: {
    fontSize: 16,
    color: theme.colors.foreground,
  },
  dayOutside: {
    color: theme.colors['muted-foreground'],
    opacity: 0.5,
  },
});
