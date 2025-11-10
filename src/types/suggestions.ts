import { Archetype, Tier } from './core';

export type Urgency = 'critical' | 'high' | 'medium' | 'low';
export type SuggestionCategory = 'drift' | 'maintain' | 'deepen' | 'celebrate' | 'reflect' | 'insight' | 'portfolio' | 'life-event';
export type ActionType = 'log' | 'plan' | 'reflect';
export type InteractionCategory = 'text-call' | 'meal-drink' | 'hangout' | 'deep-talk' | 'activity-hobby' | 'event-party';

export interface SuggestionAction {
  type: ActionType;
  prefilledCategory?: InteractionCategory;
  prefilledMode?: 'quick-touch' | 'detailed';
  interactionId?: string; // For reflect actions
}

export interface Suggestion {
  id: string;
  friendId: string;
  friendName: string;
  urgency: Urgency;
  category: SuggestionCategory;

  // Display content
  title: string;
  subtitle: string;
  actionLabel: string;
  icon: string;

  // Behavior
  action: SuggestionAction;
  dismissible: boolean;

  // Meta
  createdAt: Date;
  expiresAt?: Date;
}

export interface SuggestionInput {
  friend: {
    id: string;
    name: string;
    archetype: Archetype;
    dunbarTier: Tier;
    createdAt: Date;
    birthday?: Date;
    anniversary?: Date;
    relationshipType?: string;
  };
  currentScore: number;
  lastInteractionDate?: Date;
  interactionCount: number;
  momentumScore: number;
  // IMPORTANT: Only include COMPLETED interactions that have already happened (not planned/future)
  // Filter: status === 'completed' AND interactionDate <= now
  recentInteractions: Array<{
    id: string;
    category: InteractionCategory;
    interactionDate: Date;
    vibe?: string | null;
    notes?: string | null;
  }>;
}
