/**
 * YearInMoonsModal
 * Beautiful year-view calendar with moon phases representing battery levels
 * Two tabs: Moons (calendar), Patterns (insights)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Modal,
} from 'react-native';
import Animated, {
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence
} from 'react-native-reanimated';
import { X, Calendar, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/shared/hooks/useTheme';
// import { StandardBottomSheet } from '@/shared/ui/Sheet';
// import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useUserProfile, SocialBatteryService } from '@/modules/auth';
import { MoonPhaseIllustration } from './MoonPhaseIllustration';
import { PatternsTabContent } from './PatternsTabContent';
// import { ReflectionJourneyModal } from '../ReflectionJourney/ReflectionJourneyModal';
import { SocialBatterySheet } from '@/modules/home/components/widgets/SocialBatterySheet';
import {
  getYearMoonData,
  getYearStats,
  getMonthName,
  MonthMoonData,
  DayMoonData,
} from '@/modules/reflection';
import * as Haptics from 'expo-haptics';
import { logger } from '@/shared/services/logger.service';

interface YearInMoonsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'moons' | 'patterns';
}

type Tab = 'moons' | 'patterns';

const AnimatedMoon = React.memo(({
  children,
  index,
  monthIndex,
  batteryLevel
}: {
  children: React.ReactNode;
  index: number;
  monthIndex: number;
  batteryLevel: number | null;
}) => {
  const scale = useSharedValue(1);
  const firstRender = React.useRef(true);

  useEffect(() => {
    // Skip animation on first render as entering handles it
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    // Pulse on subsequent updates
    scale.value = withSequence(withSpring(1.2, { damping: 10 }), withSpring(1, { damping: 10 }));
  }, [batteryLevel]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <Animated.View style={animatedStyle}>
      {children}
    </Animated.View>
  );
});

export function YearInMoonsModal({ isOpen, onClose, initialTab = 'moons' }: YearInMoonsModalProps) {
  const { tokens, isDarkMode, colors } = useTheme();
  // We can't use the hook inside the function if we want to call it conditionally, but here it's fine
  // However, submitBatteryCheckin was an action. We should use the service directly.
  const { profile } = useUserProfile();
  const [currentTab, setCurrentTab] = useState<Tab>(initialTab);
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
  const hasScrolledRef = React.useRef(false);
  const currentScrollYRef = React.useRef(0);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-11
  const screenWidth = Dimensions.get('window').width;
  const moonSize = Math.floor((screenWidth - 80) / 7); // 7 moons per row with padding

  useEffect(() => {
    if (isOpen) {
      hasScrolledRef.current = false;
      setCurrentTab(initialTab); // Reset to initial tab when opening
      loadYearData();
    }
  }, [isOpen, initialTab]);

  const loadYearData = async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    try {
      const [data, stats] = await Promise.all([
        getYearMoonData(currentYear),
        getYearStats(currentYear),
      ]);
      setYearData(data);
      setYearStats(stats);
    } catch (error) {
      logger.error('YearInMoons', 'Error loading year moon data:', error);
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDay(null);
    onClose();
  };

  const handleTabChange = (tab: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentTab(tab);
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
    // Close sheet immediately for snappy UI
    setBatterySheetVisible(false);
    setDayForBatteryCheckin(null);

    if (dayForBatteryCheckin) {
      // 1. Optimistic Update: Update local state immediately
      // This makes the UI ripple instantly without waiting for DB
      const targetDateStr = dayForBatteryCheckin.toISOString().split('T')[0];

      setYearData(prevData => {
        return prevData.map(month => {
          // Optimization: Only clone/map if date is in this month
          // Check simple month/year match first
          if (month.month !== dayForBatteryCheckin.getMonth() ||
            month.year !== dayForBatteryCheckin.getFullYear()) {
            return month;
          }

          return {
            ...month,
            days: month.days.map(day => {
              // Compare by date string to ignore time component
              if (day.date.toISOString().split('T')[0] === targetDateStr) {
                return {
                  ...day,
                  batteryLevel: value,
                  hasCheckin: true,
                  // We need to recalculate moon phase for the new value to be accurate immediately
                  // We'll import batteryToMoonPhase helper or duplicate logic slightly for speed
                  // Logic: 1->0.0, 2->0.25, 3->0.5, 4->0.75, 5->1.0
                  moonPhase: [0.1, 0.0, 0.25, 0.5, 0.75, 1.0][value] || 0.1
                };
              }
              return day;
            })
          };
        });
      });

      // 2. Perform Async DB Write
      const timestamp = new Date(dayForBatteryCheckin);
      timestamp.setHours(12, 0, 0, 0);

      // 2. Perform Async DB Write
      if (profile) {
        await SocialBatteryService.submitCheckin(profile.id, value, note, timestamp.getTime(), true);
      } else {
        logger.warn('YearInMoons', 'Cannot submit checkin: No profile found');
      }

      // 3. Silent Re-sync (Safety Net)
      // We still re-fetch to ensure consistency, but user sees the change already
      // No delay needed for the UI, just for the data consistency check
      setTimeout(async () => {
        await loadYearData(false);
      }, 500);
    }
  };

  const handleBatterySheetDismiss = () => {
    setBatterySheetVisible(false);
    setDayForBatteryCheckin(null);
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'moons', label: 'Moons', icon: Calendar },
    { id: 'patterns', label: 'Patterns', icon: Sparkles },
  ];

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>

        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-5 pb-3 border-b"
          style={{ borderBottomColor: isDarkMode ? '#2A2E3F' : '#E5E7EB', backgroundColor: colors.background }}>
          <Text
            className="text-lg font-bold"
            style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
          >
            Year in Moons · {currentYear}
          </Text>
          <TouchableOpacity
            onPress={handleClose}
            className="p-2 -mr-2"
          >
            <X size={24} color={colors['muted-foreground']} />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <View className="flex-row px-5 py-3 gap-2" style={{ backgroundColor: colors.background }}>
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
          <ScrollView
            ref={scrollViewRef}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 100 }} // Add bottom padding for safety
            onScroll={(e) => {
              currentScrollYRef.current = e.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
          >
            {currentTab === 'moons' && (
              <View className="flex-1 px-5 py-4">
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
                    entering={FadeInDown.duration(600).delay(monthIndex * 50).springify()}
                    className="mb-6"
                    onLayout={(event) => {
                      if (monthData.month === currentMonth && !hasScrolledRef.current && scrollViewRef.current) {
                        const y = event.nativeEvent.layout.y;
                        logger.debug('YearInMoons', `AutoScroll: Found current month at y=${y}, scrolling now...`);

                        // Small delay to ensure ScrollView content size is updated
                        setTimeout(() => {
                          scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 20), animated: true });
                        }, 100);

                        hasScrolledRef.current = true;
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
                      {monthData.days.map((day, dayIndex) => (
                        <AnimatedMoon
                          key={day.date.toISOString()}
                          index={dayIndex}
                          monthIndex={monthIndex}
                          batteryLevel={day.batteryLevel}
                        >
                          <TouchableOpacity
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
                        </AnimatedMoon>
                      ))}
                    </View>
                  </Animated.View>
                ))}

                {/* End of year spacer */}
                <View className="h-8" />
              </View>
            )}

            {currentTab === 'patterns' && <PatternsTabContent />}
          </ScrollView>
        )}

        {/* Day Detail Bottom Sheet (Inline) */}
        {selectedDay && (
          <View
            className="absolute bottom-0 left-0 right-0 p-6 rounded-t-3xl shadow-xl border-t"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 10,
              paddingBottom: 40 // Extra padding for safety
            }}
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

        {/* Battery Check-in Sheet */}
        <SocialBatterySheet
          isVisible={batterySheetVisible}
          onSubmit={handleBatteryCheckinSubmit}
          onDismiss={handleBatterySheetDismiss}
        />
      </View>
    </Modal>
  );
}
