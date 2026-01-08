import React, { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
    FadeIn,
    FadeOut
} from 'react-native-reanimated'
import { Sparkles } from 'lucide-react-native' // Using Sparkles as a magical placeholder icon
import { useTheme } from '@/shared/hooks/useTheme'
import { Text } from '@/shared/ui/Text'

export function OracleSplashScreen() {
    const { colors, typography } = useTheme()

    // Animation values
    const scale = useSharedValue(1)
    const opacity = useSharedValue(0.8)
    const rotate = useSharedValue(0)

    useEffect(() => {
        // Pulsing breathing effect
        scale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) })
            ),
            -1,
            true
        )

        // Subtle opacity pulse
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        )

        // Slow rotation for magic feel
        rotate.value = withRepeat(
            withTiming(360, { duration: 20000, easing: Easing.linear }),
            -1,
            false // Don't reverse, just keep spinning slowly
        )
    }, [])

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { rotate: `${rotate.value}deg` } // Subtle rotation
        ],
        opacity: opacity.value
    }))

    return (
        <View className="flex-1 items-center justify-center bg-background">
            <Animated.View
                entering={FadeIn.duration(400)}
                exiting={FadeOut.duration(300)}
                className="items-center justify-center"
            >
                {/* Main Icon */}
                <Animated.View style={[animatedIconStyle, { marginBottom: 24 }]}>
                    <Sparkles
                        size={64}
                        color={colors.primary}
                        fill={colors.primary}
                        opacity={0.2}
                    />
                </Animated.View>

                {/* Text */}
                <Text
                    variant="h3"
                    style={{
                        fontFamily: typography.fonts.serifBold,
                        color: colors.foreground,
                        marginBottom: 8
                    }}
                >
                    Weave Oracle
                </Text>

                <Text
                    variant="body"
                    style={{
                        color: colors['muted-foreground'],
                        opacity: 0.8
                    }}
                >
                    Consulting the stars...
                </Text>
            </Animated.View>
        </View>
    )
}
