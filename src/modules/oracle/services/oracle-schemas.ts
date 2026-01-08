/**
 * Oracle JSON Schemas
 * 
 * Centralized JSON schema definitions for Gemini's Native Structured Output.
 * These schemas are passed to the API via responseSchema for validated responses.
 * 
 * @see https://ai.google.dev/gemini-api/docs/structured-output
 */

import { JSONSchema } from '@/shared/services/llm/types'

// ============================================================================
// ACTION TYPES (matches OracleActionType)
// ============================================================================

const ORACLE_ACTION_TYPES = [
    'log_weave',
    'add_life_event',
    'create_reflection',
    'plan_weave',
    'set_reminder',
    'view_friend',
    'view_insights',
    'start_deepening',
    'share_summary'
] as const

// ============================================================================
// GUIDED REFLECTION SCHEMAS
// ============================================================================

/**
 * Schema for guided reflection question generation
 * Used by: generateNextQuestion, continueReflection
 * 
 * Both fields required - question can be empty string when readyToCompose is true
 */
export const GuidedQuestionSchema: JSONSchema = {
    type: 'object',
    properties: {
        question: {
            type: 'string',
            description: 'Question under 25 words. Empty string if readyToCompose is true.'
        },
        readyToCompose: {
            type: 'boolean',
            description: 'True when enough context gathered (after 3 turns)'
        }
    },
    required: ['question', 'readyToCompose']
}

export interface GuidedQuestionResponse {
    question: string
    readyToCompose: boolean
}

/**
 * Schema for deepening question generation
 * Used by: startDeepening, continueDeepening
 */
export const DeepenQuestionSchema: JSONSchema = {
    type: 'object',
    properties: {
        question: {
            type: 'string',
            description: 'Follow-up question under 25 words. Empty if readyToCompose is true.'
        },
        readyToCompose: {
            type: 'boolean',
            description: 'True when ready to compose refined entry'
        }
    },
    required: ['question', 'readyToCompose']
}

export interface DeepenQuestionResponse {
    question: string
    readyToCompose: boolean
}

// ============================================================================
// ORACLE CONSULTATION SCHEMAS
// ============================================================================

/**
 * Schema for Oracle action suggestions
 * Used by: Oracle chat responses
 */
export const OracleActionSchema: JSONSchema = {
    type: 'object',
    properties: {
        type: {
            type: 'string',
            enum: [...ORACLE_ACTION_TYPES],
            description: 'Type of action to suggest'
        },
        friendName: {
            type: 'string',
            description: 'Name of friend extracted from conversation'
        },
        prefill: {
            type: 'object',
            description: 'Prefilled data for the action',
            properties: {
                activity: { type: 'string' },
                vibe: { type: 'string' },
                notes: { type: 'string' },
                eventType: { type: 'string' },
                eventDate: { type: 'string' },
                eventDescription: { type: 'string' },
                content: { type: 'string' },
                suggestedDate: { type: 'string' },
                message: { type: 'string' }
            }
        }
    },
    required: ['type']
}

/**
 * Schema for Oracle chat responses
 * Used by: askOracle (main consultation mode)
 */
export const OracleResponseSchema: JSONSchema = {
    type: 'object',
    properties: {
        text: {
            type: 'string',
            description: 'Oracle response text in warm, concise voice'
        },
        suggestedAction: OracleActionSchema
    },
    required: ['text']
}

export interface OracleResponseData {
    text: string
    suggestedAction?: {
        type: typeof ORACLE_ACTION_TYPES[number]
        friendName?: string
        prefill?: Record<string, string>
    }
}

// ============================================================================
// INSIGHT ANALYSIS SCHEMAS
// ============================================================================

/**
 * Schema for insight/question analysis
 * Used by: analyzeInsightIntent
 */
export const InsightAnalysisSchema: JSONSchema = {
    type: 'object',
    properties: {
        analysis: {
            type: 'string',
            description: 'Brief assessment of what is happening (1-2 sentences)'
        },
        identified_pattern: {
            type: 'string',
            description: "Pattern name (e.g., 'One-Way Street', 'The Drift')"
        },
        clarifying_question: {
            type: 'string',
            description: 'High-impact clarifying question'
        },
        confidence: {
            type: 'number',
            description: 'Confidence score 0.0-1.0'
        }
    },
    required: ['analysis', 'identified_pattern', 'clarifying_question', 'confidence']
}

export interface InsightAnalysisData {
    analysis: string
    identified_pattern: string
    clarifying_question: string
    confidence: number
}

/**
 * Schema for draft completeness assessment
 * Used by: assessDraft
 */
