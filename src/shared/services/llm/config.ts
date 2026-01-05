/**
 * LLM Configuration Store
 * Manages provider selection and API keys for easy switching between models.
 * 
 * Features:
 * - Runtime provider switching
 * - Persistent preferences (AsyncStorage for settings, SecureStore for API keys)
 * - Dev mode provider selector
 * 
 * Security:
 * - API keys are stored in expo-secure-store (device secure enclave)
 * - Non-sensitive config (provider, model selection) uses AsyncStorage
 */

import * as SecureStore from 'expo-secure-store'
import { llmService } from './llm-service'
import { createGeminiFlashProvider, GeminiModel, GEMINI_MODELS } from './providers/gemini-flash'
import { createClaudeProvider, ClaudeModel, CLAUDE_MODELS } from './providers/claude'
import { createSupabaseProxyProvider } from './providers/supabase-proxy'
import { logger } from '@/shared/services/logger.service'

// ============================================================================
// Types
// ============================================================================

export type ProviderType = 'gemini' | 'claude' | 'supabase-proxy'

export interface LLMConfig {
    /** Active provider */
    provider: ProviderType
    /** Gemini model to use */
    geminiModel: GeminiModel
    /** Claude model to use */
    claudeModel: ClaudeModel
    /** Gemini API key (loaded from secure storage) */
    geminiApiKey?: string
    /** Claude API key (loaded from secure storage) */
    claudeApiKey?: string
}

export interface ProviderInfo {
    name: string
    provider: ProviderType
    model: string
    displayName: string
    description: string
}

// ============================================================================
// Available Providers
// ============================================================================

export const AVAILABLE_PROVIDERS: ProviderInfo[] = [
    // Gemini models
    {
        name: 'gemini',
        provider: 'gemini',
        model: 'gemini-3.0-flash',
        displayName: 'Gemini 3.0 Flash',
        description: 'Latest, fastest Google model',
    },
    {
        name: 'gemini',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        displayName: 'Gemini 2.0 Flash',
        description: 'Previous generation, stable',
    },
    // Claude models
    {
        name: 'claude',
        provider: 'claude',
        model: 'claude-3.5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        description: 'Fast and affordable Anthropic model',
    },
    {
        name: 'claude',
        provider: 'claude',
        model: 'claude-3.5-sonnet-20241022',
        displayName: 'Claude 3.5 Sonnet',
        description: 'Balanced capability and speed',
    },
]

// ============================================================================
// Storage Keys
// ============================================================================

/** AsyncStorage key for non-sensitive config */
const CONFIG_STORAGE_KEY = '@weave/llm_config'

/** SecureStore keys for API keys (stored in secure enclave) */
const SECURE_KEY_GEMINI = 'weave_llm_gemini_api_key'
const SECURE_KEY_CLAUDE = 'weave_llm_claude_api_key'

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: LLMConfig = {
    // Default to supabase-proxy which routes through Edge Function (no client-side API key needed)
    provider: 'supabase-proxy',
    geminiModel: 'gemini-2.0-flash',
    claudeModel: 'claude-3.5-haiku-20241022',
}

// ============================================================================
// LLM Config Manager
// ============================================================================

class LLMConfigManager {
    private config: LLMConfig = DEFAULT_CONFIG
    private initPromise: Promise<void> | null = null

    /**
     * Initialize the config manager and register providers.
     * Uses promise-based guard to prevent race conditions.
     */
    async initialize(): Promise<void> {
        // Return existing promise if already initializing
        if (this.initPromise) return this.initPromise

        this.initPromise = this.doInitialize()
        return this.initPromise
    }

    /**
     * Internal initialization logic
     */
    private async doInitialize(): Promise<void> {
        // Load saved config (non-sensitive settings) from SecureStore
        try {
            const saved = await SecureStore.getItemAsync(CONFIG_STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved)
                this.config = { ...DEFAULT_CONFIG, ...parsed }
            }
        } catch (error) {
            logger.warn('LLMConfigManager', 'Failed to load saved config:', error)
        }

        // Load API keys from secure storage
        try {
            const [geminiKey, claudeKey] = await Promise.all([
                SecureStore.getItemAsync(SECURE_KEY_GEMINI),
                SecureStore.getItemAsync(SECURE_KEY_CLAUDE),
            ])

            if (geminiKey) {
                this.config.geminiApiKey = geminiKey
            }
            if (claudeKey) {
                this.config.claudeApiKey = claudeKey
            }
        } catch (error) {
            logger.warn('LLMConfigManager', 'Failed to load API keys from SecureStore:', error)
        }

        // Register providers
        await this.registerProviders()

