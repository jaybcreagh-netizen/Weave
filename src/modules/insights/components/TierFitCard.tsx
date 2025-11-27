// src/modules/insights/components/TierFitCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { AlertCircle, CheckCircle, TrendingUp } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useTierFit } from '../hooks/useTierFit';
import { getTierFitSummary } from '../services/tier-fit.service';

interface TierFitCardProps {
  friendId: string;
  onPress?: () => void;
}

/**
 * Card component showing tier fit information for a friend
 * Shows whether their interaction pattern matches their assigned tier
 */
export function TierFitCard({ friendId, onPress }: TierFitCardProps) {
  const { colors } = useTheme();
  const { analysis, isLoading, shouldShow } = useTierFit(friendId);

  // Don't render if loading or no analysis
  if (isLoading || !analysis) {
    return null;
  }

  // Don't render if insufficient data or if suggestion was dismissed
  if (analysis.fitCategory === 'insufficient_data' || !shouldShow) {
    return null;
  }

  // Only show for mismatches or good fits (not great fits - those don't need attention)
  if (analysis.fitCategory === 'great') {
    return null;
  }

  // Determine card style based on fit category
  const isMismatch = analysis.fitCategory === 'mismatch';
  const hassuggestion = analysis.suggestedTier !== undefined;

  // Icon based on fit category
  const Icon = isMismatch ? AlertCircle : analysis.actualIntervalDays < analysis.expectedIntervalDays ? TrendingUp : CheckCircle;
  const iconColor = isMismatch ? '#F59E0B' : analysis.actualIntervalDays < analysis.expectedIntervalDays ? '#3B82F6' : '#10B981';

  const summary = getTierFitSummary(analysis);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderColor: isMismatch ? '#F59E0B20' : colors.border,
          borderLeftColor: isMismatch ? '#F59E0B' : colors.border,
        }
      ]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Icon size={20} color={iconColor} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Tier Insights
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={[styles.summary, { color: colors['muted-foreground'] }]}>
          {summary}
        </Text>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors['muted-foreground'] }]}>
              Your rhythm
            </Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              Every {Math.round(analysis.actualIntervalDays)} days
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={[styles.statLabel, { color: colors['muted-foreground'] }]}>
              Tier expects
            </Text>
            <Text style={[styles.statValue, { color: colors.foreground }]}>
              Every {analysis.expectedIntervalDays} days
            </Text>
          </View>
        </View>

        {isMismatch && hassuggestion && (
          <View style={[styles.suggestionBanner, { backgroundColor: '#F59E0B10' }]}>
            <Text style={[styles.suggestionText, { color: '#F59E0B' }]}>
              ⚠️ This mismatch may cause stress
            </Text>
          </View>
        )}

        {onPress && (
          <View style={styles.actionRow}>
            <Text style={[styles.actionText, { color: colors.primary }]}>
              {isMismatch ? 'Review Tier Fit →' : 'View Details →'}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    padding: 16,
    marginVertical: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    marginRight: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
  },
  content: {
    gap: 12,
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
  },
  stats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '500',
  },
  suggestionBanner: {
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  suggestionText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  actionRow: {
    marginTop: 4,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
