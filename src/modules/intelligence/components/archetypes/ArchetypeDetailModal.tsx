import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { useUIStore } from '@/shared/stores/uiStore';
import { useTheme } from '@/shared/hooks/useTheme';
import { X, Sparkles, Star, Gem } from 'lucide-react-native';
import { type Archetype, type InteractionCategory } from '@/shared/types/common';
import { archetypeData, CategoryArchetypeMatrix } from '@/shared/constants/constants';
import { CATEGORY_METADATA } from '@/shared/constants/interaction-categories';
import { BlurView } from 'expo-blur';

// Import SVG files as components
import EmperorSvg from '@/assets/TarotIcons/TheEmperor.svg';
import EmpressSvg from '@/assets/TarotIcons/TheEmpress.svg';
import HighPriestessSvg from '@/assets/TarotIcons/HighPriestess.svg';
import FoolSvg from '@/assets/TarotIcons/TheFool.svg';
import SunSvg from '@/assets/TarotIcons/TheSun.svg';
import HermitSvg from '@/assets/TarotIcons/TheHermit.svg';
import MagicianSvg from '@/assets/TarotIcons/TheMagician.svg';
import LoversSvg from '@/assets/TarotIcons/TheLovers.svg';

// Map archetypes to their tarot card SVG components
const TAROT_CARD_COMPONENTS: Record<Archetype, React.FC<any>> = {
  Emperor: EmperorSvg,
  Empress: EmpressSvg,
  HighPriestess: HighPriestessSvg,
  Fool: FoolSvg,
  Sun: SunSvg,
  Hermit: HermitSvg,
  Magician: MagicianSvg,
  Lovers: LoversSvg,
  Unknown: React.Fragment,
};

// Helper: Get top interaction suggestions for an archetype
function getTopInteractions(archetype: Archetype): Array<{ category: InteractionCategory; multiplier: number; level: 'peak' | 'high' | 'good' }> {
  if (archetype === 'Unknown') return [];

  const affinities = CategoryArchetypeMatrix[archetype];
  const suggestions = Object.entries(affinities)
    .map(([category, multiplier]) => ({
      category: category as InteractionCategory,
      multiplier: multiplier as number,
      level: (multiplier as number) >= 1.8 ? 'peak' : (multiplier as number) >= 1.5 ? 'high' : 'good' as 'peak' | 'high' | 'good'
    }))
    .filter(item => item.multiplier >= 1.4) // Only show good+ affinities
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 5); // Top 5

  return suggestions;
}

