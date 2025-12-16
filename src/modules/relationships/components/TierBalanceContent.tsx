import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { AlertCircle, CheckCircle, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { useNetworkTierHealth, TierFitBottomSheet } from '@/modules/insights';
import type { Tier } from '@/shared/types/core';
import type { TierFitAnalysis } from '@/modules/insights';
import { changeFriendTier, dismissTierSuggestion } from '@/modules/insights';
import { useGlobalUI } from '@/shared/context/GlobalUIContext';

const TIER_DISPLAY_NAMES: Record<Tier, string> = {
    InnerCircle: 'Inner Circle',
    CloseFriends: 'Close Friends',
    Community: 'Community',
};

export const TierBalanceContent: React.FC = () => {
    const { colors } = useTheme();
    const { showToast } = useGlobalUI();
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
                showToast(`Moved ${friendName} to ${TIER_DISPLAY_NAMES[newTier]}`, friendName);
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
            <View className="flex-1 justify-center items-center">
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!networkHealth) {
        return (
            <View className="flex-1 justify-center items-center p-5">
                <Text className="text-base text-center" style={{ color: colors['muted-foreground'] }}>
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
        <View className="flex-1">
            <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 16 }}>
                {/* Overall Health */}
                <View className="rounded-2xl border p-5 gap-4" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                    <Text className="text-lg font-semibold font-lora-bold" style={{ color: colors.foreground }}>
                        Overall Health
                    </Text>

                    <View className="flex-row items-center gap-3">
                        <View className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <View
                                className="h-full rounded-full"
                                style={{ width: `${networkHealth.healthScore * 10}%`, backgroundColor: healthColor }}
                            />
                        </View>
                        <Text className="text-xl font-bold min-w-[60px]" style={{ color: healthColor }}>
                            {networkHealth.healthScore}/10
                        </Text>
                    </View>

                    <Text className="text-[15px] leading-[22px]" style={{ color: colors['muted-foreground'] }}>
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
                        <View key={tier} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                            {/* Tier Header */}
                            <TouchableOpacity
                                className="flex-row justify-between items-center p-4"
                                onPress={() => toggleTier(tier)}
                                activeOpacity={0.7}
                            >
                                <View className="flex-1 gap-1">
                                    <Text className="text-[17px] font-semibold font-lora-bold" style={{ color: colors.foreground }}>
                                        {TIER_DISPLAY_NAMES[tier]}
                                    </Text>
                                    {tierHealth.total > 0 && (
                                        <Text className="text-[13px]" style={{ color: colors['muted-foreground'] }}>
                                            {tierHealth.total} {tierHealth.total === 1 ? 'friend' : 'friends'}
                                        </Text>
                                    )}
                                </View>

                                <View className="flex-row items-center gap-3">
                                    {hasIssues ? (
                                        <View className="px-2 py-1 rounded-md" style={{ backgroundColor: '#F59E0B20' }}>
                                            <Text className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
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
                                <View className="px-4 pb-4 gap-3">
                                    {/* Tier Summary */}
                                    {tierHealth.total > 0 && (
                                        <View className="pb-2">
                                            <Text className="text-[13px]" style={{ color: colors['muted-foreground'] }}>
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
                                                className="border-2 rounded-xl p-3 gap-2"
                                                style={{
                                                    borderColor: isMismatch ? '#F59E0B40' : isLearning ? colors.border : '#10B98140',
                                                    backgroundColor: isMismatch ? '#F59E0B05' : isLearning ? 'transparent' : '#10B98105'
                                                }}
                                                onPress={() => setSelectedAnalysis(analysis)}
                                                activeOpacity={0.7}
                                            >
                                                <View className="flex-row justify-between items-center gap-3">
                                                    <View className="flex-1 gap-0.5">
                                                        <View className="flex-row items-center gap-2">
                                                            {isMismatch ? (
                                                                <AlertCircle size={20} color="#F59E0B" />
                                                            ) : isLearning ? (
                                                                <TrendingUp size={20} color={colors['muted-foreground']} />
                                                            ) : (
                                                                <CheckCircle size={20} color="#10B981" />
                                                            )}
                                                            <Text className="text-base font-semibold flex-1" style={{ color: colors.foreground }}>
                                                                {analysis.friendName}
                                                            </Text>
                                                        </View>

                                                        {analysis.suggestedTier && (
                                                            <View className="px-2 py-1 rounded-md self-start ml-7 mt-1" style={{ backgroundColor: colors.primary + '20' }}>
                                                                <Text className="text-[11px] font-semibold" style={{ color: colors.primary }}>
                                                                    Suggest: {TIER_DISPLAY_NAMES[analysis.suggestedTier]}
                                                                </Text>
                                                            </View>
                                                        )}

                                                        {isLearning && (
                                                            <View className="px-2 py-1 rounded-md self-start ml-7 mt-1" style={{ backgroundColor: colors.muted }}>
                                                                <Text className="text-[11px] font-semibold" style={{ color: colors['muted-foreground'] }}>
                                                                    Learning...
                                                                </Text>
                                                            </View>
                                                        )}

                                                        {isPreliminary && (
                                                            <View className="px-2 py-1 rounded-md self-start ml-7 mt-1" style={{ backgroundColor: colors.muted }}>
                                                                <Text className="text-[11px] font-semibold" style={{ color: colors['muted-foreground'] }}>
                                                                    Preliminary
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                </View>

                                                <View className="gap-0.5">
                                                    {isLearning ? (
                                                        <Text className="text-[13px]" style={{ color: colors['muted-foreground'] }}>
                                                            {2 - analysis.interactionCount > 0
                                                                ? `Need ${2 - analysis.interactionCount} more interactions to analyze rhythm`
                                                                : `Keep weaving to analyze rhythm`}
                                                        </Text>
                                                    ) : (
                                                        <>
                                                            <Text className="text-[13px]" style={{ color: colors['muted-foreground'] }}>
                                                                Your rhythm: Every {Math.round(analysis.actualIntervalDays)} days
                                                            </Text>
                                                            <Text className="text-[13px]" style={{ color: colors['muted-foreground'] }}>
                                                                Tier expects: Every {analysis.expectedIntervalDays} days
                                                            </Text>
                                                            {isPreliminary && (
                                                                <Text className="text-[13px] italic font-inter-regular" style={{ color: colors['muted-foreground'], fontSize: 12 }}>
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
                                        <Text className="text-sm italic text-center py-2" style={{ color: colors['muted-foreground'] }}>
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
