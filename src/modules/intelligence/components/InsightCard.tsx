/**
 * InsightCard
 * 
 * Displays a relationship insight with opener, message, and optional action.
 * Used in the dashboard to surface understanding-based insights.
 */

import React from 'react';
import { View, TouchableOpacity, Pressable } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import { icons } from 'lucide-react-native';
import RelationshipInsight, { InsightTone } from '@/db/models/RelationshipInsight';

interface InsightCardProps {
    insight: RelationshipInsight;
    onDismiss?: () => void;
    onAction?: () => void;
    onPress?: () => void;
}

const TONE_ICONS: Record<InsightTone, keyof typeof icons> = {
    curious: 'Eye',
    affirming: 'Heart',
    celebratory: 'Sparkles',
    gentle: 'Lightbulb',
    reflective: 'MessageCircle',
};

const TONE_COLORS: Record<InsightTone, string> = {
    curious: '#6366f1',     // Indigo
    affirming: '#ec4899',   // Pink
    celebratory: '#f59e0b', // Amber
    gentle: '#10b981',      // Emerald
    reflective: '#8b5cf6',  // Violet
};

export function InsightCard({
    insight,
    onDismiss,
    onAction,
    onPress
}: InsightCardProps) {
    const { colors } = useTheme();

    const iconName = TONE_ICONS[insight.tone] || 'Sparkles';
    const accentColor = TONE_COLORS[insight.tone] || colors.primary;
    const action = insight.suggestedAction;

    const IconComponent = icons[iconName];
    const XIcon = icons['X'];
    const ChevronRightIcon = icons['ChevronRight'];

    return (
        <Card className="mx-4 my-2 overflow-hidden">
            <Pressable
                onPress={onPress}
                className="p-4"
                style={{ backgroundColor: colors.muted }}
            >
                {/* Header with icon and dismiss */}
                <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                        <View
                            className="w-8 h-8 rounded-full items-center justify-center"
                            style={{ backgroundColor: `${accentColor}20` }}
                        >
                            <IconComponent size={16} color={accentColor} />
                        </View>
                        <Text
                            variant="caption"
                            className="uppercase tracking-wider"
                            style={{ color: accentColor }}
                        >
                            {insight.opener}
                        </Text>
                    </View>

                    {onDismiss && (
                        <TouchableOpacity
                            onPress={onDismiss}
                            className="p-1"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <XIcon size={16} color={colors['muted-foreground']} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Message */}
                <Text
                    variant="body"
                    className="leading-relaxed"
                    style={{ color: colors.foreground }}
                >
                    {insight.message}
                </Text>

                {/* Friend tag if applicable */}
                {insight.friendName && (
                    <View className="mt-2">
                        <Text
                            variant="caption"
                            style={{ color: colors['muted-foreground'] }}
                        >
                            About {insight.friendName}
                        </Text>
                    </View>
                )}

                {/* Suggested action button */}
                {action && onAction && (
                    <TouchableOpacity
                        onPress={onAction}
                        className="flex-row items-center justify-between mt-4 py-2 px-3 rounded-lg"
                        style={{ backgroundColor: `${accentColor}10` }}
                    >
                        <Text
                            variant="caption"
                            className="font-medium"
                            style={{ color: accentColor }}
                        >
                            {action.label}
                        </Text>
                        <ChevronRightIcon size={16} color={accentColor} />
                    </TouchableOpacity>
                )}
            </Pressable>
        </Card>
    );
}

/**
 * Compact version for dashboard widget slots
 * Subtle treatment: just icon + message, no opener text
 */
export function InsightCardCompact({
    insight,
    onPress,
    numberOfLines = 2,
}: {
    insight: RelationshipInsight;
    onPress?: () => void;
    numberOfLines?: number;
}) {
    const { colors, typography } = useTheme();
    const accentColor = TONE_COLORS[insight.tone] || colors.primary;
    const iconName = TONE_ICONS[insight.tone] || 'Sparkles';

    const IconComponent = icons[iconName];
    const ChevronRightIcon = icons['ChevronRight'];

    return (
        <Pressable
            onPress={onPress}
            className="flex-row items-center gap-3 py-2"
        >
            <IconComponent size={16} color={accentColor} />

            <Text
                variant="body"
                numberOfLines={numberOfLines}
                className="flex-1"
                style={{
                    color: colors.foreground,
                    fontFamily: typography.fonts.sans,
                    fontSize: 14,
                    lineHeight: 20,
                }}
            >
                {insight.message}
            </Text>

            <ChevronRightIcon size={14} color={colors['muted-foreground']} />
        </Pressable>
    );
}

export default InsightCard;
