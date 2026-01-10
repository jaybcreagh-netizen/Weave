/**
 * VoiceDictationButton - Microphone button component for voice input
 * 
 * PROTOTYPE SKETCH - Not production ready
 * This demonstrates the UI pattern for voice dictation.
 */

import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    withSequence,
    cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';

interface VoiceDictationButtonProps {
    /** Whether currently recording */
    isRecording: boolean;
    /** Called when button is pressed to toggle recording */
    onPress: () => void;
    /** Whether voice input is available */
    isAvailable?: boolean;
    /** Size of the button */
    size?: 'sm' | 'md' | 'lg';
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export function VoiceDictationButton({
    isRecording,
    onPress,
    isAvailable = true,
    size = 'md',
}: VoiceDictationButtonProps) {
    const { colors } = useTheme();

    // Pulse animation for recording state
    const pulseScale = useSharedValue(1);

    React.useEffect(() => {
        if (isRecording) {
            pulseScale.value = withRepeat(
                withSequence(
                    withTiming(1.15, { duration: 500 }),
                    withTiming(1, { duration: 500 })
                ),
                -1, // infinite
                true
            );
        } else {
            cancelAnimation(pulseScale);
            pulseScale.value = withTiming(1, { duration: 200 });
        }
    }, [isRecording]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pulseScale.value }],
    }));

    const sizeConfig = {
        sm: { button: 32, icon: 16, padding: 8 },
        md: { button: 44, icon: 22, padding: 11 },
        lg: { button: 56, icon: 28, padding: 14 },
    };

    const config = sizeConfig[size];
    const Icon = isRecording ? MicOff : Mic;

    if (!isAvailable) {
        return null;
    }

    return (
        <AnimatedTouchable
            onPress={onPress}
            activeOpacity={0.7}
            style={[
                animatedStyle,
                {
                    width: config.button,
                    height: config.button,
                    borderRadius: config.button / 2,
                    backgroundColor: isRecording ? colors.destructive : colors.primary,
                    justifyContent: 'center',
                    alignItems: 'center',
                    // Subtle shadow
                    shadowColor: isRecording ? colors.destructive : colors.primary,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 4,
                },
            ]}
        >
            <Icon size={config.icon} color="#FFFFFF" />
        </AnimatedTouchable>
    );
}

/**
 * VoiceDictationIndicator - Shows recording status with waveform
 * 
 * Use this inline with text to show partial transcription
 */
export function VoiceDictationIndicator({
    isRecording,
    partialText,
}: {
    isRecording: boolean;
    partialText: string;
}) {
    const { colors } = useTheme();

    if (!isRecording) return null;

    return (
        <View
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 8,
                paddingHorizontal: 12,
                backgroundColor: `${colors.primary}15`,
                borderRadius: 8,
                marginTop: 8,
            }}
        >
            <View
                style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: colors.destructive,
                    marginRight: 8,
                }}
            />
            <Animated.Text
                style={{
                    flex: 1,
                    color: colors.foreground,
                    fontStyle: 'italic',
                    opacity: 0.8,
                }}
            >
                {partialText || 'Listening...'}
            </Animated.Text>
        </View>
    );
}
