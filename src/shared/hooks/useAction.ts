/**
 * useAction Hook
 *
 * A lightweight hook for managing async operations that don't need
 * React Query's caching/retry capabilities (e.g., local DB writes).
 *
 * Use this for:
 * - WatermelonDB write operations
 * - Local state mutations
 * - Simple one-off async operations
 *
 * Use React Query mutations instead for:
 * - API calls that benefit from retry logic
 * - Operations that need caching
 * - Cross-component state synchronization
 */

import { useState, useCallback, useRef } from 'react';

export interface ActionState<TData = unknown> {
    /** Whether the action is currently executing */
    isLoading: boolean;
    /** Error from the last execution, if any */
    error: Error | null;
    /** Data returned from the last successful execution */
    data: TData | null;
    /** Whether the action has been executed at least once */
    hasRun: boolean;
    /** Whether the last execution was successful */
    isSuccess: boolean;
    /** Whether the last execution failed */
    isError: boolean;
}

export interface UseActionOptions<TData> {
    /** Callback fired on successful execution */
    onSuccess?: (data: TData) => void;
    /** Callback fired on error */
    onError?: (error: Error) => void;
    /** Callback fired after execution completes (success or error) */
    onSettled?: (data: TData | null, error: Error | null) => void;
}

export interface UseActionReturn<TData, TArgs extends unknown[]> {
    /** Execute the action */
    execute: (...args: TArgs) => Promise<TData | null>;
    /** Reset state to initial values */
    reset: () => void;
    /** Current state */
    state: ActionState<TData>;
    /** Convenience accessors */
    isLoading: boolean;
    error: Error | null;
    data: TData | null;
    isSuccess: boolean;
    isError: boolean;
}

/**
 * Hook for managing async action state
 *
 * @example
 * ```tsx
 * const { execute, isLoading, error } = useAction(
 *   async (friendId: string, name: string) => {
 *     await database.write(async () => {
 *       const friend = await database.get('friends').find(friendId);
 *       await friend.update(f => { f.name = name; });
 *     });
 *     return { success: true };
 *   },
 *   { onSuccess: () => showToast('Friend updated!') }
 * );
 *
 * // In handler:
 * await execute(friendId, newName);
 * ```
 */
export function useAction<TData, TArgs extends unknown[] = []>(
    actionFn: (...args: TArgs) => Promise<TData>,
    options?: UseActionOptions<TData>
): UseActionReturn<TData, TArgs> {
    const [state, setState] = useState<ActionState<TData>>({
        isLoading: false,
        error: null,
        data: null,
        hasRun: false,
        isSuccess: false,
        isError: false,
    });

    // Track mounted state to prevent state updates after unmount
    const isMountedRef = useRef(true);

    // Store options in ref to avoid stale closures
    const optionsRef = useRef(options);
    optionsRef.current = options;

    // Cleanup on unmount
    useState(() => {
        return () => {
            isMountedRef.current = false;
        };
    });

    const execute = useCallback(async (...args: TArgs): Promise<TData | null> => {
        if (!isMountedRef.current) return null;

        setState(prev => ({
            ...prev,
            isLoading: true,
            error: null,
            isSuccess: false,
            isError: false,
        }));

        try {
            const result = await actionFn(...args);

            if (isMountedRef.current) {
                setState({
                    isLoading: false,
                    error: null,
                    data: result,
                    hasRun: true,
                    isSuccess: true,
                    isError: false,
                });

                optionsRef.current?.onSuccess?.(result);
                optionsRef.current?.onSettled?.(result, null);
            }

            return result;
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));

            if (isMountedRef.current) {
                setState(prev => ({
                    ...prev,
                    isLoading: false,
                    error,
                    hasRun: true,
                    isSuccess: false,
                    isError: true,
                }));

                optionsRef.current?.onError?.(error);
                optionsRef.current?.onSettled?.(null, error);
            }

            return null;
        }
    }, [actionFn]);

    const reset = useCallback(() => {
        setState({
            isLoading: false,
            error: null,
            data: null,
            hasRun: false,
            isSuccess: false,
            isError: false,
        });
    }, []);

    return {
        execute,
        reset,
        state,
        isLoading: state.isLoading,
        error: state.error,
        data: state.data,
        isSuccess: state.isSuccess,
        isError: state.isError,
    };
}

/**
 * Convenience wrapper that auto-shows error toasts
 *
 * @example
 * ```tsx
 * const { execute, isLoading } = useActionWithToast(
 *   async () => { ... },
 *   { successMessage: 'Saved!' }
 * );
 * ```
 */
export interface UseActionWithToastOptions<TData> extends UseActionOptions<TData> {
    /** Message to show on success (optional) */
    successMessage?: string;
    /** Message to show on error (defaults to error.message) */
    errorMessage?: string;
    /** Toast function - inject from UI store or context */
    showToast?: (message: string, type: 'success' | 'error') => void;
}

export function useActionWithToast<TData, TArgs extends unknown[] = []>(
    actionFn: (...args: TArgs) => Promise<TData>,
    options?: UseActionWithToastOptions<TData>
): UseActionReturn<TData, TArgs> {
    return useAction(actionFn, {
        ...options,
        onSuccess: (data) => {
            if (options?.successMessage && options?.showToast) {
                options.showToast(options.successMessage, 'success');
            }
            options?.onSuccess?.(data);
        },
        onError: (error) => {
            if (options?.showToast) {
                options.showToast(options.errorMessage || error.message, 'error');
            }
            options?.onError?.(error);
        },
    });
}

export default useAction;
