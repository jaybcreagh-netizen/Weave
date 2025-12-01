/**
 * FriendshipArcView
 * 
 * Shows the complete story of a friendship through journal entries.
 * Timeline view organized by year/month, showing entries and milestones.
 * 
 * Used in:
 * - Journal "By Friend" tab
 * - Friend profile "Journal entries" section
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInLeft,
} from 'react-native-reanimated';
import {
  ChevronLeft,
  BookOpen,
  Clock,
  Activity,
  Heart,
  Sparkles,
  PenLine,
} from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import {
  getFriendshipArc,
  FriendshipArc,
  FriendshipArcEntry,
} from '@/modules/journal/services/journal-context-engine';
import * as Haptics from 'expo-haptics';

// ============================================================================
// TYPES
// ============================================================================

interface FriendshipArcViewProps {
  friendId: string;
  onBack: () => void;
  onEntryPress: (entryId: string, type: 'journal' | 'reflection') => void;
  onWriteAbout: (friendId: string, friendName: string) => void;
}

interface GroupedEntries {
  year: number;
  months: {
    month: number;
    monthName: string;
    entries: FriendshipArcEntry[];
  }[];
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FriendshipArcView({
  friendId,
  onBack,
  onEntryPress,
  onWriteAbout,
}: FriendshipArcViewProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [arc, setArc] = useState<FriendshipArc | null>(null);
  const [groupedEntries, setGroupedEntries] = useState<GroupedEntries[]>([]);

  // Load friendship arc
  useEffect(() => {
    loadArc();
  }, [friendId]);

  const loadArc = async () => {
    setLoading(true);
    try {
      const friendshipArc = await getFriendshipArc(friendId);
      setArc(friendshipArc);

      if (friendshipArc) {
        const grouped = groupEntriesByDate(friendshipArc.timeline);
        setGroupedEntries(grouped);
      }
    } catch (error) {
      console.error('[FriendshipArcView] Error loading arc:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupEntriesByDate = (entries: FriendshipArcEntry[]): GroupedEntries[] => {
    const yearMap = new Map<number, Map<number, FriendshipArcEntry[]>>();

    for (const entry of entries) {
      const date = new Date(entry.date);
      const year = date.getFullYear();
      const month = date.getMonth();

      if (!yearMap.has(year)) {
        yearMap.set(year, new Map());
      }
      const monthMap = yearMap.get(year)!;

      if (!monthMap.has(month)) {
        monthMap.set(month, []);
      }
      monthMap.get(month)!.push(entry);
    }

    // Convert to array format, sorted by year desc, month desc
    const result: GroupedEntries[] = [];
    const sortedYears = Array.from(yearMap.keys()).sort((a, b) => b - a);

    for (const year of sortedYears) {
      const monthMap = yearMap.get(year)!;
      const sortedMonths = Array.from(monthMap.keys()).sort((a, b) => b - a);

      const months = sortedMonths.map((month) => ({
        month,
        monthName: new Date(year, month).toLocaleDateString('en-GB', { month: 'long' }),
        entries: monthMap.get(month)!,
      }));

      result.push({ year, months });
    }

    return result;
  };

  const handleEntryPress = useCallback((entry: FriendshipArcEntry) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onEntryPress(entry.id, entry.type === 'milestone' ? 'journal' : entry.type);
  }, [onEntryPress]);

  const handleWriteAbout = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (arc) {
      onWriteAbout(arc.friend.id, arc.friend.name);
    }
  }, [arc, onWriteAbout]);

  // ============================================================================
  // RENDER HELPERS
  // ============================================================================

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
  };

  const getEntryIcon = (type: FriendshipArcEntry['type']) => {
    switch (type) {
      case 'journal':
        return BookOpen;
      case 'reflection':
        return Clock;
      case 'milestone':
        return Sparkles;
      default:
        return BookOpen;
    }
  };

  const renderStatCard = (
    label: string,
    value: string | number,
    icon: React.ReactNode
  ) => (
    <View
      className="flex-1 p-3 rounded-xl items-center"
      style={{ backgroundColor: colors.muted }}
    >
      {icon}
      <Text
        className="text-lg mt-1"
        style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
      >
        {value}
      </Text>
      <Text
        className="text-xs"
        style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
      >
        {label}
      </Text>
    </View>
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!arc) {
    return (
      <View className="flex-1 items-center justify-center px-8" style={{ backgroundColor: colors.background }}>
        <Text
          className="text-base text-center"
          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
        >
          Couldn't load friendship data
        </Text>
        <TouchableOpacity onPress={onBack} className="mt-4">
          <Text
            className="text-base"
            style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
          >
            Go back
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: colors.background }}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Card */}
        <Animated.View
          entering={FadeIn.duration(400)}
          className="px-5 pb-6"
          style={{ paddingTop: insets.top + 16 }}
        >
          {/* Back Button */}
          <TouchableOpacity
            onPress={onBack}
            className="flex-row items-center gap-1 mb-4"
          >
            <ChevronLeft size={20} color={colors.primary} />
            <Text
              className="text-base"
              style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
            >
              Back
            </Text>
          </TouchableOpacity>

          {/* Friend Header */}
          <View
            className="p-5 rounded-2xl"
            style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
          >
            <View className="flex-row items-center gap-4 mb-4">
              {/* Avatar */}
              <View
                className="w-16 h-16 rounded-full items-center justify-center"
                style={{ backgroundColor: colors.primary + '20' }}
              >
                <Text
                  className="text-2xl"
                  style={{ color: colors.primary, fontFamily: 'Inter_700Bold' }}
                >
                  {arc.friend.name.charAt(0).toUpperCase()}
                </Text>
              </View>

              {/* Name & Duration */}
              <View className="flex-1">
                <Text
                  className="text-xl"
                  style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
                >
                  {arc.friend.name}
                </Text>
                <Text
                  className="text-sm"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  {arc.friend.dunbarTier} · {arc.friendshipDuration}
                </Text>
              </View>
            </View>

            {/* Stats Row */}
            <View className="flex-row gap-3 mb-4">
              {renderStatCard(
                'weaves',
                arc.totalWeaves,
                <Activity size={18} color={colors.primary} />
              )}
              {renderStatCard(
                'entries',
                arc.totalEntries,
                <BookOpen size={18} color={colors.primary} />
              )}
              {renderStatCard(
                'themes',
                arc.commonThemes.length,
                <Heart size={18} color={colors.primary} />
              )}
            </View>

            {/* Themes */}
            {arc.commonThemes.length > 0 && (
              <View className="mb-4">
                <Text
                  className="text-xs mb-2"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                >
                  Common themes
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {arc.commonThemes.map((theme, i) => (
                    <View
                      key={i}
                      className="px-3 py-1.5 rounded-full"
                      style={{ backgroundColor: colors.primary + '15' }}
                    >
                      <Text
                        className="text-sm"
                        style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                      >
                        {theme}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Write Button */}
            <TouchableOpacity
              onPress={handleWriteAbout}
              className="flex-row items-center justify-center gap-2 py-3 rounded-xl"
              style={{ backgroundColor: colors.primary }}
              activeOpacity={0.8}
            >
              <PenLine size={18} color={colors['primary-foreground']} />
              <Text
                className="text-base"
                style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
              >
                Write about {arc.friend.name}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Timeline */}
        <View className="px-5 pb-8">
          <Text
            className="text-base mb-4"
            style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
          >
            Your Story Together
          </Text>

          {groupedEntries.length === 0 ? (
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <View
                className="p-6 rounded-2xl items-center"
                style={{ backgroundColor: colors.muted }}
              >
                <BookOpen size={32} color={colors['muted-foreground']} />
                <Text
                  className="text-base mt-3 text-center"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
                >
                  No journal entries yet
                </Text>
                <Text
                  className="text-sm mt-1 text-center"
                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                  Start documenting your friendship story
                </Text>
              </View>
            </Animated.View>
          ) : (
            groupedEntries.map((yearGroup, yearIndex) => (
              <Animated.View
                key={yearGroup.year}
                entering={FadeInDown.delay(200 + yearIndex * 100).duration(400)}
              >
                {/* Year Header */}
                <View className="flex-row items-center gap-3 mb-4 mt-6">
                  <View className="h-px flex-1" style={{ backgroundColor: colors.border }} />
                  <Text
                    className="text-sm"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
                  >
                    {yearGroup.year}
                  </Text>
                  <View className="h-px flex-1" style={{ backgroundColor: colors.border }} />
                </View>

                {yearGroup.months.map((monthGroup, monthIndex) => (
                  <View key={`${yearGroup.year}-${monthGroup.month}`}>
                    {/* Month entries */}
                    {monthGroup.entries.map((entry, entryIndex) => {
                      const IconComponent = getEntryIcon(entry.type);
                      const isFirst = entryIndex === 0 && monthIndex === 0 && yearIndex === 0;
                      const isLast =
                        yearIndex === groupedEntries.length - 1 &&
                        monthIndex === yearGroup.months.length - 1 &&
                        entryIndex === monthGroup.entries.length - 1;

                      return (
                        <Animated.View
                          key={entry.id}
                          entering={FadeInLeft.delay(300 + entryIndex * 50).duration(300)}
                        >
                          <View className="flex-row">
                            {/* Timeline Line */}
                            <View className="items-center mr-4" style={{ width: 40 }}>
                              {/* Month label (only on first entry of month) */}
                              {entryIndex === 0 && (
                                <Text
                                  className="text-xs mb-2"
                                  style={{
                                    color: colors['muted-foreground'],
                                    fontFamily: 'Inter_500Medium',
                                  }}
                                >
                                  {monthGroup.monthName.slice(0, 3)}
                                </Text>
                              )}

                              {/* Dot */}
                              <View
                                className="w-3 h-3 rounded-full z-10"
                                style={{
                                  backgroundColor: isLast ? colors.primary : colors.border,
                                  borderWidth: isLast ? 0 : 2,
                                  borderColor: isLast ? undefined : colors.background,
                                }}
                              />

                              {/* Vertical line */}
                              {!isFirst && (
                                <View
                                  className="absolute top-0 w-0.5"
                                  style={{
                                    backgroundColor: colors.border,
                                    height: entryIndex === 0 ? 24 : 0,
                                    top: entryIndex === 0 ? 0 : -16,
                                  }}
                                />
                              )}
                              {entryIndex < monthGroup.entries.length - 1 && (
                                <View
                                  className="w-0.5 flex-1 mt-1"
                                  style={{ backgroundColor: colors.border }}
                                />
                              )}
                            </View>

                            {/* Entry Card */}
                            <TouchableOpacity
                              onPress={() => handleEntryPress(entry)}
                              className="flex-1 mb-4 p-4 rounded-xl"
                              style={{
                                backgroundColor: colors.card,
                                borderWidth: 1,
                                borderColor: colors.border,
                              }}
                              activeOpacity={0.7}
                            >
                              {/* Entry Type Badge */}
                              <View className="flex-row items-center gap-2 mb-2">
                                <IconComponent size={14} color={colors.primary} />
                                <Text
                                  className="text-xs"
                                  style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                                >
                                  {entry.type === 'journal' && 'Journal Entry'}
                                  {entry.type === 'reflection' && 'Weekly Reflection'}
                                  {entry.type === 'milestone' && 'Milestone'}
                                </Text>
                                <View className="flex-1" />
                                <Text
                                  className="text-xs"
                                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                                >
                                  {formatDate(entry.date)}
                                </Text>
                              </View>

                              {/* Title */}
                              <Text
                                className="text-base mb-1"
                                style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                              >
                                {entry.title}
                              </Text>

                              {/* Preview */}
                              {entry.preview && (
                                <Text
                                  className="text-sm"
                                  style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                                  numberOfLines={2}
                                >
                                  {entry.preview}...
                                </Text>
                              )}

                              {/* Weave count for reflections */}
                              {entry.type === 'reflection' && entry.weaveCount !== undefined && (
                                <View className="flex-row items-center gap-1 mt-2">
                                  <Activity size={12} color={colors['muted-foreground']} />
                                  <Text
                                    className="text-xs"
                                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                                  >
                                    {entry.weaveCount} weaves that week
                                  </Text>
                                </View>
                              )}
                            </TouchableOpacity>
                          </View>
                        </Animated.View>
                      );
                    })}
                  </View>
                ))}

                {/* First Entry Marker (at end of timeline, earliest entry) */}
                {yearIndex === groupedEntries.length - 1 && arc.firstEntryDate && (
                  <View className="flex-row items-center mt-2 ml-5">
                    <Sparkles size={16} color={colors.primary} />
                    <Text
                      className="text-sm ml-2"
                      style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                    >
                      First entry about {arc.friend.name}
                    </Text>
                  </View>
                )}
              </Animated.View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

export default FriendshipArcView;
