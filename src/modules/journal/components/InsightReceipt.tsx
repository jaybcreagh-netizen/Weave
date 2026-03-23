import React from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { useTheme } from '@/shared/hooks/useTheme';
import { ProcessingResult } from '../services/journal-intelligence.service';
import { ACTION_LABELS, OracleActionType } from '@/modules/oracle';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { WeavingLoader } from './WeavingLoader';
import { useSmartActions } from '../hooks/useSmartActions';

interface InsightReceiptProps {
    loading: boolean;
    result: ProcessingResult | null;
    onDismiss: () => void;
    onExpand?: () => void;
    style?: ViewStyle;
}

export const InsightReceipt: React.FC<InsightReceiptProps> = ({
    loading,
    result,
    onDismiss,
    onExpand,
    style
}) => {
    const { colors } = useTheme();
    const { handleAction } = useSmartActions(onDismiss);

    if (loading) {
        return (
            <View
                style={[{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border }, style]}
                className="p-4"
            >
                <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2.5">
                        <View
                            className="w-7 h-7 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.primary + '12' }}
                        >
                            <Icon name="Sparkles" size={14} color={colors.primary} />
                        </View>
                        <View>
                            <Text
                                variant="body"
                                weight="semibold"
                                style={{ color: colors.foreground, fontSize: 15 }}
                            >
                                Journal entry saved
                            </Text>
                            <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                Analysis is continuing in the background.
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={onDismiss}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        className="p-1.5 rounded-full"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Icon name="X" size={12} color={colors['muted-foreground']} />
                    </TouchableOpacity>
                </View>

                <WeavingLoader />

                <Text
                    variant="caption"
                    className="mt-3 text-center"
                    style={{ color: colors['muted-foreground'] }}
                >
                    You can close this now and keep using Weave.
                </Text>

                <TouchableOpacity
                    onPress={onDismiss}
                    className="mt-3 py-2 flex-row items-center justify-center"
                    activeOpacity={0.6}
                >
                    <Text
                        variant="caption"
                        style={{ color: colors['muted-foreground'], fontWeight: '500' }}
                    >
                        Done
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (!result) return null;

    const { signals, threads, actions, memoryCount } = result;
    const hasActions = actions.length > 0;
    const themeCount = signals?.coreThemes.length || 0;

    // Build a human-readable summary line
    const summaryParts: string[] = [];
    summaryParts.push('Saved to Journal');
    if (themeCount > 0) summaryParts.push(`${themeCount} theme${themeCount > 1 ? 's' : ''}`);
    if (memoryCount > 0) summaryParts.push(`${memoryCount} memor${memoryCount > 1 ? 'ies' : 'y'}`);
    if (threads.length > 0) summaryParts.push(`${threads.length} thread${threads.length > 1 ? 's' : ''}`);

    return (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)}>
            <View
                style={[{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                }, style]}
                className="p-4"
            >
                {/* Header */}
                <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2.5">
                        <View
                            className="w-7 h-7 rounded-full items-center justify-center"
                            style={{ backgroundColor: colors.primary + '12' }}
                        >
                            <Icon name="Sparkles" size={14} color={colors.primary} />
                        </View>
                        <View>
                            <Text
                                variant="body"
                                weight="semibold"
                                style={{ color: colors.foreground, fontSize: 15 }}
                            >
                                Journal entry saved
                            </Text>
                            {summaryParts.length > 0 && (
                                <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                    {summaryParts.join(' · ')}
                                </Text>
                            )}
                        </View>
                    </View>
                    <TouchableOpacity
                        onPress={onDismiss}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        className="p-1.5 rounded-full"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Icon name="X" size={12} color={colors['muted-foreground']} />
                    </TouchableOpacity>
                </View>

                {/* Theme pills - only if we have core themes */}
                {themeCount > 0 && (
                    <View className="flex-row flex-wrap gap-1.5 mb-3">
                        {signals!.coreThemes.slice(0, 3).map((theme, i) => (
                            <View
                                key={i}
                                className="px-2.5 py-1 rounded-full"
                                style={{ backgroundColor: colors.primary + '10' }}
                            >
                                <Text
                                    variant="caption"
                                    style={{ color: colors.primary, fontSize: 11, textTransform: 'capitalize' }}
                                >
                                    {theme.replace('_', ' ')}
                                </Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* Actions */}
                {hasActions && (
                    <View className="gap-1 mb-1">
                        {actions.slice(0, 2).map((action, idx) => {
                            const labelConfig = ACTION_LABELS[action.type as OracleActionType];
                            const iconName = labelConfig?.icon || 'Zap';

                            return (
                                <TouchableOpacity
                                    key={`${action.type}-${idx}`}
                                    onPress={() => handleAction(action)}
                                    className="flex-row items-center py-2.5 px-3 rounded-xl"
                                    style={{ backgroundColor: colors.muted }}
                                    activeOpacity={0.7}
                                >
                                    <Icon name={iconName as any} size={14} color={colors.primary} />
                                    <Text
                                        variant="body"
                                        style={{ color: colors.foreground, fontSize: 14, marginLeft: 10, flex: 1 }}
                                        numberOfLines={1}
                                    >
                                        {action.label || labelConfig?.label}
                                    </Text>
                                    <Icon name="ChevronRight" size={14} color={colors['muted-foreground']} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}

                {/* View full analysis */}
                {onExpand && (
                    <TouchableOpacity
                        onPress={onExpand}
                        className="mt-2 py-2 flex-row items-center justify-center"
                        activeOpacity={0.6}
                    >
                        <Text
                            variant="caption"
                            style={{ color: colors.primary, fontWeight: '500' }}
                        >
                            View full analysis
                        </Text>
                        <View style={{ marginLeft: 4 }}>
                            <Icon name="ArrowRight" size={12} color={colors.primary} />
                        </View>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    onPress={onDismiss}
                    className="mt-3 py-2 flex-row items-center justify-center"
                    activeOpacity={0.6}
                >
                    <Text
                        variant="caption"
                        style={{ color: colors['muted-foreground'], fontWeight: '500' }}
                    >
                        Done
                    </Text>
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
};
