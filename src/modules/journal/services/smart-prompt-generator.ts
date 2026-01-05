/**
 * Smart Prompt Generator
 * 
 * Generates journal prompts using LLM when available, with automatic
 * fallback to rule-based prompts when:
 * - AI features are disabled
 * - LLM request fails or times out
 * - User is offline
 * 
 * This preserves the excellent rule-based prompts in journal-prompts.ts
 * while adding LLM-powered personalization when possible.
 */

import { llmService } from '@/shared/services/llm'
import { getPrompt, interpolatePrompt } from '@/shared/services/llm/prompt-registry'
import { logger } from '@/shared/services/logger.service'
import {
    MeaningfulWeave,
    FriendJournalContext
} from './journal-context-engine'
import {
    JournalPrompt,
    PromptContext,
    generateJournalPrompts,
    getBestPrompt
} from './journal-prompts'
import { buildPromptContextPayload, PromptContextPayload } from './prompt-context-builder'

// ============================================================================
// Types
// ============================================================================

export interface SmartPromptResult {
    /** The generated prompt */
    prompt: JournalPrompt
    /** Whether this came from LLM or rule-based fallback */
    source: 'llm' | 'fallback'
    /** Time taken to generate (only for LLM) */
    generationTimeMs?: number
    /** Context payload used (for debugging) */
    contextPayload?: PromptContextPayload
}

export interface SmartPromptOptions {
    /** Timeout in ms for LLM request (default: 5000) */
    timeoutMs?: number
    /** Skip LLM entirely and use fallback (for testing or user preference) */
    skipLLM?: boolean
    /** AbortSignal for cancellation */
    signal?: AbortSignal
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_TIMEOUT_MS = 5000
const PROMPT_ID = 'journal_prompt'

// ============================================================================
// Main Function
// ============================================================================

/**
 * Generate a smart journal prompt.
 * 
 * Attempts LLM generation first, falls back to rule-based prompts on failure.
 * Rule-based prompts are used when AI is disabled or unavailable.
 * 
 * @param context - The journal context (weave, friend, or general)
 * @param aiEnabled - Whether AI features are enabled in user settings
 * @param options - Optional configuration
 */
export async function generateSmartPrompt(
    context: PromptContext,
    aiEnabled: boolean = true,
    options: SmartPromptOptions = {}
): Promise<SmartPromptResult> {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, skipLLM = false, signal } = options

    // If AI disabled or explicitly skipped, use fallback immediately
    if (!aiEnabled || skipLLM) {
        return useFallback(context, 'ai_disabled')
    }

    // Check if LLM service is ready
    if (!llmService.isAvailable()) {
        return useFallback(context, 'llm_not_ready')
    }

    // Build context for the LLM
    const contextPayload = buildPromptContextPayload(context)
    const startTime = Date.now()

