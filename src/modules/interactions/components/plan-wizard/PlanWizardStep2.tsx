import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';
import { format } from 'date-fns';
import { useTheme } from '@/shared/hooks/useTheme';
import { type InteractionCategory } from '../types';
import FriendModel from '@/modules/interactions/db/models/Friend';
import { PlanSuggestion } from '@/modules/interactions/hooks/usePlanSuggestion';
import { calculateActivityPriorities, isSmartDefaultsEnabled } from '@/modules/interactions/services/smart-defaults.service';

interface PlanWizardStep2Props {
  selectedCategory?: InteractionCategory;
  onCategorySelect: (category: InteractionCategory) => void;
  onContinue: () => void;
  canContinue: boolean;
  friend: FriendModel;
  suggestion: PlanSuggestion | null;
}

const CATEGORIES: Array<{
  value: InteractionCategory;
  label: string;
  icon: string;
  description: string;
}> = [
  { value: 'text-call', label: 'Chat', icon: '💬', description: 'Call or video chat' },
  { value: 'meal-drink', label: 'Meal', icon: '🍽️', description: 'Coffee, lunch, or dinner' },
  { value: 'hangout', label: 'Hangout', icon: '👥', description: 'Casual time together' },
  { value: 'deep-talk', label: 'Deep Talk', icon: '💭', description: 'Meaningful conversation' },
  { value: 'activity-hobby', label: 'Activity', icon: '🚶', description: 'Sport, hobby, or adventure' },
  { value: 'event-party', label: 'Event', icon: '🎉', description: 'Party or social gathering' },
  { value: 'favor-support', label: 'Support', icon: '🤝', description: 'Help or emotional support' },
  { value: 'celebration', label: 'Celebration', icon: '🎊', description: 'Special occasion' },
];

export function PlanWizardStep2({
  selectedCategory,
  onCategorySelect,
  onContinue,
  canContinue,
  friend,
  suggestion,
}: PlanWizardStep2Props) {
  const { colors } = useTheme();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [orderedCategories, setOrderedCategories] = useState(CATEGORIES);
  const scale = useSharedValue(1);

  // Calculate smart ordering on mount
  useEffect(() => {
    const reorderCategories = async () => {
      try {
        // Check if smart defaults are enabled
        const smartDefaultsEnabled = await isSmartDefaultsEnabled();

        if (!smartDefaultsEnabled) {
          // Use fixed default order for muscle memory
          setOrderedCategories(CATEGORIES);
          return;
        }

        // Calculate smart priorities
        const priorities = await calculateActivityPriorities(friend);

        // Create a map of category to priority score
        const scoreMap = new Map(priorities.map(p => [p.category, p.score]));

        // Sort CATEGORIES by priority score (highest first)
        const sorted = [...CATEGORIES].sort((a, b) => {
          const scoreA = scoreMap.get(a.value) || 0;
          const scoreB = scoreMap.get(b.value) || 0;
          return scoreB - scoreA;
        });

        setOrderedCategories(sorted);
      } catch (error) {
        console.error('Error calculating activity priorities:', error);
        // Keep default order on error
      }
    };

    reorderCategories();
  }, [friend.id]);

  // Create animated style once at the top level
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleUseSuggestion = () => {
    if (suggestion?.suggestedCategory) {
      setSelectedKey(suggestion.suggestedCategory);
      onCategorySelect(suggestion.suggestedCategory);

      // Visual feedback: scale down then advance
      scale.value = withSpring(0.95, { damping: 15 });
      setTimeout(() => {
        scale.value = withSpring(1, { damping: 15 });
        onContinue();
      }, 200);
    }
  };

  const handleCategorySelect = (category: InteractionCategory) => {
    setSelectedKey(category);
    onCategorySelect(category);

    // Visual feedback: scale down then advance
    scale.value = withSpring(0.95, { damping: 15 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 15 });
      onContinue();
    }, 200);
  };

  const getCategoryData = (value: InteractionCategory) => {
    return CATEGORIES.find(c => c.value === value);
  };

  return (
    <View className="px-5 py-6">
      <Text className="font-lora-bold text-2xl mb-2" style={{ color: colors.foreground }}>
        What kind of connection?
      </Text>
      <Text className="font-inter-regular text-base mb-6" style={{ color: colors['muted-foreground'] }}>
        Choose what feels right for this moment
      </Text>

      {/* Suggestion banner */}
      {suggestion && suggestion.confidence !== 'low' && (
        <TouchableOpacity
          onPress={handleUseSuggestion}
          className="p-4 rounded-2xl mb-6 flex-row items-center"
          style={{
            backgroundColor: `${colors.primary}10`,
            borderWidth: selectedCategory === suggestion.suggestedCategory ? 2 : 1,
            borderColor: selectedCategory === suggestion.suggestedCategory ? colors.primary : `${colors.primary}30`,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          <View
            className="w-12 h-12 rounded-full items-center justify-center mr-4"
            style={{ backgroundColor: `${colors.primary}20` }}
          >
            <Sparkles size={20} color={colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="font-inter-semibold text-sm" style={{ color: colors.primary }}>
              💡 Suggested
            </Text>
            {suggestion.suggestedCategory && (
              <Text className="font-inter-semibold text-base mt-1" style={{ color: colors.foreground }}>
                {getCategoryData(suggestion.suggestedCategory)?.icon}{' '}
                {getCategoryData(suggestion.suggestedCategory)?.label}
              </Text>
            )}
            <Text className="font-inter-regular text-sm mt-1" style={{ color: colors['muted-foreground'] }}>
              {suggestion.reason}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* Category grid */}
      <View className="gap-3">
        {orderedCategories.map(category => {
          const isSelected = selectedCategory === category.value;
          const isSuggested = suggestion?.suggestedCategory === category.value;
          const isJustSelected = selectedKey === category.value;

          return (
            <Animated.View
              key={category.value}
              style={isJustSelected ? animatedStyle : {}}
            >
              <TouchableOpacity
                onPress={() => handleCategorySelect(category.value)}
                className="p-4 rounded-xl flex-row items-center"
                style={{
                  backgroundColor: isSelected ? `${colors.primary}15` : colors.card,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? colors.primary : isSuggested ? `${colors.primary}50` : colors.border,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.05,
                  shadowRadius: 8,
                  elevation: 2,
                }}
              >
                <Text className="text-3xl mr-3">{category.icon}</Text>
                <View className="flex-1">
                  <Text
                    className="font-inter-semibold text-base"
                    style={{ color: isSelected ? colors.primary : colors.foreground }}
                  >
                    {category.label}
                  </Text>
                  <Text className="font-inter-regular text-sm" style={{ color: colors['muted-foreground'] }}>
                    {category.description}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
