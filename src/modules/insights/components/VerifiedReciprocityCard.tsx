/**
 * Verified Reciprocity Card
 * 
 * Displays verified reciprocity data for linked friends
 * based on actual shared_weaves data.
 */

import React from 'react';
import { View } from 'react-native';
import { Handshake, TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { Text, Card } from '@/shared/ui';
import { useTheme } from '@/shared/hooks/useTheme';
import { VerifiedReciprocityAnalysis } from '../services/verified-insights.service';

interface VerifiedReciprocityCardProps {
    analysis: VerifiedReciprocityAnalysis;
    friendName: string;
}

export function VerifiedReciprocityCard({ analysis, friendName }: VerifiedReciprocityCardProps) {
    const { colors } = useTheme();

    if (!analysis.hasEnoughData) {
        return (
            <Card className="p-4">
                <View className="flex-row items-center gap-2 mb-2">
                    <Handshake size={18} color={colors['muted-foreground']} />
                    <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                        Verified Balance
                    </Text>
                </View>
                <Text style={{ color: colors['muted-foreground'] }}>
                    Share a few more weaves with {friendName} to see verified balance
                </Text>
            </Card>
        );
    }

    const getBalanceIcon = () => {
        if (analysis.balance === 'balanced') {
            return <Minus size={16} color={colors.primary} />;
        } else if (analysis.initiationRatio > 0.5) {
            return <TrendingUp size={16} color="#f59e0b" />;
        } else {
            return <TrendingDown size={16} color="#3b82f6" />;
        }
    };

    const getBalanceColor = () => {
        switch (analysis.balance) {
            case 'balanced':
                return '#22c55e';
            case 'slightly-imbalanced':
                return '#eab308';
            case 'very-imbalanced':
            case 'one-sided':
                return '#ef4444';
            default:
                return colors['muted-foreground'];
        }
    };

    const userPercent = Math.round(analysis.initiationRatio * 100);
    const friendPercent = 100 - userPercent;

    return (
        <Card className="p-4">
            {/* Header */}
            <View className="flex-row items-center gap-2 mb-3">
                <Handshake size={18} color={colors.primary} />
                <Text className="font-semibold" style={{ color: colors.foreground }}>
                    Verified Balance
                </Text>
                <View
                    className="ml-auto px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: getBalanceColor() + '20' }}
                >
                    <Text
                        variant="caption"
                        style={{ color: getBalanceColor(), fontWeight: '600' }}
                    >
                        {analysis.balance.replace('-', ' ')}
                    </Text>
                </View>
            </View>

            {/* Stats Row */}
            <View className="flex-row justify-between mb-3">
                <View className="items-center flex-1">
                    <Text className="text-2xl font-bold" style={{ color: colors.foreground }}>
                        {analysis.userInitiated}
                    </Text>
                    <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                        You initiated
                    </Text>
                </View>
                <View className="items-center justify-center px-4">
                    {getBalanceIcon()}
                </View>
                <View className="items-center flex-1">
                    <Text className="text-2xl font-bold" style={{ color: colors.foreground }}>
                        {analysis.friendInitiated}
                    </Text>
                    <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                        {friendName} initiated
                    </Text>
                </View>
            </View>

            {/* Progress Bar */}
            <View className="h-2 rounded-full overflow-hidden flex-row" style={{ backgroundColor: colors.muted }}>
                <View
                    className="h-full rounded-l-full"
                    style={{
                        width: `${userPercent}%`,
                        backgroundColor: colors.primary,
                    }}
                />
                <View
                    className="h-full rounded-r-full"
                    style={{
                        width: `${friendPercent}%`,
                        backgroundColor: '#3b82f6',
                    }}
                />
            </View>

            {/* Legend */}
            <View className="flex-row justify-center gap-4 mt-2">
                <View className="flex-row items-center gap-1">
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colors.primary }} />
                    <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                        You ({userPercent}%)
                    </Text>
                </View>
                <View className="flex-row items-center gap-1">
                    <View className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3b82f6' }} />
                    <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                        {friendName} ({friendPercent}%)
                    </Text>
                </View>
            </View>

            {/* Warning */}
            {analysis.warning && (
                <Text
                    variant="caption"
                    className="mt-3 text-center"
                    style={{ color: getBalanceColor() }}
                >
                    {analysis.warning}
                </Text>
            )}
        </Card>
    );
}
