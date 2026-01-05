/**
 * LLM Service
 * Provider-agnostic orchestration layer for LLM operations.
 * 
 * Features:
 * - Provider management and switching
 * - Fallback to rule-based logic
 * - Quality logging
 * - Cost tracking (via provider)
 */

import {
    LLMProvider,
    LLMPrompt,
    LLMOptions,
    LLMResponse,
    LLMFallbackResult,
    LLMStructuredResponse,
    JSONSchema,
    TokenUsage,
} from './types'
import { LLMError, classifyError, USER_ERROR_MESSAGES } from './errors'
import { withRetry, RetryConfig } from './retry'
import { getPrompt, buildPrompt, getPromptVersion } from './prompt-registry'
import { logger } from '@/shared/services/logger.service'

// ============================================================================
// LLM Service Class
// ============================================================================

export class LLMService {
    private providers: Map<string, LLMProvider> = new Map()
    private defaultProvider: string = ''
    private qualityLogCallback?: (entry: QualityLogEntry) => Promise<void>

    // ============================================================================
    // Provider Management
    // ============================================================================

    /**
     * Register an LLM provider
     */
    registerProvider(provider: LLMProvider, isDefault: boolean = false): void {
        this.providers.set(provider.name, provider)
        if (isDefault || this.providers.size === 1) {
            this.defaultProvider = provider.name
        }
        logger.info('LLMService', `Registered provider: ${provider.name} (${provider.model})`)
    }

    /**
     * Get a registered provider
     */
    getProvider(name?: string): LLMProvider | undefined {
        return this.providers.get(name || this.defaultProvider)
    }

    /**
     * Set the default provider
     */
    setDefaultProvider(name: string): void {
        if (!this.providers.has(name)) {
            throw new Error(`Provider '${name}' not registered`)
        }
        this.defaultProvider = name
    }

    /**
     * Check if any provider is available
     */
    isAvailable(): boolean {
        return this.providers.size > 0
    }

    // ============================================================================
    // Core Operations
    // ============================================================================

    /**
     * Complete a prompt using the LLM
     */
    async complete(
        prompt: LLMPrompt,
        options?: LLMOptions & {
            retryConfig?: Partial<RetryConfig>
            /** Skip quality logging (used by registry methods to avoid double-logging) */
            skipQualityLog?: boolean
        }
    ): Promise<LLMResponse> {
        const provider = this.getProvider(options?.provider)
        if (!provider) {
            throw classifyError(new Error('No LLM provider available'), 'service')
        }

        const startTime = Date.now()

        try {
            const response = await withRetry(
                () => provider.complete(prompt, options),
                options?.retryConfig,
                {
                    onRetry: (attempt, error, delayMs) => {
                        logger.warn('LLMService', `Retry ${attempt} after ${error.type}, waiting ${delayMs}ms`)
                    },
                    signal: options?.signal,  // Propagate cancellation to retries
                }
            )

            // Log quality (skip if called from registry method)
            if (!options?.skipQualityLog) {
                await this.logQuality({
                    promptId: 'direct_complete',
                    promptVersion: '1.0.0',
                    latencyMs: Date.now() - startTime,
                    tokensUsed: response.usage.totalTokens,
                    success: true,
                })
            }

            return response
        } catch (error) {
            const llmError = error instanceof Error && 'type' in error
                ? error as LLMError
                : classifyError(error, provider.name)

            // Log failure (skip if called from registry method)
            if (!options?.skipQualityLog) {
                await this.logQuality({
                    promptId: 'direct_complete',
                    promptVersion: '1.0.0',
                    latencyMs: Date.now() - startTime,
                    tokensUsed: 0,
                    success: false,
                    errorType: llmError.type,
                })
            }

            throw llmError
        }
    }

    /**
     * Complete a prompt with structured output
     */
    async completeStructured<T>(
        prompt: LLMPrompt,
        schema: JSONSchema,
        options?: LLMOptions & { retryConfig?: Partial<RetryConfig> }
    ): Promise<LLMStructuredResponse<T>> {
        const provider = this.getProvider(options?.provider)
        if (!provider) {
            throw classifyError(new Error('No LLM provider available'), 'service')
        }

        const startTime = Date.now()

        try {
            const response = await withRetry(
                () => provider.completeStructured<T>(prompt, schema, options),
                options?.retryConfig,
            )

            await this.logQuality({
                promptId: 'direct_structured',
                promptVersion: '1.0.0',
                latencyMs: Date.now() - startTime,
                tokensUsed: response.usage.totalTokens,
                success: true,
            })

            return response
        } catch (error) {
            const llmError = classifyError(error, provider.name)

            await this.logQuality({
                promptId: 'direct_structured',
                promptVersion: '1.0.0',
                latencyMs: Date.now() - startTime,
                tokensUsed: 0,
                success: false,
                errorType: llmError.type,
            })

            throw llmError
        }
    }

    // ============================================================================
    // Registry-Based Operations
    // ============================================================================

