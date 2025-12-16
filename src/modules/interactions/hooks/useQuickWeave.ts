import { useCallback, useRef } from 'react';
import { useDebounceCallback } from '@/shared/hooks/useDebounceCallback';
import * as Haptics from 'expo-haptics';
import { UIEventBus } from '@/shared/services/ui-event-bus';
import { useRouter } from 'expo-router';
import { useQuickWeaveStore } from '../store/quick-weave.store';
import { database } from '@/db';
import Friend from '@/db/models/Friend';
import { useGlobalUI } from '@/shared/context/GlobalUIContext';
import { useInteractions } from './useInteractions';
import { getTopActivities, isSmartDefaultsEnabled } from '../services/smart-defaults.service';
import { type InteractionCategory } from '@/shared/types/legacy-types';
import { ACTIVITIES } from '../constants';

export function useQuickWeave() {
    const router = useRouter();
    const {
        showToast,
        setSelectedFriendId,
        showMicroReflectionSheet,
    } = useGlobalUI();

    const {
        openQuickWeave,
        closeQuickWeave,
        activities: quickWeaveActivities
    } = useQuickWeaveStore();
    const { logWeave } = useInteractions();

    // Cache for pre-calculated activities to support instant opening
    // Map of friendId -> Promise<InteractionCategory[]>
    const prefetchCache = useRef<Record<string, Promise<InteractionCategory[]> | undefined>>({});

    const handleInteraction = useDebounceCallback(useCallback(async (activityId: string, activityLabel: string, friendId: string) => {
        const friend = await database.get<Friend>(Friend.table).find(friendId);
        if (!friend) return;

        // Ensure overlay is closed immediately
        closeQuickWeave();

        // 1. Log the interaction and get the ID back
        const newInteraction = await logWeave({
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

        // 2. Success haptic
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // 3. Show "just nurtured" glow via EventBus
        UIEventBus.emit({ type: 'FRIEND_NURTURED', friendId });

        // 4. Show toast
        showToast(activityLabel, friend.name);

        // 5. Trigger micro-reflection after short delay
        setTimeout(() => {
            showMicroReflectionSheet({
                friendId,
                friendName: friend.name,
                activityId,
                activityLabel,
                interactionId: newInteraction.id,
                friendArchetype: friend.archetype,
            });
        }, 200);
    }, [logWeave, showToast, showMicroReflectionSheet]));

    const handleInteractionSelection = useCallback(async (selectedIndex: number, friendId: string) => {
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

            await handleInteraction(activityId, activityLabel, friendId);
        } catch (error) {
            console.error('Error handling interaction selection:', error);
        }
    }, [quickWeaveActivities, handleInteraction]);

    const handlePrepareQuickWeave = useCallback((friendId: string) => {
        // Start calculation immediately when user touches the card
        // This runs in parallel with the gesture duration (260ms)
        prefetchCache.current[friendId] = (async () => {
            // Check if smart defaults are enabled
            const smartDefaultsEnabled = await isSmartDefaultsEnabled();

            if (smartDefaultsEnabled) {
                const friend = await database.get<Friend>(Friend.table).find(friendId);
                return getTopActivities(friend, 6);
            } else {
                return ACTIVITIES.map(a => a.id as InteractionCategory);
            }
        })();
    }, []);

    const handleOpenQuickWeave = useCallback(async (friendId: string, centerPoint: { x: number; y: number }) => {
        try {
            let orderedActivities: InteractionCategory[];

            // Check if we have a prefetch in progress or completed
            const prefetchPromise = prefetchCache.current[friendId];

            if (prefetchPromise) {
                // await the existing promise (likely resolved or near resolution)
                orderedActivities = await prefetchPromise;
                // Clear cache after use to ensure next open is fresh
                delete prefetchCache.current[friendId];
            } else {
                // Fallback to fresh calculation (shouldn't happen with correct gesture wiring)
                const smartDefaultsEnabled = await isSmartDefaultsEnabled();

                if (smartDefaultsEnabled) {
                    const friend = await database.get<Friend>(Friend.table).find(friendId);
                    orderedActivities = await getTopActivities(friend, 6);
                } else {
                    orderedActivities = ACTIVITIES.map(a => a.id as InteractionCategory);
                }
            }

            // Open Quick Weave with ordered activities
            openQuickWeave(friendId, centerPoint, orderedActivities);
        } catch (error) {
            console.error('Error opening Quick Weave:', error);
            // Fallback to default ordering
            const defaultOrder = ACTIVITIES.map(a => a.id as InteractionCategory);
            openQuickWeave(friendId, centerPoint, defaultOrder);
        }
    }, [openQuickWeave]);

    const handleTap = useDebounceCallback(useCallback((friendId: string) => {
        // Navigate immediately for snappy feel - friend profile handles unknown archetypes
        setSelectedFriendId(friendId);
        router.push(`/friend-profile?friendId=${friendId}`);
    }, [router, setSelectedFriendId]));

    return {
        handleInteractionSelection,
        handleOpenQuickWeave,
        handlePrepareQuickWeave,
        handleTap,
        closeQuickWeave
    };
}
