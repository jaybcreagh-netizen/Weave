/**
 * YourPatternsSection
 * Shows user's most-used chips and suggests custom chip creation
 */

import React, { useState, useEffect } from 'react';
import { View, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { getMostUsedChips, analyzeCustomNotesForPatterns } from '@/modules/reflection';
import { STORY_CHIPS, type ChipType } from '@/modules/reflection';
import { CustomChipModal } from '@/modules/reflection';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { Card } from '@/shared/ui/Card';

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
      setSuggestion(feelingSuggestion ? { text: feelingSuggestion.suggestedText, occurrences: feelingSuggestion.occurrences } : null);
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
      <View className="p-5 items-center">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (topChips.length === 0 && !suggestion) {
    return null; // Don't show if no patterns yet
  }

  return (
    <Animated.View entering={FadeIn.duration(400)} className="gap-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Icon name="TrendingUp" size={20} color={colors.primary} />
          <Text variant="h3" weight="bold">
            Your Patterns
          </Text>
        </View>
        <Button
          variant="outline"
          size="sm"
          onPress={() => handleCreateCustomChip()}
          className="flex-row items-center gap-1.5 px-3 py-2 rounded-lg bg-card border-border"
        >
          <Icon name="Plus" size={16} color={colors.primary} />
          <Text variant="button" className="text-primary text-xs font-semibold">
            Custom Chip
          </Text>
        </Button>
      </View>

      {/* Most used chips */}
      {topChips.length > 0 && (
        <View className="gap-3">
          <Text className="text-muted-foreground text-xs font-semibold">
            Your most-used chips:
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 pr-4"
          >
            {topChips.map((item, index) => (
              <Animated.View
                key={item.chipId}
                entering={FadeIn.duration(300).delay(index * 50)}
              >
                <View
                  className="flex-row items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-border bg-card"
                >
                  <Text variant="body" weight="medium">
                    {getChipDisplay(item.chipId, item.isCustom)}
                  </Text>
                  <View className="px-1.5 py-0.5 rounded-lg bg-primary">
                    <Text className="text-[11px] font-bold text-white">{item.count}×</Text>
                  </View>
                </View>
              </Animated.View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Custom chip suggestion */}
      {suggestion && (
        <View className="gap-3">
          <Text className="text-muted-foreground text-xs font-semibold">
            Create a chip?
          </Text>
          <TouchableOpacity
            onPress={() => handleCreateCustomChip(suggestion.text, 'feeling')}
            activeOpacity={0.7}
          >
            <Card
              variant="outlined"
              className="flex-row items-center justify-between p-4 border-primary/40 bg-card"
            >
              <View className="flex-1 gap-1">
                <Text variant="body" weight="semibold">
                  "{suggestion.text}"
                </Text>
                <Text variant="caption" className="text-muted-foreground">
                  You've used this {suggestion.occurrences} times
                </Text>
              </View>
              <Icon name="Plus" size={20} color={colors.primary} />
            </Card>
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
