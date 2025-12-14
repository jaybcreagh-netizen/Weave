import React, { useState, useEffect, useRef } from 'react';
import { useDebounceCallback } from '@/shared/hooks/useDebounceCallback';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Keyboard } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePlans } from '../hooks/usePlans';
import { useInteractions } from '../hooks/useInteractions';
import { useUIStore } from '@/shared/stores/uiStore';
import { logger } from '@/shared/services/logger.service';
import { MoonPhaseSelector } from '@/modules/intelligence';
import { useTheme } from '@/shared/hooks/useTheme';
import { Vibe } from '@/shared/types/common';
import { Check } from 'lucide-react-native';
import { format } from 'date-fns';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { SeasonAnalyticsService } from '@/modules/intelligence';

export function PostWeaveRatingModal() {
    const { colors } = useTheme();
    const { isPostWeaveRatingOpen, postWeaveRatingTargetId, closePostWeaveRating, showToast } = useUIStore();
    const { pendingConfirmations, completePlan, cancelPlan } = usePlans();
    const { allInteractions } = useInteractions();
    const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

    // Local state for the form
    const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
    const [notes, setNotes] = useState('');
    const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [friendNames, setFriendNames] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Track pending action for close animation
    const pendingActionRef = useRef<'confirm' | 'didnt-happen' | 'skip' | null>(null);
    const pendingDataRef = useRef<{ vibe?: Vibe; note?: string } | null>(null);

    // Effect to update current plan when new ones arrive OR target changes
    useEffect(() => {
        if (postWeaveRatingTargetId) {
            setCurrentPlanId(postWeaveRatingTargetId);
            setSelectedVibe(null);
            setNotes('');
            return;
        }

        const nextPlan = pendingConfirmations.find(p => !skippedIds.has(p.id) && !completedIds.has(p.id));

        if (nextPlan && currentPlanId !== nextPlan.id) {
            setCurrentPlanId(nextPlan.id);
            setSelectedVibe(null);
            setNotes('');
        } else if (!nextPlan && currentPlanId) {
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
                // @ts-ignore
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
    }, [currentPlanId, pendingConfirmations, isPostWeaveRatingOpen]);

    const currentPlan = currentPlanId
        ? (pendingConfirmations.find(p => p.id === currentPlanId) || allInteractions.find(p => p.id === currentPlanId))
        : null;

    const handleConfirm = useDebounceCallback(async () => {
        if (!currentPlanId || isSubmitting) return;

        Keyboard.dismiss();

        // ANALYTICS: Track rating (if vibe selected)
        if (selectedVibe) {
            // Map Moon Phases to Score (1-5)
            const vibeScores: Record<string, number> = {
                'FullMoon': 5,
                'WaxingGibbous': 4,
                'WaningGibbous': 4,
                'FirstQuarter': 3,
                'LastQuarter': 3,
                'WaxingCrescent': 2,
                'WaningCrescent': 2,
                'NewMoon': 1
            };
            const rating = vibeScores[selectedVibe as string] || 3;
            SeasonAnalyticsService.trackInteractionRating(rating).catch(console.error);
        }

        pendingActionRef.current = 'confirm';
        pendingDataRef.current = { vibe: selectedVibe || undefined, note: notes };
        closePostWeaveRating();
    });

    const handleDidntHappen = useDebounceCallback(async () => {
        if (!currentPlanId || isSubmitting) return;

        Keyboard.dismiss();
        pendingActionRef.current = 'didnt-happen';
        closePostWeaveRating();
    });

    const handleSkip = () => {
        Keyboard.dismiss();
        pendingActionRef.current = 'skip';
        closePostWeaveRating();
    };

    const handleCloseComplete = async () => {
        const planId = currentPlanId;
        const action = pendingActionRef.current;
        const data = pendingDataRef.current;

        // Reset refs
        pendingActionRef.current = null;
        pendingDataRef.current = null;

        if (!planId) return;

        if (action === 'confirm' && data) {
            setIsSubmitting(true);
            try {
                logger.debug('PostWeaveRatingModal', 'Completing plan:', planId, data);
                await completePlan(planId, {
                    vibe: data.vibe || undefined,
                    note: data.note
                });
                logger.debug('PostWeaveRatingModal', 'Plan completed successfully');
                setCompletedIds(prev => new Set(prev).add(planId));

                // Provide success feedback
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showToast("Weave completed", friendNames || 'Friend');
            } catch (e) {
                console.error("[PostWeaveRatingModal] Failed to complete plan", e);
                // Provide error feedback
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                showToast("Failed to complete weave", friendNames || 'Friend');
            } finally {
                setIsSubmitting(false);
            }
        } else if (action === 'didnt-happen') {
            setIsSubmitting(true);
            try {
                await cancelPlan(planId);

                // Provide feedback for cancellation
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showToast("Plan cancelled", friendNames || 'Friend');
            } catch (e) {
                console.error("Failed to cancel plan", e);
                // Provide error feedback
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                showToast("Failed to cancel plan", friendNames || 'Friend');
            } finally {
                setIsSubmitting(false);
            }
        }

        // Reset form state
        setSelectedVibe(null);
        setNotes('');
    };

    const isVisible = isPostWeaveRatingOpen && !!currentPlanId && !!currentPlan;

    if (!currentPlan) return null;

    return (
        <AnimatedBottomSheet
            visible={isVisible}
            onClose={handleSkip}
            onCloseComplete={handleCloseComplete}
            height="form"
            scrollable
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.foreground }]}>
                    How was the {currentPlan.activity}{friendNames ? ` with ${friendNames}` : ''}?
                </Text>
                <Text style={[styles.subtitle, { color: colors['muted-foreground'] }]}>
                    {format(new Date(currentPlan.interactionDate), 'EEEE, MMMM do')}
                </Text>
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
                <Text style={[styles.label, { color: colors.foreground }]}>Notes (Optional)</Text>
                <TextInput
                    style={[styles.input, { backgroundColor: colors.background, color: colors.foreground }]}
                    placeholder="Capture a memory or feeling..."
                    placeholderTextColor={colors['muted-foreground']}
                    multiline
                    value={notes}
                    onChangeText={setNotes}
                    numberOfLines={3}
                />
            </View>

            {/* Actions */}
            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.secondaryButton, isSubmitting && styles.buttonDisabled]}
                    onPress={handleDidntHappen}
                    disabled={isSubmitting}
                >
                    <Text style={[styles.secondaryButtonText, { color: colors['muted-foreground'] }]}>
                        It didn't happen
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.primaryButton,
                        { backgroundColor: colors.primary },
                        isSubmitting && styles.buttonDisabled
                    ]}
                    onPress={handleConfirm}
                    disabled={isSubmitting}
                >
                    <Text style={[styles.primaryButtonText, { color: colors['primary-foreground'] }]}>
                        {isSubmitting ? 'Weaving...' : 'Complete'}
                    </Text>
                    {!isSubmitting && <Check size={20} color={colors['primary-foreground']} />}
                </TouchableOpacity>
            </View>
        </AnimatedBottomSheet>
    );
}

const styles = StyleSheet.create({
    header: {
        marginBottom: 24,
    },
    title: {
        fontSize: 24,
        fontFamily: 'Lora_700Bold',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        fontFamily: 'Inter_400Regular',
    },
    section: {
        gap: 12,
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontFamily: 'Inter_600SemiBold',
    },
    input: {
        borderRadius: 12,
        padding: 12,
        paddingTop: 12,
        minHeight: 100,
        fontSize: 16,
        fontFamily: 'Inter_400Regular',
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
    },
    primaryButton: {
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
    },
});
