import { useCallback } from 'react';
import { useDebounceCallback } from '@/shared/hooks/useDebounceCallback';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import { useUIStore } from '@/shared/stores/uiStore';
import { useInteractions } from './useInteractions';
import { getTopActivities, isSmartDefaultsEnabled } from '../services/smart-defaults.service';
import { type InteractionCategory } from '@/shared/types/legacy-types';
import { ACTIVITIES } from '../constants';

export function useQuickWeave() {
    const router = useRouter();
    const {
        openQuickWeave,
        closeQuickWeave,
        showToast,
        setJustNurturedFriendId,

        showMicroReflectionSheet,
        quickWeaveActivities
    } = useUIStore();
    const { logWeave } = useInteractions();

    const handleInteraction = useDebounceCallback(useCallback(async (activityId: string, activityLabel: string, friendId: string) => {
        const t0 = Date.now();

        // STEP 1: Trigger haptic feedback immediately (very fast, no re-renders)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        console.log(`[handleInteraction] Haptics: ${Date.now() - t0}ms`);

        // STEP 2: Start the database write FIRST - this is the critical path
        // Don't await it - let it run in background
        console.log(`[handleInteraction] Starting logWeave at ${Date.now() - t0}ms`);
        const logPromise = logWeave({
            friendIds: [friendId],
            category: activityId as InteractionCategory,
            activity: activityId,
            notes: '',
            date: new Date(),
            type: 'log',
            status: 'completed',
            mode: 'quick-touch',
            vibe: null,
            duration: null,
        });

        // STEP 3: Defer heavy UI state updates to next frame
        // This prevents re-render cascade from blocking the database write
        requestAnimationFrame(() => {
            closeQuickWeave();
            setJustNurturedFriendId(friendId);
            console.log(`[handleInteraction] UI updates deferred: ${Date.now() - t0}ms`);
        });

        // STEP 4: Show reflection sheet after write completes
        logPromise.then(async (newInteraction) => {
            // Fetch friend data AFTER the write completes (for the reflection sheet)
            const friend = await database.get<Friend>(Friend.table).find(friendId);
            if (friend) {
                showMicroReflectionSheet({
                    friendId,
                    friendName: friend.name,
                    activityId,
                    activityLabel,
                    interactionId: newInteraction.id,
                    friendArchetype: friend.archetype,
                });
            }
        }).catch(error => {
            console.error('Error logging interaction:', error);
        });
    }, [logWeave, closeQuickWeave, setJustNurturedFriendId, showMicroReflectionSheet]));

    const handleInteractionSelection = useCallback(async (selectedIndex: number, friendId: string) => {
        console.log(`[QuickWeave] handleInteractionSelection called at ${Date.now()}`);
        try {
            // Get the selected category from quickWeaveActivities
            const currentActivities = quickWeaveActivities.length > 0
                ? quickWeaveActivities
                : ACTIVITIES.map(a => a.id as InteractionCategory);

            if (selectedIndex >= currentActivities.length) {
                console.error('Invalid activity index:', selectedIndex);
                return;
            }

            const activityId = currentActivities[selectedIndex];

            // Get label from metadata
            const activityMetadata = ACTIVITIES.find(a => a.id === activityId);
            const activityLabel = activityMetadata?.label || activityId;

            console.log(`[QuickWeave] Calling handleInteraction at ${Date.now()}`);
            await handleInteraction(activityId, activityLabel, friendId);
            console.log(`[QuickWeave] handleInteraction completed at ${Date.now()}`);
        } catch (error) {
            console.error('Error handling interaction selection:', error);
        }
    }, [quickWeaveActivities, handleInteraction]);

    const handleOpenQuickWeave = useCallback((friendId: string, centerPoint: { x: number; y: number }) => {
        // Always use fixed default ordering for muscle memory - users can develop
        // automatic gestures when the layout is consistent
        const defaultOrder = ACTIVITIES.map(a => a.id as InteractionCategory);
        openQuickWeave(friendId, centerPoint, defaultOrder);
    }, [openQuickWeave]);

    const handleTap = useCallback((friendId: string) => {
        // Navigate immediately for snappy feel
        router.push(`/friend-profile?friendId=${friendId}`);
    }, [router]);

    return {
        handleInteractionSelection,
        handleOpenQuickWeave,
        handleTap,
        closeQuickWeave
    };
}