    /**
     * Complete using a registered prompt
     */
    async completeFromRegistry(
        promptId: string,
        variables: Record<string, unknown>,
        options?: LLMOptions
    ): Promise<LLMResponse> {
        const definition = getPrompt(promptId)
        if (!definition) {
            throw new Error(`Prompt '${promptId}' not found in registry`)
        }

        const { system, user } = buildPrompt(definition, variables)
        const mergedOptions = { ...definition.defaultOptions, ...options }

        const startTime = Date.now()
        const provider = this.getProvider(options?.provider)

        try {
            const response = await this.complete(
                { system, user, context: variables },
                { ...mergedOptions, skipQualityLog: true }  // Skip internal log
            )

            await this.logQuality({
                promptId,
                promptVersion: definition.version,
                latencyMs: Date.now() - startTime,
                tokensUsed: response.usage.totalTokens,
                success: true,
            })

            return response
        } catch (error) {
            await this.logQuality({
                promptId,
                promptVersion: definition.version,
                latencyMs: Date.now() - startTime,
                tokensUsed: 0,
                success: false,
                errorType: (error as LLMError).type,
            })

            throw error
        }
    }

    /**
     * Complete structured output using a registered prompt
     */
    async completeStructuredFromRegistry<T>(
        promptId: string,
        variables: Record<string, unknown>,
        options?: LLMOptions
    ): Promise<LLMStructuredResponse<T>> {
        const definition = getPrompt(promptId)
        if (!definition) {
            throw new Error(`Prompt '${promptId}' not found in registry`)
        }
        if (!definition.outputSchema) {
            throw new Error(`Prompt '${promptId}' has no output schema`)
        }

        const { system, user } = buildPrompt(definition, variables)
        const mergedOptions = { ...definition.defaultOptions, ...options }

        return this.completeStructured<T>(
            { system, user, context: variables },
            definition.outputSchema,
            mergedOptions
        )
    }

    // ============================================================================
    // Fallback Operations
    // ============================================================================

    /**
     * Complete with fallback to a rule-based function if LLM fails
     */
    async completeWithFallback<T>(
        prompt: LLMPrompt,
        fallback: () => T,
        options?: LLMOptions & {
            retryConfig?: Partial<RetryConfig>
            logFallbackAsError?: boolean
        }
    ): Promise<LLMFallbackResult<T>> {
        try {
            const response = await this.complete(prompt, options)

            // Parse the response as T (assuming it's a valid format)
            // For complex parsing, use completeStructured instead
            return {
                result: response.text as unknown as T,
                source: 'llm',
                usage: response.usage,
            }
        } catch (error) {
            const llmError = error instanceof Error && 'type' in error
                ? error as LLMError
                : classifyError(error)

            if (options?.logFallbackAsError !== false) {
                logger.warn('LLMService', `Falling back due to: ${llmError.type}`)
            }

            return {
                result: fallback(),
                source: 'fallback',
                error: llmError,
            }
        }
    }

    /**
     * Complete from registry with fallback
     */
    async completeFromRegistryWithFallback<T>(
        promptId: string,
        variables: Record<string, unknown>,
        fallback: () => T,
        options?: LLMOptions
    ): Promise<LLMFallbackResult<T>> {
        const definition = getPrompt(promptId)
        if (!definition) {
            logger.warn('LLMService', `Prompt '${promptId}' not found, using fallback`)
            return { result: fallback(), source: 'fallback' }
        }

        const { system, user } = buildPrompt(definition, variables)
        return this.completeWithFallback<T>(
            { system, user, context: variables },
            fallback,
            { ...definition.defaultOptions, ...options }
        )
    }

    // ============================================================================
    // Quality Logging
    // ============================================================================

    /**
     * Set callback for quality logging (to database)
     */
    setQualityLogCallback(callback: (entry: QualityLogEntry) => Promise<void>): void {
        this.qualityLogCallback = callback
    }

    /**
     * Log quality metrics
     */
    private async logQuality(entry: QualityLogEntry): Promise<void> {
        if (this.qualityLogCallback) {
            try {
                await this.qualityLogCallback(entry)
            } catch (error) {
                logger.error('LLMService', 'Failed to log quality:', error)
            }
        }
    }

    // ============================================================================
    // Utility Methods
    // ============================================================================

    /**
     * Get user-friendly error message
     */
    getUserErrorMessage(error: LLMError): string {
        return USER_ERROR_MESSAGES[error.type] || USER_ERROR_MESSAGES.unknown
    }

    /**
     * Estimate token count for a string (rough approximation)
     * 
     * ⚠️ ACCURACY WARNING:
     * This uses a simple ~4 chars/token heuristic. Actual tokenization
     * varies by provider (Gemini vs Claude use different tokenizers).
     * 
     * Use for:
     * - Rough UI indicators (e.g., "~500 tokens")
     * - Context length warnings
     * 
     * Do NOT use for:
     * - Billing calculations (use actual usage from response)
     * - Strict context window management
     */
    estimateTokens(text: string): number {
        // Rough estimate: ~4 characters per token for English
        // GPT/Claude: closer to 3.5-4, Gemini: varies
        return Math.ceil(text.length / 4)
    }
}

// ============================================================================
// Types
// ============================================================================

export interface QualityLogEntry {
    promptId: string
    promptVersion: string
    latencyMs: number
    tokensUsed: number
    success: boolean
    errorType?: string
    userFeedback?: 'accepted' | 'rejected' | 'edited'
}

// ============================================================================
// Singleton Instance
// ============================================================================

export const llmService = new LLMService()

export default llmService
