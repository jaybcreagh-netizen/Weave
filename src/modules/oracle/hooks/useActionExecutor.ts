import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { trackEvent, AnalyticsEvents } from '@/shared/services/analytics.service';
import { useUIStore } from '@/shared/stores/uiStore';
import { useOracleSheet } from './useOracleSheet';
import { SmartAction } from '../services/types';

export function useActionExecutor() {
    const router = useRouter();

    const executeAction = (action: SmartAction) => {
        Haptics.selectionAsync();

        trackEvent(AnalyticsEvents.ORACLE_ACTION_EXECUTED, {
            action_type: action.type,
            label: action.label,
            confidence: action.confidence,
            has_friend_id: !!action.data?.friendId
        });

        const friendId = action.data?.friendId;

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

            case 'update_profile':
                if (friendId) {
                    useOracleSheet.getState().close();
                    router.push({
                        pathname: '/friend-profile',
                        params: { friendId }
                    });
                    // Ideally open specific edit modal, but profile is fine for now
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
