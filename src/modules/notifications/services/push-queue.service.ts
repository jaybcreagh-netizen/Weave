import { database } from '@/db';
import PendingPushNotification from '@/db/models/PendingPushNotification';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import Logger from '@/shared/utils/Logger';
import { Q } from '@nozbe/watermelondb';
import * as Network from 'expo-network';

interface PushPayload {
    type?: string;
    title: string;
    body: string;
    data?: any;
}

export const PushQueueService = {
    /**
     * Queue a push notification or send immediately if online.
     */
    async sendOrQueue(recipientUserId: string, payload: PushPayload): Promise<void> {
        const netInfo = await Network.getNetworkStateAsync();
        const isOnline = netInfo.isConnected && netInfo.isInternetReachable;

        if (isOnline) {
            try {
                await this.sendImmediately(recipientUserId, payload);
                return;
            } catch (error) {
                Logger.warn('PushQueue', 'Send failed, queuing for retry', error);
            }
        }

        // Queue it
        await database.write(async () => {
            await database.get<PendingPushNotification>('pending_push_notifications').create(rec => {
                rec.recipientUserId = recipientUserId;
                rec.payload = JSON.stringify(payload);
                rec.retryCount = 0;
            });
        });
        Logger.info('PushQueue', `Queued notification for ${recipientUserId}`);
    },

    /**
     * Internal helper to call Supabase Function
     */
    async sendImmediately(recipientUserId: string, payload: PushPayload) {
        const client = getSupabaseClient();
        if (!client) throw new Error('No Supabase client');

        const { error } = await client.functions.invoke('send-push', {
            body: {
                recipient_user_id: recipientUserId,
                ...payload
            }
        });

        if (error) throw error;
    },

    /**
     * Process the queue (called on app foreground or sync)
     */
    async processQueue() {
        const netInfo = await Network.getNetworkStateAsync();
        if (!netInfo.isConnected) return;

        const pending = await database.get<PendingPushNotification>('pending_push_notifications')
            .query(Q.sortBy('created_at', Q.asc))
            .fetch();

        if (pending.length === 0) return;

        Logger.info('PushQueue', `Processing ${pending.length} pending notifications`);

        // We process sequentially to maintain order
        for (const item of pending) {
            try {
                const payload = JSON.parse(item.payload);
                await this.sendImmediately(item.recipientUserId, payload);

                // Success - delete
                await database.write(async () => {
                    await item.destroyPermanently();
                });
            } catch (error) {
                Logger.warn('PushQueue', `Failed to process item ${item.id}`, error);

                // Increment retry or delete if max retries
                await database.write(async () => {
                    if (item.retryCount >= 5) {
                        Logger.error('PushQueue', `Max retries reached for ${item.id}, discarding.`);
                        await item.destroyPermanently();
                    } else {
                        await item.update(r => { r.retryCount += 1; });
                    }
                });
            }
        }
    }
};
