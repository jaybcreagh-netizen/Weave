/**
 * Supabase Mutation Hooks
 *
 * React Query mutations for Supabase API operations.
 * These automatically handle retry logic for transient failures.
 */

import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { logger } from '@/shared/services/logger.service';

/**
 * Error types for Supabase operations
 */
export type SupabaseErrorType =
    | 'auth_error'
    | 'not_found'
    | 'conflict'
    | 'validation_error'
    | 'rate_limited'
    | 'server_error'
    | 'network_error'
    | 'timeout'
    | 'unknown';

export class SupabaseError extends Error {
    type: SupabaseErrorType;
    retryable: boolean;
    status?: number;

    constructor(message: string, type: SupabaseErrorType, status?: number) {
        super(message);
        this.name = 'SupabaseError';
        this.type = type;
        this.status = status;
        this.retryable = ['server_error', 'network_error', 'timeout'].includes(type);
    }

    /** Get user-friendly error message */
    get userMessage(): string {
        switch (this.type) {
            case 'auth_error':
                return 'Please sign in to continue.';
            case 'not_found':
                return 'The requested item was not found.';
            case 'conflict':
                return 'This action conflicts with existing data. Please refresh and try again.';
            case 'validation_error':
                return 'Please check your input and try again.';
            case 'rate_limited':
                return 'Too many requests. Please wait a moment and try again.';
            case 'server_error':
                return 'The server is temporarily unavailable. Please try again later.';
            case 'network_error':
                return 'Network connection lost. Please check your internet.';
            case 'timeout':
                return 'The request timed out. Please try again.';
            default:
                return 'Something went wrong. Please try again.';
        }
    }
}

/**
 * Classify an error into a SupabaseErrorType
 */
function classifySupabaseError(error: unknown): SupabaseError {
    if (error instanceof SupabaseError) return error;

    const err = error as any;
    const message = (err?.message || '').toLowerCase();
    const status = err?.status || err?.code;

    // Check by status code
    if (status === 401 || status === 403) {
        return new SupabaseError(err.message || 'Authentication required', 'auth_error', status);
    }
    if (status === 404) {
        return new SupabaseError(err.message || 'Not found', 'not_found', status);
    }
    if (status === 409) {
        return new SupabaseError(err.message || 'Conflict', 'conflict', status);
    }
    if (status === 422 || status === 400) {
        return new SupabaseError(err.message || 'Validation error', 'validation_error', status);
    }
    if (status === 429) {
        return new SupabaseError(err.message || 'Rate limited', 'rate_limited', status);
    }
    if (status >= 500 && status < 600) {
        return new SupabaseError(err.message || 'Server error', 'server_error', status);
    }

    // Check by message content
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
        return new SupabaseError(err.message, 'network_error');
    }
    if (message.includes('timeout') || message.includes('timed out')) {
        return new SupabaseError(err.message, 'timeout');
    }
    if (message.includes('jwt') || message.includes('token') || message.includes('unauthorized')) {
        return new SupabaseError(err.message, 'auth_error');
    }

    return new SupabaseError(err?.message || 'Unknown error', 'unknown');
}

// ─────────────────────────────────────────────────────────────────────────────
// Edge Function Mutations
// ─────────────────────────────────────────────────────────────────────────────

export interface EdgeFunctionRequest<T extends Record<string, unknown> = Record<string, unknown>> {
    functionName: string;
    body: T;
}

export interface EdgeFunctionResponse<T = unknown> {
    data: T;
}

/**
 * Generic hook for calling Supabase Edge Functions
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useEdgeFunction<{ result: string }, { query: string }>();
 *
 * mutate({
 *   functionName: 'my-function',
 *   body: { query: 'hello' }
 * });
 * ```
 */
