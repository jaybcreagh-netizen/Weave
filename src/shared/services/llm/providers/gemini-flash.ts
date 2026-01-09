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
    LLMStreamChunk,
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
    'gemini-3-flash-preview': 'gemini-3-flash-preview', // Preview version
    'gemini-2.0-flash': 'gemini-2.0-flash',  // Previous generation
    'gemini-pro': 'gemini-pro',              // More capable, slower
} as const

export type GeminiModel = keyof typeof GEMINI_MODELS

const DEFAULT_MODEL: GeminiModel = 'gemini-3-flash-preview'
const DEFAULT_TIMEOUT_MS = 30000
const DEFAULT_MAX_TOKENS = 8192
const DEFAULT_TEMPERATURE = 1

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

    async *completeStream(
        prompt: LLMPrompt,
        options?: LLMOptions
    ): AsyncGenerator<LLMStreamChunk, void, unknown> {
        // Implement streaming via REST API using "streamGenerateContent" endpoint
        const url = `${this.baseUrl}/models/${this.model}:streamGenerateContent?alt=sse`

        // Build request body (same as complete usually)
        const requestBody = this.buildRequestBody(prompt, options)

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': this.apiKey,
                },
                body: JSON.stringify(requestBody),
                signal: options?.signal,
            })

            if (!response.ok) {
                const errorBody = await response.text()
                throw this.handleAPIError(response.status, errorBody)
            }

            if (!response.body) {
                throw createLLMError(LLMErrorType.INVALID_REQUEST, 'No response body for stream')
            }

            // Simple SSE parser logic
            // Note: In a real RN environment, streaming fetch support varies.
            // We assume standard Fetch API with potential polyfills or React Native's support.

            // NOTE: React Native's fetch doesn't support streaming body reads neatly out of the box
            // without additional libraries (like react-native-fetch-api or similar polyfills),
            // OR using XMLHttpRequest. However, modern RN + Expo often has better support.
            // If standard body reading fails, we might need a specific RN streaming approach.
            // For now, assuming environment supports text decoding of chunks.

            // Use a reader if available (web standard)
            // @ts-ignore - RN types might be missing strict stream types
            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ''
            let fullText = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                buffer += chunk

                // Parse SSE events: "data: {...}"
                const lines = buffer.split('\n')
                buffer = lines.pop() || '' // Keep last partial line

                for (const line of lines) {
                    const trimmed = line.trim()
                    if (!trimmed.startsWith('data: ')) continue

                    const dataStr = trimmed.slice(6)
                    if (dataStr === '[DONE]') continue // OpenAI style, Gemini usually just ends

                    try {
                        const data: GeminiRawResponse = JSON.parse(dataStr)
                        const candidate = data.candidates?.[0]
                        const newText = candidate?.content?.parts?.[0]?.text || ''

                        if (newText) {
                            fullText += newText
                            yield {
                                text: newText,
                                fullText,
                                isDone: false
                            }
                        }

                        if (candidate?.finishReason) {
                            // Finish event
                            yield {
                                text: '',
                                fullText,
                                isDone: true,
                                metadata: {
                                    model: this.model,
                                    latencyMs: 0, // Hard to track exact latency in stream
                                    finishReason: this.mapFinishReason(candidate.finishReason),
                                    provider: this.name
                                },
                                usage: {
                                    promptTokens: data.usageMetadata?.promptTokenCount || 0,
                                    completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
                                    totalTokens: data.usageMetadata?.totalTokenCount || 0,
                                }
                            }
                        }
                    } catch (e) {
                        // Skip malformed JSON lines
                    }
                }
            }
        } catch (error) {
            throw classifyError(error, this.name)
        }
    }

    // ============================================================================
    // API Communication
    // ============================================================================

    private buildRequestBody(prompt: LLMPrompt, options?: LLMOptions): GeminiRequestBody {
        const requestBody: GeminiRequestBody = {
            contents: this.buildContents(prompt),
            generationConfig: {
                maxOutputTokens: options?.maxTokens || DEFAULT_MAX_TOKENS,
                temperature: options?.temperature || DEFAULT_TEMPERATURE,
                ...(options?.topP !== undefined && { topP: options.topP }),
                ...(options?.topK !== undefined && { topK: options.topK }),
                ...(options?.thinkingConfig && { thinkingConfig: options.thinkingConfig }),
            },
            // Default to permissive safety settings if not overridden
            safetySettings: options?.safetySettings || [
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
            ],
        }

        // Add system instruction if provided
        if (prompt.system) {
            requestBody.systemInstruction = {
                parts: [{ text: prompt.system }],
            }
        }

        // NOTE: We intentionally do NOT set responseMimeType to 'application/json' here
        // even when jsonMode is true. Gemini 3 Flash requires an explicit responseSchema
        // when using JSON mode - without it, the model returns malformed JSON (e.g., just "{").
        // For structured JSON output, use completeStructured() which provides a schema.

        return requestBody
    }

    private async callGeminiAPI(
        prompt: LLMPrompt,
        options?: LLMOptions,
        schema?: JSONSchema
    ): Promise<GeminiAPIResponse> {
        // Security: Use header-based auth instead of URL query param
        // This prevents API key from appearing in logs, error messages, etc.
        const url = `${this.baseUrl}/models/${this.model}:generateContent`

        // Build request body
        const requestBody = this.buildRequestBody(prompt, options)

        // Add response schema for structured output specific logic
        if (schema) {
            requestBody.generationConfig.responseMimeType = 'application/json'
            requestBody.generationConfig.responseSchema = this.convertSchema(schema)
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
        // Gemini 3 Flash expects a specific Schema object format
        // We use explicit strict schema format for the API
        const converted: any = {
            type: schema.type.toUpperCase(),
            description: schema.description,
        }

        if (schema.type === 'object' && schema.properties) {
            converted.properties = Object.entries(schema.properties).reduce((acc, [key, value]) => {
                acc[key] = this.convertSchema(value as JSONSchema)
                return acc
            }, {} as any)
            if (schema.required) {
                converted.required = schema.required
            }
        }

        if (schema.type === 'array' && schema.items) {
            converted.items = this.convertSchema(schema.items as JSONSchema)
        }

        if (schema.enum) {
            converted.enum = schema.enum
        }

        return converted
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
        thinkingConfig?: {
            includeThoughts?: boolean
        }
    }
    safetySettings?: Array<{
        category: string
        threshold: string
    }>
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
