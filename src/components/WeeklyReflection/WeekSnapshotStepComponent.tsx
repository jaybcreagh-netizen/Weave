/**
 * WeekSnapshotStep
 * 
 * Screen 2 of the Sunday check-in flow.
 * Shows compact stats, one-line insight, and up to 3 friends needing attention.
 * Allows setting intentions inline without leaving the flow.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Sparkles, ChevronRight, Clock } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { ExtendedWeeklySummary, MissedFriend } from '@/modules/reflection/services/weekly-summary-extended.service';
import { InsightLine } from '@/modules/reflection/services/prompt-engine';
import { IntentionFormModal } from '@/components/IntentionFormModal';
import { ArchetypeIcon } from '@/components/ArchetypeIcon';
import { Archetype, InteractionCategory } from '@/components/types';
import { database } from '@/db';
import Intention from '@/db/models/Intention';
import IntentionFriend from '@/db/models/IntentionFriend';
import * as Haptics from 'expo-haptics';

// ============================================================================
// TYPES
// ============================================================================

interface AttentionFriend {
  friend: MissedFriend['friend'];
  attentionScore: number;
  daysSinceContact: number;
  tierLabel: string;
}

interface WeekSnapshotStepProps {
  summary: ExtendedWeeklySummary;
  insight: InsightLine;
  onComplete: () => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const TIER_MULTIPLIERS: Record<string, number> = {
  'InnerCircle': 2.0,
  'CloseFriends': 1.5,
  'Community': 1.0,
  'Outer': 0.8,
  'Dormant': 0.3,
};

const TIER_LABELS: Record<string, string> = {
  'InnerCircle': 'Inner Circle',
  'CloseFriends': 'Close Friends',
  'Community': 'Community',
  'Outer': 'Outer',
  'Dormant': 'Dormant',
};

function calculateAttentionScore(weaveScore: number, tier: string): number {
  const multiplier = TIER_MULTIPLIERS[tier] ?? 1.0;
  return (100 - weaveScore) * multiplier;
}

function getTopAttentionFriends(missedFriends: MissedFriend[], limit = 3): AttentionFriend[] {
  return missedFriends
    .map(mf => ({
      friend: mf.friend,
      attentionScore: calculateAttentionScore(mf.weaveScore, mf.friend.dunbarTier),
      daysSinceContact: mf.daysSinceLastContact,
      tierLabel: TIER_LABELS[mf.friend.dunbarTier] || mf.friend.dunbarTier,
    }))
    .sort((a, b) => b.attentionScore - a.attentionScore)
    .slice(0, limit);
}

function formatDaysSince(days: number): string {
  if (days >= 999) return 'No recent contact';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days < 7) return `${days} days`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return '1 week';
  if (weeks < 4) return `${weeks} weeks`;
  const months = Math.floor(days / 30);
  if (months === 1) return '1 month';
  return `${months} months`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function WeekSnapshotStep({ summary, insight, onComplete }: WeekSnapshotStepProps) {
  const { colors } = useTheme();
  const [intentionModalOpen, setIntentionModalOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<AttentionFriend['friend'] | null>(null);
  const [intentionSetFor, setIntentionSetFor] = useState<Set<string>>(new Set());

  // Get top 3 friends needing attention
  const attentionFriends = useMemo(() => {
    return getTopAttentionFriends(summary.missedFriends, 3);
  }, [summary.missedFriends]);

  const handleSetIntention = (friend: AttentionFriend['friend']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFriend(friend);
    setIntentionModalOpen(true);
  };

  const handleSaveIntention = async (description: string, category?: InteractionCategory) => {
    if (!selectedFriend) return;

    try {
      await database.write(async () => {
        // Create intention
        const intention = await database.get<Intention>('intentions').create(record => {
          record.description = description || undefined;
          record.interactionCategory = category || undefined;
          record.status = 'active';
        });

        // Create intention-friend link
        await database.get<IntentionFriend>('intention_friends').create(record => {
          record.intentionId = intention.id;
          record.friendId = selectedFriend.id;
        });
      });

      // Mark this friend as having an intention set
      setIntentionSetFor(prev => new Set(prev).add(selectedFriend.id));

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('[WeekSnapshotStep] Error saving intention:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const handleComplete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onComplete();
  };

  // Insight tone colors
  const insightColor = useMemo(() => {
    switch (insight.tone) {
      case 'celebration': return colors.primary;
      case 'gentle': return colors['muted-foreground'];
      default: return colors.foreground;
    }
  }, [insight.tone, colors]);

  return (
    <>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Stats Card */}
        <Animated.View
          entering={FadeIn.duration(400)}
          className="p-5 rounded-2xl mb-4"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            borderWidth: 1,
          }}
        >
          {/* Stats Row */}
          <View className="flex-row items-center justify-center mb-4">
            <View className="items-center px-4">
              <Text
                className="text-3xl font-bold"
                style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
              >
                {summary.totalWeaves}
              </Text>
              <Text
                className="text-xs mt-1"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                weaves
              </Text>
            </View>

            <View
              className="w-px h-10 mx-2"
              style={{ backgroundColor: colors.border }}
            />

            <View className="items-center px-4">
              <Text
                className="text-3xl font-bold"
                style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
              >
                {summary.friendsContacted}
              </Text>
              <Text
                className="text-xs mt-1"
                style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
              >
                friends
              </Text>
            </View>

            {summary.topActivity && (
              <>
                <View
                  className="w-px h-10 mx-2"
                  style={{ backgroundColor: colors.border }}
                />

                <View className="items-center px-4">
                  <Text
                    className="text-lg font-semibold"
                    style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                  >
                    {summary.topActivity}
                  </Text>
                  <Text
                    className="text-xs mt-1"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    {summary.topActivityCount}×
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Insight Line */}
          <View className="flex-row items-center justify-center">
            <Sparkles size={14} color={insightColor} style={{ marginRight: 6 }} />
            <Text
              className="text-sm text-center"
              style={{ color: insightColor, fontFamily: 'Inter_500Medium' }}
            >
              {insight.text}
            </Text>
          </View>
        </Animated.View>

        {/* Friends Needing Attention */}
        {attentionFriends.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text
              className="text-sm mb-3"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
            >
              Might appreciate a hello
            </Text>

            {attentionFriends.map((af, index) => {
              const hasIntention = intentionSetFor.has(af.friend.id);

              return (
                <Animated.View
                  key={af.friend.id}
                  entering={FadeInDown.delay(300 + index * 100).duration(300)}
                  className="mb-3 p-4 rounded-xl"
                  style={{
                    backgroundColor: colors.card,
                    borderColor: hasIntention ? colors.primary + '40' : colors.border,
                    borderWidth: 1,
                  }}
                >
                  <View className="flex-row items-center justify-between">
                    {/* Friend Info */}
                    <View className="flex-row items-center flex-1">
                      {/* Archetype Icon */}
                      <View
                        className="w-10 h-10 rounded-full items-center justify-center mr-3"
                        style={{ backgroundColor: colors.muted }}
                      >
                        <ArchetypeIcon
                          archetype={af.friend.archetype as Archetype}
                          size={20}
                          color={colors.foreground}
                        />
                      </View>

                      <View className="flex-1">
                        <Text
                          className="text-base font-semibold"
                          style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                        >
                          {af.friend.name}
                        </Text>
                        <View className="flex-row items-center gap-2 mt-0.5">
                          <Text
                            className="text-xs"
                            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                          >
                            {af.tierLabel}
                          </Text>
                          <View
                            className="w-1 h-1 rounded-full"
                            style={{ backgroundColor: colors['muted-foreground'] }}
                          />
                          <View className="flex-row items-center">
                            <Clock size={10} color={colors['muted-foreground']} style={{ marginRight: 3 }} />
                            <Text
                              className="text-xs"
                              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                            >
                              {formatDaysSince(af.daysSinceContact)}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>

                    {/* Action Button */}
                    {hasIntention ? (
                      <View
                        className="px-3 py-2 rounded-lg"
                        style={{ backgroundColor: colors.primary + '15' }}
                      >
                        <Text
                          className="text-xs font-medium"
                          style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                        >
                          💫 Intention set
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleSetIntention(af.friend)}
                        className="px-3 py-2 rounded-lg flex-row items-center"
                        style={{ backgroundColor: colors.muted }}
                        activeOpacity={0.7}
                      >
                        <Text
                          className="text-xs font-medium mr-1"
                          style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                        >
                          Set intention
                        </Text>
                        <Text style={{ fontSize: 12 }}>💫</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </Animated.View>
              );
            })}
          </Animated.View>
        )}

        {/* Empty state if no weaves */}
        {summary.totalWeaves === 0 && attentionFriends.length === 0 && (
          <Animated.View
            entering={FadeInDown.delay(200).duration(400)}
            className="items-center py-8"
          >
            <Text className="text-4xl mb-3">🌙</Text>
            <Text
              className="text-base text-center"
              style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
            >
              A quiet week. Rest is part of the rhythm.
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* Complete Button */}
      <Animated.View
        entering={FadeInDown.delay(500).duration(400)}
        className="pt-4 pb-2"
      >
        <TouchableOpacity
          onPress={handleComplete}
          className="py-4 rounded-2xl items-center flex-row justify-center"
          style={{ backgroundColor: colors.primary }}
          activeOpacity={0.8}
        >
          <Text
            className="text-base font-semibold mr-2"
            style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
          >
            Complete
          </Text>
          <ChevronRight size={18} color={colors['primary-foreground']} />
        </TouchableOpacity>
      </Animated.View>

      {/* Intention Form Modal */}
      {selectedFriend && (
        <IntentionFormModal
          isOpen={intentionModalOpen}
          friendName={selectedFriend.name}
          onClose={() => {
            setIntentionModalOpen(false);
            setSelectedFriend(null);
          }}
          onSave={handleSaveIntention}
        />
      )}
    </>
  );
}
