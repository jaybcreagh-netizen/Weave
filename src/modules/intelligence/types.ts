import type { ScoreComponentsDTO } from '@/shared/types/dtos';

export interface ScoringInput {
  currentScore: number;
  interactionQuality: number;
  daysSinceLastInteraction: number;
}

export interface ScoringOutput extends ScoreComponentsDTO {
  friendId: string;
  timestamp: Date;
}

export interface DecayParams {
  baseScore: number;
  daysSinceLastContact: number;
  tier: number;
}
