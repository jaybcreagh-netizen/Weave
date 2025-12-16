import React from 'react';
import { Alert } from 'react-native';
import { Tier } from '@/shared/types/legacy-types';
import { logger } from '@/shared/services/logger.service';
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
            logger.debug('TierFit', `Successfully changed ${friendId} to ${newTier}`);

            // Dismiss the modal first
            onDismiss();

            // Show toast after a slight delay using UIEventBus
            setTimeout(async () => {
                const { UIEventBus } = await import('@/shared/services/ui-event-bus');
                UIEventBus.emit({ type: 'SHOW_TOAST', message: `Moved to ${newTier}`, friendName: analysis.friendName });
            }, 400);

        } catch (error) {
            logger.error('TierFit', 'Error changing tier:', error);
            Alert.alert('Error', 'Failed to change tier. Please try again.');
        }
    };

    const handleStayInTier = () => {
        // User chose to keep current tier - just close
        logger.debug('TierFit', `User chose to stay in tier for ${friendId}`);
        onDismiss();
    };

    const handleDismissSuggestion = async () => {
        try {
            await dismissTierSuggestion(friendId);
            logger.debug('TierFit', `Dismissed suggestion for ${friendId}`);
            onDismiss();
        } catch (error) {
            logger.error('TierFit', 'Error dismissing suggestion:', error);
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
