
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { BlurView } from 'expo-blur';
import { usePlans } from '../hooks/usePlans';
import { useInteractions } from '../hooks/useInteractions';
import { useUIStore } from '@/stores/uiStore';
import { MoonPhaseSelector } from '@/components/MoonPhaseSelector';
import { theme } from '@/shared/theme/theme';
import { Vibe } from '@/shared/types/common';
import { X, Check } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { format } from 'date-fns';

export function PostWeaveRatingModal() {
    const { isPostWeaveRatingOpen, postWeaveRatingTargetId, closePostWeaveRating } = useUIStore();
    const { pendingConfirmations, completePlan, cancelPlan } = usePlans();
    const { allInteractions } = useInteractions();
    const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

    // Local state for the form
    const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
    const [notes, setNotes] = useState('');
    const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [friendNames, setFriendNames] = useState<string>('');

    // Animation control
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (isPostWeaveRatingOpen && currentPlanId) {
            setIsVisible(true);
        }
    }, [isPostWeaveRatingOpen, currentPlanId]);

    const performClose = () => {
        setIsVisible(false);
        setTimeout(() => {
            closePostWeaveRating();
        }, 300); // Match animation duration (default spring/timing) - 300ms is safe for SlideOut
    };

    // Effect to update current plan when new ones arrive OR target changes
    useEffect(() => {
        if (postWeaveRatingTargetId) {
            setCurrentPlanId(postWeaveRatingTargetId);
            // Reset form if target changed
            setSelectedVibe(null);
            setNotes('');
            return;
        }

        // Find the first pending confirmation that hasn't been skipped or completed locally
        const nextPlan = pendingConfirmations.find(p => !skippedIds.has(p.id) && !completedIds.has(p.id));

        if (nextPlan && currentPlanId !== nextPlan.id) {
            setCurrentPlanId(nextPlan.id);
            // Reset form
            setSelectedVibe(null);
            setNotes('');
        } else if (!nextPlan && currentPlanId) {
            // Check if current is still valid (logic unchanged)
            const isCurrentValid = pendingConfirmations.some(p => p.id === currentPlanId)
                && !skippedIds.has(currentPlanId)
                && !completedIds.has(currentPlanId);

            if (!isCurrentValid) {
                setCurrentPlanId(null);
            }
        }
    }, [pendingConfirmations, skippedIds, completedIds, currentPlanId, postWeaveRatingTargetId]);

    // Effect to fetch friend names
    useEffect(() => {
        if (!isPostWeaveRatingOpen || !currentPlanId) {
            setFriendNames('');
            return;
        }

        const currentPlan = pendingConfirmations.find(p => p.id === currentPlanId);
        if (!currentPlan) return;

        const fetchFriends = async () => {
            try {
                // @ts-ignore - interactionFriends is a relation but typed as any in some places or strict in others
                const friends = await currentPlan.interactionFriends.fetch();
                if (friends.length > 0) {
                    const names = friends.map((f: any) => f.name).join(', ');
                    const truncated = names.length > 30 ? names.substring(0, 30) + '...' : names;
                    setFriendNames(truncated);
                } else {
                    setFriendNames('');
                }
            } catch (error) {
                console.error('Error fetching friends for rating modal:', error);
                setFriendNames('');
            }
        };

        fetchFriends();
    }, [currentPlanId, pendingConfirmations]);

    if (!currentPlanId || !isPostWeaveRatingOpen) return null;

    // Resolve plan from either pendingConfirmations OR allInteractions
    const currentPlan = pendingConfirmations.find(p => p.id === currentPlanId) || allInteractions.find(p => p.id === currentPlanId);

    // Sanity check, should exist if currentPlanId is set
    if (!currentPlan) return null;

    const handleConfirm = async () => {
        if (!currentPlanId) return;

        // Default to 'WaxingCrescent' (neutral-ish positive) if not selected, or maybe require it?
        // Let's require it to encourage mindfulness, or default to something neutral.
        // Given the prompt "How was the party?", let's require a selection or default to 'NewMoon' if they just click yes?
        // Actually, completePlan takes whatever we give it. Let's send the selected vibe.

        try {
            // We need to update the interaction with the rating.
            // completePlan in usePlans -> calls service.
            // But completePlan signature in service is: completePlan(interactionId: string)
            // It doesn't seem to take the rating data in the current signature I saw earlier!

            // WAIT. Let's re-read plan.service.ts
            // completePlan(interactionId: string)

            // It fetches the interaction and updates status to 'completed'.
            // It DOES NOT seem to take new data (vibe, notes) and save it.
            // It assumes the interaction object in DB already has data? Or it just completes it as is?

            // I need to update the interaction data BEFORE completing it, or modify completePlan to accept data.
            // Modifying completePlan is safer.

            // Let's implement the UI first, and I will assume I need to update completePlan.
            // For now, I will assume I will modify completePlan to accept optional data.

            console.log('[PostWeaveRatingModal] Completing plan:', currentPlanId, { vibe: selectedVibe, note: notes });
            await completePlan(currentPlanId, {
                vibe: selectedVibe || undefined,
                note: notes
            });
            console.log('[PostWeaveRatingModal] Plan completed successfully');
            setCompletedIds(prev => new Set(prev).add(currentPlanId));

            // If no more plans, close the modal completely
            if (postWeaveRatingTargetId) {
                // Targeted mode: close immediately after completion
                performClose();
            } else {
                // Queue mode: check for next
                const nextPlanRaw = pendingConfirmations.find(p => p.id !== currentPlanId && !skippedIds.has(p.id) && !completedIds.has(p.id));
                if (!nextPlanRaw) {
                    performClose();
                }
            }
        } catch (e) {
            console.error("[PostWeaveRatingModal] Failed to complete plan", e);
            // @ts-ignore
            alert(`Failed to complete: ${e.message}`);
        }
    };

    const handleDidntHappen = async () => {
        if (!currentPlanId) return;
        try {
            await cancelPlan(currentPlanId);
        } catch (e) {
            console.error("Failed to cancel plan", e);
        }
    };

    const handleSkip = () => {
        // If they skip, maybe we just close the modal for now?
        // Or skip this specific one?
        // "Close with the X" usually means "Not now".
        performClose();
    };

    return (
        <Modal
            transparent
            visible={!!currentPlanId} // Modal stays "visible" logic-wise as long as currentPlanId exists, but content handled by isVisible for animation
            animationType="none"
            statusBarTranslucent
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                {isVisible && (
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <Animated.View style={StyleSheet.absoluteFill}>
                            {/* Backdrop */}
                            <Animated.View
                                entering={FadeIn}
                                exiting={FadeOut}
                                style={styles.backdrop}
                            >
                                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
                            </Animated.View>

                            {/* Content */}
                            <Animated.View
                                entering={SlideInDown.springify().damping(15)}
                                exiting={SlideOutDown}
                                style={styles.containerWrapper}
                            >
                                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                                    <View style={styles.container}>
                                        <View style={styles.content}>
                                            {/* Header */}
                                            <View style={styles.header}>
                                                <View>
                                                    <Text style={styles.title}>
                                                        How was the {currentPlan.activity}{friendNames ? ` with ${friendNames}` : ''}?
                                                    </Text>
                                                    <Text style={styles.subtitle}>
                                                        {format(new Date(currentPlan.interactionDate), 'EEEE, MMMM do')}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity onPress={handleSkip} style={styles.closeButton}>
                                                    <X size={24} color={theme.colors['muted-foreground']} />
                                                </TouchableOpacity>
                                            </View>

                                            {/* Moon Phase Selector */}
                                            <View style={styles.section}>
                                                <MoonPhaseSelector
                                                    selectedVibe={selectedVibe}
                                                    onSelect={setSelectedVibe}
                                                />
                                            </View>

                                            {/* Notes Input */}
                                            <View style={styles.section}>
                                                <Text style={styles.label}>Notes (Optional)</Text>
                                                <TextInput
                                                    style={styles.input}
                                                    placeholder="Capture a memory or feeling..."
                                                    placeholderTextColor={theme.colors['muted-foreground']}
                                                    multiline
                                                    value={notes}
                                                    onChangeText={setNotes}
                                                    numberOfLines={3}
                                                />
                                            </View>

                                            {/* Actions */}
                                            <View style={styles.actions}>
                                                <TouchableOpacity
                                                    style={styles.secondaryButton}
                                                    onPress={handleDidntHappen}
                                                >
                                                    <Text style={styles.secondaryButtonText}>It didn't happen</Text>
                                                </TouchableOpacity>

                                                <TouchableOpacity
                                                    style={[
                                                        styles.primaryButton,
                                                        !selectedVibe && styles.buttonDisabled
                                                    ]}
                                                    onPress={handleConfirm}
                                                    disabled={!selectedVibe}
                                                >
                                                    <Text style={styles.primaryButtonText}>Complete</Text>
                                                    <Check size={20} color="white" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                </TouchableWithoutFeedback>
                            </Animated.View>
                        </Animated.View>
                    </TouchableWithoutFeedback>
                )}
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    containerWrapper: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: theme.colors.card,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: Platform.OS === 'ios' ? 48 : 24,
        width: '100%',
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 24,
    },
    content: {
        gap: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    title: {
        fontSize: 24,
        fontFamily: 'Lora_700Bold',
        color: theme.colors.foreground,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: 'Inter_400Regular',
        color: theme.colors['muted-foreground'],
    },
    closeButton: {
        padding: 4,
    },
    section: {
        gap: 12,
    },
    label: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors.foreground,
    },
    input: {
        backgroundColor: theme.colors.background,
        borderRadius: 12,
        padding: 12,
        paddingTop: 12,
        minHeight: 100,
        fontSize: 16,
        fontFamily: 'Inter_400Regular',
        color: theme.colors.foreground,
        textAlignVertical: 'top',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    secondaryButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    secondaryButtonText: {
        fontSize: 16,
        fontFamily: 'Inter_500Medium',
        color: theme.colors['muted-foreground'],
    },
    primaryButton: {
        backgroundColor: theme.colors.primary,
        borderRadius: 999,
        paddingVertical: 12,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    primaryButtonText: {
        fontSize: 16,
        fontFamily: 'Inter_600SemiBold',
        color: theme.colors['primary-foreground'],
    },
});
