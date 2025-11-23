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
