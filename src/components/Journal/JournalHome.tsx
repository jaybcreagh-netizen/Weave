/**
 * JournalHome
 * 
 * Redesigned journal browser with:
 * - Memory surfacing (anniversaries, patterns, throwbacks)
 * - Tab navigation: All | By Friend | Calendar
 * - Search capability
 * - Quick access to new entry flows
 * 
 * This is the main entry point for the Journal feature.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  FadeOutDown,
} from 'react-native-reanimated';
import {
  Search,
  Plus,
  BookOpen,
  Users,

  Calendar as CalendarIcon,
  Sparkles,
  ChevronRight,
  Clock,
  Edit3,
  MessageCircle,
  Lightbulb,
  X,
  Gift,
} from 'lucide-react-native';
import { Calendar as RNCalendar, DateData } from 'react-native-calendars';
import { format, subYears, isSameDay, parseISO } from 'date-fns';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import FriendModel from '@/db/models/Friend';
import {
  getMemories,
  getFriendsForBrowsing,
  searchEntries,
  type Memory,
} from '@/modules/journal';
import { Q } from '@nozbe/watermelondb';
import * as Haptics from 'expo-haptics';
import { JournalCalendarDay } from './JournalCalendarDay';



// ============================================================================
// TYPES
// ============================================================================

type Tab = 'all' | 'friend' | 'calendar';

interface JournalHomeProps {
  onNewEntry: (mode: 'quick' | 'guided') => void;
  onEntryPress: (entry: JournalEntry | WeeklyReflection) => void;
  onFriendArcPress: (friendId: string) => void;
  onMemoryAction: (memory: Memory) => void;
  onClose?: () => void;
}

interface FriendWithEntries {
  friend: FriendModel;
  entryCount: number;
  lastEntryDate: Date | null;
  recentActivityIndicator: 'high' | 'medium' | 'low';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function JournalHome({
  onNewEntry,
  onEntryPress,
  onFriendArcPress,
  onMemoryAction,
  onClose,
}: JournalHomeProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // State
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [fabExpanded, setFabExpanded] = useState(false);



  // Data
  const [entries, setEntries] = useState<(JournalEntry | WeeklyReflection)[]>([]);
  const [friendsWithEntries, setFriendsWithEntries] = useState<FriendWithEntries[]>([]);
  const [allFriends, setAllFriends] = useState<Map<string, FriendModel>>(new Map());
  const [memories, setMemories] = useState<Memory[]>([]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadEntries(),
        loadFriends(),
        loadMemories(),
      ]);
    } catch (error) {
      console.error('[JournalHome] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEntries = async () => {
    const [journalEntries, reflections] = await Promise.all([
      database
        .get<JournalEntry>('journal_entries')
        .query(Q.sortBy('entry_date', Q.desc))
        .fetch(),
      database
        .get<WeeklyReflection>('weekly_reflections')
        .query(Q.sortBy('week_start_date', Q.desc), Q.take(20))
        .fetch(),
    ]);

    // Combine and sort by date
    const combined = [
      ...journalEntries,
      ...reflections,
    ].sort((a, b) => {
      const dateA = 'entryDate' in a ? a.entryDate : a.weekStartDate;
      const dateB = 'entryDate' in b ? b.entryDate : b.weekStartDate;
      return dateB - dateA;
    });

    setEntries(combined);
  };

  const loadFriends = async () => {
    const friends = await getFriendsForBrowsing();
    setFriendsWithEntries(friends);

    // Also load all friends for calendar lookup
    const all = await database.get<FriendModel>('friends').query().fetch();
    const friendMap = new Map<string, FriendModel>();
    all.forEach(f => friendMap.set(f.id, f));
    setAllFriends(friendMap);
  };

  const loadMemories = async () => {
    const surfacedMemories = await getMemories(3);
    setMemories(surfacedMemories);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ============================================================================
  // COMPUTED
  // ============================================================================

  const markedDates = useMemo(() => {
    const marks: any = {};

    entries.forEach(entry => {
      const dateVal = 'entryDate' in entry ? entry.entryDate : entry.weekStartDate;
      const date = new Date(dateVal);
      const dateStr = format(date, 'yyyy-MM-dd');

      // Get friend avatars for this entry
      let entryAvatars: string[] = [];
      // if ('friendTags' in entry && entry.friendTags) {
      //   try {
      //     const ids = JSON.parse(entry.friendTags || '[]');
      //     entryAvatars = ids
      //       .map((id: string) => allFriends.get(id)?.photoUrl)
      //       .filter(Boolean);
      //   } catch (e) { }
      // }

      // Merge with existing data for this date
      const existing = marks[dateStr] || {};
      const existingAvatars = existing.friendAvatars || [];

      marks[dateStr] = {
        marked: true,
        friendAvatars: [...new Set([...existingAvatars, ...entryAvatars])],
      };
    });

    // Add Milestones (Birthdays/Anniversaries) & Throwbacks
    // We iterate through a reasonable range or just check all friends?
    // For performance, let's just check the currently loaded entries for throwbacks
    // And iterate all friends for milestones (but we need to know WHICH dates to mark)
    // Actually, react-native-calendars expects a map of ALL marked dates.
    // So we should iterate friends and mark their birthdays/anniversaries for the current year(s)

    // 1. Milestones
    const currentYear = new Date().getFullYear();
    allFriends.forEach(friend => {
      if (friend.birthday) {
        // birthday format "MM-DD"
        const [m, d] = friend.birthday.split('-');
        if (m && d) {
          // Mark for current year and maybe next/prev
          const bdayStr = `${currentYear}-${m}-${d}`;
          const existing = marks[bdayStr] || {};
          const milestones = existing.milestones || [];

          marks[bdayStr] = {
            ...existing,
            isMilestone: true,
            milestones: [...milestones, { type: 'birthday', friend }]
          };
        }
      }
      if (friend.anniversary) {
        const [m, d] = friend.anniversary.split('-');
        if (m && d) {
          const annStr = `${currentYear}-${m}-${d}`;
          const existing = marks[annStr] || {};
          const milestones = existing.milestones || [];

          marks[annStr] = {
            ...existing,
            isMilestone: true,
            milestones: [...milestones, { type: 'anniversary', friend }]
          };
        }
      }
    });

    // 2. Throwbacks (entries from 1 year ago)
    entries.forEach(entry => {
      const dateVal = 'entryDate' in entry ? entry.entryDate : entry.weekStartDate;
      const date = new Date(dateVal);
      // Check if this entry is from ~1 year ago relative to NOW? 
      // Or do we mark the date 1 year later?
      // "This time last year" means if I look at Today (2025), I see an entry from 2024.
      // So we take the entry date, ADD 1 year, and mark THAT date.

      const nextYearDate = new Date(date);
      nextYearDate.setFullYear(date.getFullYear() + 1);
      const nextYearStr = format(nextYearDate, 'yyyy-MM-dd');

      marks[nextYearStr] = {
        ...(marks[nextYearStr] || {}),
        isThrowback: true,
      };
    });

    // Mark selected date
    if (selectedDate) {
      marks[selectedDate] = {
        ...(marks[selectedDate] || {}),
        selected: true,
      };
    }

    return marks;
  }, [entries, selectedDate, allFriends]);

  const selectedDateEntries = useMemo(() => {
    return entries.filter(entry => {
      const dateVal = 'entryDate' in entry ? entry.entryDate : entry.weekStartDate;
      const dateStr = format(new Date(dateVal), 'yyyy-MM-dd');
      return dateStr === selectedDate;
    });
  }, [entries, selectedDate]);

  // ============================================================================
  // SEARCH
  // ============================================================================

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);

    if (query.trim().length < 2) {
      await loadEntries();
      return;
    }

    const results = await searchEntries(query, { type: 'all' });
    setEntries(results);
  }, []);

  const clearSearch = () => {
    setSearchQuery('');
    setShowSearch(false);
    loadEntries();
  };

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const formatEntryDate = (date: Date): string => {
    const now = new Date();
    const entryDate = new Date(date);

    // Same day
    if (entryDate.toDateString() === now.toDateString()) {
      return 'Today';
    }

    // Yesterday
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (entryDate.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    // This week
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    if (entryDate > weekAgo) {
      return entryDate.toLocaleDateString('en-GB', { weekday: 'long' });
    }

    // Older
    return entryDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: entryDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getEntryPreview = (entry: JournalEntry | WeeklyReflection): string => {
    if ('content' in entry) {
      return (entry.content || '').slice(0, 100);
    }
    return (entry.gratitudeText || '').slice(0, 100);
  };

  const getEntryTitle = (entry: JournalEntry | WeeklyReflection): string => {
    if ('title' in entry && entry.title) {
      return entry.title;
    }
    if ('weekStartDate' in entry) {
      return 'Weekly Reflection';
    }
    return 'Journal Entry';
  };

  const isWeeklyReflection = (entry: JournalEntry | WeeklyReflection): boolean => {
    return 'weekStartDate' in entry;
  };

  const renderActivityIndicator = (level: 'high' | 'medium' | 'low') => {
    const dots = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
    return (
      <View className="flex-row gap-0.5">
        {[...Array(3)].map((_, i) => (
          <View
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: i < dots ? colors.primary : colors.border,
            }}
          />
        ))}
      </View>
    );
  };

  // ============================================================================
  // SECTION RENDERS
  // ============================================================================

  const renderMemoryCard = () => {
    if (memories.length === 0) return null;

    const memory = memories[0];

    return (
      <Animated.View entering={FadeInDown.delay(100).duration(400)} className="px-5 mb-4">
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onMemoryAction(memory);
          }}
          className="p-4 rounded-2xl"
          style={{
            backgroundColor: colors.primary + '10',
            borderWidth: 1,
            borderColor: colors.primary + '30',
          }}
          activeOpacity={0.7}
        >
          <View className="flex-row items-center gap-2 mb-2">
            <Lightbulb size={16} color={colors.primary} />
            <Text
              className="text-xs uppercase tracking-wide"
              style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}
            >
              Memory
            </Text>
          </View>

          <Text
            className="text-base mb-2"
            style={{ color: colors.foreground, fontFamily: 'Lora_500Medium' }}
          >
            {memory.title}
          </Text>

          <Text
            className="text-sm mb-3"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            {memory.description}
          </Text>

          <View className="flex-row items-center gap-1">
            <Text
              className="text-sm"
              style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
            >
              {memory.actionLabel}
            </Text>
            <ChevronRight size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEntryCard = (entry: JournalEntry | WeeklyReflection, index: number) => {
    const date = 'entryDate' in entry
      ? new Date(entry.entryDate)
      : new Date(entry.weekStartDate);
    const isReflection = isWeeklyReflection(entry);

    return (
      <Animated.View
        key={entry.id}
        entering={FadeInDown.delay(100 + index * 30).duration(300)}
      >
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEntryPress(entry);
          }}
          className="mx-5 mb-3 p-4 rounded-2xl"
          style={{
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
          }}
          activeOpacity={0.7}
        >
          {/* Header */}
          <View className="flex-row items-center gap-2 mb-2">
            {isReflection ? (
              <Clock size={14} color={colors.primary} />
            ) : (
              <Edit3 size={14} color={colors.primary} />
            )}
            <Text
              className="text-xs flex-1"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
            >
              {formatEntryDate(date)}
            </Text>
            {isReflection && (
              <View
                className="px-2 py-0.5 rounded-full"
                style={{ backgroundColor: colors.muted }}
              >
                <Text
                  className="text-xs"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Weekly
                </Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text
            className="text-base mb-1"
            style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
          >
            {getEntryTitle(entry)}
          </Text>

          {/* Preview */}
          <Text
            className="text-sm"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
            numberOfLines={2}
          >
            {getEntryPreview(entry)}...
          </Text>

          {/* Friend Tags (for journal entries) */}
          {/* {'friendTags' in entry && entry.friendTags && (
            <FriendTags
              friendIds={JSON.parse(entry.friendTags || '[]')}
              colors={colors}
            />
          )} */}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderTabs = () => (
    <View className="flex-row px-5 mb-4 gap-2">
      {[
        { id: 'all' as Tab, label: 'All', icon: BookOpen },
        { id: 'friend' as Tab, label: 'By Friend', icon: Users },
        { id: 'calendar' as Tab, label: 'Calendar', icon: CalendarIcon },
      ].map((tab) => {
        const isActive = activeTab === tab.id;
        const IconComponent = tab.icon;

        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setActiveTab(tab.id);
            }}
            className="flex-row items-center gap-1.5 px-4 py-2 rounded-full"
            style={{
              backgroundColor: isActive ? colors.primary : colors.muted,
            }}
            activeOpacity={0.7}
          >
            <IconComponent
              size={16}
              color={isActive ? colors['primary-foreground'] : colors['muted-foreground']}
            />
            <Text
              className="text-sm"
              style={{
                color: isActive ? colors['primary-foreground'] : colors['muted-foreground'],
                fontFamily: 'Inter_500Medium',
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderAllTab = () => (
    <View className="flex-1">
      {entries.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8 py-16">
          <BookOpen size={40} color={colors['muted-foreground']} />
          <Text
            className="text-lg mt-4 text-center"
            style={{ color: colors.foreground, fontFamily: 'Lora_500Medium' }}
          >
            No entries yet
          </Text>
          <Text
            className="text-sm mt-2 text-center"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            Start documenting your friendships
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          {entries.map((entry, index) => renderEntryCard(entry, index))}

          {/* Bottom padding */}
          <View className="h-24" />
        </ScrollView>
      )}
    </View>
  );

  const renderFriendTab = () => (
    <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
      <View className="px-5">
        {friendsWithEntries.length === 0 ? (
          <View className="items-center justify-center py-16">
            <Users size={40} color={colors['muted-foreground']} />
            <Text
              className="text-lg mt-4 text-center"
              style={{ color: colors.foreground, fontFamily: 'Lora_500Medium' }}
            >
              No friendships documented yet
            </Text>
            <Text
              className="text-sm mt-2 text-center"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
            >
              Tag friends in your entries to see them here
            </Text>
          </View>
        ) : (
          <>
            <Text
              className="text-xs uppercase tracking-wide mb-4"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
            >
              Your Friendships
            </Text>

            {friendsWithEntries.map((item, index) => (
              <Animated.View
                key={item.friend.id}
                entering={FadeInDown.delay(100 + index * 30).duration(300)}
              >
                <TouchableOpacity
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onFriendArcPress(item.friend.id);
                  }}
                  className="mb-3 p-4 rounded-2xl flex-row items-center"
                  style={{
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                  activeOpacity={0.7}
                >
                  {/* Avatar */}
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: colors.muted }}
                  >
                    <Text
                      className="text-lg"
                      style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                    >
                      {item.friend.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  {/* Info */}
                  <View className="flex-1">
                    <Text
                      className="text-base"
                      style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                    >
                      {item.friend.name}
                    </Text>
                    <View className="flex-row items-center gap-2 mt-0.5">
                      <Text
                        className="text-sm"
                        style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                      >
                        {item.entryCount} {item.entryCount === 1 ? 'entry' : 'entries'}
                      </Text>
                      {item.lastEntryDate && (
                        <>
                          <Text style={{ color: colors.border }}>·</Text>
                          <Text
                            className="text-sm"
                            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                          >
                            Last: {formatEntryDate(item.lastEntryDate)}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>

                  {/* Activity indicator */}
                  <View className="items-center">
                    {renderActivityIndicator(item.recentActivityIndicator)}
                  </View>

                  <ChevronRight size={20} color={colors['muted-foreground']} className="ml-2" />
                </TouchableOpacity>
              </Animated.View>
            ))}
          </>
        )}
      </View>

      {/* Bottom padding */}
      <View className="h-24" />
    </ScrollView>
  );

  const renderCalendarTab = () => {
    const selectedMarking = markedDates[selectedDate];
    const milestones = selectedMarking?.milestones || [];

    return (
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-5 mb-4">
          <View
            className="rounded-2xl overflow-hidden"
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card
            }}
          >
            <RNCalendar
              current={selectedDate}
              onDayPress={(day: DateData) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedDate(day.dateString);
              }}
              markedDates={markedDates}
              theme={{
                backgroundColor: colors.card,
                calendarBackground: colors.card,
                textSectionTitleColor: colors['muted-foreground'],
                selectedDayBackgroundColor: colors.primary,
                selectedDayTextColor: colors['primary-foreground'],
                todayTextColor: colors.primary,
                dayTextColor: colors.foreground,
                textDisabledColor: colors.muted,
                dotColor: colors.primary,
                selectedDotColor: colors['primary-foreground'],
                arrowColor: colors.primary,
                monthTextColor: colors.foreground,
                indicatorColor: colors.primary,
                textDayFontFamily: 'Inter_400Regular',
                textMonthFontFamily: 'Lora_500Medium',
                textDayHeaderFontFamily: 'Inter_500Medium',
              }}
              dayComponent={(props: any) => {
                if (!props.date) return <View />;
                return (
                  <JournalCalendarDay
                    state={props.state}
                    marking={props.marking}
                    date={props.date as DateData}
                    onPress={(date) => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setSelectedDate(date.dateString);
                    }}
                  />
                );
              }}
            />
          </View>
        </View>

        <View className="px-5 mb-2">
          <Text
            className="text-sm font-medium"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
          >
            {format(new Date(selectedDate), 'MMMM d, yyyy')}
          </Text>
        </View>

        {/* Milestones Display */}
        {milestones.length > 0 && (
          <View className="px-5 mb-4">
            {milestones.map((m: any, i: number) => (
              <Animated.View
                key={i}
                entering={FadeInDown.delay(100 + i * 50)}
                className="flex-row items-center p-3 rounded-xl mb-2"
                style={{
                  backgroundColor: colors.primary + '10',
                  borderWidth: 1,
                  borderColor: colors.primary + '20'
                }}
              >
                <Gift size={16} color={colors.primary} />
                <Text
                  className="ml-2 text-sm font-medium"
                  style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                >
                  {m.type === 'birthday' ? `${m.friend.name}'s Birthday` : `${m.friend.name}'s Anniversary`}
                </Text>
              </Animated.View>
            ))}
          </View>
        )}

        <View>
          {selectedDateEntries.length === 0 && milestones.length === 0 ? (
            <View className="items-center justify-center py-12">
              <Text
                className="text-base text-center"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                No entries for this day
              </Text>
            </View>
          ) : (
            selectedDateEntries.map((entry, index) => renderEntryCard(entry, index))
          )}
          <View className="h-24" />
        </View>
      </ScrollView>
    );
  };

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-5 pb-3" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row items-center justify-between mb-4">
          <View className="flex-row items-center gap-2">
            {onClose && (
              <TouchableOpacity onPress={onClose} className="mr-1">
                <ChevronRight size={28} color={colors.foreground} style={{ transform: [{ rotate: '180deg' }] }} />
              </TouchableOpacity>
            )}
            <Text
              className="text-2xl"
              style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
            >
              Journal
            </Text>
          </View>

          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => setShowSearch(!showSearch)}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: showSearch ? colors.primary + '20' : colors.muted }}
            >
              <Search size={20} color={showSearch ? colors.primary : colors['muted-foreground']} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        {showSearch && (
          <Animated.View entering={FadeInUp.duration(200)} className="mb-4">
            <View
              className="flex-row items-center px-4 py-3 rounded-xl"
              style={{ backgroundColor: colors.muted }}
            >
              <Search size={18} color={colors['muted-foreground']} />
              <TextInput
                value={searchQuery}
                onChangeText={handleSearch}
                placeholder="Search entries..."
                placeholderTextColor={colors['muted-foreground']}
                className="flex-1 ml-3 text-base"
                style={{ color: colors.foreground, fontFamily: 'Inter_400Regular' }}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={clearSearch}>
                  <X size={18} color={colors['muted-foreground']} />
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        )}
      </View>

      {/* Memory Card */}
      {!showSearch && renderMemoryCard()}

      {/* Tabs */}
      {!showSearch && renderTabs()}

      {/* Content */}
      {activeTab === 'all' && renderAllTab()}
      {activeTab === 'friend' && renderFriendTab()}
      {activeTab === 'calendar' && renderCalendarTab()}

      {/* Backdrop for FAB */}
      {fabExpanded && (
        <TouchableOpacity
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0,0,0,0.6)', // Darken background for focus
            zIndex: 40,
          }}
          activeOpacity={1}
          onPress={() => setFabExpanded(false)}
        >
          <Animated.View
            entering={FadeIn.duration(200)}
            style={StyleSheet.absoluteFill}
          />
        </TouchableOpacity>
      )}

      {/* Floating Action Button */}
      <View className="absolute bottom-6 right-5 z-50">
        <NewEntryFAB
          expanded={fabExpanded}
          onToggle={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setFabExpanded(!fabExpanded);
          }}
          onPress={(mode) => {
            setFabExpanded(false);
            onNewEntry(mode);
          }}
          colors={colors}
        />
      </View>
    </View>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface FriendTagsProps {
  friendIds: string[];
  colors: any;
}

