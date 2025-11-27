// src/components/home/widgets/NetworkBalanceWidget.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Scale, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/useTheme';
import { useNetworkTierHealth } from '@/modules/insights';

/**
 * Dashboard widget showing network-wide tier balance health
 * Shows when there are tier mismatches that need attention
 */
export function NetworkBalanceWidget() {
  const { colors } = useTheme();
  const router = useRouter();
  const { networkHealth, isLoading } = useNetworkTierHealth();

  // Don't show if loading or no data
  if (isLoading || !networkHealth) {
    return null;
  }

  // Only show if there are mismatches (health score < 8)
  const hasMismatches = networkHealth.healthScore < 8 && networkHealth.mismatches.length > 0;

  if (!hasMismatches) {
    return null;
  }

  const totalMismatches = networkHealth.mismatches.length;
  const topSuggestions = networkHealth.suggestions.slice(0, 3);

  // Health score color
  const getHealthColor = (score: number) => {
    if (score >= 8) return '#10B981'; // green
    if (score >= 5) return '#F59E0B'; // amber
    return '#EF4444'; // red
  };

  const healthColor = getHealthColor(networkHealth.healthScore);

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push('/tier-balance' as any)}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Scale size={20} color={colors.primary} />
          <Text style={[styles.title, { color: colors.foreground }]}>
            Network Balance
          </Text>
        </View>
        <ChevronRight size={20} color={colors['muted-foreground']} />
      </View>

      {/* Health Score */}
      <View style={styles.healthRow}>
        <View style={styles.healthBarContainer}>
          <View style={[styles.healthBarFill, { width: `${networkHealth.healthScore * 10}%`, backgroundColor: healthColor }]} />
        </View>
        <Text style={[styles.healthScore, { color: healthColor }]}>
          {networkHealth.healthScore}/10
        </Text>
      </View>

      {/* Summary */}
      <View style={styles.summaryRow}>
        <View style={[styles.badge, { backgroundColor: '#10B98120' }]}>
          <Text style={[styles.badgeText, { color: '#10B981' }]}>
            ✓ {networkHealth.tierHealth.InnerCircle.great + networkHealth.tierHealth.CloseFriends.great + networkHealth.tierHealth.Community.great} match their tier
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: '#F59E0B20' }]}>
          <Text style={[styles.badgeText, { color: '#F59E0B' }]}>
            ⚠️ {totalMismatches} need adjustment
          </Text>
        </View>
      </View>

      {/* Top Suggestions */}
      {topSuggestions.length > 0 && (
        <View style={styles.suggestionsSection}>
          <Text style={[styles.suggestionsLabel, { color: colors['muted-foreground'] }]}>
            Top suggestions:
          </Text>
          {topSuggestions.map((suggestion, index) => (
            <View key={suggestion.friendId} style={styles.suggestionItem}>
              <Text style={[styles.suggestionText, { color: colors.foreground }]} numberOfLines={1}>
                • {suggestion.friendName}: {getTierShortName(suggestion.currentTier)} → {getTierShortName(suggestion.suggestedTier!)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* CTA */}
      <View style={[styles.ctaRow, { borderTopColor: colors.border }]}>
        <Text style={[styles.ctaText, { color: colors.primary }]}>
          Review Balance
        </Text>
        <ChevronRight size={16} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
}

function getTierShortName(tier: string): string {
  if (tier === 'InnerCircle') return 'Inner';
  if (tier === 'CloseFriends') return 'Close';
  return 'Community';
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 16,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
  },
  healthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  healthBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  healthBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  healthScore: {
    fontSize: 16,
    fontWeight: '700',
    minWidth: 44,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  suggestionsSection: {
    gap: 6,
  },
  suggestionsLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 14,
    flex: 1,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
