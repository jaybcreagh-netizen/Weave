import { useEffect, useRef, useCallback } from 'react';
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';

const INACTIVITY_TIMEOUT = 30000; // 30 seconds

/**
 * Custom hook that keeps the screen awake while user is active,
 * but allows it to sleep after 30 seconds of inactivity.
 */
export function useActivityKeepAwake(tag: string = 'activity-keep-awake') {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(false);

  const resetTimer = useCallback(() => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Activate keep awake if not already active
    if (!isActiveRef.current) {
      activateKeepAwake(tag);
      isActiveRef.current = true;
    }

    // Set new timeout to deactivate after 30 seconds
    timeoutRef.current = setTimeout(() => {
      deactivateKeepAwake(tag);
      isActiveRef.current = false;
    }, INACTIVITY_TIMEOUT);
  }, [tag]);

  // Initial activation and cleanup
  useEffect(() => {
    resetTimer();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      deactivateKeepAwake(tag);
      isActiveRef.current = false;
    };
  }, [tag, resetTimer]);

  return resetTimer;
}
