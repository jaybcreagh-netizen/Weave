/**
 * WeekSnapshotStep
 * 
 * Screen 2 of the Sunday check-in flow.
 * Shows compact stats, one-line insight, and up to 3 friends needing attention.
 * Allows setting intentions inline without leaving the flow.
 */

import React, { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Sparkles, ChevronRight, Clock } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { ExtendedWeeklySummary, MissedFriend, InsightLine } from '@/modules/reflection';
import { IntentionFormModal } from '@/modules/reflection';
import { ArchetypeIcon } from '@/modules/intelligence';
import { Archetype, InteractionCategory } from '@/shared/types/legacy-types';
import { database } from '@/db';
import Intention from '@/db/models/Intention';
import IntentionFriend from '@/db/models/IntentionFriend';
import * as Haptics from 'expo-haptics';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';

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

  const handleSaveIntention = async (description: string | undefined, category?: InteractionCategory) => {
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
          className="mb-4"
        >
          <Card className="p-5">
            {/* Stats Row */}
            <View className="flex-row items-center justify-center mb-4">
              <View className="items-center px-4">
                <Text variant="h2" className="font-lora-bold">
                  {summary.totalWeaves}
                </Text>
                <Text variant="caption" className="text-muted-foreground mt-1">
                  weaves
                </Text>
              </View>

              <View
                className="w-px h-10 mx-2 bg-border"
              />

              <View className="items-center px-4">
                <Text variant="h2" className="font-lora-bold">
                  {summary.friendsContacted}
                </Text>
                <Text variant="caption" className="text-muted-foreground mt-1">
                  friends
                </Text>
              </View>

              {summary.topActivity && (
                <>
                  <View
                    className="w-px h-10 mx-2 bg-border"
                  />

                  <View className="items-center px-4">
                    <Text variant="h3" className="font-inter-semibold">
                      {summary.topActivity}
                    </Text>
                    <Text variant="caption" className="text-muted-foreground mt-1">
                      {summary.topActivityCount}×
                    </Text>
                  </View>
                </>
              )}
            </View>

            {/* Insight Line */}
            <View className="flex-row items-center justify-center">
              <Sparkles size={14} color={insightColor} className="mr-1.5" />
              <Text
                variant="body"
                className="text-center font-medium"
                style={{ color: insightColor }}
              >
                {insight.text}
              </Text>
            </View>
          </Card>
        </Animated.View>

        {/* Friends Needing Attention */}
        {attentionFriends.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Text variant="body" className="font-medium mb-3 text-muted-foreground">
              Might appreciate a hello
            </Text>

            {attentionFriends.map((af, index) => {
              const hasIntention = intentionSetFor.has(af.friend.id);

              return (
                <Animated.View
                  key={af.friend.id}
                  entering={FadeInDown.delay(300 + index * 100).duration(300)}
                  className="mb-3"
                >
                  <Card
                    className={`p-4 border ${hasIntention ? 'border-primary/40' : 'border-border'}`}
                  >
                    <View className="flex-row items-center justify-between">
                      {/* Friend Info */}
                      <View className="flex-row items-center flex-1">
                        {/* Archetype Icon */}
                        <View
                          className="w-10 h-10 rounded-full items-center justify-center mr-3 bg-muted"
                        >
                          <ArchetypeIcon
                            archetype={af.friend.archetype as Archetype}
                            size={20}
                            color={colors.foreground}
                          />
                        </View>

                        <View className="flex-1">
                          <Text variant="h4" className="font-semibold">
                            {af.friend.name}
                          </Text>
                          <View className="flex-row items-center gap-2 mt-0.5">
                            <Text variant="caption" className="text-muted-foreground">
                              {af.tierLabel}
                            </Text>
                            <View
                              className="w-1 h-1 rounded-full bg-muted-foreground"
                            />
                            <View className="flex-row items-center">
                              <Clock size={10} color={colors['muted-foreground']} className="mr-[3px]" />
                              <Text variant="caption" className="text-muted-foreground">
                                {formatDaysSince(af.daysSinceContact)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>

                      {/* Action Button */}
                      {hasIntention ? (
                        <View
                          className="px-3 py-2 rounded-lg bg-primary/15"
                        >
                          <Text variant="caption" className="font-medium text-primary">
                            💫 Intention set
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleSetIntention(af.friend)}
                          className="px-3 py-2 rounded-lg flex-row items-center bg-muted"
                          activeOpacity={0.7}
                        >
                          <Text variant="caption" className="font-medium mr-1 text-foreground">
                            Set intention
                          </Text>
                          <Text className="text-xs">💫</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </Card>
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
            <Text variant="body" className="text-center text-muted-foreground">
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
        <Button
          onPress={handleComplete}
          variant="primary"
          className="flex-row justify-center items-center"
        >
          <View className="flex-row items-center">
            <Text variant="button" className="mr-2 text-primary-foreground">
              Complete
            </Text>
            <ChevronRight size={18} color={colors['primary-foreground']} />
          </View>
        </Button>
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
