
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence
} from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';

export function SkeletonJournalFeed() {
    const { colors } = useTheme();
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.7, { duration: 1000 }),
                withTiming(0.3, { duration: 1000 })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    return (
        <View className="flex-1 px-5 pt-2">
            {[1, 2, 3, 4, 5].map((key) => (
                <View
                    key={key}
                    className="mb-3 p-4 rounded-2xl border"
                    style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border
                    }}
                >
                    {/* Header: Icon + Date */}
                    <View className="flex-row items-center gap-2 mb-2">
                        <Animated.View
                            className="w-4 h-4 rounded-sm"
                            style={[{ backgroundColor: colors.muted }, animatedStyle]}
                        />
                        <Animated.View
                            className="w-20 h-3 rounded-md"
                            style={[{ backgroundColor: colors.muted }, animatedStyle]}
                        />
                    </View>

                    {/* Title */}
                    <Animated.View
                        className="w-3/4 h-5 rounded-md mb-2"
                        style={[{ backgroundColor: colors.muted }, animatedStyle]}
                    />

                    {/* Content Lines */}
                    <Animated.View
                        className="w-full h-3 rounded-md mb-1"
                        style={[{ backgroundColor: colors.muted }, animatedStyle]}
                    />
                    <Animated.View
                        className="w-5/6 h-3 rounded-md"
                        style={[{ backgroundColor: colors.muted }, animatedStyle]}
                    />
                </View>
            ))}
        </View>
    );
}
