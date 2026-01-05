import { useEffect } from 'react';
import { useSharedValue, cancelAnimation, SharedValue } from 'react-native-reanimated';
import { useIsFocused } from '@react-navigation/native';
import { useAppSleeping } from './useAppState';

/**
 * Hook that automatically pauses Reanimated animations when app is sleeping (backgrounded or idle)
 * OR when the screen is not focused (user is on a different tab/screen).
 *
 * Usage:
 * ```
 * const progress = useSharedValue(0);
 * const { startAnimation, pauseAnimation } = usePausableAnimation(progress);
 *
 * useEffect(() => {
 *   startAnimation(() => {
 *     progress.value = withRepeat(withTiming(1, { duration: 2000 }), -1, true);
 *   });
 * }, []);
 * ```
 */
export function usePausableAnimation(sharedValue: SharedValue<number>) {
  const isSleeping = useAppSleeping();
  const isFocused = useIsFocused();

  const shouldPause = isSleeping || !isFocused;

  useEffect(() => {
    if (shouldPause) {
      // Cancel animation when app is sleeping or screen is not focused
      cancelAnimation(sharedValue);
    }
  }, [shouldPause, sharedValue]);

  return {
    isSleeping: shouldPause, // Return effective sleeping state
  };
}

/**
 * Hook that creates a shared value that automatically pauses when app sleeps
 *
 * Usage:
 * ```
 * const progress = usePausableSharedValue(0, (value) => {
 *   'worklet';
 *   value.value = withRepeat(withTiming(1, { duration: 2000 }), -1, true);
 * });
 * ```
 */
export function usePausableSharedValue<T>(
  initialValue: T,
  animationCallback?: (value: SharedValue<T>) => void
): SharedValue<T> {
  const sharedValue = useSharedValue(initialValue);
  const isSleeping = useAppSleeping();
  const isFocused = useIsFocused();

  const shouldPause = isSleeping || !isFocused;

  useEffect(() => {
    if (shouldPause) {
      // Cancel animation when sleeping
      if (typeof sharedValue.value === 'number') {
        cancelAnimation(sharedValue as any);
      }
    } else if (animationCallback) {
      // Restart animation when awake and focused
      animationCallback(sharedValue);
    }
  }, [shouldPause]);

  return sharedValue;
}
