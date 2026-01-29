export interface ScoreUpdate {
  friendId: string;
  scoreBefore: number;
  scoreAfter: number;
  pointsEarned: number;
}

export interface QualityMetrics {
  depthScore: number;
  energyScore: number;
  overallQuality: number;
}

export interface DecayResult {
  currentScore: number;
  decayedAmount: number;
  daysSinceUpdate: number;
}

export interface WeaveUpdateData {
  weaveScore: number;
  lastUpdated: Date;
  isNewerInteraction: boolean;
  momentumScore?: number;
  momentumLastUpdated?: Date;
  newResilience?: number | null;
  hasVibe: boolean;
  pointsEarned: number;
}
