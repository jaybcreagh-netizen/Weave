import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { useUIStore } from '../stores/uiStore';
import { useTheme } from '../hooks/useTheme';
import { X } from 'lucide-react-native';
import { type Archetype } from './types';
import { archetypeData } from '../lib/constants';
import { BlurView } from 'expo-blur';

// Import SVG files as components
import EmperorSvg from '../../assets/TarotIcons/The Emperor.svg';
import EmpressSvg from '../../assets/TarotIcons/The Empress.svg';
import HighPriestessSvg from '../../assets/TarotIcons/High Priestess.svg';
import FoolSvg from '../../assets/TarotIcons/The Fool.svg';
import SunSvg from '../../assets/TarotIcons/The Sun.svg';
import HermitSvg from '../../assets/TarotIcons/The Hermit.svg';
import MagicianSvg from '../../assets/TarotIcons/The Magician.svg';

// Map archetypes to their tarot card SVG components
const TAROT_CARD_COMPONENTS: Record<Archetype, React.FC<any>> = {
  Emperor: EmperorSvg,
  Empress: EmpressSvg,
  HighPriestess: HighPriestessSvg,
  Fool: FoolSvg,
  Sun: SunSvg,
  Hermit: HermitSvg,
  Magician: MagicianSvg,
};

export function ArchetypeDetailModal() {
  const { archetypeModal, setArchetypeModal } = useUIStore();
  const { colors, isDarkMode } = useTheme();

  if (!archetypeModal) {
    return null;
  }

  const data = archetypeData[archetypeModal];

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={!!archetypeModal}
      onRequestClose={() => setArchetypeModal(null)}
    >
      <BlurView intensity={90} className="flex-1 justify-center items-center" tint={isDarkMode ? 'dark' : 'light'}>
        <TouchableOpacity
          className="flex-1 justify-center items-center w-full"
          activeOpacity={1}
          onPress={() => setArchetypeModal(null)}
        >
          <TouchableOpacity activeOpacity={1} className="w-[85%] max-w-[400px]">
            <View
              className="w-full rounded-3xl p-6 items-center"
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
                className="font-inter-medium text-[15px] mb-5 text-center italic"
                style={{ color: colors['muted-foreground'] }}
              >
                {data.essence}
              </Text>

              <View
                className="h-[1px] w-full my-5"
                style={{ backgroundColor: colors.border }}
              />

              <Text
                className="font-inter-semibold text-[17px] mb-3"
                style={{ color: colors.foreground }}
              >
                Best Way to Connect
              </Text>

              <Text
                className="font-inter-regular text-[15px] text-center leading-[22px]"
                style={{ color: colors['muted-foreground'] }}
              >
                {data.careStyle}
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </BlurView>
    </Modal>
  );
}