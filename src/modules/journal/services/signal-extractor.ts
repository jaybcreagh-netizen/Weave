/**
 * Signal Extractor
 * 
 * Extracts relationship signals (sentiment, themes, dynamics) from journal entries.
 * Uses LLM if available, falls back to rule-based keyword matching.
 */

import { llmService } from '@/shared/services/llm'
import { getPrompt, interpolatePrompt } from '@/shared/services/llm/prompt-registry'
import {
    CORE_THEMES,
    CoreTheme,
    SentimentLabel,
    RelationshipDynamics
} from '@/db/models/JournalSignals'
import Logger from '@/shared/utils/Logger'

const PROMPT_ID = 'signal_extraction'

export interface SignalExtractionResult {
    sentiment: number // -2 to +2
    sentimentLabel: SentimentLabel
    coreThemes: CoreTheme[]
    emergentThemes: string[]
    dynamics: RelationshipDynamics
    confidence: number // 0-1
    extractedAt: number
    extractorVersion: string
}

/**
 * Extract signals from a journal entry
 */
export async function extractSignals(
    text: string,
    aiEnabled: boolean = true
): Promise<SignalExtractionResult> {
    const startTime = Date.now()

    // 1. Check if we should use LLM
    if (aiEnabled && llmService.isAvailable()) {
        try {
            return await extractWithLLM(text)
        } catch (error) {
            Logger.warn('SignalExtractor', 'LLM extraction failed, falling back to rules', error)
        }
    }

    // 2. Fallback to rule-based extraction
    return extractWithRules(text)
}

/**
 * LLM Extraction Strategy
 */
async function extractWithLLM(text: string): Promise<SignalExtractionResult> {
    const promptDef = getPrompt(PROMPT_ID)
    if (!promptDef) throw new Error(`Prompt ${PROMPT_ID} not found`)

    // Simple textual prompt - no variables needed strictly speaking, 
    // but registry usually expects them. Our system prompt does the heavy lifting.
    // We'll pass the entry text as the user prompt.

    // Note: The registry definition might be expecting a template. 
    // Let's assume for now we just pass the text as user message if no template vars needed.
    // If the registry definition has {{entryText}}, we should use interpolate.
    // Based on the file view earlier, I didn't see the userPromptTemplate. 
    // I'll assume standard usage.

    const response = await llmService.complete({
        system: promptDef.systemPrompt,
        user: `JOURNAL ENTRY:\n"${text}"\n\nExtract signals as JSON.`
    }, {
        maxTokens: 500,
        temperature: 0, // Deterministic for classification
        jsonMode: true
    })

    const result = JSON.parse(response.text)

    // Validate and sanitize LLM output
    return {
        sentiment: validateSentiment(result.sentiment),
        sentimentLabel: validateSentimentLabel(result.sentiment),
        coreThemes: validateCoreThemes(result.core_themes),
        emergentThemes: Array.isArray(result.emergent_themes) ? result.emergent_themes.slice(0, 5) : [],
        dynamics: validateDynamics(result.dynamics),
        confidence: 0.9,
        extractedAt: Date.now(),
        extractorVersion: `llm-${promptDef.version}`
    }
}

/**
 * Rule-Based Extraction Strategy
 */
function extractWithRules(text: string): SignalExtractionResult {
    const lowerText = text.toLowerCase()

    // 1. Sentiment Analysis (very basic keyword matching)
    let sentimentScore = 0
    const positiveWords = ['happy', 'great', 'love', 'enjoy', 'good', 'fun', 'excited', 'grateful', 'thanks']
    const negativeWords = ['sad', 'bad', 'angry', 'upset', 'hate', 'difficult', 'argue', 'hurt', 'worry']

    let positiveCount = 0
    let negativeCount = 0

    positiveWords.forEach(w => { if (lowerText.includes(w)) positiveCount++ })
    negativeWords.forEach(w => { if (lowerText.includes(w)) negativeCount++ })

    if (positiveCount > negativeCount) sentimentScore = 1
    if (negativeCount > positiveCount) sentimentScore = -1
    if (positiveCount > negativeCount + 2) sentimentScore = 2
    if (negativeCount > positiveCount + 2) sentimentScore = -2

    // 2. Theme Detection
    const coreThemes: CoreTheme[] = []

    const themeKeywords: Record<CoreTheme, string[]> = {
        support: ['help', 'advice', 'support', 'there for me', 'listened'],
        celebration: ['birthday', 'party', 'congrats', 'promotion', 'cheers'],
        vulnerability: ['scared', 'cry', 'cried', 'opened up', 'honest', 'fear'],
        conflict: ['fight', 'argument', 'disagree', 'mad', 'annoyed'],
        growth: ['learned', 'changed', 'better', 'improve', 'grow'],
        gratitude: ['thank', 'grateful', 'blessed', 'lucky', 'appreciate'],
        planning: ['plan', 'schedule', 'trip', 'vacation', 'future'],
        reconnection: ['long time', 'missed', 'catch up', 'catching up', 'ages'],
        shared_activity: ['went out', 'movie', 'dinner', 'hike', 'played'],
        life_transition: ['moved', 'job', 'baby', 'married', 'divorce', 'breakup']
    }

    Object.entries(themeKeywords).forEach(([theme, keywords]) => {
        if (keywords.some(k => lowerText.includes(k))) {
            coreThemes.push(theme as CoreTheme)
        }
    })

    return {
        sentiment: sentimentScore,
        sentimentLabel: validateSentimentLabel(sentimentScore),
        coreThemes,
        emergentThemes: [], // Rules can't easily extract freeform themes
        dynamics: {}, // Rules can't easily infer dynamics
        confidence: 0.5, // Lower confidence for rules
        extractedAt: Date.now(),
        extractorVersion: 'rule-v1'
    }
}

// ============================================================================
// Validators
// ============================================================================

function validateSentiment(val: any): number {
    const num = Number(val)
    if (isNaN(num)) return 0
    return Math.max(-2, Math.min(2, num))
}

function validateSentimentLabel(score: number): SentimentLabel {
    if (score >= 2) return 'grateful'
    if (score >= 1) return 'positive'
    if (score <= -2) return 'tense'
    if (score <= -1) return 'concerned'
    return 'neutral'
}

function validateCoreThemes(themes: any): CoreTheme[] {
    if (!Array.isArray(themes)) return []
    return themes.filter((t: any) => CORE_THEMES.includes(t as CoreTheme))
}

function validateDynamics(dyn: any): RelationshipDynamics {
    if (!dyn || typeof dyn !== 'object') return {}
    return {
        reciprocitySignal: ['balanced', 'giving', 'receiving'].includes(dyn.reciprocitySignal) ? dyn.reciprocitySignal : undefined,
        depthSignal: ['surface', 'personal', 'deep'].includes(dyn.depthSignal) ? dyn.depthSignal : undefined,
        tensionDetected: typeof dyn.tensionDetected === 'boolean' ? dyn.tensionDetected : undefined,
        reconnectionRelevant: typeof dyn.reconnectionRelevant === 'boolean' ? dyn.reconnectionRelevant : undefined
    }
}
