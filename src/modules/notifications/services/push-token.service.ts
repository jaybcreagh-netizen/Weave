/**
 * Push Token Service
 * 
 * Handles registering and managing Expo push tokens with Supabase.
 * Enables server-sent push notifications for shared weaves and link requests.
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { logger } from '@/shared/services/logger.service';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PUSH_TOKEN_KEY = '@weave/push_token';
const LAST_REGISTRATION_KEY = '@weave/push_token_registered_at';

/**
 * Get the current Expo push token
 */
export async function getExpoPushToken(): Promise<string | null> {
    try {
        // Check permissions first
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        if (existingStatus !== 'granted') {
            logger.info('PushToken', 'No notification permissions');
            return null;
        }

        // Get project ID from EAS config (set in app.json extra.eas.projectId)
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
            logger.warn('PushToken', 'No EAS project ID configured - push tokens unavailable');
            return null;
        }

        // Get push token
        const token = await Notifications.getExpoPushTokenAsync({
            projectId,
        });

        return token.data;
    } catch (error) {
        logger.error('PushToken', 'Failed to get push token:', error);
        return null;
    }
}

/**
 * Register push token with Supabase
 * Called on app launch and when user signs in
 */
export async function registerPushToken(): Promise<boolean> {
    try {
        const client = getSupabaseClient();
        if (!client) {
            logger.info('PushToken', 'No Supabase client - skipping registration');
            return false;
        }

        const { data: { user } } = await client.auth.getUser();
        if (!user) {
            logger.info('PushToken', 'No authenticated user - skipping registration');
            return false;
        }

        const pushToken = await getExpoPushToken();
        if (!pushToken) {
            logger.info('PushToken', 'No push token available');
            return false;
        }

        // Check if we already registered this token recently (within 24 hours)
        const lastRegistration = await AsyncStorage.getItem(LAST_REGISTRATION_KEY);
        const cachedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);

        if (lastRegistration && cachedToken === pushToken) {
            const lastTime = parseInt(lastRegistration, 10);
            const hoursSince = (Date.now() - lastTime) / (1000 * 60 * 60);

            if (hoursSince < 24) {
                logger.info('PushToken', 'Token already registered recently');
                return true;
            }
        }

        // Upsert the token to user_push_tokens table
        const { error } = await client
            .from('user_push_tokens')
            .upsert({
                user_id: user.id,
                push_token: pushToken,
                platform: Platform.OS,
                device_name: `${Platform.OS} device`,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id,push_token',
            });

        if (error) {
            // Log as warning since table may not exist in user's Supabase setup
            logger.warn('PushToken', 'Could not register token (table may not exist):', error.code);
            return false;
        }

        // Cache the registration
        await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
        await AsyncStorage.setItem(LAST_REGISTRATION_KEY, Date.now().toString());

        logger.info('PushToken', 'Successfully registered push token');
        return true;

    } catch (error) {
        logger.error('PushToken', 'Error registering push token:', error);
        return false;
    }
}

/**
 * Unregister push token (on sign out)
 */
export async function unregisterPushToken(): Promise<void> {
    try {
        const client = getSupabaseClient();
        if (!client) return;

        const cachedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
        if (!cachedToken) return;

        const { data: { user } } = await client.auth.getUser();
        if (!user) return;

        // Delete the token from Supabase
        await client
            .from('user_push_tokens')
            .delete()
            .eq('user_id', user.id)
            .eq('push_token', cachedToken);

        // Clear local cache
        await AsyncStorage.removeItem(PUSH_TOKEN_KEY);
        await AsyncStorage.removeItem(LAST_REGISTRATION_KEY);

        logger.info('PushToken', 'Successfully unregistered push token');

    } catch (error) {
        logger.error('PushToken', 'Error unregistering push token:', error);
    }
}

/**
 * Handle incoming push notification data
 * Routes to appropriate handler based on notification type
 */
export function handleRemotePushNotification(data: Record<string, unknown>): {
    type: 'shared_weave' | 'link_request' | 'link_accepted' | 'unknown';
    payload: Record<string, unknown>;
} {
    const notificationType = data.type as string;

    switch (notificationType) {
        case 'shared_weave':
            return {
                type: 'shared_weave',
                payload: {
                    sharedWeaveId: data.shared_weave_id,
                    creatorName: data.creator_name,
                    title: data.title,
                },
            };

        case 'link_request':
            return {
                type: 'link_request',
                payload: {
                    requesterId: data.requester_id,
                    requesterName: data.requester_name,
                },
            };

        case 'link_accepted':
            return {
                type: 'link_accepted',
                payload: {
                    acceptorId: data.acceptor_id,
                    acceptorName: data.acceptor_name,
                },
            };

        default:
            return {
                type: 'unknown',
                payload: data,
            };
    }
}
