/**
 * ArchetypeCarouselPicker Component
 *
 * Beautiful native carousel-style archetype picker
 * Swipe through archetypes with smooth animations
 * Premium iOS-feeling design
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Platform,
  Image,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/shared/hooks/useTheme';
import { type Archetype } from './types';
import { archetypeData } from '@/shared/constants/constants';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react-native';
import { useUIStore } from '../stores/uiStore';

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
  const { setArchetypeModal } = useUIStore();

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
      <View style={styles.cardContainer}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: isSelected ? colors.primary : colors.border,
              shadowColor: isSelected ? colors.primary : '#000',
            },
          ]}
        >
          {/* Gradient Background */}
          <LinearGradient
            colors={[...gradient.map(c => c + (isSelected ? 'E6' : '10')), 'transparent'] as any}
            style={styles.gradientBackground}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />

          {/* Tarot Card Section */}
          <View style={styles.iconSection}>
            <View
              style={[
                styles.tarotCardContainer,
                {
                  shadowColor: gradient[0],
                  backgroundColor: colors.card,
                  borderRadius: 12,
                },
              ]}
            >
              <Image
                source={TAROT_CARD_SOURCES[item]}
                style={styles.tarotCardImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <Text style={[styles.archetypeName, { color: colors.foreground }]}>
              {data.name}
            </Text>
            <Text style={[styles.archetypeEssence, { color: gradient[0] }]}>
              {data.essence}
            </Text>
            <Text
              style={[styles.archetypeDescription, { color: colors['muted-foreground'] }]}
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
            style={[
              styles.learnMoreButton,
              { backgroundColor: gradient[0] + '15', borderColor: gradient[0] + '30' },
            ]}
            activeOpacity={0.7}
          >
            <Info size={16} color={gradient[0]} />
            <Text style={[styles.learnMoreText, { color: gradient[0] }]}>
              Learn More
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
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
        contentContainerStyle={styles.flatListContent}
        getItemLayout={(data, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />

      {/* Navigation Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => scrollToIndex(currentIndex - 1)}
          disabled={currentIndex === 0}
          style={[
            styles.navButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: currentIndex === 0 ? 0.3 : 1,
            },
          ]}
          activeOpacity={0.7}
        >
          <ChevronLeft size={24} color={colors.foreground} />
        </TouchableOpacity>

        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {ARCHETYPES.map((archetype, index) => {
            const isActive = index === currentIndex;
            return (
              <TouchableOpacity
                key={archetype}
                onPress={() => scrollToIndex(index)}
                style={[
                  styles.dot,
                  {
                    backgroundColor: isActive ? colors.primary : colors.border,
                    width: isActive ? 24 : 8,
                  },
                ]}
                activeOpacity={0.7}
              />
            );
          })}
        </View>

        <TouchableOpacity
          onPress={() => scrollToIndex(currentIndex + 1)}
          disabled={currentIndex === ARCHETYPES.length - 1}
          style={[
            styles.navButton,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              opacity: currentIndex === ARCHETYPES.length - 1 ? 0.3 : 1,
            },
          ]}
          activeOpacity={0.7}
        >
          <ChevronRight size={24} color={colors.foreground} />
        </TouchableOpacity>
      </View>

      {/* Helper Text */}
      <Text style={[styles.helperText, { color: colors['muted-foreground'] }]}>
        Swipe or tap arrows to browse • Tap "Learn More" for details
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  flatListContent: {
    paddingHorizontal: 40,
  },
  cardContainer: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    borderWidth: 3,
    padding: 24,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    overflow: 'hidden',
  },
  gradientBackground: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  iconSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  tarotCardContainer: {
    width: 120,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  tarotCardImage: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    flex: 1,
    alignItems: 'center',
  },
  archetypeName: {
    fontSize: 28,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  archetypeEssence: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    marginBottom: 16,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  archetypeDescription: {
    fontSize: 15,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  learnMoreText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingHorizontal: 40,
  },
  navButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  helperText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 40,
  },
});
