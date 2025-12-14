import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, FadeIn } from 'react-native-reanimated';
import { Calendar, Sun, X, TrendingUp, CalendarDays } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { startOfDay, addDays, format, isSaturday, nextSaturday, getDay } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { useTheme } from '@/shared/hooks/useTheme';
import { CustomCalendar } from '@/shared/components/CustomCalendar';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';

interface PlanWizardStep1Props {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  onContinue: () => void;
  canContinue: boolean;
  friend: FriendModel;
  plannedDates: Date[];
  mostCommonDay: { day: number; name: string; date: Date } | null;
}

export function PlanWizardStep1({ selectedDate, onDateSelect, onContinue, canContinue, friend, plannedDates, mostCommonDay }: PlanWizardStep1Props) {
  const { colors, isDarkMode } = useTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const scale = useSharedValue(1);

  // Create animated style once at the top level
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const today = startOfDay(new Date());

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const handleQuickSelect = (option: 'today' | 'weekend' | 'usual' | 'next-week') => {
    setSelectedKey(option);
    let targetDate: Date;

    switch (option) {
      case 'today':
        targetDate = today;
        break;
      case 'weekend':
        // If today is Saturday, use today. Otherwise, next Saturday
        targetDate = isSaturday(today) ? today : nextSaturday(today);
        break;
      case 'usual':
        // Use the calculated most common day
        targetDate = mostCommonDay?.date || today;
        break;
      case 'next-week':
        // Next week = 7 days from now
        targetDate = addDays(today, 7);
        break;
      default:
        targetDate = today;
    }

    onDateSelect(targetDate);
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
        {/* Today */}
        <Animated.View style={selectedKey === 'today' ? animatedStyle : {}}>
          <TouchableOpacity
            onPress={() => handleQuickSelect('today')}
            className="p-5 rounded-2xl flex-row items-center justify-between"
            style={{
              backgroundColor: colors.card,
              borderWidth: selectedKey === 'today' ? 2 : 1,
              borderColor: selectedKey === 'today' ? colors.primary : colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
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
                  Today
                </Text>
                <Text className="font-inter-regular text-sm" style={{ color: colors['muted-foreground'] }}>
                  {format(today, 'EEEE, MMM d')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* This Weekend */}
        <Animated.View style={selectedKey === 'weekend' ? animatedStyle : {}}>
          <TouchableOpacity
            onPress={() => handleQuickSelect('weekend')}
            className="p-5 rounded-2xl flex-row items-center justify-between"
            style={{
              backgroundColor: colors.card,
              borderWidth: selectedKey === 'weekend' ? 2 : 1,
              borderColor: selectedKey === 'weekend' ? colors.primary : colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.05,
              shadowRadius: 8,
              elevation: 2,
            }}
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
                  This Weekend
                </Text>
                <Text className="font-inter-regular text-sm" style={{ color: colors['muted-foreground'] }}>
                  {format(isSaturday(today) ? today : nextSaturday(today), 'EEEE, MMM d')}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        {/* Your Usual Day (dynamic) */}
        {mostCommonDay && (
          <Animated.View style={selectedKey === 'usual' ? animatedStyle : {}}>
            <TouchableOpacity
              onPress={() => handleQuickSelect('usual')}
              className="p-5 rounded-2xl flex-row items-center justify-between"
              style={{
                backgroundColor: colors.card,
                borderWidth: selectedKey === 'usual' ? 2 : 1,
                borderColor: selectedKey === 'usual' ? colors.primary : colors.border,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
              }}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center"
                  style={{ backgroundColor: colors.background }}
                >
                  <TrendingUp size={24} color={colors.primary} />
                </View>
                <View>
                  <Text className="font-inter-semibold text-base" style={{ color: colors.foreground }}>
                    Your usual {mostCommonDay.name}
                  </Text>
                  <Text className="font-inter-regular text-sm" style={{ color: colors['muted-foreground'] }}>
                    {format(mostCommonDay.date, 'EEEE, MMM d')}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Pick a Date */}
        <TouchableOpacity
          onPress={() => {
            if (!selectedDate) {
              onDateSelect(today);
            }
            setShowDatePicker(true);
          }}
          className="p-5 rounded-2xl flex-row items-center justify-between"
          style={{
            backgroundColor: colors.card,
            borderWidth: selectedKey === 'calendar' ? 2 : 1,
            borderColor: selectedKey === 'calendar' ? colors.primary : colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View className="flex-row items-center gap-3">
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: colors.background }}
            >
              <CalendarDays size={24} color={colors.primary} />
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

      {/* Calendar Popup Modal */}
      {showDatePicker && (
        <Modal
          visible={true}
          transparent
          animationType="none"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <BlurView intensity={isDarkMode ? 20 : 40} tint={isDarkMode ? 'dark' : 'light'} className="flex-1">
            <TouchableOpacity
              className="flex-1 justify-center items-center px-5"
              activeOpacity={1}
              onPress={() => setShowDatePicker(false)}
            >
              <Animated.View
                entering={FadeIn.duration(200).springify()}
                className="w-full max-w-md rounded-3xl p-6"
                style={{
                  backgroundColor: colors.background,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 20 },
                  shadowOpacity: 0.25,
                  shadowRadius: 30,
                  elevation: 20,
                }}
                onStartShouldSetResponder={() => true}
              >
                {/* Header */}
                <View className="flex-row justify-between items-center mb-4">
                  <Text className="font-lora-bold text-xl" style={{ color: colors.foreground }}>
                    Pick a Date
                  </Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} className="p-2 -mr-2">
                    <X color={colors['muted-foreground']} size={22} />
                  </TouchableOpacity>
                </View>

                <CustomCalendar
                  selectedDate={selectedDate}
                  onDateSelect={(date) => {
                    setSelectedKey('calendar');
                    onDateSelect(date);
                    setShowDatePicker(false);
                  }}
                  minDate={today}
                  plannedDates={plannedDates}
                />
              </Animated.View>
            </TouchableOpacity>
          </BlurView>
        </Modal>
      )}

      {/* Continue button (after date is selected) */}
      {selectedDate && (
        <View className="mt-6">
          <TouchableOpacity
            onPress={onContinue}
            disabled={!canContinue}
            className="p-5 rounded-2xl items-center"
            style={{
              backgroundColor: canContinue ? colors.primary : colors.card,
              opacity: canContinue ? 1 : 0.5,
            }}
          >
            <Text
              className="font-inter-semibold text-base"
              style={{ color: canContinue ? '#FFFFFF' : colors['muted-foreground'] }}
            >
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
