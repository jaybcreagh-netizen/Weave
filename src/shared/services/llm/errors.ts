/**
 * LLM Error Classification
 * Provides a taxonomy of LLM API errors for proper handling and retry logic.
 */

// ============================================================================
// Error Types
// ============================================================================

/**
 * Categorized error types for LLM operations
 */
export enum LLMErrorType {
    // === Retryable Errors ===
    /** Rate limit exceeded - retry after delay */
    RATE_LIMITED = 'rate_limited',

    /** Context too long - truncate and retry */
    CONTEXT_TOO_LONG = 'context_too_long',

    /** Request timed out - retry with longer timeout */
    TIMEOUT = 'timeout',

    /** Temporary server error - retry with backoff */
    SERVER_ERROR = 'server_error',

    // === Non-Retryable Errors ===
    /** Authentication failed - check API key */
    AUTH_FAILED = 'auth_failed',

    /** Content was filtered by safety systems */
    CONTENT_FILTERED = 'content_filtered',

    /** Invalid request format */
    INVALID_REQUEST = 'invalid_request',

    /** Network connectivity issue */
    NETWORK_ERROR = 'network_error',

    /** Structured output parsing failed */
    PARSE_ERROR = 'parse_error',

    /** Provider not available/configured */
    PROVIDER_UNAVAILABLE = 'provider_unavailable',

    /** Unknown error */
    UNKNOWN = 'unknown',
}

/**
 * Structured LLM error with retry guidance
 */
export interface LLMError extends Error {
    /** Classified error type */
    type: LLMErrorType

    /** Whether this error is retryable */
    retryable: boolean

    /** Suggested retry delay in ms (for rate limits) */
    retryAfterMs?: number

    /** Original error for debugging */
    cause?: Error

    /** HTTP status code if applicable */
    statusCode?: number

    /** Provider name where error occurred */
    provider?: string
}

// ============================================================================
// Error Classification
// ============================================================================

/**
 * Classify an error into our taxonomy
 * @param error - The raw error from the API
 * @param provider - Provider name for context
 */
export function classifyError(error: unknown, provider: string = 'unknown'): LLMError {
    // Extract a proper error message
    let message: string
    if (error instanceof Error) {
        message = error.message
    } else if (typeof error === 'string') {
        message = error
    } else if (error !== null && typeof error === 'object') {
        // Handle plain objects with message property
        const obj = error as Record<string, unknown>
        if (typeof obj.message === 'string') {
            message = obj.message
        } else {
            // Stringify the whole object for debugging
            try {
                message = JSON.stringify(error)
            } catch {
                message = 'Unknown error'
            }
        }
    } else {
        message = 'Unknown error'
    }

    const baseError: LLMError = {
        name: 'LLMError',
        message,
        type: LLMErrorType.UNKNOWN,
        retryable: false,
        provider,
        cause: error instanceof Error ? error : undefined,
    }

    // Handle string errors
    if (typeof error === 'string') {
        return classifyByMessage(error, baseError)
    }

    // Handle Error objects
    if (error instanceof Error) {
        // Check for fetch/network errors
        if (error.name === 'AbortError' || error.message.includes('timeout')) {
            return {
                ...baseError,
                type: LLMErrorType.TIMEOUT,
                retryable: true,
                retryAfterMs: 5000,
            }
        }

        if (error.name === 'TypeError' && error.message.includes('fetch')) {
            return {
                ...baseError,
                type: LLMErrorType.NETWORK_ERROR,
                retryable: false,
            }
        }

        return classifyByMessage(error.message, baseError)
    }

    // Handle response-like objects (from API errors)
    if (typeof error === 'object' && error !== null) {
        const obj = error as Record<string, unknown>

        // Check for HTTP status codes
        const status = obj.status || obj.statusCode
        if (typeof status === 'number') {
            return classifyByStatusCode(status, obj.message as string || '', baseError)
        }

        // Check for error message
        if (typeof obj.message === 'string') {
            return classifyByMessage(obj.message, baseError)
        }
    }

    return baseError
}

/**
 * Classify by HTTP status code
 */
