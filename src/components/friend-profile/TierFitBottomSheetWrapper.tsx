import React from 'react';
import { Alert } from 'react-native';
import { Tier } from '@/components/types';
import { TierFitBottomSheet, useTierFit, changeFriendTier, dismissTierSuggestion } from '@/modules/insights';

interface TierFitBottomSheetWrapperProps {
    friendId: string;
    visible: boolean;
    onDismiss: () => void;
}

/**
 * Wrapper component to handle tier fit analysis and tier changes
 */
export function TierFitBottomSheetWrapper({
    friendId,
    visible,
    onDismiss
}: TierFitBottomSheetWrapperProps) {
    const { analysis } = useTierFit(friendId);

    if (!analysis || analysis.fitCategory === 'insufficient_data') {
        return null;
    }

    const handleChangeTier = async (newTier: Tier) => {
        try {
            await changeFriendTier(friendId, newTier, true); // true = wasFromSuggestion
            console.log(`[TierFit] Successfully changed ${friendId} to ${newTier}`);

            // Dismiss the modal first
            onDismiss();

            // Show toast after a slight delay to allow modal to close (avoiding z-index layering issues)
            // and provide feedback to the user
            setTimeout(() => {
                const { showToast } = require('@/stores/uiStore').useUIStore.getState();
                showToast(`Moved to ${newTier}`, analysis.friendName);
            }, 400);

        } catch (error) {
            console.error('[TierFit] Error changing tier:', error);
            Alert.alert('Error', 'Failed to change tier. Please try again.');
        }
    };

    const handleStayInTier = () => {
        // User chose to keep current tier - just close
        console.log(`[TierFit] User chose to stay in tier for ${friendId}`);
        onDismiss();
    };

    const handleDismissSuggestion = async () => {
        try {
            await dismissTierSuggestion(friendId);
            console.log(`[TierFit] Dismissed suggestion for ${friendId}`);
            onDismiss();
        } catch (error) {
            console.error('[TierFit] Error dismissing suggestion:', error);
            Alert.alert('Error', 'Failed to dismiss suggestion. Please try again.');
        }
    };

    return (
        <TierFitBottomSheet
            visible={visible}
            analysis={analysis}
            onDismiss={onDismiss}
            onChangeTier={handleChangeTier}
            onStayInTier={handleStayInTier}
            onDismissSuggestion={handleDismissSuggestion}
        />
    );
}
