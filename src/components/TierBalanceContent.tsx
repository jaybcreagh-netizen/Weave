import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { AlertCircle, CheckCircle, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useNetworkTierHealth, TierFitBottomSheet } from '@/modules/insights';
import type { Tier } from '@/shared/types/core';
import type { TierFitAnalysis } from '@/modules/insights/types';
import { changeFriendTier, dismissTierSuggestion } from '@/modules/insights/services/tier-management.service';
import { useUIStore } from '@/stores/uiStore';

const TIER_DISPLAY_NAMES: Record<Tier, string> = {
    InnerCircle: 'Inner Circle',
    CloseFriends: 'Close Friends',
    Community: 'Community',
};

export const TierBalanceContent: React.FC = () => {
    const { colors } = useTheme();
    const { networkHealth, isLoading } = useNetworkTierHealth();

    const [selectedAnalysis, setSelectedAnalysis] = useState<TierFitAnalysis | null>(null);
    const [expandedTiers, setExpandedTiers] = useState<Set<Tier>>(new Set(['InnerCircle']));

    const toggleTier = (tier: Tier) => {
        setExpandedTiers((prev) => {
            const next = new Set(prev);
            if (next.has(tier)) {
                next.delete(tier);
            } else {
                next.add(tier);
            }
            return next;
        });
    };

    const handleChangeTier = async (friendId: string, newTier: Tier, friendName: string) => {
        try {
            await changeFriendTier(friendId, newTier, true);
            // Dismiss modal first
            setSelectedAnalysis(null);

            // Show toast after slight delay to allow modal to close
            setTimeout(() => {
                useUIStore.getState().showToast(`Moved ${friendName} to ${TIER_DISPLAY_NAMES[newTier]}`, friendName);
            }, 400);
        } catch (error) {
            console.error('Failed to change tier:', error);
        }
    };

    const handleStayInTier = async (friendId: string) => {
        try {
            await dismissTierSuggestion(friendId);
            setSelectedAnalysis(null);
        } catch (error) {
            console.error('Failed to dismiss suggestion:', error);
        }
    };

    const handleDismissSuggestion = async (friendId: string) => {
        try {
            await dismissTierSuggestion(friendId);
            setSelectedAnalysis(null);
        } catch (error) {
            console.error('Failed to dismiss suggestion:', error);
        }
    };

    if (isLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!networkHealth) {
        return (
            <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors['muted-foreground'] }]}>
                    No tier data available yet
                </Text>
            </View>
        );
    }

    const getHealthColor = (score: number) => {
        if (score >= 8) return '#10B981';
        if (score >= 5) return '#F59E0B';
        return '#EF4444';
    };

    const healthColor = getHealthColor(networkHealth.healthScore);

    return (
        <View style={styles.container}>
            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Overall Health */}
                <View style={[styles.healthCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.healthTitle, { color: colors.foreground }]}>
                        Overall Health
                    </Text>

                    <View style={styles.healthScoreRow}>
                        <View style={styles.healthBarContainer}>
                            <View
                                style={[styles.healthBarFill, { width: `${networkHealth.healthScore * 10}%`, backgroundColor: healthColor }]}
                            />
                        </View>
                        <Text style={[styles.healthScore, { color: healthColor }]}>
                            {networkHealth.healthScore}/10
                        </Text>
                    </View>

                    <Text style={[styles.healthSummary, { color: colors['muted-foreground'] }]}>
                        {networkHealth.healthScore >= 8
                            ? 'Your tiers mostly match your actual patterns. Great job!'
                            : networkHealth.healthScore >= 5
                                ? `Your tiers mostly match, but ${networkHealth.mismatches.length} ${networkHealth.mismatches.length === 1 ? 'friend' : 'friends'} could use adjustment.`
                                : `${networkHealth.mismatches.length} friends have tier mismatches that may cause stress.`}
                    </Text>
                </View>

                {/* Per-Tier Sections */}
                {(['InnerCircle', 'CloseFriends', 'Community'] as Tier[]).map((tier) => {
                    const tierHealth = networkHealth.tierHealth[tier];
                    const isExpanded = expandedTiers.has(tier);

                    // Get ALL friends in this tier
                    const tierFriends = networkHealth.allAnalyses.filter((a) => a.currentTier === tier);

                    const tierMismatches = tierFriends.filter((a) => a.fitCategory === 'mismatch');
                    const hasIssues = tierMismatches.length > 0;

                    return (
                        <View key={tier} style={[styles.tierSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            {/* Tier Header */}
                            <TouchableOpacity
                                style={styles.tierHeader}
                                onPress={() => toggleTier(tier)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.tierHeaderLeft}>
                                    <Text style={[styles.tierTitle, { color: colors.foreground }]}>
                                        {TIER_DISPLAY_NAMES[tier]}
                                    </Text>
                                    {tierHealth.total > 0 && (
                                        <Text style={[styles.tierCount, { color: colors['muted-foreground'] }]}>
                                            {tierHealth.total} {tierHealth.total === 1 ? 'friend' : 'friends'}
                                        </Text>
                                    )}
                                </View>

                                <View style={styles.tierHeaderRight}>
                                    {hasIssues ? (
                                        <View style={[styles.tierBadge, { backgroundColor: '#F59E0B20' }]}>
                                            <Text style={[styles.tierBadgeText, { color: '#F59E0B' }]}>
                                                {tierMismatches.length} mismatch{tierMismatches.length !== 1 ? 'es' : ''}
                                            </Text>
                                        </View>
                                    ) : tierHealth.total > 0 ? (
                                        <CheckCircle size={20} color="#10B981" />
                                    ) : null}
                                    {isExpanded ? (
                                        <ChevronUp size={20} color={colors['muted-foreground']} />
                                    ) : (
                                        <ChevronDown size={20} color={colors['muted-foreground']} />
                                    )}
                                </View>
                            </TouchableOpacity>

                            {/* Tier Content (when expanded) */}
                            {isExpanded && (
                                <View style={styles.tierContent}>
                                    {/* Tier Summary */}
                                    {tierHealth.total > 0 && (
                                        <View style={styles.tierSummary}>
                                            <Text style={[styles.tierSummaryText, { color: colors['muted-foreground'] }]}>
                                                {tierHealth.great} great fit • {tierHealth.good} good fit • {tierHealth.mismatch} mismatch
                                            </Text>
                                        </View>
                                    )}

                                    {/* Friend List */}
                                    {tierFriends.map((analysis) => {
                                        const isMismatch = analysis.fitCategory === 'mismatch';
                                        const isLearning = analysis.fitCategory === 'insufficient_data';
                                        const isPreliminary = !!analysis.isPreliminary && !isLearning;
                                        const isGood = analysis.fitCategory === 'great' || analysis.fitCategory === 'good';

                                        return (
                                            <TouchableOpacity
                                                key={analysis.friendId}
                                                style={[
                                                    styles.friendCard,
                                                    {
                                                        borderColor: isMismatch ? '#F59E0B40' : isLearning ? colors.border : '#10B98140',
                                                        backgroundColor: isMismatch ? '#F59E0B05' : isLearning ? 'transparent' : '#10B98105'
                                                    }
                                                ]}
                                                onPress={() => setSelectedAnalysis(analysis)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.friendCardHeader}>
                                                    <View style={styles.friendCardContent}>
                                                        <View style={styles.friendNameRow}>
                                                            {isMismatch ? (
                                                                <AlertCircle size={20} color="#F59E0B" />
                                                            ) : isLearning ? (
                                                                <TrendingUp size={20} color={colors['muted-foreground']} />
                                                            ) : (
                                                                <CheckCircle size={20} color="#10B981" />
                                                            )}
                                                            <Text style={[styles.friendName, { color: colors.foreground }]}>
                                                                {analysis.friendName}
                                                            </Text>
                                                        </View>

                                                        {analysis.suggestedTier && (
                                                            <View style={[styles.suggestionBadge, { backgroundColor: colors.primary + '20', alignSelf: 'flex-start', marginLeft: 28, marginTop: 4 }]}>
                                                                <Text style={[styles.suggestionBadgeText, { color: colors.primary }]}>
                                                                    Suggest: {TIER_DISPLAY_NAMES[analysis.suggestedTier]}
                                                                </Text>
                                                            </View>
                                                        )}

                                                        {isLearning && (
                                                            <View style={[styles.suggestionBadge, { backgroundColor: colors.muted, alignSelf: 'flex-start', marginLeft: 28, marginTop: 4 }]}>
                                                                <Text style={[styles.suggestionBadgeText, { color: colors['muted-foreground'] }]}>
                                                                    Learning...
                                                                </Text>
                                                            </View>
                                                        )}

                                                        {isPreliminary && (
                                                            <View style={[styles.suggestionBadge, { backgroundColor: colors.muted, alignSelf: 'flex-start', marginLeft: 28, marginTop: 4 }]}>
                                                                <Text style={[styles.suggestionBadgeText, { color: colors['muted-foreground'] }]}>
                                                                    Preliminary
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>

                                                <View style={styles.friendCardStats}>
                                                    {isLearning ? (
                                                        <Text style={[styles.friendCardStat, { color: colors['muted-foreground'] }]}>
                                                            {2 - analysis.interactionCount > 0
                                                                ? `Need ${2 - analysis.interactionCount} more interactions to analyze rhythm`
                                                                : `Keep weaving to analyze rhythm`}
                                                        </Text>
                                                    ) : (
                                                        <>
                                                            <Text style={[styles.friendCardStat, { color: colors['muted-foreground'] }]}>
                                                                Your rhythm: Every {Math.round(analysis.actualIntervalDays)} days
                                                            </Text>
                                                            <Text style={[styles.friendCardStat, { color: colors['muted-foreground'] }]}>
                                                                Tier expects: Every {analysis.expectedIntervalDays} days
                                                            </Text>
                                                            {isPreliminary && (
                                                                <Text style={[styles.friendCardStat, { color: colors['muted-foreground'], fontStyle: 'italic', fontSize: 12 }]}>
                                                                    Data limited ({analysis.interactionCount}/5 interactions)
                                                                </Text>
                                                            )}
                                                        </>
                                                    )}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}

                                    {tierHealth.total === 0 && (
                                        <Text style={[styles.emptyTierText, { color: colors['muted-foreground'] }]}>
                                            No friends in this tier yet
                                        </Text>
                                    )}
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>

            {/* Tier Fit Bottom Sheet */}
            {selectedAnalysis && (
                <TierFitBottomSheet
                    visible={!!selectedAnalysis}
                    analysis={selectedAnalysis}
                    onDismiss={() => setSelectedAnalysis(null)}
                    onChangeTier={(newTier) => handleChangeTier(selectedAnalysis.friendId, newTier, selectedAnalysis.friendName)}
                    onStayInTier={() => handleStayInTier(selectedAnalysis.friendId)}
                    onDismissSuggestion={() => handleDismissSuggestion(selectedAnalysis.friendId)}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyText: {
        fontSize: 16,
        textAlign: 'center',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
        gap: 16,
    },
    healthCard: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 20,
        gap: 16,
    },
    healthTitle: {
        fontSize: 18,
        fontWeight: '600',
        fontFamily: 'Lora_700Bold',
    },
    healthScoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    healthBarContainer: {
        flex: 1,
        height: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 6,
        overflow: 'hidden',
    },
    healthBarFill: {
        height: '100%',
        borderRadius: 6,
    },
    healthScore: {
        fontSize: 20,
        fontWeight: '700',
        minWidth: 60,
    },
    healthSummary: {
        fontSize: 15,
        lineHeight: 22,
    },
    tierSection: {
        borderRadius: 16,
        borderWidth: 1,
        overflow: 'hidden',
    },
    tierHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
    },
    tierHeaderLeft: {
        flex: 1,
        gap: 4,
    },
    tierTitle: {
        fontSize: 17,
        fontWeight: '600',
        fontFamily: 'Lora_700Bold',
    },
    tierCount: {
        fontSize: 13,
    },
    tierHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    tierBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    tierBadgeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    tierContent: {
        paddingHorizontal: 16,
        paddingBottom: 16,
        gap: 12,
    },
    tierSummary: {
        paddingBottom: 8,
    },
    tierSummaryText: {
        fontSize: 13,
    },
    friendCard: {
        borderWidth: 2,
        borderRadius: 12,
        padding: 12,
        gap: 8,
    },
    friendCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    friendCardContent: {
        flex: 1,
        gap: 2,
    },
    friendNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    friendName: {
        fontSize: 16,
        fontWeight: '600',
        flex: 1,
    },
    suggestionBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    suggestionBadgeText: {
        fontSize: 11,
        fontWeight: '600',
    },
    friendCardStats: {
        gap: 2,
    },
    friendCardStat: {
        fontSize: 13,
    },
    emptyTierText: {
        fontSize: 14,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingVertical: 8,
    },
});
