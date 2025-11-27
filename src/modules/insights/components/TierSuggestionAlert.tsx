// src/modules/insights/components/TierSuggestionAlert.tsx
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
    <View style={[styles.container, { backgroundColor: bgColor, borderColor: textColor + '40' }]}>
      <View style={styles.iconContainer}>
        <Lightbulb size={24} color={textColor} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Tier Insight
        </Text>

        <Text style={[styles.message, { color: colors['muted-foreground'] }]}>
          {message}
        </Text>

        <Text style={[styles.suggestion, { color: colors.foreground }]}>
          Consider moving to {TIER_DISPLAY_NAMES[analysis.suggestedTier || '']}
        </Text>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.reviewButton, { backgroundColor: textColor }]}
            onPress={onReview}
            activeOpacity={0.7}
          >
            <Text style={[styles.reviewButtonText, { color: 'white' }]}>
              Review Fit
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.dismissButton, { borderColor: colors.border }]}
            onPress={onDismiss}
            activeOpacity={0.7}
          >
            <Text style={[styles.dismissButtonText, { color: colors['muted-foreground'] }]}>
              Later
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={styles.closeButton}
        onPress={onDismiss}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={18} color={colors['muted-foreground']} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
    marginVertical: 8,
  },
  iconContainer: {
    paddingTop: 2,
  },
  content: {
    flex: 1,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
  },
  suggestion: {
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  reviewButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  reviewButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  dismissButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  dismissButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
  },
});
