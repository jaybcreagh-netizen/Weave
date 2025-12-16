import React, { useEffect } from 'react';
import { Pressable, ViewStyle } from 'react-native';
import Animated, {
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
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
    const { tokens } = useTheme();

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
            className="w-[50px] h-[30px] justify-center"
            style={style}
        >
            <Animated.View
                className="w-full h-full rounded-full justify-center"
                style={containerAnimatedStyle}
            >
                <Animated.View
                    className="w-[26px] h-[26px] rounded-full absolute left-0 shadow-sm"
                    style={[{ backgroundColor: knobColor }, knobAnimatedStyle]}
                />
            </Animated.View>
        </Pressable>
    );
}

