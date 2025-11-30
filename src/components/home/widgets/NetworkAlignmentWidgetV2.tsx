import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Scale, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { HomeWidgetBase, HomeWidgetConfig } from '../HomeWidgetBase';
import { WidgetHeader } from '@/components/ui/WidgetHeader';
import { useNetworkTierHealth } from '@/modules/insights';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';

const WIDGET_CONFIG: HomeWidgetConfig = {
    id: 'network-alignment',
    type: 'network-alignment',
    title: 'Weave Alignment',
    minHeight: 120,
    fullWidth: true,
};

export const NetworkAlignmentWidgetV2: React.FC = () => {
    const { tokens, typography, spacing } = useTheme();
    const router = useRouter();
    const { networkHealth, isLoading } = useNetworkTierHealth();

    if (isLoading || !networkHealth) {
        return (
            <HomeWidgetBase config={WIDGET_CONFIG} isLoading={true}>
                <View style={{ height: 100 }} />
            </HomeWidgetBase>
        );
    }

    const { healthScore, mismatches, tierHealth } = networkHealth;
    const totalMismatches = mismatches.length;

    const totalMatches =
        tierHealth.InnerCircle.great +
        tierHealth.CloseFriends.great +
        tierHealth.Community.great;

    const totalFriends =
        tierHealth.InnerCircle.total +
        tierHealth.CloseFriends.total +
        tierHealth.Community.total;

    // Determine status color
    let statusColor: string = tokens.destructive;
    let statusLabel = 'Critical';

    if (healthScore >= 8) {
        statusColor = tokens.success;
        statusLabel = 'Thriving';
    } else if (healthScore >= 5) {
        statusColor = tokens.warning;
        statusLabel = 'Needs Attention';
    }

    const handlePress = () => {
        trackEvent(AnalyticsEvents.NETWORK_BALANCE_VIEWED, {
            health_score: healthScore,
            total_mismatches: totalMismatches,
            total_friends: totalFriends,
        });
        router.push('/tier-balance' as any);
    };

    return (
        <HomeWidgetBase config={WIDGET_CONFIG} padding="none">
            <TouchableOpacity
                onPress={handlePress}
                activeOpacity={0.7}
                style={{ padding: 16 }}
            >
                <WidgetHeader
                    title="Weave Alignment"
                    icon={<Scale size={16} color={tokens.primaryMuted} />}
                    action={{
                        label: "Review",
                        onPress: handlePress
                    }}
                />

                <View style={styles.content}>
                    {/* Main Score */}
                    <View style={styles.scoreContainer}>
                        <Text style={[styles.score, {
                            color: statusColor,
                            fontFamily: typography.fonts.serifBold,
                            fontSize: typography.scale.displayLarge.fontSize,
                            lineHeight: typography.scale.displayLarge.lineHeight
                        }]}>
                            {healthScore}
                        </Text>
                        <View>
                            <Text style={[styles.scoreLabel, {
                                color: statusColor,
                                fontFamily: typography.fonts.sansSemiBold,
                                fontSize: typography.scale.body.fontSize,
                                lineHeight: typography.scale.body.lineHeight
                            }]}>
                                {statusLabel}
                            </Text>
                            <Text style={[styles.scoreSub, {
                                color: tokens.foregroundMuted,
                                fontFamily: typography.fonts.sans,
                                fontSize: typography.scale.caption.fontSize,
                                lineHeight: typography.scale.caption.lineHeight
                            }]}>
                                / 10 Health Score
                            </Text>
                        </View>
                    </View>

                    {/* Stats */}
                    <View style={[styles.statsRow, { borderColor: tokens.borderSubtle }]}>
                        <View style={styles.stat}>
                            <View style={styles.statHeader}>
                                <CheckCircle2 size={12} color={tokens.success} />
                                <Text style={[styles.statLabel, {
                                    color: tokens.foregroundMuted,
                                    fontFamily: typography.fonts.sans,
                                    fontSize: typography.scale.caption.fontSize,
                                    lineHeight: typography.scale.caption.lineHeight
                                }]}>
                                    Aligned
                                </Text>
                            </View>
                            <Text style={[styles.statValue, {
                                color: tokens.foreground,
                                fontFamily: typography.fonts.sansSemiBold,
                                fontSize: typography.scale.bodyLarge.fontSize,
                                lineHeight: typography.scale.bodyLarge.lineHeight
                            }]}>
                                {totalMatches}
                            </Text>
                        </View>

                        <View style={[styles.divider, { backgroundColor: tokens.borderSubtle }]} />

                        <View style={styles.stat}>
                            <View style={styles.statHeader}>
                                <AlertCircle size={12} color={tokens.warning} />
                                <Text style={[styles.statLabel, {
                                    color: tokens.foregroundMuted,
                                    fontFamily: typography.fonts.sans,
                                    fontSize: typography.scale.caption.fontSize,
                                    lineHeight: typography.scale.caption.lineHeight
                                }]}>
                                    Drifting
                                </Text>
                            </View>
                            <Text style={[styles.statValue, {
                                color: tokens.foreground,
                                fontFamily: typography.fonts.sansSemiBold,
                                fontSize: typography.scale.bodyLarge.fontSize,
                                lineHeight: typography.scale.bodyLarge.lineHeight
                            }]}>
                                {totalMismatches}
                            </Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        </HomeWidgetBase>
    );
};

const styles = StyleSheet.create({
    content: {
        marginTop: 4,
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    score: {
        // Font size handled by typography.scale.displayLarge in component
    },
    scoreLabel: {
        // Font size handled by typography.scale.body in component
        marginBottom: 2,
    },
    scoreSub: {
        // Font size handled by typography.scale.caption in component
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
    },
    stat: {
        flex: 1,
        gap: 4,
    },
    statHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statLabel: {
        // Font size handled by typography.scale.caption in component
    },
    statValue: {
        // Font size handled by typography.scale.bodyLarge in component
        marginLeft: 18,
    },
    divider: {
        width: 1,
        height: 24,
        marginHorizontal: 16,
    },
});
