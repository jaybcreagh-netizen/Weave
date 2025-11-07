import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useTheme } from '../hooks/useTheme';
import { SocialSeason } from '../lib/social-season/season-types';

interface SeasonOverrideModalProps {
  visible: boolean;
  onClose: () => void;
  currentSeason: SocialSeason;
  onSelectSeason: (season: SocialSeason) => void;
}

export const SeasonOverrideModal: React.FC<SeasonOverrideModalProps> = ({
  visible,
  onClose,
  currentSeason,
  onSelectSeason,
}) => {
  const { colors, isDarkMode } = useTheme();

  const seasons: { key: SocialSeason; emoji: string; name: string; description: string }[] = [
    {
      key: 'resting',
      emoji: '🌙',
      name: 'Resting',
      description: 'Low social energy, focused on close bonds and solitude',
    },
    {
      key: 'balanced',
      emoji: '☀️',
      name: 'Balanced',
      description: 'Sustainable rhythm between connection and solitude',
    },
    {
      key: 'blooming',
      emoji: '✨',
      name: 'Blooming',
      description: 'High social energy, abundant connections',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1">
        <BlurView intensity={isDarkMode ? 40 : 20} style={StyleSheet.absoluteFill} />
        <TouchableOpacity className="absolute inset-0" activeOpacity={1} onPress={onClose} />

        <View className="flex-1 justify-center items-center px-5">
          <View
            className="rounded-3xl w-full max-w-[400px] p-6 border"
            style={{
              backgroundColor: colors.card,
              borderColor: colors.border,
            }}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between mb-2">
              <Text className="font-lora-bold text-xl" style={{ color: colors.foreground }}>
                Override Season
              </Text>
              <TouchableOpacity
                onPress={onClose}
                className="p-1"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={24} color={colors['muted-foreground']} />
              </TouchableOpacity>
            </View>

            <Text
              className="font-inter-regular text-sm leading-5 mb-6"
              style={{ color: colors['muted-foreground'] }}
            >
              Manually set your season if the app misjudged it. The app will recalculate automatically later.
            </Text>

            {/* Season Options */}
            <View className="gap-3">
              {seasons.map((s) => (
                <TouchableOpacity
                  key={s.key}
                  onPress={() => {
                    onSelectSeason(s.key);
                    onClose();
                  }}
                  className="rounded-2xl border p-4 flex-row items-center gap-3"
                  style={{
                    backgroundColor: currentSeason === s.key ? `${colors.primary}15` : 'transparent',
                    borderColor: currentSeason === s.key ? colors.primary : colors.border,
                    borderWidth: currentSeason === s.key ? 2 : 1,
                  }}
                >
                  <Text className="text-[32px]">{s.emoji}</Text>
                  <View className="flex-1">
                    <Text
                      className="font-inter-semibold text-base mb-1"
                      style={{ color: colors.foreground }}
                    >
                      {s.name}
                    </Text>
                    <Text
                      className="font-inter-regular text-xs leading-4"
                      style={{ color: colors['muted-foreground'] }}
                    >
                      {s.description}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};
