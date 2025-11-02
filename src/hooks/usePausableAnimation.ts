import { useEffect } from 'react';
import { useSharedValue, cancelAnimation, SharedValue } from 'react-native-reanimated';
import { useAppSleeping } from './useAppState';

/**
 * Hook that automatically pauses Reanimated animations when app is sleeping (backgrounded or idle)
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

  useEffect(() => {
    if (isSleeping) {
      // Cancel animation when app is sleeping
      cancelAnimation(sharedValue);
    }
  }, [isSleeping, sharedValue]);

  return {
    isSleeping,
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

  useEffect(() => {
    if (isSleeping) {
      // Cancel animation when sleeping
      if (typeof sharedValue.value === 'number') {
        cancelAnimation(sharedValue as SharedValue<number>);
      }
    } else if (animationCallback) {
      // Restart animation when awake
      animationCallback(sharedValue);
    }
  }, [isSleeping]);

  return sharedValue;
}
