
import React, { useEffect } from 'react';
import { View, Platform, Text } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withSequence
} from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';

export function SkeletonOracleChat() {
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
        <View className="flex-1 px-4">
            {/* Carousel Placeholder */}
            <View className="mb-4 mt-2">
                <Animated.View
                    style={[{
                        height: 140,
                        backgroundColor: colors.card,
                        borderRadius: 16,
                        borderColor: colors.border,
                        borderWidth: 1
                    }, animatedStyle]}
                />
            </View>

            {/* Empty State Placeholder - Center Icon */}
            <View className="flex-1 items-center justify-center p-6 pb-20">
                <Animated.View
                    className="w-32 h-32 rounded-full mb-6"
                    style={[{ backgroundColor: colors.muted }, animatedStyle]}
                />

                {/* Text Lines */}
                <Animated.View
                    className="h-6 w-48 rounded-md mb-2"
                    style={[{ backgroundColor: colors.muted }, animatedStyle]}
                />

                {/* Chips Row */}
                <View className="flex-row gap-2 mt-6">
                    <Animated.View
                        className="h-10 w-24 rounded-full"
                        style={[{ backgroundColor: colors.muted }, animatedStyle]}
                    />
                    <Animated.View
                        className="h-10 w-24 rounded-full"
                        style={[{ backgroundColor: colors.muted }, animatedStyle]}
                    />
                </View>
            </View>

            {/* Input Bar Placeholder */}
            <View className="flex-row items-end gap-2 py-3 border-t" style={{ borderColor: colors.border }}>
                <View
                    className="flex-1 h-12 rounded-xl justify-center px-3"
                    style={{ backgroundColor: colors.input }}
                >
                    <Animated.Text
                        style={[{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }, animatedStyle]}
                    >
                        Ask a question...
                    </Animated.Text>
                </View>
                <View
                    className="w-12 h-12 rounded-full items-center justify-center"
                    style={{ backgroundColor: colors.primary, opacity: 0.5 }}
                >
                    <View style={{ width: 20, height: 20, backgroundColor: colors['primary-foreground'], borderRadius: 10, opacity: 0.5 }} />
                </View>
            </View>

            {/* Keyboard spacer */}
            {Platform.OS === 'ios' && <View style={{ height: 20 }} />}
        </View>
    );
}
