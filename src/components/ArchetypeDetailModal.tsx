import React from 'react';
import { View, Text, Modal, TouchableOpacity } from 'react-native';
import { useUIStore } from '../stores/uiStore';
import { useTheme } from '../hooks/useTheme';
import { X } from 'lucide-react-native';
import { type Archetype } from './types';
import { archetypeData } from '../lib/constants';
import { ArchetypeIcon } from './ArchetypeIcon';
import { BlurView } from 'expo-blur';

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
                className="w-20 h-20 rounded-2xl border-2 items-center justify-center mb-4 mt-2"
                style={{
                  backgroundColor: colors.primary + '15',
                  borderColor: colors.primary,
                }}
              >
                <ArchetypeIcon archetype={archetypeModal} size={48} color={colors.primary} />
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