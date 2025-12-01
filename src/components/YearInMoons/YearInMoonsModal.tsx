/**
 * YearInMoonsModal
 * Beautiful year-view calendar with moon phases representing battery levels
 * Three tabs: Moons (calendar), Graphs (visualizations), Patterns (insights)
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import { X, Calendar, BarChart3, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUserProfileStore } from '@/modules/auth';
import { MoonPhaseIllustration } from './MoonPhaseIllustration';
import { PatternsTabContent } from './PatternsTabContent';
// import { ReflectionJourneyModal } from '../ReflectionJourney/ReflectionJourneyModal';
import { SocialBatterySheet } from '../home/SocialBatterySheet';
import {
  getYearMoonData,
  getYearStats,
  getMonthName,
  MonthMoonData,
  DayMoonData,
} from '@/modules/reflection';
import * as Haptics from 'expo-haptics';

interface YearInMoonsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'moons' | 'journal' | 'patterns';

export function YearInMoonsModal({ isOpen, onClose }: YearInMoonsModalProps) {
  const { colors, isDarkMode, tokens } = useTheme();
  const { submitBatteryCheckin } = useUserProfileStore();
  const [currentTab, setCurrentTab] = useState<Tab>('moons');
  const [yearData, setYearData] = useState<MonthMoonData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayMoonData | null>(null);
  const [batterySheetVisible, setBatterySheetVisible] = useState(false);
  const [dayForBatteryCheckin, setDayForBatteryCheckin] = useState<Date | null>(null);
  const [yearStats, setYearStats] = useState({
    totalCheckins: 0,
    avgBattery: 0,
    mostCommonLevel: 0,
    streakDays: 0,
  });
  const scrollViewRef = React.useRef<ScrollView>(null);
  const monthRefs = React.useRef<{ [key: number]: View | null }>({});

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  const screenWidth = Dimensions.get('window').width;
  const moonSize = Math.floor((screenWidth - 80) / 7); // 7 moons per row with padding

  useEffect(() => {
    if (isOpen) {
      loadYearData();
    }
  }, [isOpen]);

  const loadYearData = async () => {
    setIsLoading(true);
    try {
      const [data, stats] = await Promise.all([
        getYearMoonData(currentYear),
        getYearStats(currentYear),
      ]);
      setYearData(data);
      setYearStats(stats);
    } catch (error) {
      console.error('Error loading year moon data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to current month when data loads
  useEffect(() => {
    if (!isLoading && yearData.length > 0 && currentTab === 'moons') {
      // Small delay to ensure layout has completed
      setTimeout(() => {
        const monthRef = monthRefs.current[currentMonth];
        if (monthRef) {
          monthRef.measureLayout(
            scrollViewRef.current as any,
            (_x, y) => {
              scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 100), animated: true });
            },
            () => {
              console.log('Failed to measure month layout');
            }
          );
        }
      }, 300);
    }
  }, [isLoading, yearData, currentTab]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDay(null);
    onClose();
  };

  const router = useRouter(); // Add router

  const handleTabChange = (tab: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (tab === 'journal') {
      onClose(); // Close the modal first
      router.push('/journal'); // Navigate to the new Journal screen
    } else {
      setCurrentTab(tab);
    }
  };

  const handleMoonPress = (day: DayMoonData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDay(day);
  };

  const handleMoonLongPress = (day: DayMoonData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDayForBatteryCheckin(day.date);
    setBatterySheetVisible(true);
  };

  const handleBatteryCheckinSubmit = async (value: number, note?: string) => {
    if (dayForBatteryCheckin) {
      // Set time to noon on the selected day to avoid timezone issues
      const timestamp = new Date(dayForBatteryCheckin);
      timestamp.setHours(12, 0, 0, 0);

      await submitBatteryCheckin(value, note, timestamp.getTime());

      // Reload the year data to reflect the new check-in
      loadYearData();
    }

    setBatterySheetVisible(false);
    setDayForBatteryCheckin(null);
  };

  const handleBatterySheetDismiss = () => {
    setBatterySheetVisible(false);
    setDayForBatteryCheckin(null);
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'moons', label: 'Moons', icon: Calendar },
    { id: 'journal', label: 'Journal', icon: BarChart3 },
    { id: 'patterns', label: 'Patterns', icon: Sparkles },
  ];

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <LinearGradient
        colors={isDarkMode ? ['#1a1d2e', '#0f1419'] : ['#FAF1E0', '#F3EAD8']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView className="flex-1">
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 py-4"
            style={{ borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#2A2E3F' : '#E0E3E9' }}
          >
            <View className="flex-1">
              <Text
                className="text-xl font-bold"
                style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
              >
                Year in Moons
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
              >
                {currentYear}
              </Text>
            </View>

            <TouchableOpacity onPress={handleClose} className="p-2 -mr-2">
              <X size={24} color={isDarkMode ? '#8A8F9E' : '#6C7589'} />
            </TouchableOpacity>
          </View>

          {/* Tab Navigation */}
          <View className="flex-row px-5 py-3 gap-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = currentTab === tab.id;

              return (
                <TouchableOpacity
                  key={tab.id}
                  onPress={() => handleTabChange(tab.id)}
                  className="flex-1 py-2.5 rounded-xl flex-row items-center justify-center gap-1.5"
                  style={{
                    backgroundColor: isActive ? (isDarkMode ? '#2A2E3F' : '#FFF8ED') : 'transparent',
                  }}
                >
                  <Icon size={16} color={isActive ? (isDarkMode ? '#F5F1E8' : '#2D3142') : (isDarkMode ? '#8A8F9E' : '#6C7589')} />
                  <Text
                    className="text-sm font-medium"
                    style={{
                      color: isActive ? (isDarkMode ? '#F5F1E8' : '#2D3142') : (isDarkMode ? '#8A8F9E' : '#6C7589'),
                      fontFamily: 'Inter_500Medium',
                    }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Content */}
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color={isDarkMode ? '#F5F1E8' : '#6366F1'} />
              <Text
                className="text-sm mt-4"
                style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
              >
                Loading your moon journey...
              </Text>
            </View>
          ) : (
            <>
              <ScrollView
                ref={scrollViewRef}
                className="flex-1 px-5 py-4"
                showsVerticalScrollIndicator={false}
              >
                {currentTab === 'moons' && (
                  <>
                    {/* Stats Summary */}
                    <View className="flex-row gap-3 mb-6">
                      <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFF8ED' }}>
                        <Text
                          className="text-2xl font-bold mb-0.5"
                          style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
                        >
                          {yearStats.totalCheckins}
                        </Text>
                        <Text
                          className="text-[10px]"
                          style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
                        >
                          Check-ins
                        </Text>
                      </View>

                      <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFF8ED' }}>
                        <Text
                          className="text-2xl font-bold mb-0.5"
                          style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
                        >
                          {yearStats.streakDays}
                        </Text>
                        <Text
                          className="text-[10px]"
                          style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
                        >
                          Day Streak
                        </Text>
                      </View>

                      <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFF8ED' }}>
                        <Text
                          className="text-2xl font-bold mb-0.5"
                          style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
                        >
                          {yearStats.avgBattery}/5
                        </Text>
                        <Text
                          className="text-[10px]"
                          style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
                        >
                          Avg Energy
                        </Text>
                      </View>
                    </View>

                    {/* Moon Calendar - Month by Month */}
                    {yearData.map((monthData, monthIndex) => (
                      <Animated.View
                        key={`${monthData.year}-${monthData.month}`}
                        entering={FadeIn.delay(monthIndex * 50)}
                        className="mb-6"
                        ref={(ref) => {
                          if (ref) {
                            monthRefs.current[monthData.month] = ref as any;
                          }
                        }}
                        collapsable={false}
                      >
                        {/* Month Header */}
                        <Text
                          className="text-base font-semibold mb-3"
                          style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Inter_600SemiBold' }}
                        >
                          {getMonthName(monthData.month)}
                        </Text>

                        {/* Week Day Labels */}
                        <View className="flex-row mb-2">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                            <View
                              key={i}
                              style={{ width: moonSize }}
                              className="items-center"
                            >
                              <Text
                                className="text-[10px]"
                                style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
                              >
                                {day}
                              </Text>
                            </View>
                          ))}
                        </View>

                        {/* Moon Grid */}
                        <View className="flex-row flex-wrap">
                          {/* Padding for first day of month */}
                          {Array.from({ length: monthData.days[0].date.getDay() }).map((_, i) => (
                            <View key={`pad-${i}`} style={{ width: moonSize, height: moonSize }} />
                          ))}

                          {/* Moon days */}
                          {monthData.days.map((day) => (
                            <TouchableOpacity
                              key={day.date.toISOString()}
                              onPress={() => handleMoonPress(day)}
                              onLongPress={() => handleMoonLongPress(day)}
                              delayLongPress={200}
                              className="items-center justify-center mb-2"
                              style={{ width: moonSize, height: moonSize }}
                            >
                              <MoonPhaseIllustration
                                phase={day.moonPhase}
                                size={moonSize - 8}
                                hasCheckin={day.hasCheckin}
                                batteryLevel={day.batteryLevel}
                                color={tokens.primary}
                              />
                              {/* Day number */}
                              <Text
                                className="text-[9px] mt-0.5"
                                style={{
                                  color: day.hasCheckin
                                    ? (isDarkMode ? '#F5F1E8' : '#2D3142')
                                    : (isDarkMode ? '#5A5F6E' : '#9CA3AF'),
                                  fontFamily: 'Inter_400Regular',
                                }}
                              >
                                {day.date.getDate()}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </Animated.View>
                    ))}

                    {/* End of year spacer */}
                    <View className="h-8" />
                  </>
                )}

                {currentTab === 'patterns' && <PatternsTabContent />}
              </ScrollView>
            </>
          )}

          {/* Day Detail Bottom Sheet */}
          {selectedDay && (
            <View
              className="absolute bottom-0 left-0 right-0 p-6 rounded-t-3xl"
              style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFF8ED' }}
            >
              <View className="flex-row items-start justify-between mb-4">
                <View>
                  <Text
                    className="text-lg font-bold mb-1"
                    style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
                  >
                    {selectedDay.date.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text
                    className="text-sm"
                    style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
                  >
                    {selectedDay.hasCheckin
                      ? `Energy Level: ${selectedDay.batteryLevel}/5`
                      : 'No check-in recorded'}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedDay(null)}
                  className="p-2 -mr-2"
                >
                  <X size={20} color={isDarkMode ? '#8A8F9E' : '#6C7589'} />
                </TouchableOpacity>
              </View>

              <View className="items-center mb-4">
                <MoonPhaseIllustration
                  phase={selectedDay.moonPhase}
                  size={80}
                  hasCheckin={selectedDay.hasCheckin}
                  batteryLevel={selectedDay.batteryLevel}
                  color={tokens.primary}
                />
              </View>

              {!selectedDay.hasCheckin && (
                <Text
                  className="text-xs text-center mb-2"
                  style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
                >
                  Long-press to add a check-in for this day
                </Text>
              )}
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      {/* Battery Check-in Sheet */}
      <SocialBatterySheet
        isVisible={batterySheetVisible}
        onSubmit={handleBatteryCheckinSubmit}
        onDismiss={handleBatterySheetDismiss}
      />
    </Modal>
  );
}
