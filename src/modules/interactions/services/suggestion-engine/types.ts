import { Suggestion } from '@/shared/types/common';
import InteractionModel from '@/db/models/Interaction';
import { HydratedFriend } from '@/types/hydrated';

export interface SuggestionInput {
    friend: HydratedFriend;
    currentScore: number;
    lastInteractionDate: Date | null;
    interactionCount: number;
    momentumScore: number;
    recentInteractions: InteractionModel[];
    plannedInteractions?: InteractionModel[];
}

export interface SuggestionContext extends SuggestionInput {
    now: Date;
}

export interface SuggestionGenerator {
    name: string;
    priority: number; // Lower number = higher priority (waterfall order)
    generate(context: SuggestionContext): Promise<Suggestion | null>;
}