export function ArchetypeDetailModal() {
  const { archetypeModal, setArchetypeModal } = useUIStore();
  const { colors, isDarkMode } = useTheme();

  // Debug: Log when this modal is shown
  if (archetypeModal) {
    console.log('[ArchetypeDetailModal] Rendering with archetype:', archetypeModal);
  }

  if (!archetypeModal) {
    return null;
  }

  const data = archetypeData[archetypeModal];
  const topInteractions = getTopInteractions(archetypeModal);

  // Color scheme for affinity levels
  const getAffinityColor = (level: 'peak' | 'high' | 'good') => {
    if (level === 'peak') return '#10b981'; // Green
    if (level === 'high') return '#3b82f6'; // Blue
    return '#8b5cf6'; // Purple
  };

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={!!archetypeModal}
      onRequestClose={() => setArchetypeModal(null)}
    >
      <BlurView intensity={90} className="flex-1" tint={isDarkMode ? 'dark' : 'light'}>
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={() => setArchetypeModal(null)}
        />
        <View
          className="flex-1 justify-center items-center w-full"
          pointerEvents="box-none"
        >
          <View className="w-[85%] max-w-[400px] max-h-[80%]">
            <View
              className="w-full rounded-3xl p-6"
              style={{
                backgroundColor: colors.card,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <TouchableOpacity
                className="absolute top-4 right-4 z-10 p-1"
                onPress={() => setArchetypeModal(null)}
              >
                <X color={colors['muted-foreground']} size={24} />
              </TouchableOpacity>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16, paddingBottom: 20 }}
              >
                <View
                  className="mb-4 mt-2"
                  style={{
                    width: 120,
                    height: 180,
                  }}
                >
                  {React.createElement(TAROT_CARD_COMPONENTS[archetypeModal], {
                    width: 120,
                    height: 180,
                  })}
                </View>

                <Text
                  className="font-lora-bold text-2xl mb-2 text-center"
                  style={{ color: colors.foreground }}
                >
                  {data.name}
                </Text>

                <Text
                  className="font-inter-medium text-[15px] mb-4 text-center italic"
                  style={{ color: colors['muted-foreground'] }}
                >
                  {data.essence}
                </Text>

                <Text
                  className="font-inter-regular text-[15px] text-center leading-[22px] mb-5"
                  style={{ color: colors.foreground }}
                >
                  {data.description}
                </Text>

                <View
                  className="h-[1px] w-full my-4"
                  style={{ backgroundColor: colors.border }}
                />

                <Text
                  className="font-inter-semibold text-[16px] mb-3 self-start"
                  style={{ color: colors.foreground }}
                >
                  How to Connect
                </Text>

                <Text
                  className="font-inter-regular text-[14px] leading-[20px] mb-4"
                  style={{ color: colors['muted-foreground'] }}
                >
                  {data.careStyle}
                </Text>

                {/* Top Interaction Suggestions */}
                {topInteractions.length > 0 && (
                  <>
                    <View
                      className="h-[1px] w-full my-4"
                      style={{ backgroundColor: colors.border }}
                    />

                    <View className="flex-row items-center gap-2 mb-3 self-start">
                      <Sparkles size={16} color={colors.primary} />
                      <Text
                        className="font-inter-semibold text-[16px]"
                        style={{ color: colors.foreground }}
                      >
                        Perfect Connections
                      </Text>
                    </View>

                    <Text
                      className="font-inter-regular text-[13px] leading-[18px] mb-3"
                      style={{ color: colors['muted-foreground'] }}
                    >
                      These interactions resonate most with this archetype
                    </Text>

                    <View className="flex-row flex-wrap gap-2">
                      {topInteractions.map(({ category, level, multiplier }) => {
                        const metadata = CATEGORY_METADATA[category];
                        const affinityColor = getAffinityColor(level);

                        return (
                          <View
                            key={category}
                            className="flex-row items-center gap-1.5 rounded-full px-3 py-2"
                            style={{
                              backgroundColor: `${affinityColor}15`,
                              borderWidth: 1,
                              borderColor: `${affinityColor}40`,
                            }}
                          >
                            <metadata.iconComponent size={14} color={affinityColor} />
                            <Text
                              className="font-inter text-[13px] font-semibold"
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

                    <View className="mt-3 flex-row items-start gap-3 px-1">
                      <View className="flex-row items-center gap-1">
                        <Star size={10} color={colors['muted-foreground']} fill={colors['muted-foreground']} />
                        <Text className="font-inter text-[11px]" style={{ color: colors['muted-foreground'] }}>Peak</Text>
                      </View>
                      <Text className="font-inter text-[11px]" style={{ color: colors['muted-foreground'] }}>•</Text>
                      <View className="flex-row items-center gap-1">
                        <Sparkles size={10} color={colors['muted-foreground']} />
                        <Text className="font-inter text-[11px]" style={{ color: colors['muted-foreground'] }}>High</Text>
                      </View>
                      <Text className="font-inter text-[11px]" style={{ color: colors['muted-foreground'] }}>•</Text>
                      <View className="flex-row items-center gap-1">
                        <Gem size={10} color={colors['muted-foreground']} />
                        <Text className="font-inter text-[11px]" style={{ color: colors['muted-foreground'] }}>Good</Text>
                      </View>
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}