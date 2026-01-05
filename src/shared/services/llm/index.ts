/**
 * LLM Service Module
 * Provider-agnostic LLM abstraction layer for Weave's AI features.
 * 
 * Usage:
 * ```typescript
 * import { llmService, createGeminiFlashProvider } from '@/shared/services/llm'
 * 
 * // Initialize with provider
 * llmService.registerProvider(
 *   createGeminiFlashProvider({ apiKey: 'YOUR_KEY' }),
 *   true // set as default
 * )
 * 
 * // Use from registry (recommended)
 * const result = await llmService.completeFromRegistryWithFallback(
 *   'journal_prompt',
 *   { friendName: 'Sarah', ... },
 *   () => 'Fallback prompt text'
 * )
 * 
 * // Direct usage
 * const response = await llmService.complete({
 *   system: 'You are a helpful assistant',
 *   user: 'Hello!'
 * })
 * ```
 */

// Core types
export * from './types'

// Error handling
export * from './errors'

// Retry logic
export * from './retry'

// JSON extraction utilities
export { extractJson, safeParseJson, validateJsonFields } from './json-utils'

// Prompt registry
export * from './prompt-registry'

// Main service
export { LLMService, llmService, type QualityLogEntry } from './llm-service'

// Configuration
export {
    llmConfigManager,
    AVAILABLE_PROVIDERS,
    type LLMConfig,
    type ProviderInfo,
    type ProviderType,
} from './config'

// Providers
export {
    GeminiFlashProvider,
    createGeminiFlashProvider,
    GEMINI_MODELS,
    type GeminiConfig,
    type GeminiModel,
} from './providers/gemini-flash'

export {
    ClaudeProvider,
    createClaudeProvider,
    CLAUDE_MODELS,
    type ClaudeConfig,
    type ClaudeModel,
} from './providers/claude'

export {
    SupabaseProxyProvider,
    createSupabaseProxyProvider,
    type SupabaseProxyConfig,
} from './providers/supabase-proxy'
