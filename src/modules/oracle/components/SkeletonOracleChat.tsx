import React, { useEffect } from 'react';
import { View, Platform, DimensionValue } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    Easing,
    withSequence,
    withDelay,
    FadeIn,
    ZoomIn
} from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';

interface SkeletonProps {
    width?: DimensionValue;
    height?: DimensionValue;
    borderRadius?: number;
    style?: any;
    delay?: number;
}

function SkeletonBlock({ width, height, borderRadius = 8, style, delay = 0 }: SkeletonProps) {
    const { colors, isDarkMode } = useTheme();
    // Brighter/lighter base for "not heavy grey" feel
    // Start at 0 opacity and fade in to 0.3 then pulse
    const opacity = useSharedValue(0);

    useEffect(() => {
        opacity.value = withDelay(delay,
            withSequence(
                withTiming(0.3, { duration: 400 }), // Enter
                withRepeat(
                    withSequence(
                        withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.quad) }),
                        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.quad) })
                    ),
                    -1,
                    true
                )
            )
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
                backgroundColor: isDarkMode ? colors.muted : '#E5E5E5',
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
                {/* Icon Placeholder - Circle - Breathing scale */}
                <Animated.View entering={ZoomIn.duration(400)}>
                    <SkeletonBlock width={128} height={128} borderRadius={64} style={{ marginBottom: 24 }} delay={0} />
                </Animated.View>

                {/* Title Placeholder */}
                <SkeletonBlock width={200} height={24} borderRadius={6} style={{ marginBottom: 24 }} delay={50} />

                {/* Chips Placeholders */}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <SkeletonBlock width={140} height={36} borderRadius={18} delay={100} />
                    <SkeletonBlock width={140} height={36} borderRadius={18} delay={150} />
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
                    <SkeletonBlock width={120} height={12} borderRadius={4} delay={200} />
                </View>

                {/* Send Button Skeleton */}
                <SkeletonBlock width={48} height={48} borderRadius={24} delay={250} />
            </View>

            {/* Keyboard spacer */}
            {Platform.OS === 'ios' && <View style={{ height: 20 }} />}
        </View>
    );
}
