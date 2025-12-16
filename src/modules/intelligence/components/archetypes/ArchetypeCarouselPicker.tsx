import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/shared/hooks/useTheme';
import { type Archetype } from '@/shared/types/common';
import { archetypeData } from '@/shared/constants/constants';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react-native';
import { useGlobalUI } from '@/shared/context/GlobalUIContext';

// Import assets
import EmperorIcon from '@/assets/TarotIcons/TheEmperor.svg';
import EmpressIcon from '@/assets/TarotIcons/TheEmpress.svg';
import HighPriestessIcon from '@/assets/TarotIcons/HighPriestess.svg';
import FoolIcon from '@/assets/TarotIcons/TheFool.svg';
import SunIcon from '@/assets/TarotIcons/TheSun.svg';
import HermitIcon from '@/assets/TarotIcons/TheHermit.svg';
import MagicianIcon from '@/assets/TarotIcons/TheMagician.svg';
import LoversIcon from '@/assets/TarotIcons/TheLovers.svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 80;
const CARD_HEIGHT = 360;

interface ArchetypeCarouselPickerProps {
  selectedArchetype: Archetype;
  onSelect: (archetype: Archetype) => void;
}

const ARCHETYPES: Archetype[] = [
  'Emperor',
  'Empress',
  'HighPriestess',
  'Fool',
  'Sun',
  'Hermit',
  'Magician',
];

// Map archetypes to their tarot card SVG file paths
const TAROT_CARD_SOURCES: Record<Archetype, any> = {
  Emperor: EmperorIcon,
  Empress: EmpressIcon,
  HighPriestess: HighPriestessIcon,
  Fool: FoolIcon,
  Sun: SunIcon,
  Hermit: HermitIcon,
  Magician: MagicianIcon,
  Lovers: LoversIcon,
  Unknown: null,
};

export function ArchetypeCarouselPicker({
  selectedArchetype,
  onSelect,
}: ArchetypeCarouselPickerProps) {
  const { colors } = useTheme();
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(
    ARCHETYPES.indexOf(selectedArchetype)
  );
  const { setArchetypeModal } = useGlobalUI();

  useEffect(() => {
    const newIndex = ARCHETYPES.indexOf(selectedArchetype);
    if (newIndex !== -1 && newIndex !== currentIndex) {
      setCurrentIndex(newIndex);
      flatListRef.current?.scrollToIndex({ index: newIndex, animated: true });
    }
  }, [selectedArchetype]);

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < ARCHETYPES.length) {
      setCurrentIndex(index);
      onSelect(ARCHETYPES[index]);
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  };

  const scrollToIndex = (index: number) => {
    if (index >= 0 && index < ARCHETYPES.length) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
      setCurrentIndex(index);
      onSelect(ARCHETYPES[index]);
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    }
  };

  const getArchetypeGradient = (archetype: Archetype): string[] => {
    const gradients: Record<Archetype, string[]> = {
      Emperor: ['#ef4444', '#dc2626'],
      Empress: ['#10b981', '#059669'],
      HighPriestess: ['#8b5cf6', '#7c3aed'],
      Fool: ['#f59e0b', '#d97706'],
      Sun: ['#eab308', '#ca8a04'],
      Hermit: ['#6366f1', '#4f46e5'],
      Magician: ['#ec4899', '#db2777'],
      Lovers: ['#fb7185', '#f43f5e'],
      Unknown: ['#9ca3af', '#6b7280'],
    };
    return gradients[archetype] || ['#6b7280', '#4b5563'];
  };

  const renderArchetype = ({ item, index }: { item: Archetype; index: number }) => {
    const data = archetypeData[item];
    if (!data) return null;

    const isSelected = item === selectedArchetype;
    const gradient = getArchetypeGradient(item);

    return (
      <View
        style={{ width: SCREEN_WIDTH }}
        className="items-center justify-center"
      >
        <View
          className="rounded-3xl border-[3px] p-6 overflow-hidden"
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            backgroundColor: colors.card,
            borderColor: isSelected ? colors.primary : colors.border,
            shadowColor: isSelected ? colors.primary : '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          {/* Gradient Background */}
          <LinearGradient
            colors={[...gradient.map(c => c + (isSelected ? 'E6' : '10')), 'transparent'] as any}
            className="absolute inset-0 opacity-50"
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          {/* Tarot Card Section */}
          <View className="items-center mb-5">
            <View
              className="w-[120px] h-[180px] items-center justify-center rounded-xl"
              style={{
                shadowColor: gradient[0],
                backgroundColor: colors.card,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 6,
              }}
            >
              <Image
                source={TAROT_CARD_SOURCES[item]}
                className="w-full h-full"
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Info Section */}
          <View className="flex-1 items-center">
            <Text
              className="text-3xl font-bold font-lora-bold mb-2 text-center"
              style={{ color: colors.foreground }}
            >
              {data.name}
            </Text>
            <Text
              className="text-base font-semibold font-inter-semibold mb-4 text-center uppercase tracking-widest"
              style={{ color: gradient[0] }}
            >
              {data.essence}
            </Text>
            <Text
              className="text-15 leading-6 font-inter-regular text-center px-2"
              style={{ color: colors['muted-foreground'] }}
              numberOfLines={3}
            >
              {data.description}
            </Text>
          </View>

          {/* Learn More Button */}
          <TouchableOpacity
            onPress={() => {
              setArchetypeModal(item);
              if (Platform.OS === 'ios') {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
            className="flex-row items-center justify-center py-3 px-5 rounded-2xl border gap-2"
            style={{
              backgroundColor: gradient[0] + '15',
              borderColor: gradient[0] + '30'
            }}
            activeOpacity={0.7}
          >
            <Info size={16} color={gradient[0]} />
            <Text
              className="text-sm font-semibold font-inter-semibold"
              style={{ color: gradient[0] }}
            >
              Learn More
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View className="my-4">
      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={ARCHETYPES}
        renderItem={renderArchetype}
        keyExtractor={(item) => item}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        snapToInterval={SCREEN_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 40 }}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Navigation Controls */}
      <View className="flex-row items-center justify-between mt-6 px-10">
        <TouchableOpacity
          onPress={() => scrollToIndex(currentIndex - 1)}
          disabled={currentIndex === 0}
          className="w-12 h-12 rounded-full border-2 items-center justify-center"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: currentIndex === 0 ? 0.3 : 1,
          }}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={colors.foreground} />
        </TouchableOpacity>

        {/* Pagination Dots */}
        <View className="flex-row items-center gap-2">
          {ARCHETYPES.map((archetype, index) => {
            const isActive = index === currentIndex;
            return (
              <TouchableOpacity
                key={archetype}
                onPress={() => scrollToIndex(index)}
                className="h-2 rounded-full"
                style={{
                  backgroundColor: isActive ? colors.primary : colors.border,
                  width: isActive ? 24 : 8,
                }}
                activeOpacity={0.7}
              />
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() => scrollToIndex(currentIndex + 1)}
          disabled={currentIndex === ARCHETYPES.length - 1}
          className="w-12 h-12 rounded-full border-2 items-center justify-center"
          style={{
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: currentIndex === ARCHETYPES.length - 1 ? 0.3 : 1,
          }}
          activeOpacity={0.7}
        >
          <ChevronRight size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Helper Text */}
      <Text
        className="text-xs font-inter-regular text-center mt-4 px-10"
        style={{ color: colors['muted-foreground'] }}
      >
        Swipe or tap arrows to browse • Tap "Learn More" for details
      </Text>
    </View>
  );
}