function FriendTags({ friendIds, colors }: FriendTagsProps) {
  const [friends, setFriends] = useState<FriendModel[]>([]);

  useEffect(() => {
    if (friendIds.length === 0) return;

    database
      .get<FriendModel>('friends')
      .query(Q.where('id', Q.oneOf(friendIds)))
      .fetch()
      .then(setFriends);
  }, [friendIds]);

  if (friends.length === 0) return null;

  return (
    <View className="flex-row flex-wrap gap-1.5 mt-2">
      {friends.slice(0, 3).map((friend) => (
        <View
          key={friend.id}
          className="flex-row items-center gap-1 px-2 py-1 rounded-full"
          style={{ backgroundColor: colors.primary + '15' }}
        >
          <Users size={10} color={colors.primary} />
          <Text
            className="text-xs"
            style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
          >
            {friend.name}
          </Text>
        </View>
      ))}
      {friends.length > 3 && (
        <View
          className="px-2 py-1 rounded-full"
          style={{ backgroundColor: colors.muted }}
        >
          <Text
            className="text-xs"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            +{friends.length - 3}
          </Text>
        </View>
      )}
    </View>
  );
}

interface NewEntryFABProps {
  expanded: boolean;
  onToggle: () => void;
  onPress: (mode: 'quick' | 'guided') => void;
  colors: any;
}

