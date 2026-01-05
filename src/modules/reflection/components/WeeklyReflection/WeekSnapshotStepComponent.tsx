/**
 * WeekSnapshotStep
 * 
 * Screen 2 of the Sunday check-in flow.
 * Shows compact stats, one-line insight, and up to 3 friends needing attention.
 * Allows setting intentions inline without leaving the flow.
 */

import React, { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Sparkles, ChevronRight, Clock } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { ExtendedWeeklySummary } from '../../services/weekly-summary-extended.service';
import { MissedFriend } from '../../services/weekly-stats.service';
import { InsightLine } from '../../services/prompt-engine';
import { IntentionFormModal } from '../IntentionFormModal';
import { ArchetypeIcon } from '@/modules/intelligence/components/archetypes/ArchetypeIcon';
import { Archetype, InteractionCategory } from '@/shared/types/legacy-types';
import { database } from '@/db';
import Intention from '@/db/models/Intention';
import IntentionFriend from '@/db/models/IntentionFriend';
import * as Haptics from 'expo-haptics';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { StatsDetailSheet, StatType } from './StatsDetailSheet';

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
  const insets = useSafeAreaInsets();
  const [intentionModalOpen, setIntentionModalOpen] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<AttentionFriend['friend'] | null>(null);
  const [intentionSetFor, setIntentionSetFor] = useState<Set<string>>(new Set());
  const [statsSheetOpen, setStatsSheetOpen] = useState(false);
  const [statsSheetType, setStatsSheetType] = useState<StatType>('weaves');

  // Get top 3 friends needing attention
  const attentionFriends = useMemo(() => {
    return getTopAttentionFriends(summary.missedFriends, 3);
  }, [summary.missedFriends]);

  const handleSetIntention = (friend: AttentionFriend['friend']) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFriend(friend);
    setIntentionModalOpen(true);
  };

  const handleStatPress = (type: StatType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStatsSheetType(type);
    setStatsSheetOpen(true);
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
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24), flexGrow: 1 }}
      >
        {/* Stats Card */}
        <Animated.View
          entering={FadeIn.duration(400)}
          className="mb-4"
        >
          <Card className="p-4">
            {/* Stats Row */}
            <View className="flex-row items-center justify-around mb-3">
              <TouchableOpacity
                onPress={() => handleStatPress('weaves')}
                activeOpacity={0.7}
                className="items-center px-4 py-2"
              >
                <Text variant="h1" className="font-lora-bold text-3xl">
                  {summary.totalWeaves}
                </Text>
                <Text variant="caption" className="text-muted-foreground mt-1 uppercase tracking-wide text-xs">
                  weaves
                </Text>
              </TouchableOpacity>

              <View
                className="w-px h-12 bg-border/60"
              />

              <TouchableOpacity
                onPress={() => handleStatPress('friends')}
                activeOpacity={0.7}
                className="items-center px-4 py-2"
              >
                <Text variant="h1" className="font-lora-bold text-4xl">
                  {summary.friendsContacted}
                </Text>
                <Text variant="caption" className="text-muted-foreground mt-1 uppercase tracking-wide text-xs">
                  friends
                </Text>
              </TouchableOpacity>

              {summary.topActivity && (
                <>
                  <View
                    className="w-px h-12 bg-border/60"
                  />

                  <TouchableOpacity
                    onPress={() => {
                      console.log('[WeekSnapshotStep] Activity pressed');
                      handleStatPress('activity');
                    }}
                    activeOpacity={0.7}
                    className="items-center px-4 py-2"
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Text variant="h2" className="font-lora-bold">
                      {summary.topActivityCount}×
                    </Text>
                    <Text variant="caption" className="text-muted-foreground mt-1 text-xs text-center" numberOfLines={2}>
                      {summary.topActivity}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            {/* Insight Line */}
            <View
              className="flex-row items-center justify-center px-4 py-3 rounded-xl"
              style={{ backgroundColor: `${insightColor}10` }}
            >
              <Sparkles size={14} color={insightColor} />
              <Text
                variant="body"
                className="text-center font-medium ml-2"
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
            <Text variant="caption" className="font-medium mb-2 text-muted-foreground">
              Might appreciate a hello
            </Text>

            {attentionFriends.map((af, index) => {
              const hasIntention = intentionSetFor.has(af.friend.id);

              return (
                <Animated.View
                  key={af.friend.id}
                  entering={FadeInDown.delay(300 + index * 100).duration(300)}
                  className="mb-2"
                >
                  <Card
                    className={`p-3 ${hasIntention ? 'border border-primary/30' : ''}`}
                  >
                    <View className="flex-row items-center">
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

                      {/* Friend Info - stacked vertically */}
                      <View className="flex-1">
                        <Text variant="body" className="font-semibold" numberOfLines={1}>
                          {af.friend.name}
                        </Text>
                        <View className="flex-row items-center">
                          <Text variant="caption" className="text-muted-foreground text-xs">
                            {af.tierLabel}
                          </Text>
                          <View className="flex-row items-center ml-2">
                            <Clock size={10} color={colors['muted-foreground']} />
                            <Text variant="caption" className="text-muted-foreground ml-1 text-xs">
                              {formatDaysSince(af.daysSinceContact)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Action Button */}
                      {hasIntention ? (
                        <View
                          className="px-3 py-2 rounded-xl bg-primary/10"
                        >
                          <Text variant="caption" className="font-semibold text-primary text-xs">
                            ✓ Set
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleSetIntention(af.friend)}
                          className="px-3 py-2 rounded-xl bg-primary/10"
                          activeOpacity={0.7}
                        >
                          <Text variant="caption" className="font-semibold text-primary text-xs">
                            Intention
                          </Text>
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

        {/* Complete Button - inside ScrollView */}
        <Animated.View
          entering={FadeInDown.delay(500).duration(400)}
          className="pt-6 mt-auto"
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
      </ScrollView>

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

      {/* Stats Detail Sheet */}
      <StatsDetailSheet
        isOpen={statsSheetOpen}
        onClose={() => setStatsSheetOpen(false)}
        statType={statsSheetType}
      />
    </>
  );
}
