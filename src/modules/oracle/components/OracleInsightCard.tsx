import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated'
import { Sparkles, X, MessageCircle, Calendar, PenLine } from 'lucide-react-native'
import ProactiveInsight from '@/db/models/ProactiveInsight'
import { SPRINGS } from '@/shared/constants/animation'

import { useTheme } from '@/shared/hooks/useTheme'

interface OracleInsightCardProps {
    insight: ProactiveInsight
    onTellMeMore: (insight: ProactiveInsight) => void  // Opens chat with insight context
    onPlanWeave?: (insight: ProactiveInsight) => void  // Optional: Plan a hangout
    onLogWeave?: (insight: ProactiveInsight) => void   // Optional: Log an interaction
    onDismiss: (insight: ProactiveInsight) => void
}

export function OracleInsightCard({ insight, onTellMeMore, onPlanWeave, onLogWeave, onDismiss }: OracleInsightCardProps) {
    const { colors, typography } = useTheme()

    // Determine which contextual action to show based on insight type/signal
    // Check sourceSignals for drift detection or just general friend context
    const sourceSignals = insight.sourceSignalsJson ? JSON.parse(insight.sourceSignalsJson) : []
    const signalWithFriend = sourceSignals.find((s: any) => s.friendId)
    const friendId = signalWithFriend?.friendId

    // Show plan action if we have a specific friend context (or if explicitly set)
    const showPlanAction = insight.actionType === 'plan_weave' || !!friendId
    const showLogAction = insight.actionType === 'log_weave'

    return (
        <Animated.View
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(300)}
            layout={Layout.springify().damping(SPRINGS.PREMIUM.damping).stiffness(SPRINGS.PREMIUM.stiffness).mass(SPRINGS.PREMIUM.mass)}
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
                <View className="mb-5">
                    <Text
                        className="text-lg mb-2"
                        style={{
                            color: colors.foreground,
                            fontFamily: typography.fonts.serifBold,
                            lineHeight: 28
                        }}
                    >
                        {insight.headline}
                    </Text>
                    <Text
                        className="text-base leading-7"
                        style={{
                            color: colors.foreground,
                            fontFamily: typography.fonts.serif,
                            opacity: 0.9
                        }}
                    >
                        {insight.body}
                    </Text>
                </View>

                {/* Action Footer: Two buttons side by side */}
                <View className="flex-row items-center gap-3 pt-4 border-t" style={{ borderColor: colors.border }}>
                    {/* Tell me more - always shown */}
                    <TouchableOpacity
                        onPress={() => onTellMeMore(insight)}
                        activeOpacity={0.7}
                        className="flex-row items-center px-3 py-2 rounded-full"
                        style={{ backgroundColor: colors.primary + '15' }}
                    >
                        <MessageCircle size={14} color={colors.primary} />
                        <Text
                            style={{
                                color: colors.primary,
                                fontFamily: typography.fonts.sansMedium,
                                fontSize: 13,
                                marginLeft: 6
                            }}
                        >
                            Tell me more
                        </Text>
                    </TouchableOpacity>

                    {/* Contextual action: Plan or Log */}
                    {showPlanAction && onPlanWeave && (
                        <TouchableOpacity
                            onPress={() => onPlanWeave(insight)}
                            activeOpacity={0.7}
                            className="flex-row items-center px-3 py-2 rounded-full"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <Calendar size={14} color={colors.foreground} />
                            <Text
                                style={{
                                    color: colors.foreground,
                                    fontFamily: typography.fonts.sansMedium,
                                    fontSize: 13,
                                    marginLeft: 6
                                }}
                            >
                                Plan
                            </Text>
                        </TouchableOpacity>
                    )}

                    {showLogAction && onLogWeave && (
                        <TouchableOpacity
                            onPress={() => onLogWeave(insight)}
                            activeOpacity={0.7}
                            className="flex-row items-center px-3 py-2 rounded-full"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <PenLine size={14} color={colors.foreground} />
                            <Text
                                style={{
                                    color: colors.foreground,
                                    fontFamily: typography.fonts.sansMedium,
                                    fontSize: 13,
                                    marginLeft: 6
                                }}
                            >
                                Log
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Animated.View>
    )
}
