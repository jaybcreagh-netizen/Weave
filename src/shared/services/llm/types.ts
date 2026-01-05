/**
 * LLM Service Types
 * Core interfaces for the provider-agnostic LLM abstraction layer.
 * 
 * This establishes contracts for:
 * - LLM providers (Gemini, Claude, etc.)
 * - Prompt structure and options
 * - Response handling
 */

// ============================================================================
// Provider Interface
// ============================================================================

/**
 * Contract for LLM providers
 * Implementations: GeminiFlashProvider, (future: ClaudeProvider, OpenAIProvider)
 */
export interface LLMProvider {
    /** Provider name for logging/switching */
    name: string

    /** Model identifier */
    model: string

    /**
     * Generate a text completion
     * @returns LLMResponse with text and metadata
     */
    complete(prompt: LLMPrompt, options?: LLMOptions): Promise<LLMResponse>

    /**
     * Generate structured output matching a JSON schema
     * @returns Parsed object matching the schema
     */
    completeStructured<T>(
        prompt: LLMPrompt,
        schema: JSONSchema,
        options?: LLMOptions
    ): Promise<LLMStructuredResponse<T>>
}

// ============================================================================
// Prompt Types
// ============================================================================

/**
 * Complete prompt structure sent to the LLM
 */
export interface LLMPrompt {
    /** System prompt defining the LLM's role and behavior */
    system: string

    /** User message/question */
    user: string

    /** Optional conversation history for multi-turn */
    history?: ConversationTurn[]

    /** Structured context data (will be serialized) */
    context?: Record<string, unknown>
}

/**
 * Single turn in a conversation
 */
export interface ConversationTurn {
    role: 'user' | 'assistant'
    content: string
}

/**
 * Request options
 */
export interface LLMOptions {
    /** Max tokens to generate */
    maxTokens?: number

    /** Temperature (0-2, lower = more deterministic) */
    temperature?: number

    /**
     * Nucleus sampling (0-1)
     * Controls diversity by limiting to tokens comprising top P probability mass.
     * Use for creative prompts like journal_prompt.
     * Note: Interpretation varies slightly between providers.
     */
    topP?: number

    /**
     * Top-K sampling (1-100+)
     * Limits sampling to K most likely tokens.
     * Gemini-specific but Claude ignores gracefully.
     */
    topK?: number

    /**
     * Frequency penalty (-2 to 2)
     * Reduces repetition. Claude-specific, Gemini ignores.
     */
    presencePenalty?: number

    /**
     * Frequency penalty (-2 to 2)
     * Reduces repetition. Claude-specific, Gemini ignores.
     */
    frequencyPenalty?: number

    /**
     * Force JSON output mode
     * Useful for structured extraction tasks
     */
    jsonMode?: boolean

    /** Request timeout in ms */
    timeoutMs?: number

    /** Optional: specific provider to use */
    provider?: string

    /** Optional: signal for cancellation */
    signal?: AbortSignal
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Standard text response from LLM
 */
export interface LLMResponse {
    /** Generated text */
    text: string

    /** Token usage for cost tracking */
    usage: TokenUsage

    /** Response metadata */
    metadata: ResponseMetadata
}

/**
 * Structured response with parsed object
 */
export interface LLMStructuredResponse<T> extends LLMResponse {
    /** Parsed structured data */
    data: T
}

/**
 * Token usage breakdown
 */
export interface TokenUsage {
    promptTokens: number
    completionTokens: number
    totalTokens: number
}

/**
 * Response metadata for logging/debugging
 */
export interface ResponseMetadata {
    /** Model used for generation */
    model: string

    /** Latency in ms */
    latencyMs: number

    /** Finish reason */
    finishReason: 'stop' | 'length' | 'content_filter' | 'error'

    /** Provider name */
    provider: string
}

// ============================================================================
// JSON Schema Types (for structured output)
// ============================================================================

/**
 * JSON Schema definition for structured output
 * Uses a subset of JSON Schema spec that Gemini supports
 */
export interface JSONSchema {
    type: 'object' | 'array' | 'string' | 'number' | 'boolean'
    properties?: Record<string, JSONSchemaProperty>
    items?: JSONSchemaProperty
    required?: string[]
    description?: string
}

export interface JSONSchemaProperty {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    description?: string
    enum?: string[]
    items?: JSONSchemaProperty
    properties?: Record<string, JSONSchemaProperty>
    required?: string[]
}

// ============================================================================
// Service Types
// ============================================================================

/**
 * Result of an LLM call with fallback
 */
export interface LLMFallbackResult<T> {
    /** The result (from LLM or fallback) */
    result: T

    /** Source of the result */
    source: 'llm' | 'fallback'

    /** If from LLM, token usage */
    usage?: TokenUsage

    /** Error if LLM failed (and we fell back) */
    error?: Error
}

/**
 * Prompt registry entry
 */
export interface PromptDefinition {
    /** Unique identifier */
    id: string

    /** Version for tracking iterations */
    version: string

    /** System prompt */
    systemPrompt: string

    /** User prompt template (use {{variable}} for interpolation) */
    userPromptTemplate: string

    /** Default options for this prompt */
    defaultOptions?: LLMOptions

    /** Description for documentation */
    description?: string

    /** Expected output schema (for structured prompts) */
    outputSchema?: JSONSchema
}