function classifyByStatusCode(status: number, message: string, base: LLMError): LLMError {
    base.statusCode = status

    switch (status) {
        case 400:
            // Check if it's a context length issue
            if (message.toLowerCase().includes('context') ||
                message.toLowerCase().includes('token') ||
                message.toLowerCase().includes('length')) {
                return { ...base, type: LLMErrorType.CONTEXT_TOO_LONG, retryable: true }
            }
            return { ...base, type: LLMErrorType.INVALID_REQUEST, retryable: false }

        case 401:
        case 403:
            return { ...base, type: LLMErrorType.AUTH_FAILED, retryable: false }

        case 429:
            return {
                ...base,
                type: LLMErrorType.RATE_LIMITED,
                retryable: true,
                retryAfterMs: 60000, // Default to 60s for rate limits
            }

        case 500:
        case 502:
        case 503:
        case 504:
            return {
                ...base,
                type: LLMErrorType.SERVER_ERROR,
                retryable: true,
                retryAfterMs: 5000,
            }

        default:
            return base
    }
}

/**
 * Classify by error message content
 */
function classifyByMessage(message: string, base: LLMError): LLMError {
    const lowerMessage = message.toLowerCase()

    // Rate limiting (including Gemini's RESOURCE_EXHAUSTED)
    if (lowerMessage.includes('rate limit') ||
        lowerMessage.includes('too many requests') ||
        lowerMessage.includes('quota exceeded') ||
        lowerMessage.includes('resource exhausted') ||
        lowerMessage.includes('quota')) {
        return {
            ...base,
            type: LLMErrorType.RATE_LIMITED,
            retryable: true,
            retryAfterMs: 60000,
        }
    }

    // Context length
    if (lowerMessage.includes('context') ||
        lowerMessage.includes('token limit') ||
        lowerMessage.includes('too long') ||
        lowerMessage.includes('maximum')) {
        return { ...base, type: LLMErrorType.CONTEXT_TOO_LONG, retryable: true }
    }

    // Authentication
    if (lowerMessage.includes('api key') ||
        lowerMessage.includes('unauthorized') ||
        lowerMessage.includes('invalid key') ||
        lowerMessage.includes('authentication')) {
        return { ...base, type: LLMErrorType.AUTH_FAILED, retryable: false }
    }

    // Content filtering
    if (lowerMessage.includes('safety') ||
        lowerMessage.includes('blocked') ||
        lowerMessage.includes('content filter') ||
        lowerMessage.includes('harmful')) {
        return { ...base, type: LLMErrorType.CONTENT_FILTERED, retryable: false }
    }

    // Parsing
    if (lowerMessage.includes('parse') ||
        lowerMessage.includes('json') ||
        lowerMessage.includes('invalid response')) {
        return { ...base, type: LLMErrorType.PARSE_ERROR, retryable: false }
    }

    // Network
    if (lowerMessage.includes('network') ||
        lowerMessage.includes('connection') ||
        lowerMessage.includes('offline')) {
        return { ...base, type: LLMErrorType.NETWORK_ERROR, retryable: false }
    }

    return base
}

// ============================================================================
// Error Creation Helpers
// ============================================================================

/**
 * Create a typed LLM error
 */
export function createLLMError(
    type: LLMErrorType,
    message: string,
    options?: Partial<Omit<LLMError, 'type' | 'message' | 'name'>>
): LLMError {
    const retryable = [
        LLMErrorType.RATE_LIMITED,
        LLMErrorType.CONTEXT_TOO_LONG,
        LLMErrorType.TIMEOUT,
        LLMErrorType.SERVER_ERROR,
    ].includes(type)

    return {
        name: 'LLMError',
        message,
        type,
        retryable,
        ...options,
    }
}

/**
 * User-friendly error messages for each type
 */
export const USER_ERROR_MESSAGES: Record<LLMErrorType, string> = {
    [LLMErrorType.RATE_LIMITED]: 'Taking a moment to think... please try again shortly.',
    [LLMErrorType.CONTEXT_TOO_LONG]: 'Processing... let me simplify that.',
    [LLMErrorType.TIMEOUT]: 'Still thinking... this is taking longer than usual.',
    [LLMErrorType.SERVER_ERROR]: 'The Oracle is momentarily unavailable. Please try again.',
    [LLMErrorType.AUTH_FAILED]: 'Connection issue. Please restart the app.',
    [LLMErrorType.CONTENT_FILTERED]: "I can't help with that specific question. Could you rephrase?",
    [LLMErrorType.INVALID_REQUEST]: 'Something went wrong. Please try again.',
    [LLMErrorType.NETWORK_ERROR]: 'No internet connection. Connect and try again.',
    [LLMErrorType.PARSE_ERROR]: 'Got an unexpected response. Please try again.',
    [LLMErrorType.PROVIDER_UNAVAILABLE]: 'The Oracle is currently unavailable.',
    [LLMErrorType.UNKNOWN]: 'Something went wrong. Please try again.',
}
