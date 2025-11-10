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
import Animated, { FadeIn } from 'react-native-reanimated';
import { X, Calendar, BarChart3, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../hooks/useTheme';
import { MoonPhaseIllustration } from './MoonPhaseIllustration';
import { PatternsTabContent } from './PatternsTabContent';
import { GraphsTabContent } from './GraphsTabContent';
import {
  getYearMoonData,
  getYearStats,
  getMonthName,
  MonthMoonData,
  DayMoonData,
} from '../../lib/year-in-moons-data';
import * as Haptics from 'expo-haptics';

interface YearInMoonsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'moons' | 'graphs' | 'patterns';

export function YearInMoonsModal({ isOpen, onClose }: YearInMoonsModalProps) {
  const { colors } = useTheme();
  const [currentTab, setCurrentTab] = useState<Tab>('moons');
  const [yearData, setYearData] = useState<MonthMoonData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayMoonData | null>(null);
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

  const handleTabChange = (tab: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCurrentTab(tab);
  };

  const handleMoonPress = (day: DayMoonData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedDay(day);
  };

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: 'moons', label: 'Moons', icon: Calendar },
    { id: 'graphs', label: 'Graphs', icon: BarChart3 },
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
        colors={['#1a1d2e', '#0f1419']}
        style={{ flex: 1 }}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      >
        <SafeAreaView className="flex-1">
          {/* Header */}
          <View
            className="flex-row items-center justify-between px-5 py-4"
            style={{ borderBottomWidth: 1, borderBottomColor: '#2A2E3F' }}
          >
            <View className="flex-1">
              <Text
                className="text-xl font-bold"
                style={{ color: '#F5F1E8', fontFamily: 'Lora_700Bold' }}
              >
                Year in Moons
              </Text>
              <Text
                className="text-xs mt-0.5"
                style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}
              >
                {currentYear}
              </Text>
            </View>

            <TouchableOpacity onPress={handleClose} className="p-2 -mr-2">
              <X size={24} color="#8A8F9E" />
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
                    backgroundColor: isActive ? '#2A2E3F' : 'transparent',
                  }}
                >
                  <Icon size={16} color={isActive ? '#F5F1E8' : '#8A8F9E'} />
                  <Text
                    className="text-sm font-medium"
                    style={{
                      color: isActive ? '#F5F1E8' : '#8A8F9E',
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
              <ActivityIndicator size="large" color="#F5F1E8" />
              <Text
                className="text-sm mt-4"
                style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}
              >
                Loading your moon journey...
              </Text>
            </View>
          ) : (
            <>
              {currentTab === 'moons' && (
                <ScrollView
                  ref={scrollViewRef}
                  className="flex-1 px-5 py-4"
                  showsVerticalScrollIndicator={false}
                >
                  {/* Stats Summary */}
                  <View className="flex-row gap-3 mb-6">
                    <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: '#2A2E3F' }}>
                      <Text
                        className="text-2xl font-bold mb-0.5"
                        style={{ color: '#F5F1E8', fontFamily: 'Lora_700Bold' }}
                      >
                        {yearStats.totalCheckins}
                      </Text>
                      <Text
                        className="text-[10px]"
                        style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}
                      >
                        Check-ins
                      </Text>
                    </View>

                    <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: '#2A2E3F' }}>
                      <Text
                        className="text-2xl font-bold mb-0.5"
                        style={{ color: '#F5F1E8', fontFamily: 'Lora_700Bold' }}
                      >
                        {yearStats.streakDays}
                      </Text>
                      <Text
                        className="text-[10px]"
                        style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}
                      >
                        Day Streak
                      </Text>
                    </View>

                    <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: '#2A2E3F' }}>
                      <Text
                        className="text-2xl font-bold mb-0.5"
                        style={{ color: '#F5F1E8', fontFamily: 'Lora_700Bold' }}
                      >
                        {yearStats.avgBattery}/5
                      </Text>
                      <Text
                        className="text-[10px]"
                        style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}
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
                        style={{ color: '#F5F1E8', fontFamily: 'Inter_600SemiBold' }}
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
                              style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}
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
                            className="items-center justify-center mb-2"
                            style={{ width: moonSize, height: moonSize }}
                          >
                            <MoonPhaseIllustration
                              phase={day.moonPhase}
                              size={moonSize - 8}
                              hasCheckin={day.hasCheckin}
                              batteryLevel={day.batteryLevel}
                            />
                            {/* Day number */}
                            <Text
                              className="text-[9px] mt-0.5"
                              style={{
                                color: day.hasCheckin ? '#F5F1E8' : '#5A5F6E',
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
                </ScrollView>
              )}

              {currentTab === 'graphs' && <GraphsTabContent year={currentYear} />}

              {currentTab === 'patterns' && <PatternsTabContent />}
            </>
          )}

          {/* Day Detail Bottom Sheet */}
          {selectedDay && (
            <View
              className="absolute bottom-0 left-0 right-0 p-6 rounded-t-3xl"
              style={{ backgroundColor: '#2A2E3F' }}
            >
              <View className="flex-row items-start justify-between mb-4">
                <View>
                  <Text
                    className="text-lg font-bold mb-1"
                    style={{ color: '#F5F1E8', fontFamily: 'Lora_700Bold' }}
                  >
                    {selectedDay.date.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </Text>
                  <Text
                    className="text-sm"
                    style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}
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
                  <X size={20} color="#8A8F9E" />
                </TouchableOpacity>
              </View>

              <View className="items-center mb-4">
                <MoonPhaseIllustration
                  phase={selectedDay.moonPhase}
                  size={80}
                  hasCheckin={selectedDay.hasCheckin}
                  batteryLevel={selectedDay.batteryLevel}
                />
              </View>

              {!selectedDay.hasCheckin && (
                <Text
                  className="text-xs text-center mb-2"
                  style={{ color: '#8A8F9E', fontFamily: 'Inter_400Regular' }}
                >
                  Long-press to add a check-in for this day
                </Text>
              )}
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}