    try {
        // Get the prompt definition
        const promptDef = getPrompt(PROMPT_ID)
        if (!promptDef) {
            logger.warn('SmartPromptGenerator', `Prompt ${PROMPT_ID} not found in registry`)
            return useFallback(context, 'prompt_not_found')
        }

        // Build the user prompt from template
        const userPrompt = interpolatePrompt(
            promptDef.userPromptTemplate,
            contextPayload as unknown as Record<string, unknown>
        )

        // Call LLM with timeout
        const response = await llmService.complete(
            {
                system: promptDef.systemPrompt,
                user: userPrompt,
            },
            {
                maxTokens: promptDef.defaultOptions?.maxTokens || 80,
                temperature: promptDef.defaultOptions?.temperature || 0.8,
                timeoutMs,
                signal,
            }
        )

        // Check if cancelled during LLM call
        if (signal?.aborted) {
            throw new Error('Request cancelled')
        }

        const generationTimeMs = Date.now() - startTime

        // Parse the response into a JournalPrompt
        const promptText = response.text.trim()

        // Validate the prompt isn't empty or too long
        if (!promptText || promptText.length < 10) {
            logger.warn('SmartPromptGenerator', 'LLM returned empty or too short prompt')
            return useFallback(context, 'invalid_response')
        }

        // Check for common LLM failure patterns
        const invalidPatterns = [
            /^["'].*["']$/, // Wrapped in quotes (we asked it not to)
            /^(here|sure|okay|of course)/i, // Preamble
            /^prompt:/i, // Meta-labeling
            /\n/, // Multi-line (should be single sentence)
        ]
        if (invalidPatterns.some(p => p.test(promptText))) {
            logger.warn('SmartPromptGenerator', 'LLM response has invalid format')
            return useFallback(context, 'invalid_format')
        }

        if (promptText.length > 150) {
            logger.warn('SmartPromptGenerator', 'LLM returned too long prompt, truncating')
        }

        // Build the JournalPrompt object
        const llmPrompt: JournalPrompt = {
            id: `llm_${context.type}_${Date.now()}`,
            question: promptText.slice(0, 150), // Enforce max length
            context: buildContextDescription(context),
            type: context.type === 'weave' ? 'weave'
                : context.type === 'friend' ? 'friend'
                    : 'general',
            relatedWeaveId: context.type === 'weave' ? context.weave.interaction.id : undefined,
            relatedFriendId: context.type === 'weave'
                ? context.weave.friends[0]?.id
                : context.type === 'friend'
                    ? context.friendContext.friend.id
                    : undefined,
            relatedFriendName: context.type === 'weave'
                ? context.weave.friends[0]?.name
                : context.type === 'friend'
                    ? context.friendContext.friend.name
                    : undefined,
        }

        logger.info('SmartPromptGenerator', `LLM prompt generated in ${generationTimeMs}ms`)

        return {
            prompt: llmPrompt,
            source: 'llm',
            generationTimeMs,
            contextPayload,
        }

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        logger.warn('SmartPromptGenerator', `LLM failed: ${errorMessage}, using fallback`)
        return useFallback(context, 'llm_error')
    }
}

// ============================================================================
// Fallback Logic
// ============================================================================

/**
 * Use rule-based prompt generation as fallback
 */
function useFallback(
    context: PromptContext,
    reason: string
): SmartPromptResult {
    logger.debug('SmartPromptGenerator', `Using fallback: ${reason}`)

    // Use the existing rule-based prompt generator
    const prompt = getBestPrompt(context)

    return {
        prompt,
        source: 'fallback',
    }
}

/**
 * Build a human-readable context description for the prompt
 */
function buildContextDescription(context: PromptContext): string {
    switch (context.type) {
        case 'weave': {
            const friendNames = context.weave.friends.map((f: FriendJournalContext['friend']) => f.name).join(' and ')
            return `After your recent time with ${friendNames}`
        }
        case 'friend': {
            return `Reflecting on your friendship with ${context.friendContext.friend.name}`
        }
        case 'general':
        default:
            return 'General reflection on your relationships'
    }
}

// ============================================================================
// Quality Logging
// ============================================================================

/**
 * Log prompt feedback for quality tracking.
 * Call this when user accepts, rejects, or regenerates a prompt.
 */
export async function logPromptFeedback(
    promptId: string,
    feedback: 'accepted' | 'rejected' | 'regenerated',
    source: 'llm' | 'fallback'
): Promise<void> {
    // Log to analytics (could also write to llm_quality_log table)
    logger.info('SmartPromptGenerator', `Prompt feedback: ${feedback}`, {
        promptId,
        source,
        timestamp: Date.now(),
    })

    // TODO: Write to llm_quality_log table for detailed analysis
    // This would help tune prompts and measure LLM vs fallback quality
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Generate multiple smart prompts (for showing alternatives)
 * 
 * Returns the LLM prompt plus 2 fallback alternatives
 */
export async function generateSmartPromptsWithAlternatives(
    context: PromptContext,
    aiEnabled: boolean = true,
    options: SmartPromptOptions = {}
): Promise<{
    primary: SmartPromptResult
    alternatives: JournalPrompt[]
}> {
    // Get primary prompt (potentially LLM-generated)
    const primary = await generateSmartPrompt(context, aiEnabled, options)

    // Get rule-based alternatives
    const allRuleBased = generateJournalPrompts(context)

    // Filter out duplicates and take 2 alternatives
    const alternatives = allRuleBased
        .filter(p => p.question !== primary.prompt.question)
        .slice(0, 2)

    return {
        primary,
        alternatives,
    }
}
