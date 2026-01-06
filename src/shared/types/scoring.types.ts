import { type Vibe, type Duration, type InteractionCategory, type OracleReflectionMetadata } from '@/shared/types/common';

/**
 * Single reflection chip/sentence
 */
export interface ReflectionChip {
    chipId: string; // References a StoryChip ID
    componentOverrides: Record<string, string>;
}

/**
 * Structured reflection data
 * Supports multiple chips + custom notes + Oracle-guided metadata
 */
export interface StructuredReflection {
    // Multiple selected sentence chips (array)
    chips?: ReflectionChip[];
    // Freeform custom notes (always optional)
    customNotes?: string;
    // Oracle-guided "Help me write" metadata
    oracleGuided?: OracleReflectionMetadata;
}

// This now represents all the data collected from the form
export interface InteractionFormData {
    friendIds: string[];
    activity: string;
    notes?: string;
    date: Date;
    type: 'log' | 'plan';
    status: 'completed' | 'planned';
    mode: string; // e.g. 'one-on-one'
    vibe?: Vibe | null;
    duration?: Duration | null;
    // NEW: Simplified category system
    category?: InteractionCategory;
    // NEW: Structured reflection data
    reflection?: StructuredReflection;
    // v17: Custom title and location
    title?: string;
    location?: string;
    // v24: Event importance for special occasions
    eventImportance?: 'low' | 'medium' | 'high' | 'critical';
    // v25: Reciprocity tracking
    initiator?: 'user' | 'friend' | 'mutual';
}
