/**
 * Shared Weave Notification Channel
 * 
 * Handles local notifications for shared weaves and link requests
 * coming from server push or Realtime subscriptions.
 * 
 * These notifications BYPASS the daily budget system since they're
 * event-driven (triggered by other users' actions) and represent
 * critical social interactions that shouldn't be throttled.
 */

import * as Notifications from 'expo-notifications';
import Logger from '@/shared/utils/Logger';
import { NOTIFICATION_CONFIG } from '../notification.config';
import { IncomingWeavePayload } from '@/modules/sync';
import { getSupabaseClient } from '@/shared/services/supabase-client';

const TAG = 'SharedWeaveNotifications';

export interface SharedWeaveNotificationData {
    type: 'shared_weave';
    sharedWeaveId: string;
    creatorName: string;
    title?: string;
}

export interface LinkRequestNotificationData {
    type: 'link_request' | 'link_accepted';
    userId: string;
    userName: string;
}

/**
 * Handle incoming shared weave event from Realtime
 * Fetches necessary details (creator name, title) and shows notification
 */
export async function handleIncomingSharedWeave(payload: IncomingWeavePayload): Promise<void> {
    try {
        const client = getSupabaseClient();
        if (!client) return;

        // Fetch weave details to get title and creator ID
        const { data: weaveData, error: weaveError } = await client
            .from('shared_weaves')
            .select('title, created_by')
            .eq('id', payload.shared_weave_id)
            .single();

        if (weaveError || !weaveData) {
            Logger.error(`[${TAG}] Failed to fetch weave details for notification:`, weaveError);
            return;
        }

        // Fetch creator profile to get name
        const { data: profileData, error: profileError } = await client
            .from('user_profiles')
            .select('display_name, username')
            .eq('id', weaveData.created_by)
            .single();

        if (profileError || !profileData) {
            Logger.warn(`[${TAG}] Failed to fetch creator profile for notification:`, profileError);
            // Fallback to generic if profile fails
        }

        const creatorName = profileData?.display_name || profileData?.username || 'A friend';
        const title = weaveData.title;

        await showSharedWeaveNotification({
            type: 'shared_weave',
            sharedWeaveId: payload.shared_weave_id,
            creatorName,
            title
        });

    } catch (error) {
        Logger.error(`[${TAG}] Error handling incoming shared weave:`, error);
    }
}

/**
 * Show notification for incoming shared weave
 * Bypasses budget - event-driven from other users
 */
export async function showSharedWeaveNotification(data: SharedWeaveNotificationData): Promise<string | null> {
    try {
        const title = data.title
            ? `${data.creatorName} shared a weave`
            : `${data.creatorName} shared a weave with you`;

        const body = data.title
            ? `"${data.title}"`
            : 'Tap to view and accept';

        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: {
                    channelId: 'shared-weave',
                    sharedWeaveId: data.sharedWeaveId,
                    action: 'view_shared_weave',
                    type: 'shared_weave', // Explicitly set type for foreground handler
                },
                sound: 'default',
            },
            trigger: null, // Immediate
        });

        Logger.info(`[${TAG}] Showed shared weave notification: ${notificationId}`);
        return notificationId;

    } catch (error) {
        Logger.error(`[${TAG}] Failed to show shared weave notification:`, error);
        return null;
    }
}

/**
 * Show notification for incoming link request
 * Bypasses budget - event-driven from other users
 */
export async function showLinkRequestNotification(data: LinkRequestNotificationData): Promise<string | null> {
    try {
        const config = NOTIFICATION_CONFIG['link-request'];

        const title = data.type === 'link_request'
            ? config.templates.default.title.replace('{{name}}', data.userName)
            : config.templates.accepted?.title.replace('{{name}}', data.userName) || `${data.userName} accepted your link request!`;

        const body = data.type === 'link_request'
            ? config.templates.default.body
            : config.templates.accepted?.body || 'You can now share weaves together.';

        const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data: {
                    channelId: 'link-request',
                    userId: data.userId,
                    action: data.type === 'link_request' ? 'view_link_requests' : 'view_friend',
                    type: data.type, // Explicitly set type for foreground handler
                },
                sound: 'default',
            },
            trigger: null, // Immediate
        });

        Logger.info(`[${TAG}] Showed link request notification: ${notificationId}`);
        return notificationId;

    } catch (error) {
        Logger.error(`[${TAG}] Failed to show link request notification:`, error);
        return null;
    }
}

/**
 * Cancel a specific shared weave notification
 */
export async function cancelSharedWeaveNotification(notificationId: string): Promise<void> {
    try {
        await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
        Logger.error(`[${TAG}] Failed to cancel notification:`, error);
    }
}
