/**
 * ReflectionJourneyContent
 * Embeddable journal content for use within Year in Moons modal
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, TextInput } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Calendar, Sparkles, Search, Plus, BookOpen } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { database } from '@/db';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import JournalEntry from '@/db/models/JournalEntry';
import { Q } from '@nozbe/watermelondb';
import { format } from 'date-fns';
import { STORY_CHIPS } from '@/modules/reflection';
import { ReflectionDetailModal } from './ReflectionDetailModal';
import { JournalEntryModal } from '../Journal/JournalEntryModal';
import * as Haptics from 'expo-haptics';

type JournalItem =
  | { type: 'weekly_reflection'; data: WeeklyReflection; date: number }
  | { type: 'journal_entry'; data: JournalEntry; date: number };

export function ReflectionJourneyContent() {
  const { colors, isDarkMode } = useTheme();
  const [reflections, setReflections] = useState<WeeklyReflection[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReflection, setSelectedReflection] = useState<WeeklyReflection | null>(null);
  const [selectedJournalEntry, setSelectedJournalEntry] = useState<JournalEntry | null>(null);
  const [isJournalEntryModalOpen, setIsJournalEntryModalOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const allReflections = await database
        .get<WeeklyReflection>('weekly_reflections')
        .query(Q.sortBy('week_end_date', Q.desc))
        .fetch();

      const allJournalEntries = await database
        .get<JournalEntry>('journal_entries')
        .query(Q.sortBy('entry_date', Q.desc))
        .fetch();

      setReflections(allReflections);
      setJournalEntries(allJournalEntries);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStreak = (items: WeeklyReflection[]): number => {
    // Simplified streak calculation
    return items.length > 0 ? Math.min(items.length, 7) : 0;
  };

  const allItems: JournalItem[] = [
    ...reflections.map((r) => ({ type: 'weekly_reflection' as const, data: r, date: r.weekEndDate })),
    ...journalEntries.map((j) => ({ type: 'journal_entry' as const, data: j, date: j.entryDate })),
  ].sort((a, b) => b.date - a.date);

  const filteredItems = searchQuery
    ? allItems.filter((item) => {
        if (item.type === 'weekly_reflection') {
          const chips = item.data.storyChips || [];
          return chips.some(chip =>
            chip.toLowerCase().includes(searchQuery.toLowerCase())
          );
        } else {
          return (
            item.data.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.data.content?.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
      })
    : allItems;

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center px-8 py-10">
        <ActivityIndicator size="large" color={isDarkMode ? '#F5F1E8' : '#6366F1'} />
        <Text
          className="text-sm mt-4 text-center"
          style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
        >
          Loading your journal...
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        className="flex-1 px-5 py-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Header Stats */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFFFFF' }}>
            <Text
              className="text-2xl font-bold mb-0.5"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
            >
              {allItems.length}
            </Text>
            <Text
              className="text-[10px]"
              style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
            >
              Total Entries
            </Text>
          </View>

          <View className="flex-1 p-3 rounded-xl" style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFFFFF' }}>
            <Text
              className="text-2xl font-bold mb-0.5"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Lora_700Bold' }}
            >
              {calculateStreak(reflections)}
            </Text>
            <Text
              className="text-[10px]"
              style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
            >
              Week Streak
            </Text>
          </View>
        </View>

        {/* Search */}
        <View className="mb-4">
          <View
            className="flex-row items-center px-4 py-3 rounded-xl gap-2"
            style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFFFFF' }}
          >
            <Search size={18} color={isDarkMode ? '#8A8F9E' : '#6C7589'} />
            <TextInput
              className="flex-1 font-inter text-sm"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142' }}
              placeholder="Search entries..."
              placeholderTextColor={isDarkMode ? '#5A5F6E' : '#9CA3AF'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* New Entry Button */}
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setIsJournalEntryModalOpen(true);
          }}
          className="mb-4 p-4 rounded-xl flex-row items-center justify-center gap-2"
          style={{ backgroundColor: isDarkMode ? '#7C3AED' : '#8B5CF6' }}
          activeOpacity={0.8}
        >
          <Plus size={20} color="#FFFFFF" />
          <Text
            className="text-base font-semibold"
            style={{ color: '#FFFFFF', fontFamily: 'Inter_600SemiBold' }}
          >
            New Journal Entry
          </Text>
        </TouchableOpacity>

        {/* Entries List */}
        {filteredItems.length === 0 ? (
          <View className="items-center justify-center py-12">
            <Text className="text-5xl mb-3">📖</Text>
            <Text
              className="text-base font-semibold mb-2"
              style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Inter_600SemiBold' }}
            >
              {searchQuery ? 'No entries found' : 'No journal entries yet'}
            </Text>
            <Text
              className="text-sm text-center"
              style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
            >
              {searchQuery ? 'Try a different search term' : 'Start journaling to track your reflections'}
            </Text>
          </View>
        ) : (
          filteredItems.map((item, index) => (
            <Animated.View
              key={`${item.type}-${item.data.id}`}
              entering={FadeIn.delay(index * 50)}
            >
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  if (item.type === 'weekly_reflection') {
                    setSelectedReflection(item.data);
                  } else {
                    setSelectedJournalEntry(item.data);
                  }
                }}
                className="mb-3 p-4 rounded-xl"
                style={{ backgroundColor: isDarkMode ? '#2A2E3F' : '#FFFFFF' }}
                activeOpacity={0.7}
              >
                <View className="flex-row items-start justify-between mb-2">
                  <View className="flex-1">
                    <Text
                      className="text-base font-semibold mb-1"
                      style={{ color: isDarkMode ? '#F5F1E8' : '#2D3142', fontFamily: 'Inter_600SemiBold' }}
                    >
                      {item.type === 'journal_entry'
                        ? item.data.title || 'Journal Entry'
                        : `Week of ${format(item.date, 'MMM d')}`}
                    </Text>
                    <Text
                      className="text-xs"
                      style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
                    >
                      {format(item.date, 'MMMM d, yyyy')}
                    </Text>
                  </View>
                  {item.type === 'weekly_reflection' ? (
                    <Calendar size={18} color={isDarkMode ? '#A78BFA' : '#8B5CF6'} />
                  ) : (
                    <BookOpen size={18} color={isDarkMode ? '#F5C563' : '#F59E0B'} />
                  )}
                </View>

                {item.type === 'weekly_reflection' && item.data.storyChips && item.data.storyChips.length > 0 && (
                  <View className="flex-row flex-wrap gap-1.5 mt-2">
                    {item.data.storyChips.slice(0, 3).map((chipKey, i) => {
                      const chip = STORY_CHIPS.find(c => c.key === chipKey);
                      if (!chip) return null;
                      return (
                        <View
                          key={i}
                          className="px-2 py-1 rounded-md"
                          style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#F8F9FA' }}
                        >
                          <Text className="text-xs" style={{ fontFamily: 'Inter_400Regular' }}>
                            {chip.emoji} {chip.label}
                          </Text>
                        </View>
                      );
                    })}
                    {item.data.storyChips.length > 3 && (
                      <View
                        className="px-2 py-1 rounded-md"
                        style={{ backgroundColor: isDarkMode ? '#1a1d2e' : '#F8F9FA' }}
                      >
                        <Text
                          className="text-xs"
                          style={{ color: isDarkMode ? '#8A8F9E' : '#6C7589', fontFamily: 'Inter_400Regular' }}
                        >
                          +{item.data.storyChips.length - 3}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {item.type === 'journal_entry' && item.data.content && (
                  <Text
                    className="text-sm mt-2"
                    style={{ color: isDarkMode ? '#C5CAD3' : '#6C7589', fontFamily: 'Inter_400Regular' }}
                    numberOfLines={2}
                  >
                    {item.data.content}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          ))
        )}

        <View className="h-8" />
      </ScrollView>

      {/* Reflection Detail Modal */}
      {selectedReflection && (
        <ReflectionDetailModal
          isOpen={!!selectedReflection}
          onClose={() => setSelectedReflection(null)}
          reflection={selectedReflection}
        />
      )}

      {/* Journal Entry Detail Modal */}
      {selectedJournalEntry && (
        <JournalEntryModal
          isOpen={!!selectedJournalEntry}
          onClose={() => setSelectedJournalEntry(null)}
          entry={selectedJournalEntry}
          onSave={async () => {
            await loadData();
            setSelectedJournalEntry(null);
          }}
        />
      )}

      {/* New Journal Entry Modal */}
      <JournalEntryModal
        isOpen={isJournalEntryModalOpen}
        onClose={() => setIsJournalEntryModalOpen(false)}
        onSave={async () => {
          await loadData();
          setIsJournalEntryModalOpen(false);
        }}
      />
    </>
  );
}
