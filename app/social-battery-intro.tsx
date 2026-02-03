/**
 * Social Battery Intro Screen
 * 
 * Final onboarding screen that collects the user's first social battery check-in.
 * Uses the moon slider component for consistency with the rest of the app.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ArrowRight } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Text } from '@/shared/ui/Text';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUserProfileStore } from '@/modules/auth';
import { useTutorialStore } from '@/shared/stores/tutorialStore';
import { MoonPhaseIllustration } from '@/modules/intelligence/components/social-season/YearInMoons/MoonPhaseIllustration';
import { BATTERY_STATES } from '@/modules/home/components/widgets/SocialBatterySheet';

const FIRST_RUN_COMPLETED_KEY = '@weave:first_run_completed';

export default function SocialBatteryIntroScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();
    const { submitBatteryCheckin } = useUserProfileStore();
    const markSocialBatterySeen = useTutorialStore((state) => state.markSocialBatterySeen);
    const [batteryLevel, setBatteryLevel] = useState<number>(3);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentState = BATTERY_STATES.find(s => s.value === batteryLevel) || BATTERY_STATES[2];

    const handleSliderChange = (value: number) => {
        const rounded = Math.round(value);
        setBatteryLevel(rounded);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleContinue = async () => {
        setIsSubmitting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            await submitBatteryCheckin(batteryLevel);
        } catch (error) {
            console.error('[SocialBatteryIntro] Error submitting:', error);
        }

        try {
            await Promise.all([
                AsyncStorage.setItem(FIRST_RUN_COMPLETED_KEY, 'true'),
                markSocialBatterySeen(),
            ]);
        } catch (error) {
            console.error('[SocialBatteryIntro] Error finalizing first-run setup:', error);
        }

        setIsSubmitting(false);
        router.replace('/dashboard');
    };

    const handleSkip = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await Promise.all([
                AsyncStorage.setItem(FIRST_RUN_COMPLETED_KEY, 'true'),
                markSocialBatterySeen(),
            ]);
        } catch (error) {
            console.error('[SocialBatteryIntro] Error finalizing skip flow:', error);
        }
        router.replace('/dashboard');
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 20 }]}>
            <View style={styles.content}>
                {/* Title */}
                <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.header}>
                    <Text
                        style={[styles.title, { color: colors.foreground }]}
                    >
                        One last thing...
                    </Text>
                    <Text
                        style={[styles.subtitle, { color: colors['muted-foreground'] }]}
                    >
                        How's your social energy today?
                    </Text>
                </Animated.View>

                {/* Moon Display */}
                <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.moonContainer}>
                    <MoonPhaseIllustration
                        phase={0}
                        batteryLevel={currentState.value}
                        size={100}
                        color={currentState.color}
                        hasCheckin={true}
                    />
                    <Text style={[styles.stateLabel, { color: colors.foreground }]}>
                        {currentState.shortDesc}
                    </Text>
                    <Text style={[styles.stateDescription, { color: colors['muted-foreground'] }]}>
                        {currentState.description}
                    </Text>
                </Animated.View>

                {/* Slider */}
                <Animated.View entering={FadeInDown.delay(300).duration(600)} style={styles.sliderContainer}>
                    <Slider
                        style={{ width: '100%', height: 40 }}
                        minimumValue={1}
                        maximumValue={5}
                        step={1}
                        value={batteryLevel}
                        onValueChange={handleSliderChange}
                        minimumTrackTintColor={currentState.color}
                        maximumTrackTintColor={colors.border}
                        thumbTintColor={currentState.color}
                    />
                    <View style={styles.sliderLabels}>
                        <Text style={[styles.sliderLabel, { color: colors['muted-foreground'] }]}>
                            Depleted
                        </Text>
                        <Text style={[styles.sliderLabel, { color: colors['muted-foreground'] }]}>
                            High
                        </Text>
                    </View>
                </Animated.View>

                {/* Explainer */}
                <Animated.View entering={FadeInDown.delay(400).duration(600)}>
                    <Text style={[styles.explainer, { color: colors['muted-foreground'] }]}>
                        This is your Social Battery. Weave tracks your seasons and tailors suggestions to how you're feeling.
                    </Text>
                </Animated.View>

                {/* Spacer */}
                <View style={styles.spacer} />

                {/* Actions */}
                <Animated.View entering={FadeInDown.delay(500).duration(600)} style={styles.footer}>
                    <TouchableOpacity
                        style={[styles.continueButton, { backgroundColor: colors.primary }]}
                        onPress={handleContinue}
                        disabled={isSubmitting}
                    >
                        <Text style={styles.continueButtonText}>
                            {isSubmitting ? 'Saving...' : 'Start Exploring'}
                        </Text>
                        <ArrowRight size={20} color="white" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.skipButton}
                        onPress={handleSkip}
                    >
                        <Text style={[styles.skipButtonText, { color: colors['muted-foreground'] }]}>
                            Skip for now
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 20,
    },
    header: {
        alignItems: 'center',
        marginBottom: 32,
    },
    title: {
        fontSize: 32,
        fontFamily: 'Lora_700Bold',
        textAlign: 'center',
        marginBottom: 12,
        lineHeight: 42,
    },
    subtitle: {
        fontSize: 18,
        textAlign: 'center',
        lineHeight: 26,
    },
    moonContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    stateLabel: {
        fontSize: 20,
        fontWeight: '600',
        marginTop: 16,
    },
    stateDescription: {
        fontSize: 14,
        marginTop: 4,
    },
    sliderContainer: {
        marginBottom: 24,
    },
    sliderLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
    },
    sliderLabel: {
        fontSize: 12,
    },
    explainer: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
        paddingHorizontal: 16,
    },
    spacer: {
        flex: 1,
    },
    footer: {
        paddingTop: 24,
        gap: 12,
    },
    continueButton: {
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    continueButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
    skipButton: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    skipButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
});
