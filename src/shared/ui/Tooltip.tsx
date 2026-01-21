import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeOut, BounceIn } from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface TooltipProps {
    visible: boolean;
    text: string;
    onDismiss: () => void;
    position?: 'top' | 'bottom' | 'left' | 'right';
    targetStyle?: object; // Style object to align with target
    arrowStyle?: object; // Style object for the arrow
    offsetX?: number;
    offsetY?: number;
}

export function Tooltip({
    visible,
    text,
    onDismiss,
    position = 'top',
    targetStyle,
    arrowStyle,
    offsetX = 0,
    offsetY = 0
}: TooltipProps) {
    const { colors, isDarkMode } = useTheme();

    if (!visible) return null;

    // Determine text color based on primary color brightness
    // For now, assuming primary is always dark enough for white text (Amber 800 / Gold Light)
    // Actually Gold Light is light. 
    // If Dark Mode -> Primary is Gold Light (#D4A855). White text might be hard to read?
    // Let's check contrast. Gold #D4A855 on White #FFF? No, Gold Background.
    // Gold Background with White Text? Maybe low contrast.
    // Gold Background with Dark Text? Better.
    // User requested "App Brown". 
    // If I force "App Brown" (Amber 800) even in dark mode, it ensures White Text works.
    // But tokens say Dark Mode Primary is Gold.
    // Let's stick to `colors.primary` and handle text color dynamically if possible, or force White for now if primary is dark-ish.
    // If Primary is Gold (#D4A855) -> Black text is better.
    // If Primary is Amber 800 (#92400E) -> White text is better.

    // Let's check `isDarkMode`.
    const textColor = isDarkMode ? colors['primary-foreground'] : '#FFFFFF';

    return (
        <Animated.View
            entering={FadeIn.duration(300)}
            exiting={FadeOut.duration(200)}
            style={[
                styles.container,
                targetStyle,
                {
                    transform: [
                        { translateX: offsetX },
                        { translateY: offsetY }
                    ]
                }
            ]}
            pointerEvents="box-none"
        >
            <Animated.View
                entering={BounceIn.delay(100)}
                style={[
                    styles.bubble,
                    { backgroundColor: colors.primary }
                ]}
            >
                <Text style={[styles.text, { color: textColor }]}>
                    {text}
                </Text>

                <TouchableOpacity
                    onPress={onDismiss}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.closeButton}
                >
                    <X size={14} color={textColor} opacity={0.8} />
                </TouchableOpacity>

                {/* Arrow Triangle */}
                <View style={[
                    styles.arrow,
                    position === 'top' && styles.arrowBottom,
                    position === 'bottom' && styles.arrowTop,
                    position === 'left' && styles.arrowRight,
                    position === 'right' && styles.arrowLeft,
                    { borderTopColor: colors.primary },
                    arrowStyle
                ]} />
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        zIndex: 1000,
        // Remove alignItems: 'center' to allow custom positioning behavior
        alignItems: 'center',
        justifyContent: 'center',
    },
    bubble: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
        maxWidth: 240,
    },
    text: {
        fontSize: 14,
        fontWeight: '600',
        fontFamily: 'Inter_600SemiBold',
        marginRight: 8,
        flexShrink: 1,
    },
    closeButton: {
        marginLeft: 4,
    },
    arrow: {
        position: 'absolute',
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 6,
        borderRightWidth: 6,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
    },
    arrowBottom: {
        bottom: -6,
        left: '50%',
        marginLeft: -6,
    },
    arrowTop: {
        top: -6,
        left: '50%',
        marginLeft: -6,
        transform: [{ rotate: '180deg' }]
    },
    arrowRight: {
        right: -6,
        top: '50%',
        marginTop: -6,
        transform: [{ rotate: '-90deg' }]
    },
    arrowLeft: {
        left: -6,
        top: '50%',
        marginTop: -6,
        transform: [{ rotate: '90deg' }]
    }
});
