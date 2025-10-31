import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Sparkles } from 'lucide-react-native';
import { format } from 'date-fns';
import { useTheme } from '../../hooks/useTheme';
import { type InteractionCategory } from '../types';
import FriendModel from '../../db/models/Friend';
import { PlanSuggestion } from '../../hooks/usePlanSuggestion';

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

  const handleUseSuggestion = () => {
    if (suggestion?.suggestedCategory) {
      onCategorySelect(suggestion.suggestedCategory);
    }
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
      <View className="gap-3 mb-6">
        {CATEGORIES.map(category => {
          const isSelected = selectedCategory === category.value;
          const isSuggested = suggestion?.suggestedCategory === category.value;

          return (
            <TouchableOpacity
              key={category.value}
              onPress={() => onCategorySelect(category.value)}
              className="p-4 rounded-xl flex-row items-center"
              style={{
                backgroundColor: isSelected ? `${colors.primary}15` : colors.muted,
                borderWidth: isSelected ? 2 : isSuggested ? 1 : 0,
                borderColor: isSelected ? colors.primary : isSuggested ? `${colors.primary}50` : 'transparent',
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
          );
        })}
      </View>

      {/* Continue button */}
      <TouchableOpacity
        onPress={onContinue}
        disabled={!canContinue}
        className="py-4 rounded-full items-center"
        style={{
          backgroundColor: canContinue ? colors.primary : colors.muted,
          opacity: canContinue ? 1 : 0.5,
        }}
      >
        <Text className="font-inter-semibold text-base text-white">Continue</Text>
      </TouchableOpacity>
    </View>
  );
}
