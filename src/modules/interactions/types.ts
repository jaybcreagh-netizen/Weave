import { type Vibe, type Duration, type InteractionCategory, type InteractionType, type StructuredReflection } from '@/shared/types/common';

export * from '@/shared/types/scoring.types';
export { type InteractionCategory, type Vibe, type Duration, type StructuredReflection };

export type MoonPhase = Vibe;

export type Interaction = {
    id: string;
    friendIds?: string[];
    createdAt: Date;
    interactionDate: Date;
    category?: InteractionCategory; // NEW: Simplified interaction category
    interactionType: InteractionType; // DEPRECATED: Old activity (kept for migration)
    duration: Duration | null;
    vibe: Vibe | null;
    note: string | null;
    source?: 'quick-weave' | 'full-form' | 'import'; // Track entry method for node sizing
    photos?: string[]; // Photo URIs for rich content detection
    reflection?: StructuredReflection; // NEW: Structured reflection data

    // Missing properties added to fix build errors
    activity: string;
    status: string;
    mode: string;
    title?: string;
    location?: string;
    eventImportance?: string;
    initiator?: string;
    updatedAt: Date;
    interactionCategory?: InteractionCategory;
};
