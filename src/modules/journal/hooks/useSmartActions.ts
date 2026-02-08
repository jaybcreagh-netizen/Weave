import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { SmartAction } from '@/modules/oracle';
import { UIEventBus } from '@/shared/services/ui-event-bus';
import { useUIStore } from '@/shared/stores/uiStore';

export const useSmartActions = (onComplete?: () => void) => {
    const router = useRouter();

    const handleAction = useCallback((action: SmartAction) => {
        // Guard: friendId must look like a database ID, not a name
        // WatermelonDB IDs are 16-char alphanumeric or 36-char UUIDs
        const rawFriendId = action.data?.friendId;
        const isValidId = rawFriendId && (
            /^[a-zA-Z0-9_-]{16}$/.test(rawFriendId) || /^[0-9a-fA-F-]{36}$/.test(rawFriendId)
        );
        const resolvedFriendId = isValidId ? rawFriendId : undefined;

        switch (action.type) {
            case 'mimic_plan':
            case 'schedule_event':
                if (resolvedFriendId) {
                    useUIStore.getState().openPlanWizard({
                        friendId: resolvedFriendId,
                        prefillData: { title: action.label },
                    });
                } else {
                    // Fallback: open weave logger in plan mode without friend
                    router.push({
                        pathname: '/weave-logger',
                        params: {
                            mode: 'plan',
                            notes: action.data?.activity || action.data?.note || '',
                        }
                    });
                }
                break;

            case 'create_intention':
                if (resolvedFriendId) {
                    useUIStore.getState().openIntentionForm({
                        friendId: resolvedFriendId,
                        initialText: action.label,
                    });
                } else {
                    UIEventBus.emit({ type: 'SHOW_TOAST', message: 'No friend associated with this action' });
                }
                break;

            case 'add_memory':
            case 'update_profile':
                if (resolvedFriendId) {
                    router.push({
                        pathname: '/friend-profile',
                        params: {
                            friendId: resolvedFriendId,
                            action: 'add_memory',
                            memorySource: 'insight',
                            memoryNotes: action.data?.note || '',
                        }
                    });
                } else {
                    UIEventBus.emit({ type: 'SHOW_TOAST', message: 'No friend associated with this action' });
                }
                break;

            case 'reach_out':
                if (resolvedFriendId) {
                    router.push({
                        pathname: '/friend-profile',
                        params: { friendId: resolvedFriendId }
                    });
                } else {
                    UIEventBus.emit({ type: 'SHOW_TOAST', message: 'No friend associated with this action' });
                }
                break;

            default:
                console.warn('Unhandled action type:', action.type);
                if (resolvedFriendId) {
                    router.push({
                        pathname: '/friend-profile',
                        params: { friendId: resolvedFriendId }
                    });
                }
        }

        if (onComplete) {
            onComplete();
        }
    }, [router, onComplete]);

    return { handleAction };
};
