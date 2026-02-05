import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { useUIStore } from '@/shared/stores/uiStore';
import { useOracleSheet } from './useOracleSheet';
import { SmartAction } from '../services/types';

export function useActionExecutor() {
    const router = useRouter();
    const isLikelyRecordId = (value?: string) => {
        if (!value) return false;
        return /^[a-zA-Z0-9_-]{16}$/.test(value) || /^[0-9a-fA-F-]{36}$/.test(value);
    };

    const buildMemoryParams = (action: SmartAction): Record<string, string> => {
        const note = action.data?.note?.trim() || '';
        const labelAsTitle = action.label.replace(/^note:\s*/i, '').trim();
        const fallbackTitle = note
            ? (note.split(/[.!?]/)[0]?.trim() || note).slice(0, 80)
            : '';

        const params: Record<string, string> = {
            action: 'add_memory',
            memorySource: 'oracle',
            memoryType: 'context',
        };

        if (note) params.memoryNotes = note;
        if (labelAsTitle || fallbackTitle) {
            params.memoryTitle = (labelAsTitle || fallbackTitle).slice(0, 80);
        }

        return params;
    };

    const executeAction = async (action: SmartAction) => {
        Haptics.selectionAsync();

        trackEvent(AnalyticsEvents.ORACLE_ACTION_EXECUTED, {
            action_type: action.type,
            label: action.label,
            confidence: action.confidence,
            has_friend_id: !!action.data?.friendId
        });

        const oracleParams = useOracleSheet.getState().params;
        const actionFriendId = action.data?.friendId?.trim();
        const shouldUseProfileFriend = oracleParams.context === 'friend'
            && !!oracleParams.friendId
            && (
                !actionFriendId
                || !isLikelyRecordId(actionFriendId)
                || (oracleParams.friendName && actionFriendId.toLowerCase() === oracleParams.friendName.toLowerCase())
            );
        const friendId = shouldUseProfileFriend ? oracleParams.friendId : actionFriendId;

        switch (action.type) {
            case 'schedule_event':
            case 'mimic_plan':
                if (friendId) {
                    useOracleSheet.getState().close(); // Close Oracle to show Wizard
                    // Short delay to allow Oracle to close smoothly
                    setTimeout(() => {
                        useUIStore.getState().openPlanWizard({
                            friendId,
                            prefillData: {
                                title: action.label,
                                // We could parse date here from action.data.date if needed
                            }
                        });
                    }, 300);
                } else {
                    Alert.alert("Which friend?", "We couldn't identify a specific friend for this plan. Please start from a friend's profile.");
                }
                break;

            case 'create_intention':
                if (friendId) {
                    useOracleSheet.getState().close();
                    setTimeout(() => {
                        useUIStore.getState().openIntentionForm({
                            friendId,
                            initialText: action.label
                        });
                    }, 300);
                } else {
                    Alert.alert("Which friend?", "We couldn't identify a specific friend for this intention. Please start from a friend's profile.");
                }
                break;

            case 'reach_out':
                if (friendId) {
                    useOracleSheet.getState().close();
                    router.push({
                        pathname: '/friend-profile',
                        params: { friendId }
                    });
                } else {
                    Alert.alert("Which friend?", "We couldn't identify who to reach out to.");
                }
                break;

            case 'add_memory':
            case 'update_profile':
                if (friendId) {
                    const memoryParams = buildMemoryParams(action);
                    useOracleSheet.getState().close();
                    setTimeout(() => {
                        if (oracleParams.context === 'friend' && oracleParams.friendId === friendId) {
                            router.setParams(memoryParams);
                            return;
                        }

                        router.push({
                            pathname: '/friend-profile',
                            params: {
                                friendId,
                                ...memoryParams,
                            }
                        });
                    }, 300);
                } else {
                    Alert.alert("Which friend?", "We couldn't identify whose profile to update.");
                }
                break;

            default:
                Alert.alert("Action", `Executing ${action.type}`);
        }
    };

    return { executeAction };
}
