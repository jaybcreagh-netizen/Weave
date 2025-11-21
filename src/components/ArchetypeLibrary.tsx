import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Modal } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, BookOpen, Sparkles } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';

import { type Archetype, type InteractionCategory } from './types';
import { archetypeData, CategoryArchetypeMatrix } from '@/shared/constants/constants';
import { CATEGORY_METADATA } from '@/shared/constants/interaction-categories';
import { useTheme } from '@/shared/hooks/useTheme';

// Import SVG files as components
import EmperorSvg from '@/assets/TarotIcons/TheEmperor.svg';
import EmpressSvg from '@/assets/TarotIcons/TheEmpress.svg';
import HighPriestessSvg from '@/assets/TarotIcons/HighPriestess.svg';
import FoolSvg from '@/assets/TarotIcons/TheFool.svg';
import SunSvg from '@/assets/TarotIcons/TheSun.svg';
import HermitSvg from '@/assets/TarotIcons/TheHermit.svg';
import MagicianSvg from '@/assets/TarotIcons/TheMagician.svg';
import LoversSvg from '@/assets/TarotIcons/TheLovers.svg';

const TAROT_CARD_COMPONENTS: Record<Archetype, React.FC<any>> = {
  Emperor: EmperorSvg,
  Empress: EmpressSvg,
  HighPriestess: HighPriestessSvg,
  Fool: FoolSvg,
  Sun: SunSvg,
  Hermit: HermitSvg,
  Magician: MagicianSvg,
  Lovers: LoversSvg,
};

const ARCHETYPE_GRADIENTS: Record<Archetype, string[]> = {
  Emperor: ['#ef4444', '#dc2626'],
  Empress: ['#10b981', '#059669'],
  HighPriestess: ['#8b5cf6', '#7c3aed'],
  Fool: ['#f59e0b', '#d97706'],
  Sun: ['#eab308', '#ca8a04'],
  Hermit: ['#6366f1', '#4f46e5'],
  Magician: ['#ec4899', '#db2777'],
  Lovers: ['#fb7185', '#f43f5e'],
};

const ALL_ARCHETYPES: Archetype[] = [
  'Emperor',
  'Empress',
  'HighPriestess',
  'Fool',
  'Sun',
  'Hermit',
  'Magician',
  'Lovers',
];

// Helper: Get all interactions sorted by affinity
function getInteractionAffinities(archetype: Archetype): Array<{ category: InteractionCategory; multiplier: number; level: 'peak' | 'high' | 'good' | 'moderate' }> {
  const affinities = CategoryArchetypeMatrix[archetype];
  return Object.entries(affinities)
    .map(([category, multiplier]) => ({
      category: category as InteractionCategory,
      multiplier,
      level: multiplier >= 1.8 ? 'peak' : multiplier >= 1.5 ? 'high' : multiplier >= 1.2 ? 'good' : 'moderate' as 'peak' | 'high' | 'good' | 'moderate'
    }))
    .sort((a, b) => b.multiplier - a.multiplier);
}

interface ArchetypeLibraryProps {
  isVisible: boolean;
  onClose: () => void;
}

