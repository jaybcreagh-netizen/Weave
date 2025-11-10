/**
 * ReflectionJourneyModal
 * View past weekly reflections, gratitude entries, and track reflection streak
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { X, Calendar, TrendingUp, Sparkles, ChevronRight, Search, List, Filter } from 'lucide-react-native';
import { useTheme } from '../../hooks/useTheme';
import { database } from '../../db';
import WeeklyReflection from '../../db/models/WeeklyReflection';
import { Q } from '@nozbe/watermelondb';
import { format } from 'date-fns';
import { STORY_CHIPS } from '../../lib/story-chips';
import { ReflectionCalendarView } from './ReflectionCalendarView';
import { ReflectionDetailModal } from './ReflectionDetailModal';
import * as Haptics from 'expo-haptics';

interface ReflectionJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'list' | 'calendar';

export function ReflectionJourneyModal({ isOpen, onClose }: ReflectionJourneyModalProps) {
  const { colors } = useTheme();
  const [reflections, setReflections] = useState<WeeklyReflection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [totalReflections, setTotalReflections] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChipFilter, setSelectedChipFilter] = useState<string | null>(null);
  const [selectedReflection, setSelectedReflection] = useState<WeeklyReflection | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadReflections();
    }
  }, [isOpen]);

  const loadReflections = async () => {
    setIsLoading(true);
    try {
      const allReflections = await database
        .get<WeeklyReflection>('weekly_reflections')
        .query(Q.sortBy('week_end_date', Q.desc))
        .fetch();

      setReflections(allReflections);
      setTotalReflections(allReflections.length);
      setStreak(calculateStreak(allReflections));
    } catch (error) {
      console.error('Error loading reflections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStreak = (reflections: WeeklyReflection[]): number => {
    if (reflections.length === 0) return 0;

    // Sort by most recent first
    const sorted = [...reflections].sort((a, b) => b.weekEndDate - a.weekEndDate);

    let currentStreak = 0;
    const weekInMs = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();

    for (let i = 0; i < sorted.length; i++) {
      const reflection = sorted[i];
      const expectedWeekEnd = now - (i * weekInMs);
      const difference = Math.abs(reflection.weekEndDate - expectedWeekEnd);

      // Allow 3 days of flexibility
      if (difference < 3 * 24 * 60 * 60 * 1000) {
        currentStreak++;
      } else {
        break;
      }
    }

    return currentStreak;
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  // Get all unique story chips from reflections for filtering
  const allChips = useMemo(() => {
    const chipIds = new Set<string>();
    reflections.forEach(r => {
      r.storyChips.forEach(chip => chipIds.add(chip.chipId));
    });
    return Array.from(chipIds)
      .map(chipId => STORY_CHIPS.find(c => c.id === chipId))
      .filter((c): c is typeof STORY_CHIPS[0] => c !== undefined);
  }, [reflections]);

  // Filter reflections based on search and chip filter
  const filteredReflections = useMemo(() => {
    return reflections.filter(reflection => {
      // Search filter (searches gratitude text)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesText = reflection.gratitudeText?.toLowerCase().includes(query);
        const matchesChips = reflection.storyChips.some(chip => {
          const chipData = STORY_CHIPS.find(c => c.id === chip.chipId);
          return chipData?.plainText.toLowerCase().includes(query);
        });
        if (!matchesText && !matchesChips) return false;
      }

      // Chip filter
      if (selectedChipFilter) {
        if (!reflection.storyChips.some(chip => chip.chipId === selectedChipFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [reflections, searchQuery, selectedChipFilter]);

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        {/* Header */}
        <View
          className="px-5 py-4"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          <View className="flex-row items-center justify-between mb-3">
            <Text
              className="text-xl font-bold"
              style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
            >
              Reflection Journey
            </Text>
            <View className="flex-row items-center gap-2">
              {/* View Toggle */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setViewMode(viewMode === 'list' ? 'calendar' : 'list');
                }}
                className="p-2"
              >
                {viewMode === 'list' ? (
                  <Calendar size={20} color={colors.foreground} />
                ) : (
                  <List size={20} color={colors.foreground} />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={handleClose} className="p-2">
                <X size={24} color={colors['muted-foreground']} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View
            className="flex-row items-center px-3 py-2 rounded-xl mb-3"
            style={{ backgroundColor: colors.muted }}
          >
            <Search size={16} color={colors['muted-foreground']} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search reflections..."
              placeholderTextColor={colors['muted-foreground']}
              className="flex-1 ml-2 text-sm"
              style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={colors['muted-foreground']} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Chips */}
          {allChips.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row gap-2"
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedChipFilter(null);
                }}
                className="px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: !selectedChipFilter ? colors.primary : colors.muted,
                }}
              >
                <Text
                  className="text-xs"
                  style={{
                    color: !selectedChipFilter ? colors['primary-foreground'] : colors['muted-foreground'],
                    fontFamily: 'Inter_500Medium',
                  }}
                >
                  All
                </Text>
              </TouchableOpacity>
              {allChips.map(chip => (
                <TouchableOpacity
                  key={chip.id}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedChipFilter(selectedChipFilter === chip.id ? null : chip.id);
                  }}
                  className="px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: selectedChipFilter === chip.id ? colors.primary : colors.muted,
                  }}
                >
                  <Text
                    className="text-xs"
                    style={{
                      color: selectedChipFilter === chip.id ? colors['primary-foreground'] : colors['muted-foreground'],
                      fontFamily: 'Inter_500Medium',
                    }}
                  >
                    {chip.plainText}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Content */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text
              className="text-sm mt-4"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
            >
              Loading your journey...
            </Text>
          </View>
        ) : (
          <ScrollView className="flex-1 px-5 py-4" showsVerticalScrollIndicator={false}>
            {/* Stats Cards */}
            <View className="flex-row gap-3 mb-6">
              {/* Streak */}
              <Animated.View
                entering={FadeIn}
                className="flex-1 p-4 rounded-2xl"
                style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: colors.primary + '20' }}
                >
                  <TrendingUp size={20} color={colors.primary} />
                </View>
                <Text
                  className="text-2xl font-bold mb-1"
                  style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
                >
                  {streak}
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Week Streak
                </Text>
              </Animated.View>

              {/* Total */}
              <Animated.View
                entering={FadeIn.delay(100)}
                className="flex-1 p-4 rounded-2xl"
                style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
              >
                <View
                  className="w-10 h-10 rounded-full items-center justify-center mb-2"
                  style={{ backgroundColor: colors.secondary + '20' }}
                >
                  <Calendar size={20} color={colors.secondary} />
                </View>
                <Text
                  className="text-2xl font-bold mb-1"
                  style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
                >
                  {totalReflections}
                </Text>
                <Text
                  className="text-xs"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Total Reflections
                </Text>
              </Animated.View>
            </View>

            {/* View Mode: Calendar */}
            {viewMode === 'calendar' ? (
              <ReflectionCalendarView
                reflections={filteredReflections}
                onReflectionSelect={(reflection) => {
                  setSelectedReflection(reflection);
                }}
              />
            ) : (
              <>
            {/* Reflections List */}
            {filteredReflections.length > 0 ? (
              <View className="mb-4">
                <Text
                  className="text-base font-semibold mb-3"
                  style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                >
                  {searchQuery || selectedChipFilter ? `${filteredReflections.length} Reflection${filteredReflections.length === 1 ? '' : 's'} Found` : 'Past Reflections'}
                </Text>

                {filteredReflections.map((reflection, index) => (
                  <TouchableOpacity
                    key={reflection.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedReflection(reflection);
                    }}
                    activeOpacity={0.7}
                  >
                    <Animated.View
                      entering={FadeIn.delay(200 + index * 50)}
                      className="mb-3 p-4 rounded-2xl"
                      style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
                    >
                    {/* Date Header */}
                    <View className="flex-row items-center justify-between mb-3">
                      <Text
                        className="text-sm font-semibold"
                        style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                      >
                        {reflection.getWeekRange()}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                      >
                        {reflection.getDaysAgo() === 0
                          ? 'Today'
                          : reflection.getDaysAgo() < 7
                          ? `${reflection.getDaysAgo()}d ago`
                          : `${Math.floor(reflection.getDaysAgo() / 7)}w ago`}
                      </Text>
                    </View>

                    {/* Stats Grid */}
                    <View className="flex-row gap-2 mb-3">
                      <View
                        className="flex-1 px-3 py-2 rounded-lg"
                        style={{ backgroundColor: colors.muted }}
                      >
                        <Text
                          className="text-xl font-bold mb-0.5"
                          style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
                        >
                          {reflection.totalWeaves}
                        </Text>
                        <Text
                          className="text-[10px]"
                          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                        >
                          Weaves
                        </Text>
                      </View>

                      <View
                        className="flex-1 px-3 py-2 rounded-lg"
                        style={{ backgroundColor: colors.muted }}
                      >
                        <Text
                          className="text-xl font-bold mb-0.5"
                          style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
                        >
                          {reflection.friendsContacted}
                        </Text>
                        <Text
                          className="text-[10px]"
                          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                        >
                          Friends
                        </Text>
                      </View>

                      <View
                        className="flex-1 px-3 py-2 rounded-lg"
                        style={{ backgroundColor: colors.muted }}
                      >
                        <Text
                          className="text-xl font-bold mb-0.5"
                          style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
                        >
                          {reflection.missedFriendsCount}
                        </Text>
                        <Text
                          className="text-[10px]"
                          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                        >
                          Missed
                        </Text>
                      </View>
                    </View>

                    {/* Top Activity */}
                    {reflection.topActivity && (
                      <View className="mb-3">
                        <Text
                          className="text-xs mb-1"
                          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                        >
                          Top Activity
                        </Text>
                        <Text
                          className="text-sm font-medium"
                          style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                        >
                          {reflection.topActivity} ({reflection.topActivityCount}×)
                        </Text>
                      </View>
                    )}

                    {/* Story Chips */}
                    {reflection.storyChips.length > 0 && (
                      <View className="mb-3">
                        <Text
                          className="text-xs mb-2"
                          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                        >
                          Week Themes
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                          {reflection.storyChips.map((chip, chipIndex) => {
                            const chipData = STORY_CHIPS.find(c => c.id === chip.chipId);
                            if (!chipData) return null;

                            return (
                              <View
                                key={`${chip.chipId}-${chipIndex}`}
                                className="px-3 py-1.5 rounded-full"
                                style={{ backgroundColor: colors.primary + '15' }}
                              >
                                <Text
                                  className="text-xs"
                                  style={{ color: colors.primary, fontFamily: 'Inter_400Regular' }}
                                >
                                  {chipData.plainText}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {/* Gratitude */}
                    {reflection.gratitudeText && (
                      <View
                        className="p-3 rounded-xl"
                        style={{ backgroundColor: colors.secondary + '10' }}
                      >
                        <View className="flex-row items-center mb-2">
                          <Sparkles size={14} color={colors.secondary} />
                          <Text
                            className="text-xs font-medium ml-1.5"
                            style={{ color: colors.secondary, fontFamily: 'Inter_500Medium' }}
                          >
                            Gratitude Entry
                          </Text>
                        </View>
                        <Text
                          className="text-sm italic leading-5"
                          style={{ color: colors.foreground, fontFamily: 'Lora_400Regular' }}
                        >
                          "{reflection.gratitudeText}"
                        </Text>
                        {reflection.gratitudePrompt && (
                          <Text
                            className="text-xs mt-2"
                            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                          >
                            Prompt: {reflection.gratitudePrompt}
                          </Text>
                        )}
                      </View>
                    )}
                  </Animated.View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View className="flex-1 items-center justify-center py-16">
                <Text className="text-5xl mb-4">📖</Text>
                <Text
                  className="text-lg font-semibold text-center mb-2"
                  style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
                >
                  Your Journey Begins
                </Text>
                <Text
                  className="text-sm text-center px-8 leading-5"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Complete your first weekly reflection to start building your practice.
                </Text>
              </View>
            )}
            </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {/* Reflection Detail/Edit Modal */}
      <ReflectionDetailModal
        reflection={selectedReflection}
        isOpen={selectedReflection !== null}
        onClose={() => setSelectedReflection(null)}
        onUpdate={() => {
          // Reload reflections after update
          loadReflections();
        }}
      />
    </Modal>
  );
}
