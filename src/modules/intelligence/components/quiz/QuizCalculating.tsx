/**
 * QuizCalculating
 * 
 * Brief loading state while "calculating" results.
 * Builds anticipation with animation.
 */

import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence,
    Easing,
} from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';

import { Text } from '@/shared/ui/Text';
import { useTheme } from '@/shared/hooks/useTheme';

interface QuizCalculatingProps {
    onComplete: () => void;
}

export function QuizCalculating({ onComplete }: QuizCalculatingProps) {
    const { colors } = useTheme();
    const rotation = useSharedValue(0);
    const scale = useSharedValue(1);

    useEffect(() => {
        // Rotate animation
        rotation.value = withRepeat(
            withTiming(360, { duration: 2000, easing: Easing.linear }),
            -1,
            false
        );

        // Pulse animation
        scale.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 500, easing: Easing.out(Easing.quad) }),
                withTiming(1, { duration: 500, easing: Easing.in(Easing.quad) })
            ),
            -1,
            true
        );

        // Auto-complete after 2 seconds
        const timer = setTimeout(onComplete, 2000);
        return () => clearTimeout(timer);
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { rotate: `${rotation.value}deg` },
            { scale: scale.value },
        ],
    }));

    return (
        <View className="flex-1 items-center justify-center px-6">
            <Animated.View className="mb-6" style={animatedStyle}>
                <Sparkles size={64} color={colors.primary} />
            </Animated.View>

            <Text variant="h3" className="text-center">
                Revealing your archetype...
            </Text>
        </View>
    );
}
