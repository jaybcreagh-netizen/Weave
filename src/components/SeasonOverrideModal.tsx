import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { SocialSeason } from '@/modules/intelligence';

import RestingIcon from '@/assets/icons/resting.svg';
import BalancedIcon from '@/assets/icons/Balanced.svg';
import BloomingIcon from '@/assets/icons/blooming.svg';

interface SeasonOverrideModalProps {
  visible: boolean;
  onClose: () => void;
  currentSeason: SocialSeason;
  onSelectSeason: (season: SocialSeason, durationDays?: number) => void;
}

const DURATION_OPTIONS = [
  { label: 'Until tomorrow', days: 1 },
  { label: '3 Days', days: 3 },
  { label: '1 Week', days: 7 },
];

export const SeasonOverrideModal: React.FC<SeasonOverrideModalProps> = ({
  visible,
  onClose,
  currentSeason,
  onSelectSeason,
}) => {
  const { colors, isDarkMode } = useTheme();
  const [selectedSeason, setSelectedSeason] = React.useState<SocialSeason | null>(null);

  const seasons: { key: SocialSeason; Icon: React.FC<any>; name: string; description: string }[] = [
    {
      key: 'resting',
      Icon: RestingIcon,
      name: 'Resting',
      description: 'Low social energy, focused on close bonds and solitude',
    },
    {
      key: 'balanced',
      Icon: BalancedIcon,
      name: 'Balanced',
      description: 'Sustainable rhythm between connection and solitude',
    },
    {
      key: 'blooming',
      Icon: BloomingIcon,
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

            {/* Content Switcher */}
            {!selectedSeason ? (
              // STEP 1: Select Season
              <View className="gap-3">
                {seasons.map((s) => (
                  <TouchableOpacity
                    key={s.key}
                    onPress={() => setSelectedSeason(s.key)}
                    className="rounded-2xl border p-4 flex-row items-center gap-3"
                    style={{
                      backgroundColor: currentSeason === s.key ? `${colors.primary}15` : 'transparent',
                      borderColor: currentSeason === s.key ? colors.primary : colors.border,
                      borderWidth: currentSeason === s.key ? 2 : 1,
                    }}
                  >
                    <s.Icon width={32} height={32} color={colors.foreground} />
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
            ) : (
              // STEP 2: Select Duration
              <View className="gap-4">
                <View className="flex-row items-center gap-3 mb-2">
                  <TouchableOpacity onPress={() => setSelectedSeason(null)} className="p-1 -ml-2">
                    <Text style={{ color: colors.primary }}>Let's go back</Text>
                  </TouchableOpacity>
                </View>

                <Text className="font-inter-bold text-lg" style={{ color: colors.foreground }}>
                  How long should we keep you in {seasons.find(s => s.key === selectedSeason)?.name}?
                </Text>

                <View className="gap-3">
                  {DURATION_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.days}
                      onPress={() => {
                        if (selectedSeason) {
                          onSelectSeason(selectedSeason, opt.days);
                          onClose();
                          setSelectedSeason(null);
                        }
                      }}
                      className="rounded-xl border p-4 items-center justify-center"
                      style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                      }}
                    >
                      <Text className="font-inter-medium text-base" style={{ color: colors.foreground }}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};
