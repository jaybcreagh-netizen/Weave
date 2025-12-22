// src/modules/insights/components/TierFitBottomSheet.tsx
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import type { TierFitAnalysis } from '../types';
import type { Tier } from '@/shared/types/core';

interface TierFitBottomSheetProps {
  visible: boolean;
  analysis: TierFitAnalysis;
  onDismiss: () => void;
  onChangeTier: (newTier: Tier) => void;
  onStayInTier: () => void;
  onDismissSuggestion: () => void;
}

const TIER_DISPLAY_NAMES: Record<Tier, string> = {
  InnerCircle: 'Inner Circle',
  CloseFriends: 'Close Friends',
  Community: 'Community'
};

const TIER_DESCRIPTIONS: Record<Tier, string> = {
  InnerCircle: 'Your closest bonds - typically 3-5 people you connect with weekly',
  CloseFriends: 'Important ongoing relationships - typically 10-15 people you see bi-weekly',
  Community: 'Meaningful connections - typically 30-50 people you connect with monthly'
};

/**
 * Bottom sheet that shows detailed tier fit analysis and options
 */
export function TierFitBottomSheet({
  visible,
  analysis,
  onDismiss,
  onChangeTier,
  onStayInTier,
  onDismissSuggestion
}: TierFitBottomSheetProps) {
  const { colors } = useTheme();

  const scrollRef = React.useRef<ScrollView>(null);

  const isMismatch = analysis.fitCategory === 'over_investing' || analysis.fitCategory === 'under_investing';
  const hasSuggestion = analysis.suggestedTier !== undefined;
  const isMovingDown = hasSuggestion &&
    (analysis.currentTier === 'InnerCircle' && analysis.suggestedTier === 'CloseFriends') ||
    (analysis.currentTier === 'CloseFriends' && analysis.suggestedTier === 'Community');

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onDismiss}
      height="full"
      title={`Tier Fit for ${analysis.friendName}`}
      scrollable
      scrollRef={scrollRef}
    >
      <View className="flex-1 p-5 gap-5">
        {/* Preliminary Badge for Detail View */}
        {!!analysis.isPreliminary && (
          <View
            className="rounded-2xl border p-5 gap-4"
            style={{ padding: 12, backgroundColor: colors.muted, borderWidth: 1 }}
          >
            <Text
              className="text-[13px] text-center"
              style={{ color: colors.foreground }}
            >
              <Text className="font-semibold">Preliminary Result:</Text> Based on only {analysis.interactionCount} interactions. Reliability improves with time.
            </Text>
          </View>
        )}

        {/* Analysis Summary */}
        <View
          className="rounded-2xl border p-5 gap-4"
          style={{ backgroundColor: colors.card, borderColor: colors.border }}
        >
          <View className="items-center mb-2">
            {isMovingDown ? (
              <TrendingDown size={32} color="#F59E0B" />
            ) : (
              <TrendingUp size={32} color="#3B82F6" />
            )}
          </View>

          <Text
            className="text-lg font-lora-bold text-center"
            style={{ color: colors.foreground }}
          >
            Your Connection Pattern
          </Text>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-1">
              <Text
                className="text-xs"
                style={{ color: colors['muted-foreground'] }}
              >
                Your rhythm
              </Text>
              <Text
                className="text-base font-semibold"
                style={{ color: colors.foreground }}
              >
                Every {Math.round(analysis.actualIntervalDays)} days
              </Text>
            </View>

            <View className="flex-1 gap-1">
              <Text
                className="text-xs"
                style={{ color: colors['muted-foreground'] }}
              >
                {TIER_DISPLAY_NAMES[analysis.currentTier]} expects
              </Text>
              <Text
                className="text-base font-semibold"
                style={{ color: colors.foreground }}
              >
                Every {analysis.expectedIntervalDays} days
              </Text>
            </View>
          </View>

          <View
            className="p-4 rounded-xl"
            style={{ backgroundColor: colors.muted }}
          >
            <Text
              className="text-[15px] leading-[22px]"
              style={{ color: colors.foreground }}
            >
              {analysis.reason}
            </Text>
          </View>
        </View>

        {/* Impact Explanation */}
        {isMismatch && (
          <View
            className="rounded-2xl border p-5 gap-4"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
          >
            <View
              className="flex-row items-center gap-2 p-3 rounded-lg"
              style={{ backgroundColor: '#F59E0B20' }}
            >
              <AlertCircle size={20} color="#F59E0B" />
              <Text
                className="text-sm font-semibold"
                style={{ color: '#F59E0B' }}
              >
                This mismatch may cause stress
              </Text>
            </View>

            <Text
              className="text-base font-semibold mt-2"
              style={{ color: colors.foreground }}
            >
              Why this matters:
            </Text>

            <View className="gap-2">
              <Text
                className="text-sm leading-5"
                style={{ color: colors['muted-foreground'] }}
              >
                • {analysis.friendName}'s score keeps dropping despite your care
              </Text>
              <Text
                className="text-sm leading-5"
                style={{ color: colors['muted-foreground'] }}
              >
                • You feel pressure that doesn't match your actual friendship
              </Text>
              <Text
                className="text-sm leading-5"
                style={{ color: colors['muted-foreground'] }}
              >
                • The tier expectation isn't aligned with reality
              </Text>
            </View>
          </View>
        )}

        {/* Options */}
        <View className="gap-4">
          <Text
            className="text-lg font-lora-bold"
            style={{ color: colors.foreground }}
          >
            What would you like to do?
          </Text>

          {/* Option 1: Change Tier (if suggested) */}
          {hasSuggestion && analysis.suggestedTier && (
            <TouchableOpacity
              className="rounded-xl border-2 p-4 gap-3"
              style={{ backgroundColor: colors.card, borderColor: colors.primary }}
              onPress={() => {
                onChangeTier(analysis.suggestedTier!);
                onDismiss();
              }}
            >
              <View className="flex-row justify-between items-center">
                <Text
                  className="text-base font-semibold flex-1"
                  style={{ color: colors.primary }}
                >
                  Move to {TIER_DISPLAY_NAMES[analysis.suggestedTier]}
                </Text>
                <Text
                  className="text-xs font-semibold px-2 py-1 rounded-md border"
                  style={{ color: colors.primary, borderColor: colors.primary }}
                >
                  Recommended
                </Text>
              </View>
              <Text
                className="text-sm leading-5"
                style={{ color: colors['muted-foreground'] }}
              >
                {TIER_DESCRIPTIONS[analysis.suggestedTier]}
              </Text>
              <Text
                className="text-[13px] font-medium"
                style={{ color: colors.foreground }}
              >
                ✓ Better fit for your rhythm • Less stress • More honest reflection
              </Text>
            </TouchableOpacity>
          )}

          {/* Option 2: Stay in Current Tier */}
          <TouchableOpacity
            className="rounded-xl border-2 p-4 gap-3"
            style={{ backgroundColor: colors.card, borderColor: colors.border }}
            onPress={() => {
              onStayInTier();
              onDismiss();
            }}
          >
            <Text
              className="text-base font-semibold"
              style={{ color: colors.foreground }}
            >
              Stay in {TIER_DISPLAY_NAMES[analysis.currentTier]}
            </Text>
            <Text
              className="text-sm leading-5"
              style={{ color: colors['muted-foreground'] }}
            >
              Keep current tier and maintain {isMovingDown ? 'higher' : 'current'} expectations
            </Text>
            <Text
              className="text-[13px] italic"
              style={{ color: colors['muted-foreground'] }}
            >
              {isMovingDown
                ? "Your call - they're important to you!"
                : "You're connecting well - this tier works!"}
            </Text>
          </TouchableOpacity>

          {/* Option 3: Dismiss Suggestion */}
          <TouchableOpacity
            className="p-3 items-center"
            onPress={() => {
              onDismissSuggestion();
              onDismiss();
            }}
          >
            <Text
              className="text-sm"
              style={{ color: colors['muted-foreground'] }}
            >
              Don't show this suggestion again
            </Text>
          </TouchableOpacity>
        </View>

        {/* Confidence Indicator */}
        <View className="items-center gap-1 pt-2">
          <Text
            className="text-[13px] font-medium"
            style={{ color: colors['muted-foreground'] }}
          >
            Suggestion confidence: {Math.round(analysis.confidence * 100)}%
          </Text>
          <Text
            className="text-xs"
            style={{ color: colors['muted-foreground'] }}
          >
            Based on {analysis.interactionCount} interactions
          </Text>
        </View>
      </View>
    </StandardBottomSheet>
  );
}
