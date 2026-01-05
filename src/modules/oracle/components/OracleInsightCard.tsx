import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated'
import { Sparkles, X, ArrowRight } from 'lucide-react-native'
import ProactiveInsight from '@/db/models/ProactiveInsight'
import { useTheme } from '@/shared/hooks/useTheme'

interface OracleInsightCardProps {
    insight: ProactiveInsight
    onAction: (insight: ProactiveInsight) => void
    onDismiss: (insight: ProactiveInsight) => void
    compact?: boolean
}

export function OracleInsightCard({ insight, onAction, onDismiss, compact = false }: OracleInsightCardProps) {
    const { isDarkMode: isDark } = useTheme()

    // Magical/Wisdom aesthetic colors
    const gradientColors = isDark
        ? ['#2D1B4E', '#1A1625'] // Deep Purple -> Dark
        : ['#E6DFF7', '#FAF9FD'] // Light Lilac -> White

    const accentColor = isDark ? '#FFD700' : '#8A4FFF' // Gold / Purple
    const textColor = isDark ? '#F5F1E8' : '#2D3142'

    return (
        <Animated.View
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(300)}
            layout={Layout.springify()}
            className="mb-4 mx-1 rounded-2xl overflow-hidden shadow-sm"
            style={{
                shadowColor: accentColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 8,
            }}
        >
            <LinearGradient
                colors={gradientColors as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: compact ? 12 : 16 }}
            >
                {/* Header Badge */}
                <View className="flex-row justify-between items-start mb-2">
                    <View className="flex-row items-center bg-white/10 px-2 py-1 rounded-full border border-white/20">
                        <Sparkles size={12} color={accentColor} />
                        <Text
                            className="text-xs font-medium ml-1.5"
                            style={{ color: accentColor, letterSpacing: 0.5 }}
                        >
                            ORACLE INSIGHT
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => onDismiss(insight)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="p-1 rounded-full bg-black/5"
                    >
                        <X size={14} color={isDark ? '#FFFFFF60' : '#00000040'} />
                    </TouchableOpacity>
                </View>

                {/* Content */}
                <View className="mb-4">
                    <Text
                        className={`${compact ? 'text-base' : 'text-lg'} font-bold mb-1`}
                        style={{ color: textColor, fontFamily: 'Lora_700Bold' }}
                    >
                        {insight.headline}
                    </Text>
                    <Text
                        className={`${compact ? 'text-xs' : 'text-sm'} leading-5`}
                        style={{ color: isDark ? '#E2E2E2' : '#4A5568', fontFamily: 'Inter_400Regular' }}
                        numberOfLines={compact ? 2 : undefined}
                    >
                        {insight.body}
                    </Text>
                </View>

                {/* Action Button */}
                <TouchableOpacity
                    onPress={() => onAction(insight)}
                    activeOpacity={0.8}
                >
                    <BlurView
                        intensity={20}
                        tint={isDark ? 'light' : 'dark'}
                        className="flex-row items-center justify-between px-4 py-3 rounded-xl overflow-hidden"
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.03)' }}
                    >
                        <Text
                            className="text-sm font-semibold"
                            style={{ color: textColor }}
                        >
                            {insight.actionLabel}
                        </Text>
                        <View className="bg-white/20 rounded-full p-1">
                            <ArrowRight size={14} color={textColor} />
                        </View>
                    </BlurView>
                </TouchableOpacity>

            </LinearGradient>
        </Animated.View>
    )
}
