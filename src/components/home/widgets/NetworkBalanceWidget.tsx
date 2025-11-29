// src/components/home/widgets/NetworkBalanceWidget.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Scale, ChevronRight, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/shared/hooks/useTheme';
import { useNetworkTierHealth } from '@/modules/insights';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';

/**
 * Dashboard widget showing network-wide tier balance health
 * Shows when there are tier mismatches that need attention
 */
export function NetworkBalanceWidget() {
  const { colors, isDarkMode } = useTheme();
  const router = useRouter();
  const { networkHealth, isLoading } = useNetworkTierHealth();

  // Don't show if loading or no data
  if (isLoading || !networkHealth) {
    return null;
  }

  // Only show if there are mismatches (health score < 8)
  // const hasMismatches = networkHealth.healthScore < 8 && networkHealth.mismatches.length > 0;

  // if (!hasMismatches) {
  //   return null;
  // }

  const totalMismatches = networkHealth.mismatches.length;
  const topSuggestions = networkHealth.suggestions.slice(0, 3);

  const totalMatches =
    networkHealth.tierHealth.InnerCircle.great +
    networkHealth.tierHealth.CloseFriends.great +
    networkHealth.tierHealth.Community.great;

  const totalFriends =
    networkHealth.tierHealth.InnerCircle.total +
    networkHealth.tierHealth.CloseFriends.total +
    networkHealth.tierHealth.Community.total;

  // Health score color & gradient
  const getHealthConfig = (score: number) => {
    if (score >= 8) return {
      color: '#10B981',
      label: 'Thriving',
      gradient: isDarkMode
        ? ['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.05)']
        : ['#ECFDF5', '#F0FDF4']
    };
    if (score >= 5) return {
      color: '#F59E0B',
      label: 'Needs Attention',
      gradient: isDarkMode
        ? ['rgba(245, 158, 11, 0.15)', 'rgba(245, 158, 11, 0.05)']
        : ['#FFFBEB', '#FFF7ED']
    };
    return {
      color: '#EF4444',
      label: 'Critical',
      gradient: isDarkMode
        ? ['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.05)']
        : ['#FEF2F2', '#FFF1F2']
    };
  };

  const healthConfig = getHealthConfig(networkHealth.healthScore);

  const handlePress = () => {
    trackEvent(AnalyticsEvents.NETWORK_BALANCE_VIEWED, {
      health_score: networkHealth.healthScore,
      total_mismatches: totalMismatches,
      total_friends: totalFriends,
    });
    router.push('/tier-balance' as any);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.9}
      style={[styles.containerShadow]}
    >
      <LinearGradient
        colors={healthConfig.gradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.container, { borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.iconContainer, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'white' }]}>
              <Scale size={18} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Weave Alignment
            </Text>
          </View>
          <ChevronRight size={20} color={colors['muted-foreground']} />
        </View>

        {/* Score Section */}
        <View style={styles.scoreSection}>
          <View style={styles.scoreRow}>
            <Text style={[styles.scoreValue, { color: healthConfig.color }]}>
              {networkHealth.healthScore}
            </Text>
            <View style={styles.scoreContext}>
              <Text style={[styles.scoreLabel, { color: healthConfig.color }]}>
                {healthConfig.label}
              </Text>
              <Text style={[styles.scoreSubtext, { color: colors['muted-foreground'] }]}>
                / 10 Health Score
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarTrack,
                { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
              ]}
            >
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${networkHealth.healthScore * 10}%`,
                    backgroundColor: healthConfig.color
                  }
                ]}
              />
            </View>
          </View>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={[styles.statItem, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)' }]}>
            <View style={styles.statHeader}>
              <CheckCircle2 size={14} color="#10B981" />
              <Text style={[styles.statLabel, { color: colors['muted-foreground'] }]}>Aligned</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{totalMatches}</Text>
          </View>

          <View style={[styles.statItem, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)' }]}>
            <View style={styles.statHeader}>
              <AlertCircle size={14} color="#F59E0B" />
              <Text style={[styles.statLabel, { color: colors['muted-foreground'] }]}>Drifting</Text>
            </View>
            <Text style={[styles.statValue, { color: colors.foreground }]}>{totalMismatches}</Text>
          </View>
        </View>

        {/* Top Suggestions */}
        {topSuggestions.length > 0 && (
          <View style={styles.suggestionsSection}>
            <Text style={[styles.suggestionsHeader, { color: colors['muted-foreground'] }]}>
              Suggested Adjustments
            </Text>
            <View style={styles.suggestionsList}>
              {topSuggestions.map((suggestion, index) => (
                <View
                  key={suggestion.friendId}
                  style={[
                    styles.suggestionRow,
                    index !== topSuggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }
                  ]}
                >
                  <Text style={[styles.friendName, { color: colors.foreground }]} numberOfLines={1}>
                    {suggestion.friendName}
                  </Text>

                  <View style={styles.tierChangeContainer}>
                    <View style={[styles.tierBadge, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                      <Text style={[styles.tierBadgeText, { color: colors['muted-foreground'] }]}>
                        {getTierShortName(suggestion.currentTier)}
                      </Text>
                    </View>

                    <ArrowRight size={12} color={colors['muted-foreground']} style={{ marginHorizontal: 4 }} />

                    <View style={[styles.tierBadge, { backgroundColor: healthConfig.color + '20' }]}>
                      <Text style={[styles.tierBadgeText, { color: healthConfig.color }]}>
                        {getTierShortName(suggestion.suggestedTier!)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer CTA */}
        <View style={[styles.footer, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
          <Text style={[styles.footerText, { color: colors.primary }]}>
            Review Network Health
          </Text>
          <ChevronRight size={16} color={colors.primary} />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

function getTierShortName(tier: string): string {
  if (tier === 'InnerCircle') return 'Inner';
  if (tier === 'CloseFriends') return 'Close';
  return 'Community';
}

const styles = StyleSheet.create({
  containerShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 16,
  },
  container: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    fontFamily: 'Lora_700Bold',
  },
  scoreSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
    gap: 12,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
    lineHeight: 36,
  },
  scoreContext: {
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  scoreSubtext: {
    fontSize: 12,
  },
  progressBarContainer: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarTrack: {
    flex: 1,
    borderRadius: 3,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Lora_700Bold',
  },
  suggestionsSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  suggestionsHeader: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  suggestionsList: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  friendName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  tierChangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tierBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
