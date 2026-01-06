import React, { useEffect } from 'react';
import { View, Platform, DimensionValue } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    withSequence
} from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';

interface SkeletonProps {
    width?: DimensionValue;
    height?: DimensionValue;
    borderRadius?: number;
    style?: any;
}

function SkeletonBlock({ width, height, borderRadius = 8, style }: SkeletonProps) {
    const { colors, isDarkMode } = useTheme();
    // Brighter/lighter base for "not heavy grey" feel
    const opacity = useSharedValue(0.3);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(
                withTiming(0.6, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
                withTiming(0.3, { duration: 1000, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value
    }));

    return (
        <Animated.View
            style={[{
                width,
                height,
                borderRadius,
                backgroundColor: isDarkMode ? colors.muted : '#E5E5E5', // Lighter grey in light mode
            }, style, animatedStyle]}
        />
    );
}

export function SkeletonOracleChat() {
    const { colors } = useTheme();

    return (
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
            {/* Center Content Placeholder */}
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 80 }}>
                {/* Icon Placeholder - Circle */}
                <SkeletonBlock width={128} height={128} borderRadius={64} style={{ marginBottom: 24 }} />

                {/* Title Placeholder - "What's on your mind?" */}
                <SkeletonBlock width={200} height={24} borderRadius={6} style={{ marginBottom: 24 }} />

                {/* Chips Placeholders */}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <SkeletonBlock width={140} height={36} borderRadius={18} />
                    <SkeletonBlock width={140} height={36} borderRadius={18} />
                </View>
            </View>

            {/* Input Bar Placeholder */}
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'flex-end',
                    gap: 8,
                    paddingVertical: 12,
                    borderTopWidth: 1,
                    borderTopColor: colors.border
                }}
            >
                {/* Input Field Skeleton */}
                <View
                    style={{
                        flex: 1,
                        height: 48,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: colors.border,
                        padding: 12,
                        justifyContent: 'center',
                        backgroundColor: colors.card
                    }}
                >
                    <SkeletonBlock width={120} height={12} borderRadius={4} />
                </View>

                {/* Send Button Skeleton */}
                <SkeletonBlock width={48} height={48} borderRadius={24} />
            </View>

            {/* Keyboard spacer */}
            {Platform.OS === 'ios' && <View style={{ height: 20 }} />}
        </View>
    );
}