export const AssessDraftSchema: JSONSchema = {
    type: 'object',
    properties: {
        status: {
            type: 'string',
            enum: ['complete', 'gaps'],
            description: "Whether the draft is complete or has gaps"
        },
        missing_elements: {
            type: 'array',
            items: { type: 'string' },
            description: "What's missing (e.g., 'emotion', 'context', 'people')"
        },
        clarifying_questions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Short, casual questions to prompt missing info'
        },
        confidence: {
            type: 'number',
            description: 'Confidence score 0.0-1.0'
        }
    },
    required: ['status', 'missing_elements', 'clarifying_questions', 'confidence']
}

export interface AssessDraftData {
    status: 'complete' | 'gaps'
    missing_elements: string[]
    clarifying_questions: string[]
    confidence: number
}

// ============================================================================
// ORACLE LENS SCHEMAS
// ============================================================================

const ORACLE_ARCHETYPES = [
    'THE_HERMIT',
    'THE_EMPEROR',
    'THE_LOVERS',
    'THE_MAGICIAN',
    'THE_EMPRESS',
    'THE_HIGH_PRIESTESS',
    'THE_FOOL',
    'THE_SUN'
] as const

/**
 * Schema for lens suggestions (journal entry analysis)
 * Used by: analyzeEntryContext
 */
export const LensSuggestionSchema: JSONSchema = {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            archetype: {
                type: 'string',
                enum: [...ORACLE_ARCHETYPES],
                description: 'Archetype for this path'
            },
            title: {
                type: 'string',
                description: 'Short punchy action title (max 4 words)'
            },
            reasoning: {
                type: 'string',
                description: 'Why this path fits (1 sentence)'
            },
            initialQuestion: {
                type: 'string',
                description: 'First question to start this path'
            }
        },
        required: ['archetype', 'title', 'reasoning', 'initialQuestion']
    }
}

export interface LensSuggestionData {
    archetype: typeof ORACLE_ARCHETYPES[number]
    title: string
    reasoning: string
    initialQuestion: string
}

// ============================================================================
// ACTION DETECTION SCHEMAS
// ============================================================================

const SMART_ACTION_TYPES = [
    'mimic_plan',
    'schedule_event',
    'create_intention',
    'update_profile',
    'reach_out'
] as const

/**
 * Schema for smart action detection
 * Used by: detectActions
 */
export const SmartActionsSchema: JSONSchema = {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            type: {
                type: 'string',
                enum: [...SMART_ACTION_TYPES],
                description: 'Type of action detected'
            },
            label: {
                type: 'string',
                description: "Short button label (e.g., 'Plan Sushi')"
            },
            data: {
                type: 'object',
                properties: {
                    friendId: { type: 'string' },
                    activity: { type: 'string' },
                    date: { type: 'string' },
                    note: { type: 'string' }
                }
            },
            confidence: {
                type: 'number',
                description: 'Confidence score 0.0-1.0'
            }
        },
        required: ['type', 'label', 'confidence']
    }
}

export interface SmartActionData {
    type: typeof SMART_ACTION_TYPES[number]
    label: string
    data?: {
        friendId?: string
        activity?: string
        date?: string
        note?: string
    }
    confidence: number
}

// ============================================================================
// STARTER PROMPTS SCHEMA
// ============================================================================

const STARTER_ICONS = [
    'heart',
    'users',
    'battery',
    'sparkles',
    'book-open',
    'message-circle',
    'zap'
] as const

/**
 * Schema for personalized starter prompts
 * Used by: getPersonalizedStarterPrompts
 */
export const StarterPromptsSchema: JSONSchema = {
    type: 'array',
    items: {
        type: 'object',
        properties: {
            text: {
                type: 'string',
                description: 'Display text for the chip'
            },
            prompt: {
                type: 'string',
                description: 'Full prompt to send to Oracle'
            },
            icon: {
                type: 'string',
                enum: [...STARTER_ICONS],
                description: 'Icon name for the chip'
            }
        },
        required: ['text', 'prompt', 'icon']
    }
}

export interface StarterPromptData {
    text: string
    prompt: string
    icon: typeof STARTER_ICONS[number]
}

// ============================================================================
// INSIGHT SYNTHESIS SCHEMA
// ============================================================================

/**
 * Schema for insight synthesis (letters)
 * Used by: generateInsight
 */
export const InsightSynthesisSchema: JSONSchema = {
    type: 'object',
    properties: {
        headline: {
            type: 'string',
            description: 'Short, poetic but clear title'
        },
        body: {
            type: 'string',
            description: '2-3 paragraphs of synthesis'
        }
    },
    required: ['headline', 'body']
}

export interface InsightSynthesisData {
    headline: string
    body: string
}
