import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, useWindowDimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { Calendar, Heart, Sparkles, X, CloudSun, Star, Gem } from 'lucide-react-native';
import withObservables from '@nozbe/with-observables';

import { useTheme } from '@/shared/hooks/useTheme';
import { ArchetypeCard } from '@/modules/intelligence';
import { CategoryArchetypeMatrix } from '@/shared/constants/constants';
import { CATEGORY_METADATA } from '@/shared/constants/interaction-categories';
import { type InteractionCategory, Archetype } from '@/shared/types/legacy-types';
import FriendModel from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import FriendMemory from '@/db/models/FriendMemory';
import FriendMemoryCandidate from '@/db/models/FriendMemoryCandidate';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import { calculateCurrentScore } from '@/modules/intelligence';
import { getFriendMilestones, Milestone } from '@/modules/gamification';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { buildLifeEventPrefillFromMemory } from '@/modules/relationships/services/memory-life-event.service';

// Helper: Get top interaction suggestions for an archetype
function getTopInteractions(archetype: Archetype): Array<{ category: InteractionCategory; multiplier: number; level: 'peak' | 'high' | 'good' }> {
  if (archetype === 'Unknown') return [];

  const affinities = CategoryArchetypeMatrix[archetype];
  if (!affinities) return [];

  const suggestions = Object.entries(affinities)
    .map(([category, multiplier]) => ({
      category: category as InteractionCategory,
      multiplier,
      level: multiplier >= 1.8 ? 'peak' : multiplier >= 1.5 ? 'high' : 'good' as 'peak' | 'high' | 'good'
    }))
    .filter(item => item.multiplier >= 1.4) // Only show good+ affinities
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 5); // Top 5

  return suggestions;
}

