/**
 * Gemini Flash Provider
 * Implementation of LLMProvider for Google's Gemini models.
 * 
 * Supports: gemini-2.0-flash, gemini-3.0-flash, gemini-pro, etc.
 * Uses the REST API directly for maximum control.
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

// Available Gemini models
export const GEMINI_MODELS = {
    'gemini-3.0-flash': 'gemini-3.0-flash',  // Latest, fastest
    'gemini-2.0-flash': 'gemini-2.0-flash',  // Previous generation
    'gemini-pro': 'gemini-pro',              // More capable, slower
} as const

export type GeminiModel = keyof typeof GEMINI_MODELS

const DEFAULT_MODEL: GeminiModel = 'gemini-3.0-flash'
const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_MAX_TOKENS = 1024
const DEFAULT_TEMPERATURE = 0.7

// ============================================================================
// Provider Implementation
// ============================================================================

export class GeminiFlashProvider implements LLMProvider {
    name = 'gemini'
    model: string = DEFAULT_MODEL

    private apiKey: string
    private baseUrl: string

    constructor(config: GeminiConfig) {
        this.apiKey = config.apiKey
        this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta'

        if (config.model) {
            this.model = config.model
        }
    }

    // ============================================================================
    // Core Methods
    // ============================================================================

    async complete(prompt: LLMPrompt, options?: LLMOptions): Promise<LLMResponse> {
        const startTime = Date.now()
        const timeoutMs = options?.timeoutMs || DEFAULT_TIMEOUT_MS

        try {
            const response = await withTimeout(
                this.callGeminiAPI(prompt, options),
                timeoutMs,
                'Gemini request timed out'
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
                system: `${prompt.system}\n\nRespond ONLY with valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}`,
            }

            const response = await withTimeout(
                this.callGeminiAPI(enhancedPrompt, options, schema),
                timeoutMs,
                'Gemini request timed out'
            )

            // Parse JSON response using robust extraction
            let data: T
            try {
                data = safeParseJson<T>(response.text, 'Gemini structured response')
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

    private async callGeminiAPI(
        prompt: LLMPrompt,
        options?: LLMOptions,
        schema?: JSONSchema
    ): Promise<GeminiAPIResponse> {
        // Security: Use header-based auth instead of URL query param
        // This prevents API key from appearing in logs, error messages, etc.
        const url = `${this.baseUrl}/models/${this.model}:generateContent`

        // Build request body
        const requestBody: GeminiRequestBody = {
            contents: this.buildContents(prompt),
            generationConfig: {
                maxOutputTokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
                temperature: options?.temperature || DEFAULT_TEMPERATURE,
                ...(options?.topP !== undefined && { topP: options.topP }),
                ...(options?.topK !== undefined && { topK: options.topK }),
            },
        }

        // Add system instruction if provided
        if (prompt.system) {
            requestBody.systemInstruction = {
                parts: [{ text: prompt.system }],
            }
        }

        // Add response schema for structured output
        if (schema) {
            requestBody.generationConfig.responseMimeType = 'application/json'
            requestBody.generationConfig.responseSchema = this.convertSchema(schema)
        } else if (options?.jsonMode) {
            requestBody.generationConfig.responseMimeType = 'application/json'
        }

        logger.debug('GeminiFlashProvider', 'Sending request', {
            model: this.model,
            contentLength: prompt.user.length,
        })

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': this.apiKey,  // Header-based auth
            },
            body: JSON.stringify(requestBody),
            signal: options?.signal,
        })

        if (!response.ok) {
            const errorBody = await response.text()
            throw this.handleAPIError(response.status, errorBody)
        }

        const data: GeminiRawResponse = await response.json()

        // Extract response content
        const candidate = data.candidates?.[0]
        if (!candidate?.content?.parts?.[0]?.text) {
            throw createLLMError(
                LLMErrorType.INVALID_REQUEST,
                'Empty response from Gemini'
            )
        }

        // Check finish reason
        const finishReason = this.mapFinishReason(candidate.finishReason)
        if (finishReason === 'content_filter') {
            throw createLLMError(
                LLMErrorType.CONTENT_FILTERED,
                'Response was filtered by safety settings'
            )
        }

        // Extract usage
        const usage: TokenUsage = {
            promptTokens: data.usageMetadata?.promptTokenCount || 0,
            completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata?.totalTokenCount || 0,
        }

        return {
            text: candidate.content.parts[0].text,
            usage,
            finishReason,
        }
    }

    // ============================================================================
    // Helpers
    // ============================================================================

    private buildContents(prompt: LLMPrompt): GeminiContent[] {
        const contents: GeminiContent[] = []

        // Add conversation history if present
        if (prompt.history) {
            for (const turn of prompt.history) {
                contents.push({
                    role: turn.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: turn.content }],
                })
            }
        }

        // Add current user message
        contents.push({
            role: 'user',
            parts: [{ text: prompt.user }],
        })

        return contents
    }

    private convertSchema(schema: JSONSchema): object {
        // Gemini uses a slightly different schema format
        // This is a simplified conversion - expand as needed
        return {
            type: schema.type.toUpperCase(),
            properties: schema.properties,
            required: schema.required,
        }
    }

    private mapFinishReason(reason?: string): ResponseMetadata['finishReason'] {
        switch (reason) {
            case 'STOP':
                return 'stop'
            case 'MAX_TOKENS':
                return 'length'
            case 'SAFETY':
            case 'RECITATION':
                return 'content_filter'
            default:
                return 'stop'
        }
    }

    private handleAPIError(status: number, body: string): Error {
        try {
            const parsed = JSON.parse(body)
            const message = parsed.error?.message || body

            return createLLMError(
                this.statusToErrorType(status),
                message,
                { statusCode: status }
            )
        } catch {
            return createLLMError(
                this.statusToErrorType(status),
                body,
                { statusCode: status }
            )
        }
    }

    private statusToErrorType(status: number): LLMErrorType {
        switch (status) {
            case 400:
                return LLMErrorType.INVALID_REQUEST
            case 401:
            case 403:
                return LLMErrorType.AUTH_FAILED
            case 429:
                return LLMErrorType.RATE_LIMITED
            case 500:
            case 502:
            case 503:
                return LLMErrorType.SERVER_ERROR
            default:
                return LLMErrorType.UNKNOWN
        }
    }
}

// ============================================================================
// Types
// ============================================================================

export interface GeminiConfig {
    apiKey: string
    baseUrl?: string
    model?: string
}

interface GeminiRequestBody {
    contents: GeminiContent[]
    systemInstruction?: { parts: { text: string }[] }
    generationConfig: {
        maxOutputTokens: number
        temperature: number
        responseMimeType?: string
        responseSchema?: object
    }
}

interface GeminiContent {
    role: 'user' | 'model'
    parts: { text: string }[]
}

interface GeminiRawResponse {
    candidates?: {
        content?: {
            parts?: { text: string }[]
        }
        finishReason?: string
    }[]
    usageMetadata?: {
        promptTokenCount?: number
        candidatesTokenCount?: number
        totalTokenCount?: number
    }
}

interface GeminiAPIResponse {
    text: string
    usage: TokenUsage
    finishReason: ResponseMetadata['finishReason']
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a Gemini Flash provider instance
 */
export function createGeminiFlashProvider(config: GeminiConfig): GeminiFlashProvider {
    return new GeminiFlashProvider(config)
}
