/**
 * StarterPromptChips Component
 * Displays tappable prompt chips for the Oracle empty state.
 */

import React from 'react'
import { View, TouchableOpacity, Text } from 'react-native'
import Animated, {
    FadeInDown,
    FadeOutUp,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    Easing,
    ZoomIn,
    ZoomOut,
    LinearTransition
} from 'react-native-reanimated'
import { useTheme } from '@/shared/hooks/useTheme'
import { useStarterPrompts, StarterPrompt, OracleEntryPoint } from '../hooks/useStarterPrompts'
import { RefreshCcw } from 'lucide-react-native'

interface StarterPromptChipsProps {
    onSelect: (prompt: StarterPrompt) => void
    context?: OracleEntryPoint
}

const LoadingSkeleton = ({ colors }: { colors: any }) => {
    // Pulse animation
    const opacity = useSharedValue(0.3)

    React.useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.quad) }),
                withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.quad) })
            ),
            -1,
            true
        )
    }, [])

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }))

    return (
        <Animated.View
            entering={FadeInDown.duration(400)}
            exiting={FadeOutUp.duration(300)}
            className="w-full items-center"
        >
            <View style={{ flexDirection: 'row', gap: 6, justifyContent: 'center', flexWrap: 'wrap', paddingHorizontal: 24 }}>
                {[1, 2, 3].map((i) => (
                    <Animated.View
                        key={`skeleton-${i}`}
                        style={[{
                            width: 80 + (i * 20),
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: colors.border,
                        }, animatedStyle]}
                    />
                ))}
            </View>
            <View className="mt-4 opacity-40 flex-row items-center">
                <RefreshCcw size={14} color={colors['muted-foreground']} style={{ marginRight: 6 }} />
                <Text style={{ fontFamily: 'Inter', fontSize: 11, color: colors['muted-foreground'] }}>
                    Generating...
                </Text>
            </View>
        </Animated.View>
    )
}

export function StarterPromptChips({ onSelect, context = 'default' }: StarterPromptChipsProps) {
    const { colors, typography } = useTheme()
    const { prompts, refresh, loading } = useStarterPrompts(context)

    // Combine loading check inside the render to allow exit animations
    return (
        <View className="mt-8 w-full items-center min-h-[100px]">
            {loading && prompts.length === 0 ? (
                <LoadingSkeleton colors={colors} />
            ) : (
                <>
                    {prompts.length > 0 && (
                        <View
                            style={{
                                flexDirection: 'row',
                                flexWrap: 'wrap',
                                justifyContent: 'center',
                                gap: 6,
                                paddingHorizontal: 24,
                            }}
                        >
                            {prompts.map((prompt, index) => (
                                <Animated.View
                                    key={prompt.id}
                                    entering={ZoomIn.delay(index * 50).springify().damping(12)}
                                    exiting={ZoomOut.duration(200)}
                                    layout={LinearTransition.delay(100)}
                                >
                                    <TouchableOpacity
                                        onPress={() => onSelect(prompt)}
                                        style={{
                                            paddingHorizontal: 12,
                                            paddingVertical: 6,
                                            borderRadius: 16,
                                            backgroundColor: 'transparent',
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                            opacity: 0.7,
                                        }}
                                        activeOpacity={0.6}
                                    >
                                        <Text
                                            style={{
                                                color: colors['muted-foreground'],
                                                fontFamily: typography.fonts.sans,
                                                fontSize: 12,
                                            }}
                                            numberOfLines={1}
                                        >
                                            {prompt.text}
                                        </Text>
                                    </TouchableOpacity>
                                </Animated.View>
                            ))}
                        </View>
                    )}

                    {loading ? (
                        <View className="mt-4 opacity-40 flex-row items-center">
                            <Animated.View
                                style={{ marginRight: 6 }}
                                entering={FadeInDown.duration(300)}
                            >
                                <RefreshCcw size={14} color={colors['muted-foreground']} />
                            </Animated.View>
                            <Animated.Text
                                entering={FadeInDown.duration(300).delay(100)}
                                style={{ fontFamily: typography.fonts.sans, fontSize: 11, color: colors['muted-foreground'] }}
                            >
                                Generating...
                            </Animated.Text>
                        </View>
                    ) : (
                        prompts.length > 0 && (
                            <TouchableOpacity
                                onPress={refresh}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                className="mt-4 flex-row items-center justify-center opacity-40"
                            >
                                <RefreshCcw size={14} color={colors['muted-foreground']} style={{ marginRight: 6 }} />
                                <Text style={{ fontFamily: typography.fonts.sans, fontSize: 11, color: colors['muted-foreground'] }}>
                                    Refresh suggestions
                                </Text>
                            </TouchableOpacity>
                        )
                    )}
                </>
            )}
        </View>
    )
}
