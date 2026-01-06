import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated'
import { Sparkles, X, ArrowRight } from 'lucide-react-native'
import ProactiveInsight from '@/db/models/ProactiveInsight'
import { useTheme } from '@/shared/hooks/useTheme'

interface OracleInsightCardProps {
    insight: ProactiveInsight
    onAction: (insight: ProactiveInsight) => void
    onDismiss: (insight: ProactiveInsight) => void
}

export function OracleInsightCard({ insight, onAction, onDismiss }: OracleInsightCardProps) {
    const { colors, typography } = useTheme()

    return (
        <Animated.View
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(300)}
            layout={Layout.springify()}
            className="mb-4 mx-1"
        >
            <View
                style={{
                    backgroundColor: colors.card,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 20,
                    shadowColor: '#000000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.05,
                    shadowRadius: 8,
                    elevation: 2
                }}
            >
                {/* Header: Clean & Minimal */}
                <View className="flex-row justify-between items-start mb-4">
                    <View className="flex-row items-center space-x-2">
                        <Sparkles size={14} color={colors.primary} />
                        <Text
                            style={{
                                color: colors['muted-foreground'],
                                fontFamily: typography.fonts.sansMedium,
                                fontSize: 12,
                                letterSpacing: 0.5,
                                textTransform: 'uppercase'
                            }}
                        >
                            Insight
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => onDismiss(insight)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="opacity-50"
                    >
                        <X size={16} color={colors.foreground} />
                    </TouchableOpacity>
                </View>

                {/* Content: Letter Style */}
                <View className="mb-6">
                    <Text
                        className="text-lg mb-2"
                        style={{
                            color: colors.foreground,
                            fontFamily: typography.fonts.serifBold, // Lora Bold
                            lineHeight: 28
                        }}
                    >
                        {insight.headline}
                    </Text>
                    <Text
                        className="text-base leading-7"
                        style={{
                            color: colors.foreground,
                            fontFamily: typography.fonts.serif, // Lora Regular
                            opacity: 0.9
                        }}
                    >
                        {insight.body}
                    </Text>
                </View>

                {/* Action Footer: Subtle & Integrated */}
                <View className="flex-row items-center justify-between pt-4 border-t" style={{ borderColor: colors.border }}>
                    <TouchableOpacity
                        onPress={() => onAction(insight)}
                        activeOpacity={0.7}
                        className="flex-row items-center"
                    >
                        <Text
                            style={{
                                color: colors.primary,
                                fontFamily: typography.fonts.sansMedium,
                                fontSize: 14,
                                marginRight: 6
                            }}
                        >
                            {insight.actionLabel || "Reflect"}
                        </Text>
                        <ArrowRight size={14} color={colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    )
}
