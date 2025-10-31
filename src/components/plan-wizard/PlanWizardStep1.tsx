import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, FadeIn, SlideInDown } from 'react-native-reanimated';
import { Calendar, Sun, Moon, X } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { BlurView } from 'expo-blur';
import { startOfDay, addDays, format, isSaturday, nextSaturday } from 'date-fns';
import { useTheme } from '../../hooks/useTheme';

interface PlanWizardStep1Props {
  selectedDate?: Date;
  onDateSelect: (date: Date) => void;
  onContinue: () => void;
  canContinue: boolean;
}

export function PlanWizardStep1({ selectedDate, onDateSelect, onContinue, canContinue }: PlanWizardStep1Props) {
  const { colors, isDarkMode } = useTheme();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const scale = useSharedValue(1);

  // Create animated style once at the top level
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const today = startOfDay(new Date());

  const handleQuickSelect = (option: 'weekend' | 'next-week') => {
    setSelectedKey(option);
    let targetDate: Date;
    if (option === 'weekend') {
      // If today is Saturday, use today. Otherwise, next Saturday
      targetDate = isSaturday(today) ? today : nextSaturday(today);
    } else {
      // Next week = 7 days from now
      targetDate = addDays(today, 7);
    }
    onDateSelect(targetDate);

    // Visual feedback: scale down then advance
    scale.value = withSpring(0.95, { damping: 15 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 15 });
      onContinue();
    }, 200);
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
        <Animated.View style={selectedKey === 'weekend' ? animatedStyle : {}}>
          <TouchableOpacity
            onPress={() => handleQuickSelect('weekend')}
            className="p-5 rounded-2xl flex-row items-center justify-between"
            style={{
              backgroundColor: colors.card,
              borderWidth: selectedDate && isSaturday(selectedDate) ? 2 : 1,
              borderColor: selectedDate && isSaturday(selectedDate) ? colors.primary : colors.border,
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
                  {format(isSaturday(today) ? today : nextSaturday(today), 'EEEE')}
                </Text>
                <Text className="font-inter-regular text-sm" style={{ color: colors['muted-foreground'] }}>
                  {format(isSaturday(today) ? today : nextSaturday(today), 'MMM d')} • This Weekend
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={selectedKey === 'next-week' ? animatedStyle : {}}>
          <TouchableOpacity
            onPress={() => handleQuickSelect('next-week')}
            className="p-5 rounded-2xl flex-row items-center justify-between"
            style={{
              backgroundColor: colors.card,
              borderWidth: selectedDate && !isSaturday(selectedDate) ? 2 : 1,
              borderColor: selectedDate && !isSaturday(selectedDate) ? colors.primary : colors.border,
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
                <Moon size={24} color={colors.primary} />
              </View>
              <View>
                <Text className="font-inter-semibold text-base" style={{ color: colors.foreground }}>
                  {format(addDays(today, 7), 'EEEE')}
                </Text>
                <Text className="font-inter-regular text-sm" style={{ color: colors['muted-foreground'] }}>
                  {format(addDays(today, 7), 'MMM d')} • Next Week
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          className="p-5 rounded-2xl flex-row items-center justify-between"
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
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
      <Modal
        visible={showDatePicker}
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
                backgroundColor: isDarkMode ? colors.background + 'F5' : colors.background + 'F8',
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

              <DateTimePicker
                value={selectedDate || today}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={today}
                onChange={(event, date) => {
                  if (date && (Platform.OS === 'android' || event.type === 'set')) {
                    setSelectedKey('calendar');
                    onDateSelect(startOfDay(date));
                    setShowDatePicker(false);
                    // Auto-advance after selecting from calendar
                    scale.value = withSpring(0.95, { damping: 15 });
                    setTimeout(() => {
                      scale.value = withSpring(1, { damping: 15 });
                      onContinue();
                    }, 200);
                  }
                }}
              />
            </Animated.View>
          </TouchableOpacity>
        </BlurView>
      </Modal>
    </View>
  );
}