function NewEntryFAB({ expanded, onToggle, onPress, colors }: NewEntryFABProps) {
  const handleQuick = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress('quick');
  };

  const handleGuided = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress('guided');
  };

  return (
    <View className="items-end">
      {/* Expanded Options */}
      {expanded && (
        <View className="mb-4 gap-3">
          {/* Quick Capture (Top) */}
          <Animated.View
            entering={FadeInDown.springify().damping(15).delay(50)}
            exiting={FadeOutDown.duration(150)}
          >
            <TouchableOpacity
              onPress={handleQuick}
              className="flex-row items-center justify-end gap-3"
              activeOpacity={0.9}
            >
              <View
                className="px-4 py-2 rounded-xl"
                style={{ backgroundColor: colors.card }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                >
                  Quick Note
                </Text>
              </View>
              <View
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{
                  backgroundColor: colors.card,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Edit3 size={20} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Guided Reflection (Bottom) */}
          <Animated.View
            entering={FadeInDown.springify().damping(15)}
            exiting={FadeOutDown.duration(150)}
          >
            <TouchableOpacity
              onPress={handleGuided}
              className="flex-row items-center justify-end gap-3"
              activeOpacity={0.9}
            >
              <View
                className="px-4 py-2 rounded-xl"
                style={{ backgroundColor: colors.card }}
              >
                <Text
                  className="text-sm font-medium"
                  style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                >
                  Guided Reflection
                </Text>
              </View>
              <View
                className="w-12 h-12 rounded-full items-center justify-center"
                style={{
                  backgroundColor: colors.card,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }}
              >
                <Sparkles size={20} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* Main FAB */}
      <TouchableOpacity
        onPress={onToggle}
        className="w-14 h-14 rounded-full items-center justify-center"
        style={{
          backgroundColor: expanded ? colors.card : colors.primary, // Change color instead of rotating
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 6,
          // Removed rotation transform
        }}
        activeOpacity={0.9}
      >
        <Plus size={24} color={expanded ? colors.primary : colors['primary-foreground']} />
      </TouchableOpacity>
    </View>
  );
}

export default JournalHome;
