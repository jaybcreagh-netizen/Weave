import React, { useEffect } from 'react'
import { View } from 'react-native'
import { WeaveIcon } from '@/shared/components/WeaveIcon'
import { useTheme } from '@/shared/hooks/useTheme'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming,
    Easing,
    ZoomIn,
    FadeOut
} from 'react-native-reanimated'

export function ThinkingBubble() {
    const { colors } = useTheme()

    // Animation values for the dots
    const dot1 = useSharedValue(0)
    const dot2 = useSharedValue(0)
    const dot3 = useSharedValue(0)

    useEffect(() => {
        const duration = 600
        const easing = Easing.inOut(Easing.ease)

        // Staggered jumping animation
        const animateDot = (dot: any, delay: number) => {
            setTimeout(() => {
                dot.value = withRepeat(
                    withSequence(
                        withTiming(-6, { duration: duration / 2, easing }), // Jump up
                        withTiming(0, { duration: duration / 2, easing }),  // Land
                        withTiming(0, { duration: duration / 2 }),          // Pause
                    ),
                    -1,
                    false
                )
            }, delay)
        }

        animateDot(dot1, 0)
        animateDot(dot2, 200)
        animateDot(dot3, 400)
    }, [])

    const createDotStyle = (dotContext: any) => useAnimatedStyle(() => ({
        transform: [{ translateY: dotContext.value }],
        opacity: 0.7
    }))

    return (
        <Animated.View
            entering={ZoomIn.duration(300)}
            exiting={FadeOut.duration(200)}
            className="flex-row justify-start mb-4"
        >
            <View
                className="w-8 h-8 rounded-full items-center justify-center mr-2 mt-1"
                style={{ backgroundColor: colors.primary }}
            >
                <WeaveIcon size={16} color={colors['primary-foreground']} />
            </View>
            <View
                className="px-4 py-3 rounded-2xl rounded-tl-none flex-row items-center gap-1.5 h-[46px]"
                style={{
                    backgroundColor: colors.card,
                    borderWidth: 1,
                    borderColor: colors.border
                }}
            >
                <Animated.View
                    style={[{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.foreground
                    }, createDotStyle(dot1)]}
                />
                <Animated.View
                    style={[{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.foreground
                    }, createDotStyle(dot2)]}
                />
                <Animated.View
                    style={[{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.foreground
                    }, createDotStyle(dot3)]}
                />
            </View>
        </Animated.View>
    )
}
