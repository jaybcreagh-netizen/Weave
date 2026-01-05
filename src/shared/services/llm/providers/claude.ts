/**
 * Claude Provider
 * Implementation of LLMProvider for Anthropic's Claude models.
 * 
 * Supports: claude-3-haiku, claude-3.5-sonnet, claude-3-opus, etc.
 * Uses the Messages API directly.
 */

import {
    LLMProvider,
    LLMPrompt,
    LLMOptions,
    LLMResponse,
    LLMStructuredResponse,
    JSONSchema,
    TokenUsage,
    ResponseMetadata,
} from '../types'
import { classifyError, createLLMError, LLMErrorType } from '../errors'
import { withTimeout } from '../retry'
import { safeParseJson } from '../json-utils'
import { logger } from '@/shared/services/logger.service'

// ============================================================================
// Configuration
// ============================================================================

// Available Claude models
export const CLAUDE_MODELS = {
    'claude-3-haiku-20240307': 'claude-3-haiku-20240307',      // Fast, cheap
    'claude-3.5-haiku-20241022': 'claude-3.5-haiku-20241022',  // Latest Haiku
    'claude-3.5-sonnet-20241022': 'claude-3.5-sonnet-20241022', // Balanced
    'claude-3-opus-20240229': 'claude-3-opus-20240229',        // Most capable
} as const

export type ClaudeModel = keyof typeof CLAUDE_MODELS

const DEFAULT_MODEL: ClaudeModel = 'claude-3.5-haiku-20241022'
const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_MAX_TOKENS = 1024
const DEFAULT_TEMPERATURE = 0.7
const API_VERSION = '2023-06-01'

// ============================================================================
// Provider Implementation
// ============================================================================

export class ClaudeProvider implements LLMProvider {
    name = 'claude'
    model: string

    private apiKey: string
    private baseUrl: string

    constructor(config: ClaudeConfig) {
        this.apiKey = config.apiKey
        this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1'
        this.model = config.model || DEFAULT_MODEL
    }

    // ============================================================================
    // Core Methods
    // ============================================================================

    async complete(prompt: LLMPrompt, options?: LLMOptions): Promise<LLMResponse> {
        const startTime = Date.now()
        const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS

        try {
            const response = await withTimeout(
                this.callClaudeAPI(prompt, options),
                timeoutMs,
                'Claude request timed out'
            )

            return {
                text: response.text,
                usage: response.usage,
                metadata: {
                    model: this.model,
                    latencyMs: Date.now() - startTime,
                    finishReason: response.finishReason,
                    provider: this.name,
                },
            }
        } catch (error) {
            throw classifyError(error, this.name)
        }
    }

    async completeStructured<T>(
        prompt: LLMPrompt,
        schema: JSONSchema,
        options?: LLMOptions
    ): Promise<LLMStructuredResponse<T>> {
        const startTime = Date.now()
        const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS

        try {
            // Add JSON instruction to system prompt
            const enhancedPrompt: LLMPrompt = {
                ...prompt,
                system: `${prompt.system}\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\n\nDo not include any text before or after the JSON.`,
            }

            const response = await withTimeout(
                this.callClaudeAPI(enhancedPrompt, options),
                timeoutMs,
                'Claude request timed out'
            )

            // Parse JSON response using robust extraction
            let data: T
            try {
                data = safeParseJson<T>(response.text, 'Claude structured response')
            } catch (parseError) {
                throw createLLMError(
                    LLMErrorType.PARSE_ERROR,
                    `Failed to parse JSON response: ${parseError}`,
                    { cause: parseError as Error }
                )
            }

            return {
                text: response.text,
                data,
                usage: response.usage,
                metadata: {
                    model: this.model,
                    latencyMs: Date.now() - startTime,
                    finishReason: response.finishReason,
                    provider: this.name,
                },
            }
        } catch (error) {
            throw classifyError(error, this.name)
        }
    }

    // ============================================================================
    // API Communication
    // ============================================================================