export function ArchetypeLibrary({ isVisible, onClose }: ArchetypeLibraryProps) {
  const { colors, isDarkMode } = useTheme();
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype | null>(null);

  const handleArchetypePress = (archetype: Archetype) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedArchetype(archetype);
  };

  const handleCloseDetail = () => {
    setSelectedArchetype(null);
  };

  // Color scheme for affinity levels
  const getAffinityColor = (level: 'peak' | 'high' | 'good' | 'moderate') => {
    if (level === 'peak') return '#10b981';
    if (level === 'high') return '#3b82f6';
    if (level === 'good') return '#8b5cf6';
    return '#6b7280';
  };

  const getAffinityIcon = (level: 'peak' | 'high' | 'good' | 'moderate') => {
    if (level === 'peak') return '★';
    if (level === 'high') return '✦';
    if (level === 'good') return '◆';
    return '○';
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-6 pt-6 pb-4"
          style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
          <View className="flex-row items-center gap-3">
            <BookOpen size={24} color={colors.primary} />
            <Text
              className="font-lora text-2xl font-bold"
              style={{ color: colors.foreground }}
            >
              Archetype Library
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} className="p-2">
            <X size={24} color={colors['muted-foreground']} />
          </TouchableOpacity>
        </View>

        {/* Description */}
        <View className="px-6 py-4" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text
            className="font-inter text-[15px] leading-[22px]"
            style={{ color: colors['muted-foreground'] }}
          >
            Discover the eight connection archetypes and how they shape meaningful relationships
          </Text>
        </View>

        {/* Archetype Grid */}
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-row flex-wrap gap-3">
            {ALL_ARCHETYPES.map((archetype) => {
              const data = archetypeData[archetype];
              const gradient = ARCHETYPE_GRADIENTS[archetype];

              return (
                <TouchableOpacity
                  key={archetype}
                  onPress={() => handleArchetypePress(archetype)}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    width: '48%',
                    minHeight: 200,
                    backgroundColor: colors.card,
                    shadowColor: '#000',
                    shadowOpacity: 0.1,
                    shadowOffset: { width: 0, height: 2 },
                    shadowRadius: 8,
                    elevation: 3,
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[...gradient.map(c => c + '20'), 'transparent']}
                    className="absolute inset-0"
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  />

                  <View className="items-center justify-center p-4 relative z-10">
                    <View
                      className="mb-2"
                      style={{
                        width: 70,
                        height: 105,
                        shadowColor: gradient[0],
                        shadowOpacity: 0.2,
                        shadowOffset: { width: 0, height: 2 },
                        shadowRadius: 6,
                      }}
                    >
                      {React.createElement(TAROT_CARD_COMPONENTS[archetype], {
                        width: 70,
                        height: 105,
                        color: colors.foreground,
                      })}
                    </View>

                    <Text
                      className="font-lora text-base font-semibold text-center mb-1"
                      style={{ color: colors.foreground }}
                    >
                      {data.name.replace('The ', '')}
                    </Text>

                    <Text
                      className="font-inter text-[11px] text-center"
                      style={{ color: colors['muted-foreground'] }}
                      numberOfLines={2}
                    >
                      {data.essence}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Detail Modal */}
        {selectedArchetype && (
          <Modal
            animationType="fade"
            transparent={true}
            visible={!!selectedArchetype}
            onRequestClose={handleCloseDetail}
          >
            <BlurView intensity={90} className="flex-1 justify-center items-center" tint={isDarkMode ? 'dark' : 'light'}>
              <TouchableOpacity
                className="flex-1 justify-center items-center w-full"
                activeOpacity={1}
                onPress={handleCloseDetail}
              >
                <TouchableOpacity activeOpacity={1} className="w-[90%] max-w-[500px] max-h-[85%]">
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
                      onPress={handleCloseDetail}
                    >
                      <X color={colors['muted-foreground']} size={24} />
                    </TouchableOpacity>

                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 16, paddingBottom: 20 }}
                    >
                      {/* Tarot Card */}
                      <View
                        className="mb-4 mt-2"
                        style={{
                          width: 120,
                          height: 180,
                        }}
                      >
                        {React.createElement(TAROT_CARD_COMPONENTS[selectedArchetype], {
                          width: 120,
                          height: 180,
                        })}
                      </View>

                      {/* Name & Essence */}
                      <Text
                        className="font-lora-bold text-2xl mb-2 text-center"
                        style={{ color: colors.foreground }}
                      >
                        {archetypeData[selectedArchetype].name}
                      </Text>

                      <Text
                        className="font-inter-medium text-[15px] mb-4 text-center italic"
                        style={{ color: colors['muted-foreground'] }}
                      >
                        {archetypeData[selectedArchetype].essence}
                      </Text>

                      {/* Description */}
                      <Text
                        className="font-inter-regular text-[15px] text-center leading-[22px] mb-5"
                        style={{ color: colors.foreground }}
                      >
                        {archetypeData[selectedArchetype].description}
                      </Text>

                      <View
                        className="h-[1px] w-full my-4"
                        style={{ backgroundColor: colors.border }}
                      />

                      {/* How to Connect */}
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
                        {archetypeData[selectedArchetype].careStyle}
                      </Text>

                      <View
                        className="h-[1px] w-full my-4"
                        style={{ backgroundColor: colors.border }}
                      />

                      {/* Interaction Affinity Matrix */}
                      <View className="flex-row items-center gap-2 mb-3 self-start">
                        <Sparkles size={16} color={colors.primary} />
                        <Text
                          className="font-inter-semibold text-[16px]"
                          style={{ color: colors.foreground }}
                        >
                          Connection Affinity
                        </Text>
                      </View>

                      <Text
                        className="font-inter-regular text-[13px] leading-[18px] mb-3"
                        style={{ color: colors['muted-foreground'] }}
                      >
                        How this archetype resonates with different interaction types
                      </Text>

                      {/* Affinity List */}
                      <View className="w-full gap-2">
                        {getInteractionAffinities(selectedArchetype).map(({ category, level, multiplier }) => {
                          const metadata = CATEGORY_METADATA[category];
                          const affinityColor = getAffinityColor(level);
                          const affinityIcon = getAffinityIcon(level);

                          return (
                            <View
                              key={category}
                              className="flex-row items-center justify-between px-3 py-2.5 rounded-xl"
                              style={{
                                backgroundColor: `${affinityColor}10`,
                                borderWidth: 1,
                                borderColor: `${affinityColor}30`,
                              }}
                            >
                              <View className="flex-row items-center gap-2 flex-1">
                                <Text className="text-lg">{metadata.icon}</Text>
                                <Text
                                  className="font-inter text-[14px] font-medium flex-1"
                                  style={{ color: colors.foreground }}
                                >
                                  {metadata.label}
                                </Text>
                              </View>

                              <View className="flex-row items-center gap-2">
                                <Text
                                  className="font-inter text-[12px] font-semibold"
                                  style={{ color: affinityColor }}
                                >
                                  {affinityIcon}
                                </Text>
                                <Text
                                  className="font-inter text-[11px] font-medium"
                                  style={{ color: colors['muted-foreground'] }}
                                >
                                  {multiplier.toFixed(1)}x
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>

                      {/* Legend */}
                      <View className="mt-4 flex-row flex-wrap items-center gap-3 px-2">
                        <View className="flex-row items-center gap-1">
                          <Text className="font-inter text-[11px]" style={{ color: '#10b981' }}>★</Text>
                          <Text className="font-inter text-[11px]" style={{ color: colors['muted-foreground'] }}>
                            Peak
                          </Text>
                        </View>
                        <Text className="font-inter text-[11px]" style={{ color: colors['muted-foreground'] }}>•</Text>
                        <View className="flex-row items-center gap-1">
                          <Text className="font-inter text-[11px]" style={{ color: '#3b82f6' }}>✦</Text>
                          <Text className="font-inter text-[11px]" style={{ color: colors['muted-foreground'] }}>
                            High
                          </Text>
                        </View>
                        <Text className="font-inter text-[11px]" style={{ color: colors['muted-foreground'] }}>•</Text>
                        <View className="flex-row items-center gap-1">
                          <Text className="font-inter text-[11px]" style={{ color: '#8b5cf6' }}>◆</Text>
                          <Text className="font-inter text-[11px]" style={{ color: colors['muted-foreground'] }}>
                            Good
                          </Text>
                        </View>
                        <Text className="font-inter text-[11px]" style={{ color: colors['muted-foreground'] }}>•</Text>
                        <View className="flex-row items-center gap-1">
                          <Text className="font-inter text-[11px]" style={{ color: '#6b7280' }}>○</Text>
                          <Text className="font-inter text-[11px]" style={{ color: colors['muted-foreground'] }}>
                            Moderate
                          </Text>
                        </View>
                      </View>
                    </ScrollView>
                  </View>
                </TouchableOpacity>
              </TouchableOpacity>
            </BlurView>
          </Modal>
        )}
      </View>
    </Modal>
  );
}
