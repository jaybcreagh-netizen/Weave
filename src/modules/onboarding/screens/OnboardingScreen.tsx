import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { ArrowRight, Lightbulb, Calendar, CheckCircle2 } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { theme } from '@/shared/theme/theme';
import { AnimatedThoughtBubbles } from '@/shared/components/onboarding/AnimatedThoughtBubbles';
import { ArchetypeImpactDemo } from '@/shared/components/onboarding/ArchetypeImpactDemo';
import { useTutorialStore } from '@/shared/stores/tutorialStore';

/**
 * Simplified Interactive Onboarding
 *
 * Flow:
 * 1. Hook - Emotional resonance
 * 2. Three pathways - Brief intro to Intentions/Plans/Logs
 * 3. → Redirect to add-friend (with contextual tutorials)
 *
 * All other learning happens in-context as users explore the app
 */
export function OnboardingScreen() {
    const router = useRouter();
    const completeOnboarding = useTutorialStore(state => state.completeOnboarding);

    const [currentStep, setCurrentStep] = useState(0);
    const steps = ['hook', 'pathways', 'ready'];
    const currentStepName = steps[currentStep];
    const isLastStep = currentStep === steps.length - 1;

    const handleNext = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        if (isLastStep) {
            await completeOnboarding();
            // Redirect to permissions screen, then to add-friend
            router.replace('/permissions');
        } else {
            setCurrentStep(prev => prev + 1);
        }
    };

    const handleSkip = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await completeOnboarding();
        router.replace('/permissions');
    };

    const renderStepContent = () => {
        switch (currentStepName) {
            case 'hook':
                return (
                    <Animated.View style={styles.stepContainer} entering={FadeInDown.duration(600)}>
                        <Text style={styles.title}>When did you last talk to...</Text>
                        <AnimatedThoughtBubbles
                            phrases={["your sister?", "your best friend?", "your college roommate?"]}
                        />
                        <Text style={styles.subtitle}>
                            Think of someone you care about deeply.{'\n'}When did you last connect?
                        </Text>
                        <Text style={styles.bodyText}>
                            Life gets busy. Friendships fade without intention.
                            {'\n\n'}
                            Weave helps you stay close to what matters, not through guilt, but through gentle guidance.
                        </Text>
                    </Animated.View>
                );

            case 'pathways':
                return (
                    <Animated.View style={styles.stepContainer} entering={FadeInDown.duration(600)}>
                        <Text style={styles.title}>Three ways to weave connection</Text>
                        <Text style={styles.subtitle}>Follow what feels right in each moment</Text>

                        <View style={styles.pyramidContainer}>
                            {/* Row 1: Intentions (top) */}
                            <View style={styles.pyramidRow}>
                                <PathwayCard
                                    icon={<Lightbulb size={24} color={theme.colors.primary} />}
                                    title="Intentions"
                                    subtitle="Hold the thread"
                                    description="A gentle wish to reconnect, without the weight of when or how."
                                    delay={300}
                                />
                            </View>

                            {/* Row 2: Plans and Logs */}
                            <View style={styles.pyramidRowDouble}>
                                <View style={styles.halfCard}>
                                    <PathwayCard
                                        icon={<Calendar size={24} color={theme.colors.primary} />}
                                        title="Plans"
                                        subtitle="Weave the future"
                                        description="When a day and time feel right, set them in place."
                                        delay={500}
                                        compact
                                    />
                                </View>
                                <View style={styles.halfCard}>
                                    <PathwayCard
                                        icon={<CheckCircle2 size={24} color={theme.colors.primary} />}
                                        title="Logs"
                                        subtitle="Remember the past"
                                        description="Honor the moments you've already shared."
                                        delay={700}
                                        compact
                                    />
                                </View>
                            </View>
                        </View>

                        <Text style={styles.footerText}>
                            You'll discover each one naturally as you explore.
                        </Text>
                    </Animated.View>
                );

            case 'archetypes':
                return <ArchetypeImpactDemo />;

            case 'ready':
                return (
                    <Animated.View style={styles.stepContainer} entering={FadeInDown.duration(600)}>
                        <Text style={styles.celebrationEmoji}>✨</Text>
                        <Text style={styles.title}>Ready to begin?</Text>
                        <Text style={styles.bodyText}>
                            Let's start by adding someone you care about.
                            {'\n\n'}
                            Weave will guide you gently as you go, learning through practice rather than instruction.
                        </Text>
                        <View style={styles.featuresList}>
                            <FeatureItem text="Add a friend and discover their archetype" />
                            <FeatureItem text="Experience your first QuickWeave" />
                            <FeatureItem text="Find your compass home" />
                        </View>
                    </Animated.View>
                );

            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Simple progress dots */}
            <View style={styles.header}>
                <View style={styles.progressDots}>
                    {steps.map((_, index) => (
                        <View
                            key={index}
                            style={[
                                styles.dot,
                                index === currentStep && styles.dotActive,
                            ]}
                        />
                    ))}
                </View>
                {!isLastStep && (
                    <TouchableOpacity onPress={handleSkip} style={styles.skipButton} activeOpacity={0.7}>
                        <Text style={styles.skipButtonText}>Skip</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                {renderStepContent()}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    onPress={handleNext}
                    style={[styles.nextButton, isLastStep && styles.nextButtonFinal]}
                    activeOpacity={0.8}
                >
                    <Text style={styles.nextButtonText}>
                        {isLastStep ? 'Let\'s go' : 'Continue'}
                    </Text>
                    <ArrowRight size={20} color="white" />
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

interface PathwayCardProps {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    description: string;
    delay: number;
    compact?: boolean;
}

function PathwayCard({ icon, title, subtitle, description, delay, compact }: PathwayCardProps) {
    return (
        <Animated.View
            style={[styles.pathwayCard, compact && styles.pathwayCardCompact]}
            entering={FadeInDown.delay(delay).duration(400).springify()}
        >
            <View style={styles.pathwayIcon}>{icon}</View>
            <Text style={styles.pathwayTitle}>{title}</Text>
            <Text style={styles.pathwaySubtitle}>{subtitle}</Text>
            {!compact && (
                <Text style={styles.pathwayDescription}>{description}</Text>
            )}
        </Animated.View>
    );
}

function FeatureItem({ text }: { text: string }) {
    return (
        <View style={styles.featureItem}>
            <View style={styles.featureDot} />
            <Text style={styles.featureText}>{text}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        paddingHorizontal: 24,
        position: 'relative',
    },
    progressDots: {
        flexDirection: 'row',
        gap: 8,
    },
    skipButton: {
        position: 'absolute',
        right: 24,
        paddingVertical: 8,
        paddingHorizontal: 12,
    },
    skipButtonText: {
        fontSize: 16,
        color: theme.colors['muted-foreground'],
        fontWeight: '600',
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.muted,
    },
    dotActive: {
        backgroundColor: theme.colors.primary,
        width: 24,
    },
    content: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    stepContainer: {
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontFamily: 'Lora_700Bold',
        textAlign: 'center',
        color: theme.colors.foreground,
        marginBottom: 16,
    },
    subtitle: {
        fontSize: 18,
        textAlign: 'center',
        color: theme.colors['muted-foreground'],
        marginBottom: 24,
        lineHeight: 26,
    },
    bodyText: {
        fontSize: 16,
        textAlign: 'center',
        color: theme.colors.foreground,
        lineHeight: 24,
        maxWidth: 400,
    },
    celebrationEmoji: {
        fontSize: 64,
        marginBottom: 16,
    },
    pyramidContainer: {
        width: '100%',
        marginVertical: 24,
        gap: 12,
    },
    pyramidRow: {
        alignItems: 'center',
    },
    pyramidRowDouble: {
        flexDirection: 'row',
        gap: 12,
    },
    halfCard: {
        flex: 1,
    },
    pathwayCard: {
        backgroundColor: theme.colors.card,
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: theme.colors.border,
        alignItems: 'center',
        width: '100%',
    },
    pathwayCardCompact: {
        padding: 16,
    },
    pathwayIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: `${theme.colors.primary}15`,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    pathwayTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: theme.colors.foreground,
        marginBottom: 4,
    },
    pathwaySubtitle: {
        fontSize: 14,
        color: theme.colors.primary,
        fontWeight: '600',
        marginBottom: 8,
    },
    pathwayDescription: {
        fontSize: 13,
        color: theme.colors['muted-foreground'],
        textAlign: 'center',
        lineHeight: 18,
    },
    footerText: {
        fontSize: 14,
        textAlign: 'center',
        color: theme.colors['muted-foreground'],
        fontStyle: 'italic',
        marginTop: 16,
    },
    featuresList: {
        marginTop: 32,
        gap: 16,
        width: '100%',
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    featureDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: theme.colors.primary,
    },
    featureText: {
        fontSize: 16,
        color: theme.colors.foreground,
    },
    footer: {
        padding: 24,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    nextButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    nextButtonFinal: {
        backgroundColor: theme.colors.accent,
    },
    nextButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
});
