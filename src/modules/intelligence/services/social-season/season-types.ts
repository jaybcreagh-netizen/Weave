import { SocialSeason } from '@/db/models/UserProfile';

export type { SocialSeason };

export interface SeasonCalculationInput {
  // Activity metrics (60% weight)
  weavesLast7Days: number;
  weavesLast30Days: number;
  avgScoreAllFriends: number;
  avgScoreInnerCircle: number;
  momentumCount: number; // Number of friends with active momentum

  // Battery metrics (40% weight)
  batteryLast7DaysAvg: number | null; // 1-5 scale, null if no data
  batteryTrend: 'rising' | 'falling' | 'stable' | null;
}

export interface SeasonThresholds {
  resting: { min: number; max: number };
  balanced: { min: number; max: number };
  blooming: { min: number; max: number };
}

export const SEASON_THRESHOLDS: SeasonThresholds = {
  resting: { min: 0, max: 45 },
  balanced: { min: 46, max: 80 },
  blooming: { min: 81, max: 100 },
};

// Hysteresis buffer to prevent rapid state switching
export const HYSTERESIS_BUFFER = 5;

export interface SeasonContext {
  // Context for adaptive greeting selection
  innerCircleStrong: boolean; // Avg inner circle score > 70
  innerCircleWeak: boolean; // Avg inner circle score < 40
  highActivity: boolean; // 5+ weaves in last 7 days
  lowActivity: boolean; // < 2 weaves in last 7 days
  batteryLow: boolean; // Battery avg < 2.5
  batteryHigh: boolean; // Battery avg > 4.0
}

export interface SeasonExplanationData {
  season: SocialSeason;
  weavesLast7Days: number;
  weavesLast30Days: number;
  avgScoreAllFriends: number;
  avgScoreInnerCircle: number;
  momentumCount: number;
  batteryLast7DaysAvg: number;
  batteryTrend: 'rising' | 'falling' | 'stable';
}
