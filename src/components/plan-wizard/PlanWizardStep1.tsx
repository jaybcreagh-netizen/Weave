import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform } from 'react-native';
import { Calendar, Sun, Moon } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { startOfDay, addDays, format, isSaturday, nextSaturday } from 'date-fns';
import { useTheme } from '../../hooks/useTheme';

interface PlanWizardStep1Props {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  onContinue: () => void;
  canContinue: boolean;
}

export function PlanWizardStep1({ selectedDate, onDateSelect, onContinue, canContinue }: PlanWizardStep1Props) {
  const { colors } = useTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);

  const today = startOfDay(new Date());

  const handleQuickSelect = (option: 'weekend' | 'next-week') => {
    if (option === 'weekend') {
      // If today is Saturday, use today. Otherwise, next Saturday
      const targetDate = isSaturday(today) ? today : nextSaturday(today);
      onDateSelect(targetDate);
    } else {
      // Next week = 7 days from now
      onDateSelect(addDays(today, 7));
    }
  };

  return (
    <View className="px-5 py-6">
      <Text className="font-lora-bold text-2xl mb-2" style={{ color: colors.foreground }}>
        When?
      </Text>
      <Text className="font-inter-regular text-base mb-8" style={{ color: colors['muted-foreground'] }}>
        Pick a time that works for both of you
      </Text>

      {/* Quick select options */}
      <View className="gap-3 mb-6">
        <TouchableOpacity
          onPress={() => handleQuickSelect('weekend')}
          className="p-5 rounded-2xl flex-row items-center justify-between"
          style={{
            backgroundColor: colors.muted,
            borderWidth: selectedDate && isSaturday(selectedDate) ? 2 : 0,
            borderColor: colors.primary,
          }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.background }}
            >
              <Sun size={24} color={colors.primary} />
            </View>
            <View>
              <Text className="font-inter-semibold text-base" style={{ color: colors.foreground }}>
                This Weekend
              </Text>
              <Text className="font-inter-regular text-sm" style={{ color: colors['muted-foreground'] }}>
                {format(isSaturday(today) ? today : nextSaturday(today), 'EEEE, MMM d')}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleQuickSelect('next-week')}
          className="p-5 rounded-2xl flex-row items-center justify-between"
          style={{
            backgroundColor: colors.muted,
            borderWidth: selectedDate && !isSaturday(selectedDate) ? 2 : 0,
            borderColor: colors.primary,
          }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.background }}
            >
              <Moon size={24} color={colors.primary} />
            </View>
            <View>
              <Text className="font-inter-semibold text-base" style={{ color: colors.foreground }}>
                Next Week
              </Text>
              <Text className="font-inter-regular text-sm" style={{ color: colors['muted-foreground'] }}>
                {format(addDays(today, 7), 'EEEE, MMM d')}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          className="p-5 rounded-2xl flex-row items-center justify-between"
          style={{ backgroundColor: colors.muted }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.background }}
            >
              <Calendar size={24} color={colors.primary} />
            </View>
            <View>
              <Text className="font-inter-semibold text-base" style={{ color: colors.foreground }}>
                Pick a Date
              </Text>
              <Text className="font-inter-regular text-sm" style={{ color: colors['muted-foreground'] }}>
                Choose from calendar
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {showDatePicker && (
        <DateTimePicker
          value={selectedDate || today}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={today}
          onChange={(event, date) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (date) {
              onDateSelect(startOfDay(date));
            }
          }}
        />
      )}

      {/* Selected date display */}
      {selectedDate && (
        <View
          className="p-4 rounded-xl mb-6"
          style={{ backgroundColor: `${colors.primary}15`, borderWidth: 1, borderColor: colors.primary }}
        >
          <Text className="font-inter-medium text-sm" style={{ color: colors['muted-foreground'] }}>
            Selected date
          </Text>
          <Text className="font-lora-bold text-lg mt-1" style={{ color: colors.foreground }}>
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </Text>
        </View>
      )}

      {/* Continue button */}
      <TouchableOpacity
        onPress={onContinue}
        disabled={!canContinue}
        className="py-4 rounded-full items-center"
        style={{
          backgroundColor: canContinue ? colors.primary : colors.muted,
          opacity: canContinue ? 1 : 0.5,
        }}
      >
        <Text className="font-inter-semibold text-base text-white">Continue</Text>
      </TouchableOpacity>
    </View>
  );
}
