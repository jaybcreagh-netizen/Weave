import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Calendar, Heart, Sparkles, X, CloudSun } from 'lucide-react-native';
import withObservables from '@nozbe/with-observables';

import { useTheme } from '@/shared/hooks/useTheme';
import { ArchetypeIcon } from '@/modules/intelligence';
import { archetypeData, CategoryArchetypeMatrix } from '@/shared/constants/constants';
import { CATEGORY_METADATA } from '@/shared/constants/interaction-categories';
import { type InteractionCategory, Archetype } from '@/shared/types/legacy-types';
import FriendModel from '@/db/models/Friend';
import Interaction from '@/db/models/Interaction';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';
import { calculateCurrentScore } from '@/modules/intelligence';
import { getFriendMilestones, Milestone } from '@/modules/gamification';
import { switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

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

interface FriendDetailSheetProps {
  isVisible: boolean;
  onClose: () => void;
  friendId: string;
  friend: FriendModel; // Injected
  interactions: Interaction[]; // Injected
}

const FriendDetailSheetContent: React.FC<FriendDetailSheetProps> = ({
  isVisible,
  onClose,
  friend,
  interactions,
}) => {
  const { colors, tokens, isDarkMode } = useTheme();
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

  if (!shouldRender) return null;

  const archetypeInfo = archetypeData[friend.archetype];
  const weaveScore = calculateCurrentScore(friend);

  // Use observed interactions directly to calculate stats
  // We can filter by status now that we have the full Interaction objects
  const completedWeaves = interactions.filter(i => i.status === 'completed').length;

  const topInteractions = getTopInteractions(friend.archetype);

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

  return (
    <Modal transparent visible={isVisible} onRequestClose={onClose} animationType="none">
      {/* Backdrop */}
      <Animated.View style={animatedBackdropStyle} className="absolute inset-0">
        <BlurView intensity={isDarkMode ? 40 : 20} className="absolute inset-0" />
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

        {/* Date Info */}
        <View className="mb-6 gap-4">
          {friend.birthday && (
            <View className="flex-row items-center gap-3">
              <View
                style={{ backgroundColor: colors.muted }}
                className="h-10 w-10 items-center justify-center rounded-full"
              >
                <Calendar size={20} color={colors.foreground} />
              </View>
              <View className="flex-1">
                <Text
                  style={{ color: colors['muted-foreground'] }}
                  className="font-inter-regular text-xs"
                >
                  Birthday
                </Text>
                <Text
                  style={{ color: colors.foreground }}
                  className="font-inter-semibold text-base font-semibold"
                >
                  {(() => {
                    // Format MM-DD string to "Month Day"
                    const [month, day] = friend.birthday.split('-');
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
                    return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}`;
                  })()}
                </Text>
              </View>
            </View>
          )}

          {friend.anniversary && friend.relationshipType?.toLowerCase().includes('partner') && (
            <View className="flex-row items-center gap-3">
              <View
                style={{ backgroundColor: colors.muted }}
                className="h-10 w-10 items-center justify-center rounded-full"
              >
                <Heart size={20} color={colors.foreground} />
              </View>
              <View className="flex-1">
                <Text
                  style={{ color: colors['muted-foreground'] }}
                  className="font-inter-regular text-xs"
                >
                  Anniversary
                </Text>
                <Text
                  style={{ color: colors.foreground }}
                  className="font-inter-semibold text-base font-semibold"
                >
                  {(() => {
                    const [month, day] = friend.anniversary.split('-');
                    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
                    return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}`;
                  })()}
                </Text>
              </View>
            </View>
          )}

          {!friend.birthday && !friend.anniversary && (
            <Text
              style={{ color: colors['muted-foreground'] }}
              className="text-center font-inter-regular text-sm"
            >
              No dates set
            </Text>
          )}
        </View>

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

        {/* Archetype Info */}
        <View
          style={{ backgroundColor: colors.muted, borderColor: colors.border }}
          className="mb-6 rounded-2xl border p-4"
        >
          <View className="mb-3 flex-row items-center gap-3">
            <ArchetypeIcon archetype={friend.archetype} size={24} color={colors.primary} />
            <Text
              style={{ color: colors.foreground }}
              className="font-lora-bold text-lg font-bold"
            >
              {archetypeInfo?.name || friend.archetype}
            </Text>
          </View>
          <Text
            style={{ color: colors['muted-foreground'] }}
            className="font-inter-regular text-sm leading-5 mb-4"
          >
            {archetypeInfo?.description || 'A unique archetype'}
          </Text>

          {/* Perfect Connections */}
          {topInteractions.length > 0 && (
            <>
              <View className="flex-row items-center gap-2 mb-3 mt-2">
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
                      <Text
                        className="font-inter-medium text-[10px] font-medium"
                        style={{ color: `${affinityColor}CC` }}
                      >
                        {level === 'peak' ? '★' : level === 'high' ? '✦' : '◆'}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>

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

        {/* Stats */}
        <View className="flex-row gap-3">
          <View
            style={{ backgroundColor: colors.muted, borderColor: colors.border }}
            className="flex-1 rounded-xl border p-4"
          >
            <Text
              style={{ color: colors['muted-foreground'] }}
              className="mb-1 font-inter-regular text-xs"
            >
              Weave Score
            </Text>
            <Text
              style={{ color: colors.primary }}
              className="font-lora-bold text-2xl font-bold"
            >
              {Math.round(weaveScore)}
            </Text>
          </View>

          <View
            style={{ backgroundColor: colors.muted, borderColor: colors.border }}
            className="flex-1 rounded-xl border p-4"
          >
            <Text
              style={{ color: colors['muted-foreground'] }}
              className="mb-1 font-inter-regular text-xs"
            >
              Total Weaves
            </Text>
            <Text
              style={{ color: colors.foreground }}
              className="font-lora-bold text-2xl font-bold"
            >
              {completedWeaves}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Modal >
  );
};

// Enhance with observables
export const FriendDetailSheet = withObservables(['friendId'], ({ friendId }: { friendId: string }) => ({
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
