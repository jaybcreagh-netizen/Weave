/**
 * Shared Hooks
 *
 * Common React hooks used across the application.
 */

export { useAppState } from './useAppState';
export { useBufferedInput } from './useBufferedInput';
export { useDatabaseReady } from './useDatabaseReady';
export { useDebounceCallback } from './useDebounceCallback';
export { useFriendSelector } from './useFriendSelector';
export { usePausableAnimation } from './usePausableAnimation';
export { useTheme } from './useTheme';
export { useVoiceDictation } from './useVoiceDictation';

// Async state management
export {
    useAction,
    useActionWithToast,
    type ActionState,
    type UseActionOptions,
    type UseActionReturn,
    type UseActionWithToastOptions,
} from './useAction';
