/**
 * useSmartPrompt Hook
 * 
 * React hook for generating smart journal prompts.
 * Handles loading state, error handling, and automatic fallback.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
    JournalPrompt,
    PromptContext,
    generateJournalPrompts
} from './journal-prompts'
import {
    generateSmartPromptsWithAlternatives,
    logPromptFeedback
} from './smart-prompt-generator'

// ============================================================================
// Types
// ============================================================================

export interface UseSmartPromptResult {
    /** Primary prompt (LLM or fallback) */
    prompt: JournalPrompt | null
    /** All available prompts including alternatives */
    prompts: JournalPrompt[]
    /** Whether we're generating a new prompt */
    isLoading: boolean
    /** Source of the primary prompt */
    source: 'llm' | 'fallback' | null
    /** Error message if generation failed */
    error: string | null
    /** Regenerate prompts */
    refresh: () => void
    /** Log that the user selected a prompt */
    logSelection: (promptId: string) => void
    /** Log that the user rejected/skipped prompts */
    logRejection: () => void
}

// ============================================================================
// Hook
// ============================================================================

export function useSmartPrompt(
    context: PromptContext | null,
    aiEnabled: boolean = true
): UseSmartPromptResult {
    const [prompt, setPrompt] = useState<JournalPrompt | null>(null)
    const [prompts, setPrompts] = useState<JournalPrompt[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [source, setSource] = useState<'llm' | 'fallback' | null>(null)
    const [error, setError] = useState<string | null>(null)

    // Ref to track current abort controller
    const abortControllerRef = useRef<AbortController | null>(null)

    // Generate prompts
    const generatePrompts = useCallback(async (signal?: AbortSignal) => {
        if (!context) {
            setPrompt(null)
            setPrompts([])
            setSource(null)
            setError(null)
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const result = await generateSmartPromptsWithAlternatives(
                context,
                aiEnabled,
                { timeoutMs: 5000, signal }
            )

            // Check if aborted before setting state
            if (signal?.aborted) return

            setPrompt(result.primary.prompt)
            setSource(result.primary.source)
            setPrompts([result.primary.prompt, ...result.alternatives])

        } catch (err) {
            // Ignore abort errors
            if (err instanceof Error && err.name === 'AbortError') return
            if (signal?.aborted) return

            console.error('[useSmartPrompt] Error:', err)
            setError(err instanceof Error ? err.message : 'Failed to generate prompt')

            // Fall back to rule-based
            const fallbackPrompts = generateJournalPrompts(context)
            setPrompts(fallbackPrompts)
            setPrompt(fallbackPrompts[0] || null)
            setSource('fallback')
        } finally {
            if (!signal?.aborted) {
                setIsLoading(false)
            }
        }
    }, [context, aiEnabled])

    // Effect to generate on context/aiEnabled change
    useEffect(() => {
        // Abort any in-flight request
        abortControllerRef.current?.abort()

        // Create new abort controller
        const abortController = new AbortController()
        abortControllerRef.current = abortController

        generatePrompts(abortController.signal)

        return () => {
            abortController.abort()
        }
    }, [generatePrompts])

    // Refresh function - aborts previous and regenerates
    const refresh = useCallback(() => {
        // Abort any in-flight request
        abortControllerRef.current?.abort()

        // Create new abort controller
        const abortController = new AbortController()
        abortControllerRef.current = abortController

        generatePrompts(abortController.signal)
    }, [generatePrompts])

    // Log prompt selection with accurate source detection
    const logSelection = useCallback((promptId: string) => {
        const promptSource = promptId.startsWith('llm_') ? 'llm' : 'fallback'
        logPromptFeedback(promptId, 'accepted', promptSource)
    }, [])

    // Log prompt rejection
    const logRejection = useCallback(() => {
        if (prompt && source) {
            logPromptFeedback(prompt.id, 'rejected', source)
        }
    }, [prompt, source])

    return {
        prompt,
        prompts,
        isLoading,
        source,
        error,
        refresh,
        logSelection,
        logRejection,
    }
}
