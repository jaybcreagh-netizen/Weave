import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Calendar, MessageCircle, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/shared/hooks/useTheme';
import FriendModel from '@/db/models/Friend';
import { Suggestion } from '@/shared/types/common';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { useReachOut, ContactLinker } from '@/modules/messaging';
import { SuggestionCard } from './SuggestionCard';

interface SuggestionActionSheetProps {
    suggestion: Suggestion | null;
    friend: FriendModel | null;
    isOpen: boolean;
    onClose: () => void;
    onPlan: (suggestion: Suggestion, friend: FriendModel) => void;
    onDismiss: (suggestion: Suggestion) => void;
    /**
     * Optional callback when reach out is successful.
     * If provided, the sheet will handle the reach out logic internally.
     */
    onReachOutSuccess?: (suggestion: Suggestion) => void;
}

/**
 * Action sheet for acting on a suggestion
 * Options: Plan Weave, Reach Out, or Dismiss
 */
export function SuggestionActionSheet({
    suggestion,
    friend,
    isOpen,
    onClose,
    onPlan,
    onDismiss,
    onReachOutSuccess,
}: SuggestionActionSheetProps) {
    const { colors } = useTheme();
    const [showContactLinker, setShowContactLinker] = useState(false);
    const { reachOut } = useReachOut();

    const handlePlan = () => {
        if (!suggestion || !friend) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onClose();
        // Small delay to allow sheet to close
        setTimeout(() => onPlan(suggestion, friend), 300);
    };

    const handleDismissAction = () => {
        if (!suggestion) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
        setTimeout(() => onDismiss(suggestion), 300);
    };

    const handleReachOut = async () => {
        if (!friend || !suggestion) return;

        // Check if friend has contact info
        const hasContactInfo = friend.phoneNumber || friend.email;

        if (!hasContactInfo) {
            // Show contact linker
            setShowContactLinker(true);
            return;
        }

        // Reach out directly
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const result = await reachOut(friend, suggestion.subtitle);

        if (result.success) {
            onClose();
            onReachOutSuccess?.(suggestion);
        }
    };

    if (!suggestion || !friend) return null;

    return (
        <AnimatedBottomSheet
            visible={isOpen}
            onClose={onClose}
            height="action"
            title={`Connect with ${friend.name}`}
        >
            {/* Suggestion Context */}
            <View className="mb-6 pointer-events-none">
                <SuggestionCard
                    suggestion={suggestion}
                    onAct={() => { }}
                    onLater={() => { }}
                />
            </View>

            {/* Actions */}
            <View className="gap-3">
                <TouchableOpacity
                    className="flex-row items-center justify-center gap-3 py-4 rounded-xl shadow-sm elevation-4"
                    style={{
                        backgroundColor: colors.primary,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8
                    }}
                    onPress={handlePlan}
                    activeOpacity={0.8}
                >
                    <Calendar color={colors['primary-foreground']} size={20} />
                    <Text className="text-base font-semibold" style={{ color: colors['primary-foreground'] }}>
                        Plan Weave
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-row items-center justify-center gap-3 py-4 rounded-xl shadow-sm elevation-4"
                    style={{
                        backgroundColor: colors.accent || colors.secondary,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8
                    }}
                    onPress={handleReachOut}
                    activeOpacity={0.8}
                >
                    <MessageCircle color={colors['accent-foreground'] || colors['secondary-foreground']} size={20} />
                    <Text className="text-base font-semibold" style={{ color: colors['accent-foreground'] || colors['secondary-foreground'] }}>
                        Reach Out
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    className="flex-row items-center justify-center gap-3 py-4 rounded-xl shadow-sm elevation-4 border"
                    style={{
                        backgroundColor: colors.muted,
                        borderColor: colors.border,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8
                    }}
                    onPress={handleDismissAction}
                    activeOpacity={0.8}
                >
                    <Text className="text-base font-semibold" style={{ color: colors.foreground }}>
                        Dismiss
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Contact Linker Sheet */}
            {friend && (
                <ContactLinker
                    visible={showContactLinker}
                    onClose={() => setShowContactLinker(false)}
                    friend={friend}
                    onLinked={() => {
                        setShowContactLinker(false);
                        // After linking, try to reach out
                        handleReachOut();
                    }}
                />
            )}
        </AnimatedBottomSheet>
    );
}