function formatLabel(value: string): string {
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function getExpiryLabel(expiresAt?: number): string | null {
  if (typeof expiresAt !== 'number') return null;
  const daysRemaining = Math.ceil((expiresAt - Date.now()) / 86400000);
  if (daysRemaining < 0) return 'Expired';
  if (daysRemaining === 0) return 'Expires today';
  if (daysRemaining === 1) return 'Expires tomorrow';
  if (daysRemaining <= 14) return `Expires in ${daysRemaining}d`;
  return null;
}

function formatMonthDay(value?: string): string | null {
  if (!value || !value.includes('-')) return null;
  const [month, day] = value.split('-');
  const monthIndex = Number(month) - 1;
  const dayNumber = Number(day);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  if (monthIndex < 0 || monthIndex > 11 || Number.isNaN(dayNumber)) return null;
  return `${monthNames[monthIndex]} ${dayNumber}`;
}

interface FriendDetailSheetExternalProps {
  isVisible: boolean;
  onClose: () => void;
  friendId: string;
  memories?: FriendMemory[];
  memoryCandidates?: FriendMemoryCandidate[];
  onAddMemory?: () => void;
  onEditMemory?: (memory: FriendMemory) => void;
  onReviewMemorySuggestions?: () => void;
  onDismissAllMemorySuggestions?: () => void;
  onCreateLifeEventFromMemory?: (prefill: {
    eventType?: string;
    title?: string;
    notes?: string;
    eventDate?: string;
    source?: 'memory';
  }) => void;
}

interface FriendDetailSheetInjectedProps {
  friend: FriendModel; // Injected
  interactions: Interaction[]; // Injected
}

type FriendDetailSheetProps = FriendDetailSheetExternalProps & FriendDetailSheetInjectedProps;

const FriendDetailSheetContent: React.FC<FriendDetailSheetProps> = ({
  isVisible,
  onClose,
  friend,
  interactions,
  memories = [],
  memoryCandidates = [],
  onAddMemory,
  onEditMemory,
  onReviewMemorySuggestions,
  onDismissAllMemorySuggestions,
  onCreateLifeEventFromMemory,
}) => {
  const { colors, tokens } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  // const { activeFriendInteractions } = useRelationshipsStore(); // Removed
  const [shouldRender, setShouldRender] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);

  const sheetTranslateY = useSharedValue(600);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isVisible) {
      setShouldRender(true);
      sheetTranslateY.value = withSpring(0, {
        damping: 35,
        stiffness: 200,
      });
      backdropOpacity.value = withTiming(1, { duration: 300 });

      // Load milestones when sheet opens
      getFriendMilestones(friend.id).then(setMilestones);
    } else if (shouldRender) {
      // Animate out, then unmount
      sheetTranslateY.value = withTiming(600, { duration: 250 });
      backdropOpacity.value = withTiming(0, { duration: 250 }, (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [isVisible, shouldRender, friend.id]);

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetTranslateY.value }],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));
  const recentMemories = memories.slice(0, 3);
  const memoryLifeEventPrefills = useMemo(() => {
    return new Map(
      recentMemories.map(memory => [
        memory.id,
        buildLifeEventPrefillFromMemory({
          type: memory.type,
          title: memory.title,
          content: memory.content,
          effectiveDate: memory.effectiveDate,
        }),
      ])
    );
  }, [recentMemories]);

  if (!shouldRender) return null;

  const weaveScore = calculateCurrentScore(friend);

  // Use observed interactions directly to calculate stats
  // We can filter by status now that we have the full Interaction objects
  const completedWeaves = interactions.filter(i => i.status === 'completed').length;

  const topInteractions = getTopInteractions(friend.archetype);
  const birthdayLabel = formatMonthDay(friend.birthday) || 'Not set';
  const anniversaryLabel = formatMonthDay(friend.anniversary) || 'Not set';
  const detectedThemes = friend.detectedThemes.slice(0, 6);
  const preferredWeaveTypes = friend.preferredWeaveTypes.slice(0, 4);
  const topicHighlights = Object.entries(friend.topicClusters)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const hasJournalPatterns = detectedThemes.length > 0 || preferredWeaveTypes.length > 0 || topicHighlights.length > 0;

  // Color scheme for affinity levels
  const getAffinityColor = (level: 'peak' | 'high' | 'good') => {
    if (level === 'peak') return '#10b981'; // Green
    if (level === 'high') return '#3b82f6'; // Blue
    return '#8b5cf6'; // Purple
  };

  // Score Override Logic
  const handleScoreOverride = async (state: 'Healthy' | 'Stable' | 'Attention') => {
    try {
      let targetScore: number;
      switch (state) {
        case 'Healthy': targetScore = 85; break;
        case 'Stable': targetScore = 50; break;
        case 'Attention': targetScore = 20; break;
      }

      await database.write(async () => {
        await friend.update(f => {
          f.weaveScore = targetScore;
          // Optionally touch lastUpdated to ensure sync?
          // f.lastUpdated = new Date();
        });
      });
      // runOnJS(onClose)(); // Optional: close sheet on selection vs stay open to see update
    } catch (error) {
      console.error('Error overriding score:', error);
    }
  };

  const queueMemoryAction = (action?: () => void) => {
    if (!action) return;
    onClose();
    setTimeout(action, 220);
  };

  return (
    <Modal transparent visible={shouldRender} onRequestClose={onClose} animationType="none">
      {/* Backdrop */}
      <Animated.View style={animatedBackdropStyle} className="absolute inset-0">
        <View className="absolute inset-0 bg-black/50" />
        <TouchableOpacity
          className="absolute inset-0"
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        style={[
          animatedSheetStyle,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
        className="absolute bottom-0 left-0 right-0 rounded-t-3xl border-t px-6 pt-6 pb-10 shadow-2xl"
      >
        {/* Header */}
        <View className="mb-6 flex-row items-center justify-between">
          <Text
            style={{ color: colors.foreground }}
            className="font-lora-bold text-[22px] font-bold"
          >
            {friend.name}'s Details
          </Text>
          <TouchableOpacity onPress={onClose} className="p-2">
            <X size={24} color={colors['muted-foreground']} />
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={{ maxHeight: windowHeight * 0.72 }}
          contentContainerStyle={{ paddingBottom: 8 }}
        >
          {/* Archetype Card */}
          <View className="mb-6">
            <ArchetypeCard
              archetype={friend.archetype}
              isSelected={true}
            />
          </View>

          {/* Date + Stats */}
          <View className="mb-6 flex-row gap-3">
            <View className="flex-1 gap-2.5">
              <View
                style={{ backgroundColor: colors.muted, borderColor: colors.border }}
                className="h-[120px] items-center justify-center rounded-xl border px-3 py-3"
              >
                <View
                  style={{ backgroundColor: colors.card, borderColor: colors.border }}
                  className="mb-1 h-8 w-8 items-center justify-center rounded-full border"
                >
                  <Calendar size={16} color={colors.foreground} />
                </View>
                <View className="items-center">
                  <Text
                    style={{ color: colors['muted-foreground'] }}
                    className="font-inter-regular text-[11px] text-center"
                  >
                    Birthday
                  </Text>
                  <Text
                    style={{ color: colors.foreground }}
                    className="font-inter-semibold text-[18px] leading-[22px] text-center"
                  >
                    {birthdayLabel}
                  </Text>
                </View>
              </View>

              <View
                style={{ backgroundColor: colors.muted, borderColor: colors.border }}
                className="h-[120px] items-center justify-center rounded-xl border px-3 py-3"
              >
                <View
                  style={{ backgroundColor: colors.card, borderColor: colors.border }}
                  className="mb-1 h-8 w-8 items-center justify-center rounded-full border"
                >
                  <Heart size={16} color={colors.foreground} />
                </View>
                <View className="items-center">
                  <Text
                    style={{ color: colors['muted-foreground'] }}
                    className="font-inter-regular text-[11px] text-center"
                  >
                    Anniversary
                  </Text>
                  <Text
                    style={{ color: colors.foreground }}
                    className="font-inter-semibold text-[18px] leading-[22px] text-center"
                  >
                    {anniversaryLabel}
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-1 gap-2.5">
              <View
                style={{ backgroundColor: colors.muted, borderColor: colors.border }}
                className="h-[120px] items-center justify-center rounded-xl border px-3 py-3"
              >
                <Text
                  style={{ color: colors['muted-foreground'] }}
                  className="mb-1 font-inter-regular text-[11px] text-center"
                >
                  Weave Score
                </Text>
                <Text
                  style={{ color: colors.primary }}
                  className="font-inter-semibold text-[18px] leading-[22px] text-center"
                >
                  {Math.round(weaveScore)}
                </Text>
              </View>

              <View
                style={{ backgroundColor: colors.muted, borderColor: colors.border }}
                className="h-[120px] items-center justify-center rounded-xl border px-3 py-3"
              >
                <Text
                  style={{ color: colors['muted-foreground'] }}
                  className="mb-1 font-inter-regular text-[11px] text-center"
                >
                  Total Weaves
                </Text>
                <Text
                  style={{ color: colors.foreground }}
                  className="font-inter-semibold text-[18px] leading-[22px] text-center"
                >
                  {completedWeaves}
                </Text>
              </View>
            </View>
          </View>

          {/* Relationship Notes */}
          <View className="mb-6">
            <View className="mb-3 flex-row items-center justify-between">
              <Text
                style={{ color: colors['muted-foreground'] }}
                className="font-inter-medium text-xs uppercase tracking-wider"
              >
                Relationship Notes
              </Text>
              <TouchableOpacity
                onPress={() => queueMemoryAction(onAddMemory)}
                className="rounded-full px-3 py-1.5"
                style={{ backgroundColor: `${colors.primary}16` }}
              >
                <Text className="font-inter-semibold text-[11px]" style={{ color: colors.primary }}>
                  Add note
                </Text>
              </TouchableOpacity>
            </View>

            <View
              style={{ backgroundColor: colors.muted, borderColor: colors.border }}
              className="rounded-2xl border p-3"
            >
              {memoryCandidates.length > 0 && (
                <View
                  className="mb-3 rounded-xl px-3 py-2"
                  style={{ backgroundColor: `${colors.primary}12`, borderWidth: 1, borderColor: `${colors.primary}30` }}
                >
                  <Text className="font-inter-semibold text-xs" style={{ color: colors.primary }}>
                    {memoryCandidates.length} note suggestion{memoryCandidates.length > 1 ? 's' : ''} from your journal
                  </Text>
                  <View className="mt-2 flex-row gap-2">
                    <TouchableOpacity
                      onPress={() => queueMemoryAction(onReviewMemorySuggestions)}
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: `${colors.primary}20` }}
                    >
                      <Text className="font-inter-semibold text-[10px]" style={{ color: colors.primary }}>
                        Review
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => onDismissAllMemorySuggestions?.()}
                      className="rounded-full px-2.5 py-1"
                      style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
                    >
                      <Text className="font-inter-semibold text-[10px]" style={{ color: colors['muted-foreground'] }}>
                        Dismiss all
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {recentMemories.length === 0 ? (
                <Text className="font-inter-regular text-[12px]" style={{ color: colors['muted-foreground'] }}>
                  No notes yet. Add helpful details so Oracle can personalize plans and prompts.
                </Text>
              ) : (
                <View className="gap-2">
                  {recentMemories.map((memory) => (
                    <TouchableOpacity
                      key={memory.id}
                      onPress={() => queueMemoryAction(() => onEditMemory?.(memory))}
                      className="rounded-xl border p-3"
                      style={{ backgroundColor: colors.card, borderColor: colors.border }}
                    >
                      <Text className="font-inter-semibold text-[12px]" style={{ color: colors.foreground }} numberOfLines={1}>
                        {memory.title}
                      </Text>
                      <Text className="mt-1 font-inter-regular text-[11px]" style={{ color: colors['muted-foreground'] }} numberOfLines={2}>
                        {memory.content}
                      </Text>
                      {memoryLifeEventPrefills.get(memory.id) && (
                        <TouchableOpacity
                          onPress={(event) => {
                            event.stopPropagation();
                            const prefill = memoryLifeEventPrefills.get(memory.id);
                            if (!prefill) return;
                            queueMemoryAction(() => onCreateLifeEventFromMemory?.(prefill));
                          }}
                          className="mt-2 self-start rounded-full px-2.5 py-1"
                          style={{ backgroundColor: `${colors.primary}16` }}
                        >
                          <Text className="font-inter-semibold text-[10px]" style={{ color: colors.primary }}>
                            Add as life event
                          </Text>
                        </TouchableOpacity>
                      )}
                      {getExpiryLabel(memory.expiresAt) && (
                        <View
                          className="mt-2 self-start rounded-full px-2 py-0.5"
                          style={{ backgroundColor: `${colors.primary}14`, borderWidth: 1, borderColor: `${colors.primary}35` }}
                        >
                          <Text className="font-inter-medium text-[10px]" style={{ color: colors.primary }}>
                            {getExpiryLabel(memory.expiresAt)}
                          </Text>
                        </View>
                      )}
                      {memory.tags.length > 0 && (
                        <View className="mt-2 flex-row flex-wrap gap-1.5">
                          {memory.tags.slice(0, 3).map(tag => (
                            <View
                              key={`${memory.id}-${tag}`}
                              className="rounded-full px-2 py-0.5"
                              style={{ backgroundColor: `${colors.primary}12`, borderWidth: 1, borderColor: `${colors.primary}35` }}
                            >
                              <Text className="font-inter-medium text-[10px]" style={{ color: colors.primary }}>
                                #{tag}
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Journal Patterns */}
          {hasJournalPatterns && (
            <View className="mb-6">
              <Text
                style={{ color: colors['muted-foreground'] }}
                className="mb-3 font-inter-medium text-xs uppercase tracking-wider"
              >
                Journal Patterns
              </Text>
              <View
                style={{ backgroundColor: colors.muted, borderColor: colors.border }}
                className="rounded-2xl border p-3"
              >
                {detectedThemes.length > 0 && (
                  <View className="mb-3">
                    <Text className="mb-1 font-inter-medium text-[11px]" style={{ color: colors['muted-foreground'] }}>
                      Themes that keep showing up
                    </Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {detectedThemes.map((theme) => (
                        <View
                          key={`theme-${theme}`}
                          className="rounded-full px-2.5 py-1"
                          style={{ backgroundColor: `${colors.primary}15`, borderWidth: 1, borderColor: `${colors.primary}35` }}
                        >
                          <Text className="font-inter-medium text-[11px]" style={{ color: colors.primary }}>
                            {formatLabel(theme)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {preferredWeaveTypes.length > 0 && (
                  <View className="mb-3">
                    <Text className="mb-1 font-inter-medium text-[11px]" style={{ color: colors['muted-foreground'] }}>
                      Preferred weave types
                    </Text>
                    <View className="flex-row flex-wrap gap-1.5">
                      {preferredWeaveTypes.map((weaveType) => (
                        <View
                          key={`weave-${weaveType}`}
                          className="rounded-full px-2.5 py-1"
                          style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}
                        >
                          <Text className="font-inter-medium text-[11px]" style={{ color: colors.foreground }}>
                            {formatLabel(weaveType)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {topicHighlights.length > 0 && (
                  <View>
                    <Text className="mb-1 font-inter-medium text-[11px]" style={{ color: colors['muted-foreground'] }}>
                      Topics in recent entries
                    </Text>
                    <View className="gap-1">
                      {topicHighlights.map(([topic, mentions]) => (
                        <View key={`topic-${topic}`} className="flex-row items-center justify-between">
                          <Text className="font-inter-regular text-[12px]" style={{ color: colors.foreground }}>
                            {formatLabel(topic)}
                          </Text>
                          <Text className="font-inter-medium text-[11px]" style={{ color: colors['muted-foreground'] }}>
                            {mentions} mention{mentions === 1 ? '' : 's'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Relationship Status Override */}
          <View className="mb-6">
            <Text
              style={{ color: colors['muted-foreground'] }}
              className="mb-3 font-inter-medium text-xs uppercase tracking-wider"
            >
              Correction
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => handleScoreOverride('Healthy')}
                className="flex-1 items-center justify-center rounded-xl p-3 border"
                style={{
                  backgroundColor: weaveScore >= 65 ? `${tokens.success}15` : colors.card,
                  borderColor: weaveScore >= 65 ? tokens.success : colors.border,
                }}
              >
                <Heart size={20} color={weaveScore >= 65 ? tokens.success : colors['muted-foreground']} fill={weaveScore >= 65 ? tokens.success : 'transparent'} />
                <Text
                  className="mt-1 font-inter-medium text-xs"
                  style={{ color: weaveScore >= 65 ? tokens.success : colors['muted-foreground'] }}
                >
                  Healthy
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleScoreOverride('Stable')}
                className="flex-1 items-center justify-center rounded-xl p-3 border"
                style={{
                  backgroundColor: (weaveScore >= 35 && weaveScore < 65) ? `${tokens.warning}15` : colors.card,
                  borderColor: (weaveScore >= 35 && weaveScore < 65) ? tokens.warning : colors.border,
                }}
              >
                <View style={{ transform: [{ rotate: '-45deg' }] }}>
                  <Sparkles size={20} color={(weaveScore >= 35 && weaveScore < 65) ? tokens.warning : colors['muted-foreground']} />
                </View>
                <Text
                  className="mt-1 font-inter-medium text-xs"
                  style={{ color: (weaveScore >= 35 && weaveScore < 65) ? tokens.warning : colors['muted-foreground'] }}
                >
                  Stable
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleScoreOverride('Attention')}
                className="flex-1 items-center justify-center rounded-xl p-3 border"
                style={{
                  backgroundColor: weaveScore < 35 ? `${tokens.destructive}15` : colors.card,
                  borderColor: weaveScore < 35 ? tokens.destructive : colors.border,
                }}
              >
                <View className="items-center justify-center" style={{ width: 20, height: 20 }}>
                  <CloudSun size={20} color={weaveScore < 35 ? tokens.destructive : colors['muted-foreground']} />
                </View>
                <Text
                  className="mt-1 font-inter-medium text-xs"
                  style={{ color: weaveScore < 35 ? tokens.destructive : colors['muted-foreground'] }}
                >
                  Drifting
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Perfect Connections */}
          {topInteractions.length > 0 && (
            <View className="mb-6">
              <View
                style={{ backgroundColor: colors.muted, borderColor: colors.border }}
                className="rounded-2xl border p-4"
              >
                <View className="mb-3 flex-row items-center gap-2">
                  <Sparkles size={14} color={colors.primary} />
                  <Text
                    className="font-inter-semibold text-[14px]"
                    style={{ color: colors.foreground }}
                  >
                    Perfect Connections
                  </Text>
                </View>

                <View className="flex-row flex-wrap gap-2">
                  {topInteractions.map(({ category, level }) => {
                    const metadata = CATEGORY_METADATA[category];
                    const affinityColor = getAffinityColor(level);

                    return (
                      <View
                        key={category}
                        className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1.5"
                        style={{
                          backgroundColor: `${affinityColor}15`,
                          borderWidth: 1,
                          borderColor: `${affinityColor}40`,
                        }}
                      >
                        <metadata.iconComponent size={14} color={affinityColor} />
                        <Text
                          className="font-inter-semibold text-[12px] font-semibold"
                          style={{ color: affinityColor }}
                        >
                          {metadata.label}
                        </Text>
                        {level === 'peak' ? (
                          <Star size={10} color={affinityColor} fill={affinityColor} />
                        ) : level === 'high' ? (
                          <Sparkles size={10} color={affinityColor} />
                        ) : (
                          <Gem size={10} color={affinityColor} />
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          )}

          {/* Milestones */}
          {milestones.length > 0 && (
            <View className="mb-6">
              <Text
                style={{ color: colors['muted-foreground'] }}
                className="mb-3 font-inter-medium text-xs uppercase tracking-wider"
              >
                Milestones
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {milestones.map((milestone) => (
                  <View
                    key={milestone.id}
                    style={{
                      backgroundColor: `${colors.primary}15`,
                      borderColor: `${colors.primary}30`,
                    }}
                    className="flex-row items-center gap-1.5 rounded-full border px-3 py-2"
                  >
                    <milestone.iconComponent size={16} color={colors.primary} />
                    <Text
                      style={{ color: colors.primary }}
                      className="font-inter-semibold text-xs font-semibold"
                    >
                      {milestone.name}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

        </ScrollView>
      </Animated.View>
    </Modal >
  );
};

// Enhance with observables
export const FriendDetailSheet = withObservables(['friendId'], ({ friendId }: FriendDetailSheetExternalProps) => ({
  friend: database.get<FriendModel>('friends').findAndObserve(friendId),
  interactions: database
    .get('interaction_friends')
    .query(Q.where('friend_id', friendId))
    .observe()
    .pipe(
      switchMap(interactionFriends => {
        // @ts-ignore - typing issue with complex watermelon queries
        const interactionIds = interactionFriends.map(join => join.interactionId);

        if (interactionIds.length === 0) {
          return of([]);
        }

        return database
          .get<Interaction>('interactions')
          .query(Q.where('id', Q.oneOf(interactionIds)))
          .observe();
      })
    ),
}))(FriendDetailSheetContent);
