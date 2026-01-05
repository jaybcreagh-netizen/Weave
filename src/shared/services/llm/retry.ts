/**
 * LLM Retry Logic
 * Implements exponential backoff with jitter for retrying LLM operations.
 */

import { LLMErrorType, classifyError, LLMError } from './errors'

// ============================================================================
// Configuration
// ============================================================================

export interface RetryConfig {
    /** Maximum number of retry attempts */
    maxRetries: number

    /** Base delay in ms (will be multiplied by 2^attempt) */
    baseDelayMs: number

    /** Maximum delay between retries */
    maxDelayMs: number

    /** Jitter factor (0-1) to randomize delay */
    jitter: number
}

const DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitter: 0.2,
}

// ============================================================================
// Retry Function
// ============================================================================

/**
 * Execute an async operation with retry logic
 * 
 * @param operation - The async function to execute
 * @param config - Retry configuration
 * @param onContextTooLong - Callback when context is too long (for truncation)
 * @param onRetry - Callback on each retry attempt (for logging/UI)
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    options?: {
        /** Callback when context is too long (can be async for DB pruning) */
        onContextTooLong?: () => void | Promise<void>
        onRetry?: (attempt: number, error: LLMError, delayMs: number) => void
        /** AbortSignal to cancel retries */
        signal?: AbortSignal
    }
): Promise<T> {
    const finalConfig = { ...DEFAULT_CONFIG, ...config }
    const { onContextTooLong, onRetry, signal } = options || {}

    let lastError: LLMError | null = null

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
        // Check for cancellation before each attempt
        if (signal?.aborted) {
            const abortError = new Error('Request cancelled') as LLMError
            abortError.name = 'AbortError'
            abortError.type = LLMErrorType.TIMEOUT
            abortError.retryable = false
            throw abortError
        }

        try {
            return await operation()
        } catch (error) {
            lastError = classifyError(error)

            // Don't retry non-retryable errors
            if (!lastError.retryable) {
                throw lastError
            }

            // Handle context too long specially - await in case callback is async
            if (lastError.type === LLMErrorType.CONTEXT_TOO_LONG && onContextTooLong) {
                await onContextTooLong()
                // Let it retry after truncation callback
            }

            // Last attempt - throw the error
            if (attempt === finalConfig.maxRetries) {
                throw lastError
            }

            // Calculate delay with exponential backoff and jitter
            const delayMs = calculateDelay(attempt, lastError, finalConfig)

            // Notify caller of retry
            if (onRetry) {
                onRetry(attempt + 1, lastError, delayMs)
            }

            // Check for cancellation before waiting
            if (signal?.aborted) {
                const abortError = new Error('Request cancelled') as LLMError
                abortError.name = 'AbortError'
                abortError.type = LLMErrorType.TIMEOUT
                abortError.retryable = false
                throw abortError
            }

            // Wait before retrying
            await sleep(delayMs)
        }
    }

    // Should never reach here, but TypeScript requires it
    throw lastError || new Error('Retry exhausted')
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Calculate delay for a retry attempt
 */
function calculateDelay(attempt: number, error: LLMError, config: RetryConfig): number {
    // Use retry-after hint if provided (e.g., from rate limit headers)
    if (error.retryAfterMs && error.type === LLMErrorType.RATE_LIMITED) {
        return Math.min(error.retryAfterMs, config.maxDelayMs)
    }

    // Exponential backoff: baseDelay * 2^attempt
    const exponentialDelay = config.baseDelayMs * Math.pow(2, attempt)

    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs)

    // Add jitter to prevent thundering herd
    // Clamp jitter factor to 0-0.5 to prevent negative or excessive delays
    const clampedJitter = Math.max(0, Math.min(0.5, config.jitter))
    const jitter = cappedDelay * clampedJitter * (Math.random() - 0.5) * 2

    // Ensure delay is never negative
    return Math.max(0, Math.round(cappedDelay + jitter))
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap an operation with timeout
 */
export async function withTimeout<T>(
    operation: Promise<T>,
    timeoutMs: number,
    timeoutMessage: string = 'Operation timed out'
): Promise<T> {
    return Promise.race([
        operation,
        new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        ),
    ])
}

/**
 * Create an AbortController with timeout
 */
export function createTimeoutController(timeoutMs: number): {
    controller: AbortController
    cleanup: () => void
} {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    return {
        controller,
        cleanup: () => clearTimeout(timeoutId),
    }
}
