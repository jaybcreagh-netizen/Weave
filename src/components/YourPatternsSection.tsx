/**
 * YourPatternsSection
 * Shows user's most-used chips and suggests custom chip creation
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { TrendingUp, Plus } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { getMostUsedChips, analyzeCustomNotesForPatterns } from '../lib/adaptive-chips';
import { STORY_CHIPS, type ChipType } from '../lib/story-chips';
import { CustomChipModal } from './CustomChipModal';
import Animated, { FadeIn } from 'react-native-reanimated';

interface YourPatternsSectionProps {
  onCustomChipCreated?: () => void;
}

export function YourPatternsSection({ onCustomChipCreated }: YourPatternsSectionProps) {
  const { colors } = useTheme();
  const [topChips, setTopChips] = useState<Array<{ chipId: string; count: number; isCustom: boolean }>>([]);
  const [suggestion, setSuggestion] = useState<{ text: string; occurrences: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCustomChipModal, setShowCustomChipModal] = useState(false);
  const [suggestedType, setSuggestedType] = useState<ChipType>('feeling');

  useEffect(() => {
    loadPatterns();
  }, []);

  const loadPatterns = async () => {
    setIsLoading(true);
    try {
      const [chips, feelingSuggestion] = await Promise.all([
        getMostUsedChips(6),
        analyzeCustomNotesForPatterns('feeling', 3),
      ]);
      setTopChips(chips);
      setSuggestion(feelingSuggestion);
    } catch (error) {
      console.error('Error loading patterns:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getChipDisplay = (chipId: string, isCustom: boolean) => {
    if (isCustom) {
      return chipId; // Custom chips store text as ID for now
    }
    const chip = STORY_CHIPS.find(c => c.id === chipId);
    return chip?.plainText || chipId;
  };

  const getChipType = (chipId: string, isCustom: boolean): ChipType => {
    if (isCustom) {
      return 'feeling'; // Default for custom chips
    }
    const chip = STORY_CHIPS.find(c => c.id === chipId);
    return chip?.type || 'feeling';
  };

  const handleCreateCustomChip = (text?: string, type?: ChipType) => {
    if (text) {
      setSuggestion({ text, occurrences: 3 });
    }
    if (type) {
      setSuggestedType(type);
    }
    setShowCustomChipModal(true);
  };

  const handleChipCreated = () => {
    loadPatterns();
    onCustomChipCreated?.();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (topChips.length === 0 && !suggestion) {
    return null; // Don't show if no patterns yet
  }

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TrendingUp size={20} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Your Patterns
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => handleCreateCustomChip()}
        >
          <Plus size={16} color={colors.primary} />
          <Text style={[styles.addButtonText, { color: colors.primary }]}>
            Custom Chip
          </Text>
        </TouchableOpacity>
      </View>

      {/* Most used chips */}
      {topChips.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors['muted-foreground'] }]}>
            Your most-used chips:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsScroll}
          >
            {topChips.map((item, index) => (
              <Animated.View
                key={item.chipId}
                entering={FadeIn.duration(300).delay(index * 50)}
              >
                <View
                  style={[
                    styles.patternChip,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: colors.foreground }]}>
                    {getChipDisplay(item.chipId, item.isCustom)}
                  </Text>
                  <View style={[styles.chipBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.chipBadgeText}>{item.count}×</Text>
                  </View>
                </View>
              </Animated.View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Custom chip suggestion */}
      {suggestion && (
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors['muted-foreground'] }]}>
            Create a chip?
          </Text>
          <TouchableOpacity
            style={[
              styles.suggestionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary + '40',
              },
            ]}
            onPress={() => handleCreateCustomChip(suggestion.text, 'feeling')}
          >
            <View style={styles.suggestionContent}>
              <Text style={[styles.suggestionText, { color: colors.foreground }]}>
                "{suggestion.text}"
              </Text>
              <Text style={[styles.suggestionHint, { color: colors['muted-foreground'] }]}>
                You've used this {suggestion.occurrences} times
              </Text>
            </View>
            <Plus size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Custom Chip Modal */}
      <CustomChipModal
        isOpen={showCustomChipModal}
        onClose={() => setShowCustomChipModal(false)}
        suggestedText={suggestion?.text}
        suggestedType={suggestedType}
        onChipCreated={handleChipCreated}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    gap: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipsScroll: {
    gap: 8,
    paddingRight: 16,
  },
  patternChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  chipBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 10,
  },
  chipBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'white',
  },
  suggestionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  suggestionContent: {
    flex: 1,
    gap: 4,
  },
  suggestionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  suggestionHint: {
    fontSize: 12,
    fontWeight: '500',
  },
});
