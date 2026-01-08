/**
 * Supabase Proxy Provider
 * Routes LLM requests through a Supabase Edge Function.
 * The API key is stored server-side as a Supabase secret.
 */

import { getSupabaseClient } from '@/shared/services/supabase-client'
import {
    LLMProvider,
    LLMPrompt,
    LLMOptions,
    LLMResponse,
    LLMStructuredResponse,
    JSONSchema,
    TokenUsage,
} from '../types'
import { createLLMError, LLMErrorType } from '../errors'
import { safeParseJson } from '../json-utils'
import { logger } from '@/shared/services/logger.service'

// ============================================================================
// Configuration
// ============================================================================

const FUNCTION_NAME = 'oracle-journal'
const DEFAULT_MAX_TOKENS = 8192
const DEFAULT_TEMPERATURE = 1.0

export interface SupabaseProxyConfig {
    functionName?: string
    model?: string
}

// ============================================================================
// Provider Implementation
// ============================================================================

export class SupabaseProxyProvider implements LLMProvider {
    name = 'supabase-proxy'
    model: string

    private functionName: string

    constructor(config: SupabaseProxyConfig = {}) {
        this.functionName = config.functionName || FUNCTION_NAME
        this.model = config.model || 'gemini-3-flash'
    }

    // ============================================================================
    // Core Methods
    // ============================================================================

    async complete(prompt: LLMPrompt, options?: LLMOptions): Promise<LLMResponse> {
        const startTime = Date.now()

        try {
            const supabase = getSupabaseClient()
            if (!supabase) {
                throw createLLMError(
                    LLMErrorType.SERVER_ERROR,
                    'Supabase client not available',
                    { retryable: false }
                )
            }

            const jsonModeValue = options?.jsonMode ?? false
            logger.debug('SupabaseProxyProvider', 'Invoking Edge Function', {
                jsonMode: jsonModeValue,
                promptPreview: prompt.user?.substring(0, 100)
            })

            const { data, error } = await supabase.functions.invoke(this.functionName, {
                body: {
                    system: prompt.system,
                    user: prompt.user,
                    model: this.model,
                    temperature: options?.temperature ?? DEFAULT_TEMPERATURE,
                    maxTokens: options?.maxTokens ?? DEFAULT_MAX_TOKENS,
                    jsonMode: jsonModeValue,
                    thinkingLevel: options?.thinkingLevel,
                },
            })

            if (error) {
                logger.error('SupabaseProxyProvider', 'Edge function error', { error: error.message })
                throw createLLMError(
                    LLMErrorType.SERVER_ERROR,
                    `Edge function error: ${error.message}`,
                    { retryable: true }
                )
            }

            if (data?.error) {
                logger.error('SupabaseProxyProvider', 'Gemini API error via proxy', { error: data.error })
                throw createLLMError(
                    LLMErrorType.SERVER_ERROR,
                    `Gemini error: ${data.error}`,
                    { retryable: true }
                )
            }

            const latencyMs = Date.now() - startTime

            const usage: TokenUsage = data.usage ? {
                promptTokens: data.usage.promptTokens || 0,
                completionTokens: data.usage.completionTokens || 0,
                totalTokens: data.usage.totalTokens || 0,
            } : {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0,
            }

            return {
                text: data.text || '',
                usage,
                metadata: {
                    provider: this.name,
                    model: this.model,
                    latencyMs,
                    finishReason: data.finishReason || 'stop',
                },
            }
        } catch (error) {
            if ((error as any)?.type) {
                // Already an LLMError
                throw error
            }

            logger.error('SupabaseProxyProvider', 'Request failed', { error })
            throw createLLMError(
                LLMErrorType.NETWORK_ERROR,
                `Network error: ${error instanceof Error ? error.message : 'Unknown'}`,
                { retryable: true }
            )
        }
    }

    async completeStructured<T>(
        prompt: LLMPrompt,
        schema: JSONSchema,
        options?: LLMOptions
    ): Promise<LLMStructuredResponse<T>> {
        // Add schema instruction to prompt
        const schemaInstruction = `\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`
        const augmentedPrompt: LLMPrompt = {
            ...prompt,
            user: prompt.user + schemaInstruction,
        }

        const response = await this.complete(augmentedPrompt, options)

        try {
            const data = safeParseJson<T>(response.text)
            return {
                text: response.text,
                data,
                usage: response.usage,
                metadata: response.metadata,
            }
        } catch (error) {
            // Better error message handling
            const errorMessage = error instanceof Error
                ? error.message
                : (typeof error === 'object' ? JSON.stringify(error) : String(error))

            logger.error('SupabaseProxyProvider', 'Failed to parse structured response', {
                error: errorMessage,
                responsePreview: response.text?.substring(0, 200)
            })

            throw createLLMError(
                LLMErrorType.PARSE_ERROR,
                `Failed to parse JSON response: ${errorMessage}`,
                { retryable: true }
            )
        }
    }

    isAvailable(): boolean {
        // Available if supabase client is configured
        return !!getSupabaseClient()
    }
}

// ============================================================================
// Factory
// ============================================================================

export function createSupabaseProxyProvider(config?: SupabaseProxyConfig): SupabaseProxyProvider {
    return new SupabaseProxyProvider(config)
}
