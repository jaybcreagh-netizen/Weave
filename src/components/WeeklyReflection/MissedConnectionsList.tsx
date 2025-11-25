/**
 * MissedConnectionsList Component
 * Shows friends who need attention with quick-add buttons
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { ChevronRight, Heart, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useRouter } from 'expo-router';
import { MissedFriend } from '@/modules/reflection';
import { ArchetypeIcon } from '../ArchetypeIcon';
import { Archetype } from '../types';
import * as Haptics from 'expo-haptics';

interface MissedConnectionsListProps {
  missedFriends: MissedFriend[];
  onNext: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export function MissedConnectionsList({
  missedFriends,
  onNext,
  onSkip,
  onClose,
}: MissedConnectionsListProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const handleLogWeave = (friendId: string, friendName: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
    // Small delay to allow modal animation to complete
    setTimeout(() => {
      router.push({ pathname: '/weave-logger', params: { friendId } });
    }, 300);
  };

  if (missedFriends.length === 0) {
    return (
      <View className="flex-1 justify-center">
        <View className="items-center mb-8">
          <Text className="text-6xl mb-4">✨</Text>
          <Text
            className="text-xl font-semibold text-center mb-3"
            style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
          >
            All caught up!
          </Text>
          <Text
            className="text-sm text-center leading-5 px-6"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
          >
            Your important relationships are thriving. Keep up the beautiful work.
          </Text>
        </View>

        <TouchableOpacity
          onPress={onNext}
          className="py-4 rounded-xl items-center mx-4"
          style={{ backgroundColor: colors.primary }}
        >
          <Text
            className="text-base font-semibold"
            style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
          >
            Continue to Reflection
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {/* Header */}
      <View className="mb-6">
        <View className="flex-row items-center justify-center mb-2">
          <AlertCircle size={24} color={colors.accent} />
          <Text
            className="text-2xl font-bold ml-2"
            style={{ color: colors.foreground, fontFamily: 'Lora_700Bold' }}
          >
            Friends to Reconnect
          </Text>
        </View>
        <Text
          className="text-sm text-center leading-5 px-4"
          style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
        >
          These important friends are drifting. A small gesture goes a long way.
        </Text>
      </View>

      {/* Missed Friends List */}
      <ScrollView
        className="flex-1 mb-6"
        showsVerticalScrollIndicator={false}
      >
        {missedFriends.map((missed, index) => {
          const scoreColor =
            missed.weaveScore < 30
              ? colors.destructive
              : missed.weaveScore < 50
                ? colors.accent
                : colors.primary;

          return (
            <Animated.View
              key={missed.friend.id}
              entering={FadeInRight.delay(index * 100)}
              className="mb-3 rounded-2xl overflow-hidden"
              style={{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }}
            >
              {/* Friend Info */}
              <View className="p-4">
                <View className="flex-row items-center mb-3">
                  {/* Archetype Icon */}
                  <View
                    className="w-12 h-12 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: colors.muted }}
                  >
                    <ArchetypeIcon
                      archetype={missed.friend.archetype as Archetype}
                      size={24}
                      color={colors.foreground}
                    />
                  </View>

                  {/* Name and Score */}
                  <View className="flex-1">
                    <Text
                      className="text-lg font-semibold mb-1"
                      style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                    >
                      {missed.friend.name}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <View
                        className="px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: scoreColor + '20' }}
                      >
                        <Text
                          className="text-xs font-medium"
                          style={{ color: scoreColor, fontFamily: 'Inter_500Medium' }}
                        >
                          {Math.round(missed.weaveScore)} / 100
                        </Text>
                      </View>
                      <Text
                        className="text-xs"
                        style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                      >
                        {missed.daysSinceLastContact < 999
                          ? `${missed.daysSinceLastContact}d since last contact`
                          : 'No recent contact'}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Suggestion */}
                <View
                  className="p-3 rounded-xl mb-3"
                  style={{ backgroundColor: colors.secondary + '10' }}
                >
                  <Text
                    className="text-xs mb-1"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                  >
                    They value {missed.archetypeValue}. Try:
                  </Text>
                  <Text
                    className="text-sm font-medium"
                    style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                  >
                    {missed.suggestedAction}
                  </Text>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                  onPress={() => handleLogWeave(missed.friend.id, missed.friend.name)}
                  className="flex-row items-center justify-center py-3 rounded-xl"
                  style={{ backgroundColor: colors.primary }}
                >
                  <Heart size={16} color={colors['primary-foreground']} fill={colors['primary-foreground']} />
                  <Text
                    className="text-sm font-semibold ml-2"
                    style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
                  >
                    Log a Weave with {missed.friend.name}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Bottom Actions */}
      <View className="gap-3">
        <TouchableOpacity
          onPress={onNext}
          className="py-4 rounded-xl items-center"
          style={{ backgroundColor: colors.primary }}
        >
          <View className="flex-row items-center">
            <Text
              className="text-base font-semibold mr-2"
              style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
            >
              Continue to Reflection
            </Text>
            <ChevronRight size={20} color={colors['primary-foreground']} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onSkip}
          className="py-3 items-center"
        >
          <Text
            className="text-sm font-medium"
            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_500Medium' }}
          >
            Skip for now
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