export function useEdgeFunction<TResponse = unknown, TRequest extends Record<string, unknown> = Record<string, unknown>>(
    options?: Omit<UseMutationOptions<TResponse, SupabaseError, EdgeFunctionRequest<TRequest>>, 'mutationFn'>
) {
    return useMutation<TResponse, SupabaseError, EdgeFunctionRequest<TRequest>>({
        mutationFn: async ({ functionName, body }) => {
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new SupabaseError('Supabase not configured', 'auth_error');
            }

            try {
                const { data, error } = await supabase.functions.invoke(functionName, { body: body as Record<string, unknown> });

                if (error) {
                    throw error;
                }

                if (!data) {
                    throw new SupabaseError('No data returned from edge function', 'server_error');
                }

                return data as TResponse;
            } catch (error) {
                throw classifySupabaseError(error);
            }
        },
        retry: (failureCount, error) => {
            return error.retryable && failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 4000),
        onError: (error) => {
            logger.error('useEdgeFunction', 'Edge function call failed', {
                type: error.type,
                message: error.message,
                status: error.status,
            });
        },
        ...options,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Database Mutations (for RPC calls or direct operations)
// ─────────────────────────────────────────────────────────────────────────────

export interface RpcRequest<T = unknown> {
    functionName: string;
    params: T;
}

/**
 * Hook for calling Supabase RPC functions
 *
 * @example
 * ```tsx
 * const { mutate } = useSupabaseRpc<{ count: number }, { user_id: string }>();
 *
 * mutate({
 *   functionName: 'get_friend_count',
 *   params: { user_id: '123' }
 * });
 * ```
 */
export function useSupabaseRpc<TResponse = unknown, TParams = unknown>(
    options?: Omit<UseMutationOptions<TResponse, SupabaseError, RpcRequest<TParams>>, 'mutationFn'>
) {
    return useMutation<TResponse, SupabaseError, RpcRequest<TParams>>({
        mutationFn: async ({ functionName, params }) => {
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new SupabaseError('Supabase not configured', 'auth_error');
            }

            try {
                const { data, error } = await supabase.rpc(functionName, params as any);

                if (error) {
                    throw error;
                }

                return data as TResponse;
            } catch (error) {
                throw classifySupabaseError(error);
            }
        },
        retry: (failureCount, error) => {
            return error.retryable && failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 4000),
        onError: (error) => {
            logger.error('useSupabaseRpc', 'RPC call failed', {
                type: error.type,
                message: error.message,
            });
        },
        ...options,
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Specific Feature Mutations
// ─────────────────────────────────────────────────────────────────────────────

export interface LinkFriendRequest {
    friendId: string;
    targetUserId: string;
}

export interface LinkFriendResponse {
    success: boolean;
    linkedUserId: string;
}

/**
 * Hook for linking a friend to another Weave user
 *
 * @example
 * ```tsx
 * const { mutate, isPending, error } = useLinkFriend({
 *   onSuccess: () => showToast('Friend linked!'),
 * });
 *
 * mutate({ friendId: '123', targetUserId: '456' });
 * ```
 */
export function useLinkFriend(
    options?: Omit<UseMutationOptions<LinkFriendResponse, SupabaseError, LinkFriendRequest>, 'mutationFn'>
) {
    return useMutation<LinkFriendResponse, SupabaseError, LinkFriendRequest>({
        mutationFn: async ({ friendId, targetUserId }) => {
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new SupabaseError('Supabase not configured', 'auth_error');
            }

            try {
                const { data, error } = await supabase.functions.invoke('link-friend', {
                    body: { friendId, targetUserId },
                });

                if (error) throw error;

                return {
                    success: true,
                    linkedUserId: targetUserId,
                };
            } catch (error) {
                throw classifySupabaseError(error);
            }
        },
        retry: (failureCount, error) => {
            // Don't retry conflicts (user might already be linked)
            return error.retryable && error.type !== 'conflict' && failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 4000),
        onError: (error) => {
            logger.error('useLinkFriend', 'Friend linking failed', {
                type: error.type,
                message: error.message,
            });
        },
        ...options,
    });
}

export interface CheckUsernameRequest {
    username: string;
    excludeUserId?: string;
}

export interface CheckUsernameResponse {
    available: boolean;
    username: string;
}

/**
 * Hook for checking username availability
 *
 * @example
 * ```tsx
 * const { mutate, data } = useCheckUsername();
 *
 * // On input blur or debounced change:
 * mutate({ username: 'newname' });
 *
 * // Check result:
 * if (data?.available) { ... }
 * ```
 */
export function useCheckUsername(
    options?: Omit<UseMutationOptions<CheckUsernameResponse, SupabaseError, CheckUsernameRequest>, 'mutationFn'>
) {
    return useMutation<CheckUsernameResponse, SupabaseError, CheckUsernameRequest>({
        mutationFn: async ({ username, excludeUserId }) => {
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new SupabaseError('Supabase not configured', 'auth_error');
            }

            const cleaned = username.trim().toLowerCase();

            try {
                let query = supabase
                    .from('user_profiles')
                    .select('id', { count: 'exact', head: true })
                    .eq('username', cleaned);

                if (excludeUserId) {
                    query = query.neq('id', excludeUserId);
                }

                const { count, error } = await query;

                if (error) throw error;

                return {
                    available: (count || 0) === 0,
                    username: cleaned,
                };
            } catch (error) {
                throw classifySupabaseError(error);
            }
        },
        retry: false, // Don't retry availability checks
        onError: (error) => {
            logger.error('useCheckUsername', 'Username check failed', {
                type: error.type,
                message: error.message,
            });
        },
        ...options,
    });
}

export interface UpdateUsernameRequest {
    userId: string;
    username: string;
}

export interface UpdateUsernameResponse {
    success: boolean;
    username: string;
}

/**
 * Hook for updating user's username
 *
 * @example
 * ```tsx
 * const { mutate, isPending } = useUpdateUsername({
 *   onSuccess: () => showToast('Username updated!'),
 * });
 *
 * mutate({ userId: user.id, username: 'newname' });
 * ```
 */
export function useUpdateUsername(
    options?: Omit<UseMutationOptions<UpdateUsernameResponse, SupabaseError, UpdateUsernameRequest>, 'mutationFn'>
) {
    return useMutation<UpdateUsernameResponse, SupabaseError, UpdateUsernameRequest>({
        mutationFn: async ({ userId, username }) => {
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new SupabaseError('Supabase not configured', 'auth_error');
            }

            const cleaned = username.trim().toLowerCase();

            // Validate format
            if (cleaned.length < 3) {
                throw new SupabaseError('Username must be at least 3 characters', 'validation_error');
            }
            if (!/^[a-z0-9_]+$/.test(cleaned)) {
                throw new SupabaseError('Only letters, numbers, and underscores allowed', 'validation_error');
            }

            try {
                // Check availability first
                const { count: existing } = await supabase
                    .from('user_profiles')
                    .select('id', { count: 'exact', head: true })
                    .eq('username', cleaned)
                    .neq('id', userId);

                if (existing && existing > 0) {
                    throw new SupabaseError('Username is already taken', 'conflict');
                }

                // Update username
                const { error } = await supabase
                    .from('user_profiles')
                    .upsert({
                        id: userId,
                        user_id: userId,
                        username: cleaned,
                        updated_at: new Date().toISOString(),
                    }, {
                        onConflict: 'user_id',
                    });

                if (error) throw error;

                return {
                    success: true,
                    username: cleaned,
                };
            } catch (error) {
                if (error instanceof SupabaseError) throw error;
                throw classifySupabaseError(error);
            }
        },
        retry: (failureCount, error) => {
            // Don't retry validation or conflict errors
            return error.retryable && failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 4000),
        onError: (error) => {
            logger.error('useUpdateUsername', 'Username update failed', {
                type: error.type,
                message: error.message,
            });
        },
        ...options,
    });
}
