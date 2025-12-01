import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/shared/hooks/useTheme';

interface ActionButtonsProps {
    buttonsOpacity: SharedValue<number>;
    onLogWeave: () => void;
    onPlanWeave: () => void;
}

export function ActionButtons({
    buttonsOpacity,
    onLogWeave,
    onPlanWeave,
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
                        <Text style={[styles.actionButtonTextPrimary, { color: colors['primary-foreground'] }]}>Log a Weave</Text>
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
                        <Text style={[styles.actionButtonTextSecondary, { color: colors.foreground }]}>Plan a Weave</Text>
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
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    actionButtonPrimary: {},
    actionButtonSecondary: {},
    buttonGradient: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
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
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
    actionButtonTextSecondary: {
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.2,
    },
});