        logger.info('LLMConfigManager', `Initialized with provider: ${this.config.provider}`)
    }

    /**
     * Check if initialized
     */
    get isInitialized(): boolean {
        return this.initPromise !== null
    }

    /**
     * Register all configured providers
     */
    private async registerProviders(): Promise<void> {
        // Always register Supabase Proxy (no API key needed client-side)
        llmService.registerProvider(
            createSupabaseProxyProvider({
                model: this.config.geminiModel,
            }),
            this.config.provider === 'supabase-proxy'
        )

        // Register Gemini if we have a key (for users who want direct access)
        if (this.config.geminiApiKey) {
            llmService.registerProvider(
                createGeminiFlashProvider({
                    apiKey: this.config.geminiApiKey,
                    model: this.config.geminiModel,
                }),
                this.config.provider === 'gemini'
            )
        }

        // Register Claude if we have a key
        if (this.config.claudeApiKey) {
            llmService.registerProvider(
                createClaudeProvider({
                    apiKey: this.config.claudeApiKey,
                    model: this.config.claudeModel,
                }),
                this.config.provider === 'claude'
            )
        }
    }

    /**
     * Get current configuration
     */
    getConfig(): LLMConfig {
        return { ...this.config }
    }

    /**
     * Get current active provider info
     */
    getCurrentProvider(): ProviderInfo | undefined {
        const model = this.config.provider === 'gemini'
            ? this.config.geminiModel
            : this.config.claudeModel

        return AVAILABLE_PROVIDERS.find(
            p => p.provider === this.config.provider && p.model === model
        )
    }

    /**
     * Switch to a different provider/model
     */
    async switchProvider(provider: ProviderType, model?: string): Promise<void> {
        this.config.provider = provider

        if (model) {
            if (provider === 'gemini' && model in GEMINI_MODELS) {
                this.config.geminiModel = model as GeminiModel
            } else if (provider === 'claude' && model in CLAUDE_MODELS) {
                this.config.claudeModel = model as ClaudeModel
            }
        }

        // Re-register providers with new config
        await this.registerProviders()

        // Set default provider
        llmService.setDefaultProvider(provider)

        // Save config (non-sensitive only)
        await this.saveConfig()

        logger.info('LLMConfigManager', `Switched to ${provider} (${model || 'default model'})`)
    }

    /**
     * Set API key for a provider (stored securely)
     */
    async setApiKey(provider: ProviderType, apiKey: string): Promise<void> {
        // Store in secure enclave
        const secureKey = provider === 'gemini' ? SECURE_KEY_GEMINI : SECURE_KEY_CLAUDE

        try {
            await SecureStore.setItemAsync(secureKey, apiKey)
        } catch (error) {
            logger.error('LLMConfigManager', `Failed to save API key to SecureStore:`, error)
            throw new Error('Failed to securely store API key')
        }

        // Update in-memory config
        if (provider === 'gemini') {
            this.config.geminiApiKey = apiKey
        } else {
            this.config.claudeApiKey = apiKey
        }

        // Re-register providers
        await this.registerProviders()

        logger.info('LLMConfigManager', `Securely stored API key for ${provider}`)
    }

    /**
     * Clear API key for a provider
     */
    async clearApiKey(provider: ProviderType): Promise<void> {
        const secureKey = provider === 'gemini' ? SECURE_KEY_GEMINI : SECURE_KEY_CLAUDE

        try {
            await SecureStore.deleteItemAsync(secureKey)
        } catch (error) {
            logger.warn('LLMConfigManager', `Failed to delete API key from SecureStore:`, error)
        }

        // Update in-memory config
        if (provider === 'gemini') {
            this.config.geminiApiKey = undefined
        } else {
            this.config.claudeApiKey = undefined
        }

        // Re-register providers
        await this.registerProviders()

        logger.info('LLMConfigManager', `Cleared API key for ${provider}`)
    }

    /**
     * Check if a provider is available (has API key)
     */
    isProviderAvailable(provider: ProviderType): boolean {
        if (provider === 'gemini') {
            return !!this.config.geminiApiKey
        }
        return !!this.config.claudeApiKey
    }

    /**
     * Get list of available providers with availability status
     */
    getAvailableProvidersWithStatus(): (ProviderInfo & { available: boolean })[] {
        return AVAILABLE_PROVIDERS.map(p => ({
            ...p,
            available: this.isProviderAvailable(p.provider),
        }))
    }

    /**
     * Save config to persistent storage (non-sensitive settings only)
     */
    private async saveConfig(): Promise<void> {
        try {
            // Only save non-sensitive config to SecureStore (safer than AsyncStorage)
            const { geminiApiKey, claudeApiKey, ...safeConfig } = this.config
            await SecureStore.setItemAsync(CONFIG_STORAGE_KEY, JSON.stringify(safeConfig))
        } catch (error) {
            logger.error('LLMConfigManager', 'Failed to save config:', error)
        }
    }

    /**
     * Reset to default configuration and clear all API keys
     */
    async reset(): Promise<void> {
        // Clear API keys from secure storage
        try {
            await Promise.all([
                SecureStore.deleteItemAsync(SECURE_KEY_GEMINI),
                SecureStore.deleteItemAsync(SECURE_KEY_CLAUDE),
            ])
        } catch (error) {
            logger.warn('LLMConfigManager', 'Failed to clear API keys from SecureStore:', error)
        }

        // Reset in-memory config
        this.config = { ...DEFAULT_CONFIG }

        // Clear SecureStore config
        await SecureStore.deleteItemAsync(CONFIG_STORAGE_KEY)

        logger.info('LLMConfigManager', 'Reset to default config and cleared all API keys')
    }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const llmConfigManager = new LLMConfigManager()

export default llmConfigManager
