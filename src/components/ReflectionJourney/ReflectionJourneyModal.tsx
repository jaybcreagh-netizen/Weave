/**
 * ReflectionJourneyModal
 * View past weekly reflections, gratitude entries, and track reflection streak
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, SafeAreaView, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { X, Calendar, TrendingUp, Sparkles, ChevronRight, Search, List, Filter, Plus, BookOpen, Users } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { formatWeaveDate, daysAgo } from '@/shared/utils/date-utils';
import { getWeekRange, getAllReflectionFriends, getFriendsForReflection } from '@/modules/reflection';
import { database } from '@/db';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import JournalEntry from '@/db/models/JournalEntry';
import { Q } from '@nozbe/watermelondb';
import { format } from 'date-fns';
import { STORY_CHIPS } from '@/lib/story-chips';
import { ReflectionCalendarView } from './ReflectionCalendarView';
import { ReflectionDetailModal } from './ReflectionDetailModal';
import { JournalEntryModal } from '../Journal/JournalEntryModal';
import { checkAndScheduleMemoryNudges } from '@/lib/notification-manager-enhanced';
import FriendModel from '@/db/models/Friend';
import * as Haptics from 'expo-haptics';

// Unified type for displaying both weekly reflections and journal entries
type JournalItem =
  | { type: 'weekly_reflection'; data: WeeklyReflection; date: number }
  | { type: 'journal_entry'; data: JournalEntry; date: number };

interface ReflectionJourneyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ViewMode = 'list' | 'calendar';

export function ReflectionJourneyModal({ isOpen, onClose }: ReflectionJourneyModalProps) {
  const { colors } = useTheme();
  const [reflections, setReflections] = useState<WeeklyReflection[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [totalReflections, setTotalReflections] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChipFilter, setSelectedChipFilter] = useState<string | null>(null);
  const [selectedFriendFilter, setSelectedFriendFilter] = useState<string | null>(null);
  const [selectedReflection, setSelectedReflection] = useState<WeeklyReflection | null>(null);
  const [selectedJournalEntry, setSelectedJournalEntry] = useState<JournalEntry | null>(null);
  const [isJournalEntryModalOpen, setIsJournalEntryModalOpen] = useState(false);
  const [allFriends, setAllFriends] = useState<FriendModel[]>([]);
  const [reflectionFriendMap, setReflectionFriendMap] = useState<Map<string, string[]>>(new Map());

  useEffect(() => {
    if (isOpen) {
      loadData();
      loadFriends();
      checkAndScheduleMemoryNudges(); // Check for anniversary reflections
    }
  }, [isOpen]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load weekly reflections
      const allReflections = await database
        .get<WeeklyReflection>('weekly_reflections')
        .query(Q.sortBy('week_end_date', Q.desc))
        .fetch();

      // Load journal entries
      const allJournalEntries = await database
        .get<JournalEntry>('journal_entries')
        .query(Q.sortBy('entry_date', Q.desc))
        .fetch();

      setReflections(allReflections);
      setJournalEntries(allJournalEntries);
      setTotalReflections(allReflections.length + allJournalEntries.length);
      setStreak(calculateStreak(allReflections));

      // Build reflection-to-friends mapping for filtering
      const friendMap = new Map<string, string[]>();
      await Promise.all(
        allReflections.map(async (reflection) => {
          const friends = await getFriendsForReflection(reflection);
          friendMap.set(reflection.id, friends.map(f => f.friend.id));
        })
      );
      setReflectionFriendMap(friendMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadFriends = async () => {
    try {
      const friends = await getAllReflectionFriends();
      setAllFriends(friends);
    } catch (error) {
      console.error('Error loading friends:', error);
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

  // Get all unique story chips from both reflections and journal entries
  const allChips = useMemo(() => {
    const chipIds = new Set<string>();
    reflections.forEach(r => {
      r.storyChips.forEach(chip => chipIds.add(chip.chipId));
    });
    journalEntries.forEach(e => {
      e.storyChips.forEach(chip => chipIds.add(chip.chipId));
    });
    return Array.from(chipIds)
      .map(chipId => STORY_CHIPS.find(c => c.id === chipId))
      .filter((c): c is typeof STORY_CHIPS[0] => c !== undefined);
  }, [reflections, journalEntries]);

  // Merge and filter both types of entries
  const filteredJournalItems = useMemo(() => {
    // Create unified list
    const items: JournalItem[] = [
      ...reflections.map(r => ({
        type: 'weekly_reflection' as const,
        data: r,
        date: r.weekEndDate,
      })),
      ...journalEntries.map(e => ({
        type: 'journal_entry' as const,
        data: e,
        date: e.entryDate,
      })),
    ];

    // Filter items
    return items.filter(item => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (item.type === 'weekly_reflection') {
          const matchesText = item.data.gratitudeText?.toLowerCase().includes(query);
          const matchesChips = item.data.storyChips.some(chip => {
            const chipData = STORY_CHIPS.find(c => c.id === chip.chipId);
            return chipData?.plainText.toLowerCase().includes(query);
          });
          if (!matchesText && !matchesChips) return false;
        } else {
          const matchesTitle = item.data.title?.toLowerCase().includes(query);
          const matchesContent = item.data.content.toLowerCase().includes(query);
          const matchesChips = item.data.storyChips.some(chip => {
            const chipData = STORY_CHIPS.find(c => c.id === chip.chipId);
            return chipData?.plainText.toLowerCase().includes(query);
          });
          if (!matchesTitle && !matchesContent && !matchesChips) return false;
        }
      }

      // Chip filter
      if (selectedChipFilter) {
        const storyChips = item.type === 'weekly_reflection' ? item.data.storyChips : item.data.storyChips;
        if (!storyChips.some(chip => chip.chipId === selectedChipFilter)) {
          return false;
        }
      }

      // Friend filter
      if (selectedFriendFilter) {
        if (item.type === 'weekly_reflection') {
          const friendIds = reflectionFriendMap.get(item.data.id);
          if (!friendIds || !friendIds.includes(selectedFriendFilter)) {
            return false;
          }
        } else {
          if (!item.data.friendIds.includes(selectedFriendFilter)) {
            return false;
          }
        }
      }

      return true;
    }).sort((a, b) => b.date - a.date); // Sort by date descending
  }, [reflections, journalEntries, searchQuery, selectedChipFilter, selectedFriendFilter, reflectionFriendMap]);

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
              Journal
            </Text>
            <View className="flex-row items-center gap-2">
              {/* New Entry Button */}
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedJournalEntry(null);
                  setIsJournalEntryModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg flex-row items-center gap-1.5"
                style={{ backgroundColor: colors.primary }}
              >
                <Plus size={16} color={colors['primary-foreground']} />
                <Text
                  className="text-sm font-semibold"
                  style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
                >
                  New
                </Text>
              </TouchableOpacity>
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
            <View className="mb-2">
              <Text
                className="text-xs mb-2"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
              >
                Filter by Theme
              </Text>
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
                    All Themes
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
            </View>
          )}

          {/* Filter by Friends */}
          {allFriends.length > 0 && (
            <View>
              <Text
                className="text-xs mb-2"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
              >
                Filter by Friend
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-row gap-2"
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedFriendFilter(null);
                  }}
                  className="px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: !selectedFriendFilter ? colors.primary : colors.muted,
                  }}
                >
                  <Text
                    className="text-xs"
                    style={{
                      color: !selectedFriendFilter ? colors['primary-foreground'] : colors['muted-foreground'],
                      fontFamily: 'Inter_500Medium',
                    }}
                  >
                    All Friends
                  </Text>
                </TouchableOpacity>
                {allFriends.map(friend => (
                  <TouchableOpacity
                    key={friend.id}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedFriendFilter(selectedFriendFilter === friend.id ? null : friend.id);
                    }}
                    className="px-3 py-1.5 rounded-full"
                    style={{
                      backgroundColor: selectedFriendFilter === friend.id ? colors.primary : colors.muted,
                    }}
                  >
                    <Text
                      className="text-xs"
                      style={{
                        color: selectedFriendFilter === friend.id ? colors['primary-foreground'] : colors['muted-foreground'],
                        fontFamily: 'Inter_500Medium',
                      }}
                    >
                      {friend.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
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
                reflections={reflections}
                onReflectionSelect={(reflection) => {
                  setSelectedReflection(reflection);
                }}
              />
            ) : (
              <>
            {/* Journal List */}
            {filteredJournalItems.length > 0 ? (
              <View className="mb-4">
                <Text
                  className="text-base font-semibold mb-3"
                  style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                >
                  {searchQuery || selectedChipFilter || selectedFriendFilter ? `${filteredJournalItems.length} Entr${filteredJournalItems.length === 1 ? 'y' : 'ies'} Found` : 'Journal Entries'}
                </Text>

                {filteredJournalItems.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.type}-${item.data.id}`}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      if (item.type === 'weekly_reflection') {
                        setSelectedReflection(item.data);
                      } else {
                        setSelectedJournalEntry(item.data);
                        setIsJournalEntryModalOpen(true);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Animated.View
                      entering={FadeIn.delay(200 + index * 50)}
                      className="mb-3 p-4 rounded-2xl"
                      style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
                    >
                    {item.type === 'weekly_reflection' ? (
                      <>
                    {/* Weekly Reflection Card */}
                    <View className="flex-row items-center gap-2 mb-2">
                      <View
                        className="px-2 py-0.5 rounded"
                        style={{ backgroundColor: colors.secondary + '20' }}
                      >
                        <Text
                          className="text-[10px] font-semibold"
                          style={{ color: colors.secondary, fontFamily: 'Inter_600SemiBold' }}
                        >
                          WEEKLY
                        </Text>
                      </View>
                      <Text
                        className="text-sm font-semibold flex-1"
                        style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                      >
                        {getWeekRange(item.data)}
                      </Text>
                      <Text
                        className="text-xs"
                        style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                      >
                        {daysAgo(new Date(item.data.entryDate)) === 0
                          ? 'Today'
                          : daysAgo(new Date(item.data.entryDate)) < 7
                          ? `${daysAgo(new Date(item.data.entryDate))}d ago`
                          : `${Math.floor(daysAgo(new Date(item.data.entryDate)) / 7)}w ago`}
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
                          {item.data.totalWeaves}
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
                          {item.data.friendsContacted}
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
                          {item.data.missedFriendsCount}
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
                    {item.data.topActivity && (
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
                          {item.data.topActivity} ({item.data.topActivityCount}×)
                        </Text>
                      </View>
                    )}

                    {/* Story Chips */}
                    {item.data.storyChips.length > 0 && (
                      <View className="mb-3">
                        <Text
                          className="text-xs mb-2"
                          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                        >
                          Week Themes
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                          {item.data.storyChips.map((chip, chipIndex) => {
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
                    {item.data.gratitudeText && (
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
                          "{item.data.gratitudeText}"
                        </Text>
                        {item.data.gratitudePrompt && (
                          <Text
                            className="text-xs mt-2"
                            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                          >
                            Prompt: {item.data.gratitudePrompt}
                          </Text>
                        )}
                      </View>
                    )}
                    </>
                    ) : (
                      <>
                    {/* Journal Entry Card */}
                    <View className="flex-row items-center gap-2 mb-3">
                      <View
                        className="px-2 py-0.5 rounded"
                        style={{ backgroundColor: colors.primary + '20' }}
                      >
                        <Text
                          className="text-[10px] font-semibold"
                          style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}
                        >
                          ENTRY
                        </Text>
                      </View>
                      {item.data.title && (
                        <Text
                          className="text-sm font-semibold flex-1"
                          style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                        >
                          {item.data.title}
                        </Text>
                      )}
                      <Text
                        className="text-xs"
                        style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                      >
                        {formatWeaveDate(new Date(item.data.entryDate))}
                      </Text>
                    </View>

                    {/* Content Preview */}
                    <Text
                      className="text-sm leading-5 mb-3"
                      style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}
                      numberOfLines={3}
                    >
                      {item.data.content}
                    </Text>

                    {/* Tagged Friends */}
                    {item.data.friendIds.length > 0 && (
                      <View className="flex-row items-center gap-2 mb-3">
                        <Users size={12} color={colors['muted-foreground']} />
                        <Text
                          className="text-xs"
                          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                        >
                          {item.data.friendIds.length} friend{item.data.friendIds.length > 1 ? 's' : ''} tagged
                        </Text>
                      </View>
                    )}

                    {/* Story Chips */}
                    {item.data.storyChips.length > 0 && (
                      <View className="flex-row flex-wrap gap-2">
                        {item.data.storyChips.map((chip, chipIndex) => {
                          const chipData = STORY_CHIPS.find(c => c.id === chip.chipId);
                          if (!chipData) return null;
                          return (
                            <View
                              key={`${chip.chipId}-${chipIndex}`}
                              className="px-3 py-1 rounded-full"
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
                    )}
                    </>
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
          // Reload data after update
          loadData();
        }}
      />

      {/* Journal Entry Create/Edit Modal */}
      <JournalEntryModal
        isOpen={isJournalEntryModalOpen}
        onClose={() => {
          setIsJournalEntryModalOpen(false);
          setSelectedJournalEntry(null);
        }}
        entry={selectedJournalEntry}
        onSave={() => {
          // Reload data after save
          loadData();
        }}
      />
    </Modal>
  );
}
