import React, { useEffect } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';

interface ModernSwitchProps {
    value: boolean;
    onValueChange: (value: boolean) => void;
    disabled?: boolean;
    style?: ViewStyle;
}

const SWITCH_WIDTH = 50;
const SWITCH_HEIGHT = 30;
const KNOB_SIZE = 26;
const PADDING = 2;

export function ModernSwitch({
    value,
    onValueChange,
    disabled = false,
    style,
}: ModernSwitchProps) {
    const { tokens, isDarkMode } = useTheme();

    // Animation values
    const progress = useSharedValue(value ? 1 : 0);
    const pressed = useSharedValue(0);

    // Sync external value changes
    useEffect(() => {
        progress.value = withSpring(value ? 1 : 0, {
            mass: 0.8,
            damping: 12,
            stiffness: 120,
        });
    }, [value]);

    const handlePress = async () => {
        if (disabled) return;

        // Haptic feedback
        if (process.env.EXPO_OS === 'ios') {
            await Haptics.selectionAsync();
        }

        onValueChange(!value);
    };

    const handlePressIn = () => {
        pressed.value = withSpring(1, { mass: 0.5 });
    };

    const handlePressOut = () => {
        pressed.value = withSpring(0, { mass: 0.5 });
    };

    // Colors
    const activeColor = tokens.success; // Green for ON
    const inactiveColor = tokens.border; // Muted for OFF
    const knobColor = '#FFFFFF';

    const containerAnimatedStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            progress.value,
            [0, 1],
            [inactiveColor, activeColor]
        );

        return {
            backgroundColor,
        };
    });

    const knobAnimatedStyle = useAnimatedStyle(() => {
        const translateX = interpolate(
            progress.value,
            [0, 1],
            [PADDING, SWITCH_WIDTH - KNOB_SIZE - PADDING]
        );

        // Scale effect on press
        const scale = interpolate(pressed.value, [0, 1], [1, 0.9]);

        // Stretch effect when moving (optional, keep simple for now)
        const width = interpolate(pressed.value, [0, 1], [KNOB_SIZE, KNOB_SIZE + 4]);

        return {
            transform: [
                { translateX },
                { scale },
            ],
            width,
        };
    });

    return (
        <Pressable
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled}
            style={[styles.container, style]}
        >
            <Animated.View style={[styles.track, containerAnimatedStyle]}>
                <Animated.View style={[styles.knob, { backgroundColor: knobColor }, knobAnimatedStyle]} />
            </Animated.View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    container: {
        width: SWITCH_WIDTH,
        height: SWITCH_HEIGHT,
        justifyContent: 'center',
    },
    track: {
        width: '100%',
        height: '100%',
        borderRadius: SWITCH_HEIGHT / 2,
        justifyContent: 'center',
    },
    knob: {
        width: KNOB_SIZE,
        height: KNOB_SIZE,
        borderRadius: KNOB_SIZE / 2,
        position: 'absolute',
        left: 0,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.2,
        shadowRadius: 2.5,
        elevation: 4,
    },
});
