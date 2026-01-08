/**
 * Oracle Action Types
 * Defines the actions that the Oracle can suggest based on conversation context.
 */

export type OracleActionType =
    | 'log_weave'
    | 'add_life_event'
    | 'create_reflection'
    | 'plan_weave'
    | 'set_reminder'
    | 'view_friend'
    | 'view_insights'
    | 'start_deepening'
    | 'share_summary'

export interface OracleAction {
    type: OracleActionType
    friendName?: string  // LLM extracts from conversation
    friendId?: string    // Resolved by app after fuzzy matching
    prefill?: {
        // For log_weave
        activity?: string
        vibe?: string
        notes?: string
        // For add_life_event
        eventType?: string
        eventDate?: string
        eventDescription?: string
        // For create_reflection
        content?: string
        // For plan_weave
        suggestedDate?: string
        // For set_reminder
        message?: string
    }
}

export interface OracleStructuredResponse {
    text: string
    suggestedAction?: OracleAction
}

/** Action labels for UI display */
export const ACTION_LABELS: Record<OracleActionType, { label: string; icon: string }> = {
    log_weave: { label: 'Log this weave', icon: 'calendar-plus' },
    add_life_event: { label: 'Add life event', icon: 'gift' },
    create_reflection: { label: 'Save as reflection', icon: 'book-open' },
    plan_weave: { label: 'Plan a meetup', icon: 'calendar' },
    set_reminder: { label: 'Set reminder', icon: 'bell' },
    view_friend: { label: 'View profile', icon: 'user' },
    view_insights: { label: 'View insights', icon: 'sparkles' },
    start_deepening: { label: 'Go deeper', icon: 'arrow-down-circle' },
    share_summary: { label: 'Share summary', icon: 'share' },
}

// ============================================================================
// ORACLE MODES
// Oracle is the intelligence layer. These are its interaction modes.
// ============================================================================

export type OracleMode =
    | 'consultation'       // User asks, Oracle answers
    | 'guided_reflection'  // Oracle asks, user answers, Oracle composes
    | 'proactive_insight'  // Oracle offers observation unprompted
    | 'inline_assist'      // Oracle helps mid-task (writing, logging)

// ============================================================================
// GUIDED REFLECTION TYPES
// ============================================================================

export type ReflectionType =
    | 'post_weave'        // Right after logging an interaction
    | 'friend_reflection' // Thinking about a specific friend
    | 'weekly_reflection' // Weekly check-in
    | 'journal_entry'     // Freeform journal
    | 'quick_capture'     // Expanding a quick note

export type GuidedSessionStatus =
    | 'in_progress'   // Asking questions
    | 'deepening'     // Follow-up deepening questions
    | 'draft_ready'   // Composed entry ready for review
    | 'complete'      // Entry saved

export interface ReflectionContext {
    type: ReflectionType
    friendIds: string[]
    friendNames: string[]
    interactionId?: string       // For post_weave
    activity?: string            // Activity type from interaction
    weekStartDate?: string       // For weekly_reflection
    quickCaptureText?: string    // For quick_capture - existing text to expand
    insightId?: string           // If reflection was triggered from an insight
    activeThreads?: Array<{      // Ongoing topics with these friends
        id: string
        topic: string
        sentiment: 'concern' | 'neutral' | 'positive'
        daysSinceLastMention: number
    }>
}

export interface GuidedTurn {
    oracleQuestion: string
    userAnswer: string
    extractedSignals?: {
        sentiment: number
        topics: string[]
        threadHints: string[]
    }
}

export interface GuidedSession {
    id: string
    mode: 'guided_reflection'
    context: ReflectionContext

    // Conversation state
    turns: GuidedTurn[]
    pendingQuestion?: string

    // Composition
    composedDraft?: string

    // Deepening state (for "Go Deeper" feature)
    deepeningTurns?: GuidedTurn[]
    originalDraft?: string  // Preserved before deepening
    hasDeepened?: boolean   // Track if already deepened once

    // Status
    status: GuidedSessionStatus

    // Analytics (for tracking escape rate)
    startedAt: number
    escapedAt?: {
        turnNumber: number
        reason: 'user_chose_freeform' | 'timeout' | 'error'
    }
}

export interface ComposedEntry {
    content: string
    friendIds: string[]
    metadata: {
        source: 'guided_reflection'
        turnCount: number
        reflectionType: ReflectionType
    }
}


export interface InsightSignal {
    type: 'drifting' | 'deepening' | 'one_sided' | 'reconnection_win' | 'consistency_win' | 'location_pattern' | 'activity_habit' | 'vibe_trend' | 'journal_signal';
    friendId?: string;
    data: Record<string, any>;
    priority: number;
}

// ============================================================================
// ORACLE LENS (Contextual Intelligence)
// ============================================================================

export type OracleLensArchetype =
    | 'THE_HERMIT'
    | 'THE_EMPEROR'
    | 'THE_LOVERS'
    | 'THE_MAGICIAN'
    | 'THE_EMPRESS'
    | 'THE_HIGH_PRIESTESS'
    | 'THE_FOOL'
    | 'THE_SUN';

export interface OracleSuggestion {
    id: string; // UUID
    archetype: OracleLensArchetype;
    title: string;
    reasoning: string;
    initialQuestion: string;
}

export type OracleLensMode =
    | 'consultation'
    | 'go_deeper'
    | 'plan_next_steps'
    | 'expand_entry'
    | 'quick_actions';

export interface InsightAnalysisResult {
    analysis: string
    identified_pattern: string
    clarifying_question: string
    confidence: number
}

export interface AssessDraftResult {
    status: 'complete' | 'gaps'
    missing_elements: string[]
    clarifying_questions: string[]
    confidence: number
}

export interface SmartAction {
    type: 'mimic_plan' | 'schedule_event' | 'create_intention' | 'update_profile' | 'reach_out';
    label: string;
    data: {
        friendId?: string;
        activity?: string;
        date?: string;
        note?: string;
    };
    confidence: number;
}

