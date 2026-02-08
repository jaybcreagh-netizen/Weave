import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { ProcessingResult } from '../services/journal-intelligence.service';
import { ACTION_LABELS, OracleActionType } from '@/modules/oracle';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useSmartActions } from '../hooks/useSmartActions';

interface InsightReceiptExpandedProps {
    result: ProcessingResult;
    onActionPress?: (action: any) => void;
    onClose?: () => void;
}

export const InsightReceiptExpanded: React.FC<InsightReceiptExpandedProps> = ({
    result,
    onActionPress: propOnActionPress, // Rename prop to avoid conflict
    onClose
}) => {
    const { colors } = useTheme();
    const { signals, threads, actions, memoryCount } = result;
    const { handleAction } = useSmartActions(onClose); // Use hook

    // Use prop handler if provided (for custom overrides), otherwise use hook
    const handlePress = propOnActionPress || handleAction;

    const getSentimentColor = (value: number) => {
        if (value > 0) return colors.success;
        if (value < 0) return colors.destructive;
        return colors['muted-foreground'];
    };

    const getThreadSentimentColor = (sentiment: string) => {
        return sentiment === 'positive' ? colors.success : colors.warning;
    };

    return (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
            {/* Header */}
            <View className="px-4 pt-4 pb-2 mb-2">
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-3">
                        <View
                            className="w-10 h-10 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.primary + '12' }}
                        >
                            <Icon name="Sparkles" size={18} color={colors.primary} />
                        </View>
                        <View>
                            <Text
                                variant="body"
                                weight="semibold"
                                style={{ color: colors.foreground, fontSize: 17 }}
                            >
                                Full Analysis
                            </Text>
                            <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                Woven from your entry
                            </Text>
                        </View>
                    </View>
                    {onClose && (
                        <Button variant="ghost" size="sm" onPress={onClose} icon="X" />
                    )}
                </View>
            </View>

            {/* 1. Signals Section */}
            {signals && (signals.coreThemes.length > 0 || signals.sentimentLabel) && (
                <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-5 px-4">
                    <Text
                        variant="caption"
                        weight="semibold"
                        style={{ color: colors['muted-foreground'], fontSize: 10, letterSpacing: 0.5, marginBottom: 10 }}
                    >
                        SIGNALS
                    </Text>
                    <View className="flex-row flex-wrap gap-2">
                        {/* Sentiment Chip */}
                        <View
                            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                            style={{
                                backgroundColor: getSentimentColor(signals.sentiment) + '12',
                                borderWidth: 1,
                                borderColor: getSentimentColor(signals.sentiment) + '25',
                            }}
                        >
                            <Icon
                                name={signals.sentiment > 0 ? 'TrendingUp' : signals.sentiment < 0 ? 'TrendingDown' : 'Minus'}
                                size={13}
                                color={getSentimentColor(signals.sentiment)}
                            />
                            <Text
                                variant="caption"
                                weight="semibold"
                                style={{ color: getSentimentColor(signals.sentiment), textTransform: 'capitalize' }}
                            >
                                {signals.sentimentLabel}
                            </Text>
                        </View>

                        {/* Theme Chips */}
                        {signals.coreThemes.map((theme, i) => (
                            <View
                                key={i}
                                className="px-3 py-1.5 rounded-full"
                                style={{ backgroundColor: colors.primary + '10' }}
                            >
                                <Text
                                    variant="caption"
                                    weight="medium"
                                    style={{ color: colors.primary, textTransform: 'capitalize' }}
                                >
                                    {theme.replace('_', ' ')}
                                </Text>
                            </View>
                        ))}
                    </View>
                </Animated.View>
            )}

            {/* 2. Threads Section */}
            {threads.length > 0 && (
                <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-5 px-4">
                    <Text
                        variant="caption"
                        weight="semibold"
                        style={{ color: colors['muted-foreground'], fontSize: 10, letterSpacing: 0.5, marginBottom: 10 }}
                    >
                        ACTIVE THREADS
                    </Text>
                    <View className="gap-2">
                        {threads.map((thread, idx) => (
                            <View
                                key={idx}
                                className="p-3.5 rounded-xl flex-row items-center justify-between"
                                style={{
                                    backgroundColor: colors.card,
                                    borderWidth: 1,
                                    borderColor: colors.border,
                                    borderLeftWidth: 3,
                                    borderLeftColor: getThreadSentimentColor(thread.sentiment),
                                }}
                            >
                                <View className="flex-1 mr-3">
                                    <Text
                                        variant="body"
                                        weight="medium"
                                        style={{ color: colors.foreground, fontSize: 14, marginBottom: 2 }}
                                    >
                                        {thread.topic}
                                    </Text>
                                    <Text variant="caption" style={{ color: colors['muted-foreground'], fontSize: 11 }}>
                                        {thread.sentiment === 'positive' ? 'Building momentum' : 'Continuing conversation'}
                                    </Text>
                                </View>
                                <Icon name="MessageCircle" size={16} color={colors['muted-foreground']} />
                            </View>
                        ))}
                    </View>
                </Animated.View>
            )}

            {/* 3. Memories Section */}
            {memoryCount > 0 && (
                <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mb-5 px-4">
                    <View
                        className="p-4 rounded-xl flex-row items-center gap-3"
                        style={{
                            backgroundColor: colors.primary + '08',
                            borderWidth: 1,
                            borderColor: colors.primary + '18',
                        }}
                    >
                        <View
                            className="w-9 h-9 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.primary + '15' }}
                        >
                            <Icon name="Brain" size={16} color={colors.primary} />
                        </View>
                        <View className="flex-1">
                            <Text
                                variant="body"
                                weight="semibold"
                                style={{ color: colors.foreground, fontSize: 14 }}
                            >
                                {memoryCount} new memor{memoryCount > 1 ? 'ies' : 'y'}
                            </Text>
                            <Text variant="caption" style={{ color: colors['muted-foreground'], fontSize: 11 }}>
                                Saved to friend history
                            </Text>
                        </View>
                    </View>
                </Animated.View>
            )}

            {/* 4. Smart Actions Section */}
            {actions.length > 0 && (
                <Animated.View entering={FadeInDown.delay(400).duration(400)} className="mb-5 px-4">
                    <Text
                        variant="caption"
                        weight="semibold"
                        style={{ color: colors['muted-foreground'], fontSize: 10, letterSpacing: 0.5, marginBottom: 10 }}
                    >
                        SUGGESTED ACTIONS
                    </Text>
                    <View className="gap-2">
                        {actions.map((action, idx) => {
                            const labelConfig = ACTION_LABELS[action.type as OracleActionType];
                            const iconName = labelConfig?.icon || 'Zap';

                            return (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => handlePress(action)}
                                    className="flex-row items-center p-3.5 rounded-xl"
                                    style={{
                                        backgroundColor: colors.card,
                                        borderWidth: 1,
                                        borderColor: colors.border,
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View
                                        className="w-9 h-9 rounded-lg items-center justify-center"
                                        style={{ backgroundColor: colors.muted }}
                                    >
                                        <Icon name={iconName as any} size={16} color={colors.primary} />
                                    </View>

                                    <View className="flex-1 ml-3 mr-2">
                                        <Text
                                            variant="body"
                                            weight="medium"
                                            style={{ color: colors.foreground, fontSize: 14 }}
                                        >
                                            {action.label || labelConfig?.label}
                                        </Text>
                                        {action.data.note && (
                                            <Text
                                                variant="caption"
                                                style={{ color: colors['muted-foreground'], fontSize: 11 }}
                                                numberOfLines={1}
                                            >
                                                {action.data.note}
                                            </Text>
                                        )}
                                    </View>

                                    <Icon name="ChevronRight" size={14} color={colors['muted-foreground']} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </Animated.View>
            )}

        </ScrollView>
    );
};
