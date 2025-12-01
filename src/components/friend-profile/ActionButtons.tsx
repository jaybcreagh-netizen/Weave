import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/shared/hooks/useTheme';

interface ActionButtonsProps {
    buttonsOpacity: SharedValue<number>;
    onLogWeave: () => void;
    onPlanWeave: () => void;
    onJournal: () => void;
}

export function ActionButtons({
    buttonsOpacity,
    onLogWeave,
    onPlanWeave,
    onJournal,
}: ActionButtonsProps) {
    const { colors } = useTheme();

    const buttonsAnimatedStyle = useAnimatedStyle(() => ({
        opacity: buttonsOpacity.value,
    }));

    return (
        <View style={styles.container}>
            <Animated.View style={[styles.actionButtonsContainer, buttonsAnimatedStyle]}>
                <TouchableOpacity
                    onPress={onLogWeave}
                    style={[styles.actionButton, styles.actionButtonPrimary]}
                >
                    <LinearGradient
                        colors={[colors.primary, `${colors.primary}DD`]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.buttonGradient}
                    >
                        <View style={styles.glassOverlay} />
                        <Text
                            style={[styles.actionButtonTextPrimary, { color: colors['primary-foreground'] }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                        >
                            Log Weave
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onJournal}
                    style={[
                        styles.actionButton,
                        styles.actionButtonSecondary,
                    ]}
                >
                    <LinearGradient
                        colors={[colors.card, colors.card]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.buttonGradient}
                    >
                        <View style={styles.glassOverlay} />
                        <Text
                            style={[styles.actionButtonTextSecondary, { color: colors.foreground }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                        >
                            Journal
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={onPlanWeave}
                    style={[styles.actionButton, styles.actionButtonSecondary]}
                >
                    <LinearGradient
                        colors={[colors.secondary, `${colors.secondary}CC`]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.buttonGradient}
                    >
                        <View style={styles.glassOverlay} />
                        <Text
                            style={[styles.actionButtonTextSecondary, { color: colors.foreground }]}
                            numberOfLines={1}
                            adjustsFontSizeToFit
                            minimumFontScale={0.8}
                        >
                            Plan Weave
                        </Text>
                    </LinearGradient>
                </TouchableOpacity>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { paddingHorizontal: 20, paddingBottom: 12 },
    actionButtonsContainer: { flexDirection: 'row', gap: 12 },
    actionButton: {
        flex: 1,
        borderRadius: 12,
        // Remove overflow: 'hidden' from here to allow shadow to show
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
        backgroundColor: 'transparent', // Ensure shadow works
    },
    actionButtonPrimary: {},
    actionButtonSecondary: {},
    buttonGradient: {
        // paddingVertical removed to allow flex centering to work perfectly with fixed height
        paddingHorizontal: 8,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        height: 48,
        borderRadius: 12, // Move border radius here
        overflow: 'hidden', // Clip the gradient and overlay here
    },
    glassOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '50%',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderBottomLeftRadius: 100,
        borderBottomRightRadius: 100,
    },
    actionButtonTextPrimary: {
        fontSize: 13, // Slightly smaller font
        fontWeight: '600',
        letterSpacing: 0.1,
        textAlign: 'center',
    },
    actionButtonTextSecondary: {
        fontSize: 13, // Slightly smaller font
        fontWeight: '600',
        letterSpacing: 0.1,
        textAlign: 'center',
    },
});