    private async callClaudeAPI(
        prompt: LLMPrompt,
        options?: LLMOptions
    ): Promise<ClaudeAPIResponse> {
        const url = `${this.baseUrl}/messages`

        // Build messages array
        const messages = this.buildMessages(prompt)

        // Build request body
        const requestBody: ClaudeRequestBody = {
            model: this.model,
            max_tokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
            messages,
        }

        // Add system if provided
        if (prompt.system) {
            requestBody.system = prompt.system
        }

        // Add temperature if specified
        if (options?.temperature !== undefined) {
            requestBody.temperature = options.temperature
        }

        // Add topP (Claude supports this)
        if (options?.topP !== undefined) {
            requestBody.top_p = options.topP
        }

        logger.debug('ClaudeProvider', 'Sending request', {
            model: this.model,
            messageCount: messages.length,
        })

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': this.apiKey,
                'anthropic-version': API_VERSION,
            },
            body: JSON.stringify(requestBody),
            signal: options?.signal,
        })

        if (!response.ok) {
            const errorBody = await response.text()
            throw this.handleAPIError(response.status, errorBody)
        }

        const data: ClaudeRawResponse = await response.json()

        // Extract response content
        const textContent = data.content?.find(c => c.type === 'text')
        if (!textContent?.text) {
            throw createLLMError(
                LLMErrorType.INVALID_REQUEST,
                'Empty response from Claude'
            )
        }

        // Check stop reason
        const finishReason = this.mapStopReason(data.stop_reason)

        // Extract usage
        const usage: TokenUsage = {
            promptTokens: data.usage?.input_tokens || 0,
            completionTokens: data.usage?.output_tokens || 0,
            totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        }

        return {
            text: textContent.text,
            usage,
            finishReason,
        }
    }

    // ============================================================================
    // Helpers
    // ============================================================================

    private buildMessages(prompt: LLMPrompt): ClaudeMessage[] {
        const messages: ClaudeMessage[] = []

        // Add conversation history if present
        if (prompt.history) {
            for (const turn of prompt.history) {
                messages.push({
                    role: turn.role === 'assistant' ? 'assistant' : 'user',
                    content: turn.content,
                })
            }
        }

        // Add current user message
        messages.push({
            role: 'user',
            content: prompt.user,
        })

        return messages
    }

    private mapStopReason(reason?: string): ResponseMetadata['finishReason'] {
        switch (reason) {
            case 'end_turn':
            case 'stop_sequence':
                return 'stop'
            case 'max_tokens':
                return 'length'
            default:
                return 'stop'
        }
    }

    private handleAPIError(status: number, body: string): Error {
        try {
            const parsed = JSON.parse(body)
            const message = parsed.error?.message || body

            return createLLMError(
                this.statusToErrorType(status, message),
                message,
                { statusCode: status }
            )
        } catch {
            return createLLMError(
                this.statusToErrorType(status, body),
                body,
                { statusCode: status }
            )
        }
    }

    private statusToErrorType(status: number, message: string): LLMErrorType {
        // Claude-specific error detection
        if (message.toLowerCase().includes('credit') ||
            message.toLowerCase().includes('quota')) {
            return LLMErrorType.RATE_LIMITED
        }

        switch (status) {
            case 400:
                if (message.toLowerCase().includes('context') ||
                    message.toLowerCase().includes('token')) {
                    return LLMErrorType.CONTEXT_TOO_LONG
                }
                return LLMErrorType.INVALID_REQUEST
            case 401:
                return LLMErrorType.AUTH_FAILED
            case 403:
                return LLMErrorType.AUTH_FAILED
            case 429:
                return LLMErrorType.RATE_LIMITED
            case 500:
            case 502:
            case 503:
            case 529:
                return LLMErrorType.SERVER_ERROR
            default:
                return LLMErrorType.UNKNOWN
        }
    }
}

// ============================================================================
// Types
// ============================================================================

export interface ClaudeConfig {
    apiKey: string
    baseUrl?: string
    model?: ClaudeModel | string
}

interface ClaudeRequestBody {
    model: string
    max_tokens: number
    messages: ClaudeMessage[]
    system?: string
    temperature?: number
    top_p?: number
}

interface ClaudeMessage {
    role: 'user' | 'assistant'
    content: string
}

interface ClaudeRawResponse {
    content?: { type: string; text: string }[]
    stop_reason?: string
    usage?: {
        input_tokens?: number
        output_tokens?: number
    }
}

interface ClaudeAPIResponse {
    text: string
    usage: TokenUsage
    finishReason: ResponseMetadata['finishReason']
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Claude provider instance
 */
export function createClaudeProvider(config: ClaudeConfig): ClaudeProvider {
    return new ClaudeProvider(config)
}
