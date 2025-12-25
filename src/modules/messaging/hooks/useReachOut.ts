/**
 * useReachOut Hook
 *
 * Provides a function to reach out to a friend via messaging apps.
 * Handles analytics tracking and error display.
 */

import { useCallback } from 'react';
import { messagingService } from '../services/messaging.service';
import { MessagingApp, ReachOutResult } from '../types';
import Friend from '@/db/models/Friend';

interface UseReachOutReturn {
  /**
   * Reach out to a friend via their preferred messaging app.
   * @param friend - The friend to reach out to
   * @param contextMessage - Optional pre-filled message
   * @param overrideApp - Force a specific app instead of using preferences
   * @returns Result indicating success/failure
   */
  reachOut: (
    friend: Friend,
    contextMessage?: string,
    overrideApp?: MessagingApp
  ) => Promise<ReachOutResult>;
}

export function useReachOut(): UseReachOutReturn {
  const reachOut = useCallback(
    async (
      friend: Friend,
      contextMessage?: string,
      overrideApp?: MessagingApp
    ): Promise<ReachOutResult> => {
      const preferredApp =
        overrideApp || (friend.preferredMessagingApp as MessagingApp | undefined);

      const result = await messagingService.reachOut({
        friendId: friend.id,
        friendName: friend.name,
        phoneNumber: friend.phoneNumber,
        email: friend.email,
        preferredApp,
        contextMessage,
      });

      // Show error alert if failed
      if (!result.success && result.error) {
        messagingService.showErrorAlert(result.error, friend.name);
      }

      return result;
    },
    []
  );

  return { reachOut };
}
