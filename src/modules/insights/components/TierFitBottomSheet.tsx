// src/modules/insights/components/TierFitBottomSheet.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
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

  const isMismatch = analysis.fitCategory === 'mismatch';
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
    >
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {/* Preliminary Badge for Detail View */}
          {!!analysis.isPreliminary && (
            <View style={[styles.section, { padding: 12, backgroundColor: colors.muted }]}>
              <Text style={{ fontSize: 13, textAlign: 'center', color: colors.foreground }}>
                <Text style={{ fontWeight: '600' }}>Preliminary Result:</Text> Based on only {analysis.interactionCount} interactions. Reliability improves with time.
              </Text>
            </View>
          )}

          {/* Analysis Summary */}
          <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.iconRow}>
              {isMovingDown ? (
                <TrendingDown size={32} color="#F59E0B" />
              ) : (
                <TrendingUp size={32} color="#3B82F6" />
              )}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Your Connection Pattern
            </Text>

            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: colors['muted-foreground'] }]}>
                  Your rhythm
                </Text>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  Every {Math.round(analysis.actualIntervalDays)} days
                </Text>
              </View>

              <View style={styles.statBox}>
                <Text style={[styles.statLabel, { color: colors['muted-foreground'] }]}>
                  {TIER_DISPLAY_NAMES[analysis.currentTier]} expects
                </Text>
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  Every {analysis.expectedIntervalDays} days
                </Text>
              </View>
            </View>

            <View style={[styles.reasonBox, { backgroundColor: colors.muted }]}>
              <Text style={[styles.reasonText, { color: colors.foreground }]}>
                {analysis.reason}
              </Text>
            </View>
          </View>

          {/* Impact Explanation */}
          {isMismatch && (
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.warningBadge, { backgroundColor: '#F59E0B20' }]}>
                <AlertCircle size={20} color="#F59E0B" />
                <Text style={[styles.warningText, { color: '#F59E0B' }]}>
                  This mismatch may cause stress
                </Text>
              </View>

              <Text style={[styles.impactTitle, { color: colors.foreground }]}>
                Why this matters:
              </Text>

              <View style={styles.bulletList}>
                <Text style={[styles.bulletPoint, { color: colors['muted-foreground'] }]}>
                  • {analysis.friendName}'s score keeps dropping despite your care
                </Text>
                <Text style={[styles.bulletPoint, { color: colors['muted-foreground'] }]}>
                  • You feel pressure that doesn't match your actual friendship
                </Text>
                <Text style={[styles.bulletPoint, { color: colors['muted-foreground'] }]}>
                  • The tier expectation isn't aligned with reality
                </Text>
              </View>
            </View>
          )}

          {/* Options */}
          <View style={styles.optionsSection}>
            <Text style={[styles.optionsTitle, { color: colors.foreground }]}>
              What would you like to do?
            </Text>

            {/* Option 1: Change Tier (if suggested) */}
            {hasSuggestion && analysis.suggestedTier && (
              <TouchableOpacity
                style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.primary }]}
                onPress={() => {
                  onChangeTier(analysis.suggestedTier!);
                  onDismiss();
                }}
              >
                <View style={styles.optionHeader}>
                  <Text style={[styles.optionTitle, { color: colors.primary }]}>
                    Move to {TIER_DISPLAY_NAMES[analysis.suggestedTier]}
                  </Text>
                  <Text style={[styles.optionBadge, { color: colors.primary, borderColor: colors.primary }]}>
                    Recommended
                  </Text>
                </View>
                <Text style={[styles.optionDescription, { color: colors['muted-foreground'] }]}>
                  {TIER_DESCRIPTIONS[analysis.suggestedTier]}
                </Text>
                <Text style={[styles.optionBenefit, { color: colors.foreground }]}>
                  ✓ Better fit for your rhythm • Less stress • More honest reflection
                </Text>
              </TouchableOpacity>
            )}

            {/* Option 2: Stay in Current Tier */}
            <TouchableOpacity
              style={[styles.optionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                onStayInTier();
                onDismiss();
              }}
            >
              <Text style={[styles.optionTitle, { color: colors.foreground }]}>
                Stay in {TIER_DISPLAY_NAMES[analysis.currentTier]}
              </Text>
              <Text style={[styles.optionDescription, { color: colors['muted-foreground'] }]}>
                Keep current tier and maintain {isMovingDown ? 'higher' : 'current'} expectations
              </Text>
              <Text style={[styles.optionNote, { color: colors['muted-foreground'] }]}>
                {isMovingDown
                  ? "Your call - they're important to you!"
                  : "You're connecting well - this tier works!"}
              </Text>
            </TouchableOpacity>

            {/* Option 3: Dismiss Suggestion */}
            <TouchableOpacity
              style={[styles.dismissButton]}
              onPress={() => {
                onDismissSuggestion();
                onDismiss();
              }}
            >
              <Text style={[styles.dismissText, { color: colors['muted-foreground'] }]}>
                Don't show this suggestion again
              </Text>
            </TouchableOpacity>
          </View>

          {/* Confidence Indicator */}
          <View style={styles.confidenceSection}>
            <Text style={[styles.confidenceLabel, { color: colors['muted-foreground'] }]}>
              Suggestion confidence: {Math.round(analysis.confidence * 100)}%
            </Text>
            <Text style={[styles.confidenceNote, { color: colors['muted-foreground'] }]}>
              Based on {analysis.interactionCount} interactions
            </Text>
          </View>
      </ScrollView>
    </StandardBottomSheet>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    gap: 20,
  },
  section: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  reasonBox: {
    padding: 16,
    borderRadius: 12,
  },
  reasonText: {
    fontSize: 15,
    lineHeight: 22,
  },
  warningBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  warningText: {
    fontSize: 14,
    fontWeight: '600',
  },
  impactTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  bulletList: {
    gap: 8,
  },
  bulletPoint: {
    fontSize: 14,
    lineHeight: 20,
  },
  optionsSection: {
    gap: 16,
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
  },
  optionCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    gap: 12,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  optionBadge: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  optionDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  optionBenefit: {
    fontSize: 13,
    fontWeight: '500',
  },
  optionNote: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  dismissButton: {
    padding: 12,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
  },
  confidenceSection: {
    alignItems: 'center',
    gap: 4,
    paddingTop: 8,
  },
  confidenceLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  confidenceNote: {
    fontSize: 12,
  },
});
