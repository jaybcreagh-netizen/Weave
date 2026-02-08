import React, { useEffect } from 'react';
import { View, Image } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { useTheme } from '@/shared/hooks/useTheme';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    withSequence,
    Easing
} from 'react-native-reanimated';

export const WeavingLoader = () => {
    const { colors } = useTheme();

    // Animation values matching OracleSplashScreen
    const scale = useSharedValue(1);
    const opacity = useSharedValue(0.8);
    const rotate = useSharedValue(0);
    const textOpacity = useSharedValue(1);

    // Status text cycling
    const [statusIndex, setStatusIndex] = React.useState(0);
    const statuses = [
        "Weaving insights...",
        "Connecting threads...",
        "Identifying themes...",
        "Crafting suggestions..."
    ];

    useEffect(() => {
        // Pulsing breathing effect (Oracle style)
        scale.value = withRepeat(
            withSequence(
                withTiming(1.1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
                withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) })
            ),
            -1,
            true
        );

        // Subtle opacity pulse (Oracle style)
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.6, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
                withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) })
            ),
            -1,
            true
        );

        // Slow rotation for magic feel (Oracle style)
        rotate.value = withRepeat(
            withTiming(360, { duration: 20000, easing: Easing.linear }),
            -1,
            false
        );

        // Cycle text
        const interval = setInterval(() => {
            textOpacity.value = withSequence(
                withTiming(0, { duration: 300 }),
                withTiming(1, { duration: 300 })
            );
            setTimeout(() => {
                setStatusIndex((prev) => (prev + 1) % statuses.length);
            }, 300);
        }, 2500);

        return () => clearInterval(interval);
    }, []);

    const animatedIconStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value },
            { rotate: `${rotate.value}deg` }
        ],
        opacity: opacity.value
    }));

    const textStyle = useAnimatedStyle(() => ({
        opacity: textOpacity.value
    }));

    return (
        <View className="flex-row items-center space-x-4 p-2">
            {/* Animated Logo Container */}
            <View className="w-12 h-12 items-center justify-center relative">
                <Animated.View style={animatedIconStyle}>
                    <Image
                        source={require('@/assets/icon.png')}
                        style={{ width: 40, height: 40, tintColor: colors.primary }}
                        resizeMode="contain"
                    />
                </Animated.View>
            </View>

            {/* Cycling Text */}
            <View>
                <Animated.View style={textStyle}>
                    <Text variant="body" weight="medium" className="text-foreground">
                        {statuses[statusIndex]}
                    </Text>
                </Animated.View>
                <Text variant="caption" className="text-muted-foreground">
                    Just a moment
                </Text>
            </View>
        </View>
    );
};
