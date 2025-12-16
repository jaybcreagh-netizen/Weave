// src/modules/insights/components/TierSuggestionAlert.tsx
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Lightbulb, X } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import type { TierSuggestionContext } from '../services/tier-suggestion-engine.service';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';

interface TierSuggestionAlertProps {
  suggestion: TierSuggestionContext;
  onReview: () => void;
  onDismiss: () => void;
}

const TIER_DISPLAY_NAMES: Record<string, string> = {
  InnerCircle: 'Inner Circle',
  CloseFriends: 'Close Friends',
  Community: 'Community'
};

/**
 * Inline alert component for tier suggestions
 * Shows after interactions when pattern is established
 */
export function TierSuggestionAlert({
  suggestion,
  onReview,
  onDismiss
}: TierSuggestionAlertProps) {
  const { colors } = useTheme();

  const { analysis, urgency, message, trigger } = suggestion;

  const bgColor = urgency === 'high' ? '#F59E0B20' : '#3B82F620';
  const textColor = urgency === 'high' ? '#F59E0B' : '#3B82F6';

  // Track when suggestion is shown
  useEffect(() => {
    trackEvent(AnalyticsEvents.TIER_SUGGESTION_SHOWN, {
      friend_id: analysis.friendId,
      friend_name: analysis.friendName,
      current_tier: analysis.currentTier,
      suggested_tier: analysis.suggestedTier,
      trigger,
      urgency,
      confidence: analysis.confidence,
    });
  }, [analysis.friendId, analysis.currentTier, analysis.suggestedTier, trigger, urgency, analysis.confidence, analysis.friendName]);

  return (
    <View
      className="flex-row rounded-xl border p-4 gap-3 my-2"
      style={{
        backgroundColor: bgColor,
        borderColor: textColor + '40'
      }}
    >
      <View className="pt-0.5">
        <Lightbulb size={24} color={textColor} />
      </View>

      <View className="flex-1 gap-2">
        <Text
          className="text-[15px] font-lora-bold font-semibold"
          style={{ color: colors.foreground }}
        >
          Tier Insight
        </Text>

        <Text
          className="text-sm leading-5"
          style={{ color: colors['muted-foreground'] }}
        >
          {message}
        </Text>

        <Text
          className="text-sm font-medium"
          style={{ color: colors.foreground }}
        >
          Consider moving to {TIER_DISPLAY_NAMES[analysis.suggestedTier || '']}
        </Text>

        <View className="flex-row gap-2 mt-1">
          <TouchableOpacity
            className="py-2 px-4 rounded-lg"
            style={{ backgroundColor: textColor }}
            onPress={onReview}
            activeOpacity={0.7}
          >
            <Text className="text-sm font-semibold text-white">
              Review Fit
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="py-2 px-4 rounded-lg border"
            style={{ borderColor: colors.border }}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text
              className="text-sm font-medium"
              style={{ color: colors['muted-foreground'] }}
            >
              Later
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        className="p-1"
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={18} color={colors['muted-foreground']} />
      </TouchableOpacity>
    </View>
  );
}
