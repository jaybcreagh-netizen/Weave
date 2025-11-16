import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUserProfileStore } from '../stores/userProfileStore';
import { generateSeasonExplanation, type SeasonExplanationData } from '../lib/narrative-generator';
import { SeasonCalculationInput } from '../lib/social-season/season-types';

interface SeasonExplanationModalProps {
  visible: boolean;
  onClose: () => void;
  seasonData: SeasonCalculationInput | null;
}

export const SeasonExplanationModal: React.FC<SeasonExplanationModalProps> = ({
  visible,
  onClose,
  seasonData,
}) => {
  const { colors, isDarkMode } = useTheme();
  const { profile } = useUserProfileStore();

  const season = profile?.currentSocialSeason || 'balanced';
  const batteryLevel = profile?.socialBatteryCurrent || 3;

  // Generate data-driven explanation if we have seasonData
  const explanation = seasonData ? generateSeasonExplanation({
    ...seasonData,
    season,
  }) : null;

  // Season metadata
  const seasonMetadata = {
    resting: {
      emoji: '🌙',
      name: 'Resting',
      color: isDarkMode ? '#6366F1' : '#818CF8',
      description: 'Your energy is focused inward. This is a natural time to nurture your closest bonds and honor your need for solitude.',
      characteristics: [
        'Lower energy for socializing',
        'Preference for intimate gatherings',
        'Focus on your Inner Circle',
        'More solo time feels restorative',
      ],
    },
    balanced: {
      emoji: '☀️',
      name: 'Balanced',
      color: isDarkMode ? '#F59E0B' : '#FCD34D',
      description: 'You\'re finding a comfortable rhythm between connection and solitude. Your social energy feels sustainable.',
      characteristics: [
        'Steady social engagement',
        'Mix of group and one-on-one time',
        'Comfortable with variety',
        'Energy feels sustainable',
      ],
    },
    blooming: {
      emoji: '✨',
      name: 'Blooming',
      color: isDarkMode ? '#EC4899' : '#F472B6',
      description: 'Your social energy is abundant. This is a great time to expand connections, plan gatherings, and explore new experiences.',
      characteristics: [
        'High energy for socializing',
        'Drawn to group activities',
        'Excited to meet new people',
        'Thrive in vibrant settings',
      ],
    },
  };

  const currentSeasonMetadata = seasonMetadata[season];

  // Battery level description
  const getBatteryDescription = (level: number) => {
    if (level <= 1) return 'Your social battery is very low. Rest and recharge with solitude or close friends.';
    if (level <= 2) return 'Your social battery is running low. Consider lighter social activities.';
    if (level === 3) return 'Your social battery is moderate. You have energy for meaningful connections.';
    if (level === 4) return 'Your social battery is good. You have energy for diverse social activities.';
    return 'Your social battery is full. You\'re ready for vibrant social experiences!';
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1">
        <BlurView intensity={isDarkMode ? 40 : 20} style={StyleSheet.absoluteFill} />
        <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={onClose} />

        <View className="flex-1 justify-center items-center px-5">
          <View
            className="rounded-3xl w-full max-w-[500px] border"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
              maxHeight: '80%',
            }}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between p-5 pb-4">
              <Text className="font-lora-bold text-2xl" style={{ color: colors.foreground }}>
                Social Seasons
              </Text>
              <TouchableOpacity
                onPress={onClose}
                className="p-1"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color={colors['muted-foreground']} />
              </TouchableOpacity>
            </View>

            <ScrollView className="px-5 pb-5" showsVerticalScrollIndicator={false}>
              {/* Current Season */}
              <View className="mb-6">
                <Text
                  className="font-inter-semibold text-xs uppercase tracking-wide mb-3"
                  style={{ color: colors['muted-foreground'] }}
                >
                  YOUR CURRENT SEASON
                </Text>
                <View
                  className="rounded-2xl border p-4"
                  style={{
                    backgroundColor: `${currentSeasonMetadata.color}15`,
                    borderColor: `${currentSeasonMetadata.color}40`,
                  }}
                >
                  <View className="flex-row items-center gap-3 mb-3">
                    <Text className="text-[32px]">{currentSeasonMetadata.emoji}</Text>
                    <Text
                      className="font-lora-bold text-2xl"
                      style={{ color: currentSeasonMetadata.color }}
                    >
                      {currentSeasonMetadata.name}
                    </Text>
                  </View>
                  <Text
                    className="font-inter-regular text-[15px] leading-[22px]"
                    style={{ color: colors.foreground }}
                  >
                    {explanation ? explanation.headline : currentSeasonMetadata.description}
                  </Text>
                </View>
              </View>

              {/* Data-Driven Explanation */}
              {explanation && explanation.reasons.length > 0 && (
                <View className="mb-6">
                  <Text
                    className="font-inter-semibold text-xs uppercase tracking-wide mb-3"
                    style={{ color: colors['muted-foreground'] }}
                  >
                    BASED ON
                  </Text>
                  {explanation.reasons.map((reason, index) => (
                    <View
                      key={index}
                      className="flex-row items-start gap-2 mb-2"
                    >
                      <Text className="text-sm mt-0.5" style={{ color: colors.primary }}>•</Text>
                      <Text
                        className="font-inter-regular text-sm leading-5 flex-1"
                        style={{ color: colors.foreground }}
                      >
                        {reason}
                      </Text>
                    </View>
                  ))}
                  {explanation.insight && (
                    <View className="rounded-xl p-4 mt-3" style={{ backgroundColor: colors.muted }}>
                      <Text
                        className="font-inter-regular text-sm leading-5"
                        style={{ color: colors.foreground }}
                      >
                        {explanation.insight}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* Battery Level */}
              <View className="mb-6">
                <Text
                  className="font-inter-semibold text-xs uppercase tracking-wide mb-3"
                  style={{ color: colors['muted-foreground'] }}
                >
                  YOUR SOCIAL BATTERY
                </Text>
                <View className="rounded-xl p-4" style={{ backgroundColor: colors.muted }}>
                  <View className="flex-row items-center gap-2 mb-2">
                    <Text className="text-2xl">⚡</Text>
                    <Text className="font-inter-bold text-xl" style={{ color: colors.primary }}>
                      {batteryLevel}/5
                    </Text>
                  </View>
                  <Text
                    className="font-inter-regular text-sm leading-5"
                    style={{ color: colors['muted-foreground'] }}
                  >
                    {getBatteryDescription(batteryLevel)}
                  </Text>
                </View>
              </View>

              {/* Characteristics */}
              <View className="mb-6">
                <Text
                  className="font-inter-semibold text-xs uppercase tracking-wide mb-3"
                  style={{ color: colors['muted-foreground'] }}
                >
                  WHAT THIS MEANS
                </Text>
                {currentSeasonMetadata.characteristics.map((characteristic, index) => (
                  <View
                    key={index}
                    className="flex-row items-center gap-3 py-2.5 border-b"
                    style={{ borderColor: colors.border }}
                  >
                    <View
                      className="w-2 h-2 rounded"
                      style={{ backgroundColor: currentSeasonMetadata.color }}
                    />
                    <Text
                      className="font-inter-medium text-[15px] flex-1"
                      style={{ color: colors.foreground }}
                    >
                      {characteristic}
                    </Text>
                  </View>
                ))}
              </View>

              {/* All Seasons Overview */}
              <View className="mb-6">
                <Text
                  className="font-inter-semibold text-xs uppercase tracking-wide mb-3"
                  style={{ color: colors['muted-foreground'] }}
                >
                  ALL SEASONS
                </Text>
                <Text
                  className="font-inter-regular text-sm leading-5 mb-4"
                  style={{ color: colors['muted-foreground'] }}
                >
                  Your season adapts naturally based on your social patterns and energy. Each season has its own rhythm and beauty.
                </Text>
                {Object.entries(seasonMetadata).map(([key, data]) => (
                  <View
                    key={key}
                    className="rounded-xl border p-3.5 mb-3"
                    style={{
                      backgroundColor: key === season ? colors.muted : 'transparent',
                      borderColor: colors.border,
                    }}
                  >
                    <View className="flex-row items-center gap-2.5 mb-2">
                      <Text className="text-2xl">{data.emoji}</Text>
                      <Text
                        className="font-inter-semibold text-base"
                        style={{ color: colors.foreground }}
                      >
                        {data.name}
                      </Text>
                    </View>
                    <Text
                      className="font-inter-regular text-[13px] leading-[19px]"
                      style={{ color: colors['muted-foreground'] }}
                    >
                      {data.description}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};
