/**
 * LLM Mutation Hooks
 *
 * React Query mutations for LLM-powered features.
 * These automatically handle retry logic for transient failures.
 */

import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { llmService } from '@/shared/services/llm';
import { logger } from '@/shared/services/logger.service';

/**
 * Error types for LLM operations
 */
export type LLMErrorType =
    | 'auth_failed'
    | 'rate_limited'
    | 'timeout'
    | 'server_error'
    | 'network_error'
    | 'invalid_response'
    | 'unknown';

export class LLMError extends Error {
    type: LLMErrorType;
    retryable: boolean;

    constructor(message: string, type: LLMErrorType) {
        super(message);
        this.name = 'LLMError';
        this.type = type;
        this.retryable = ['timeout', 'server_error', 'network_error'].includes(type);
    }

    /** Get user-friendly error message */
    get userMessage(): string {
        switch (this.type) {
            case 'auth_failed':
                return 'Authentication failed. Please check your API key in Settings.';
            case 'rate_limited':
                return 'You have reached your usage limit. Please try again later.';
            case 'timeout':
                return 'The request is taking too long. Please try again.';
            case 'server_error':
                return 'The service is temporarily unavailable. Please try again later.';
            case 'network_error':
                return 'Network connection lost. Please check your internet.';
            case 'invalid_response':
                return 'Received an invalid response. Please try again.';
            default:
                return 'Something went wrong. Please try again.';
        }
    }
}

/**
 * Classify an error into an LLMErrorType
 */
function classifyLLMError(error: unknown): LLMError {
    if (error instanceof LLMError) return error;

    const err = error as any;
    const message = (err?.message || '').toLowerCase();
    const type = err?.type;

    // Check by type first (if LLM service provides it)
    if (type) {
        if (['auth_failed', 'rate_limited', 'timeout', 'server_error', 'network_error'].includes(type)) {
            return new LLMError(err.message || 'LLM error', type as LLMErrorType);
        }
    }

    // Check by message content
    if (message.includes('api key') || message.includes('unauthorized') || message.includes('403')) {
        return new LLMError(err.message, 'auth_failed');
    }
    if (message.includes('rate') || message.includes('limit') || message.includes('quota')) {
        return new LLMError(err.message, 'rate_limited');
    }
    if (message.includes('timeout') || message.includes('timed out')) {
        return new LLMError(err.message, 'timeout');
    }
    if (message.includes('500') || message.includes('503') || message.includes('server')) {
        return new LLMError(err.message, 'server_error');
    }
    if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
        return new LLMError(err.message, 'network_error');
    }

    return new LLMError(err?.message || 'Unknown LLM error', 'unknown');
}

/**
 * Base LLM completion request
 */
export interface LLMCompletionRequest {
    system: string;
    user: string;
    options?: {
        temperature?: number;
        maxTokens?: number;
        jsonMode?: boolean;
    };
}

export interface LLMCompletionResponse {
    text: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * Hook for making LLM completion requests
 *
 * @example
 * ```tsx
 * const { mutate, isPending, error } = useLLMCompletion({
 *   onSuccess: (data) => console.log('Response:', data.text),
 * });
 *
 * // Call it:
 * mutate({ system: 'You are helpful.', user: 'Hello!' });
 * ```
 */
export function useLLMCompletion(
    options?: Omit<UseMutationOptions<LLMCompletionResponse, LLMError, LLMCompletionRequest>, 'mutationFn'>
) {
    return useMutation<LLMCompletionResponse, LLMError, LLMCompletionRequest>({
        mutationFn: async (request) => {
            if (!llmService.isAvailable()) {
                throw new LLMError('LLM service not configured', 'auth_failed');
            }

            try {
                const response = await llmService.complete(
                    { system: request.system, user: request.user },
                    request.options
                );

                return {
                    text: response.text,
                    usage: response.usage,
                };
            } catch (error) {
                throw classifyLLMError(error);
            }
        },
        retry: (failureCount, error) => {
            // Only retry retryable errors, up to 2 times
            return error.retryable && failureCount < 2;
        },
        retryDelay: (attemptIndex) => {
            // Exponential backoff: 1s, 2s
            return Math.min(1000 * Math.pow(2, attemptIndex), 4000);
        },
        onError: (error) => {
            logger.error('useLLMCompletion', 'LLM request failed', {
                type: error.type,
                message: error.message,
            });
        },
        ...options,
    });
}

/**
 * Hook for LLM completions that return JSON
 *
 * @example
 * ```tsx
 * const { mutate, data } = useLLMJsonCompletion<{ sentiment: string }>();
 * mutate({ system: '...', user: '...' });
 * // data?.sentiment
 * ```
 */
export function useLLMJsonCompletion<T>(
    options?: Omit<UseMutationOptions<T, LLMError, LLMCompletionRequest>, 'mutationFn'>
) {
    return useMutation<T, LLMError, LLMCompletionRequest>({
        mutationFn: async (request) => {
            if (!llmService.isAvailable()) {
                throw new LLMError('LLM service not configured', 'auth_failed');
            }

            try {
                const response = await llmService.complete(
                    { system: request.system, user: request.user },
                    { ...request.options, jsonMode: true }
                );

                try {
                    return JSON.parse(response.text) as T;
                } catch {
                    throw new LLMError('Failed to parse LLM response as JSON', 'invalid_response');
                }
            } catch (error) {
                if (error instanceof LLMError) throw error;
                throw classifyLLMError(error);
            }
        },
        retry: (failureCount, error) => {
            // Retry retryable errors and invalid_response (might be transient)
            const shouldRetry = error.retryable || error.type === 'invalid_response';
            return shouldRetry && failureCount < 2;
        },
        retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 4000),
        onError: (error) => {
            logger.error('useLLMJsonCompletion', 'LLM JSON request failed', {
                type: error.type,
                message: error.message,
            });
        },
        ...options,
    });
}
