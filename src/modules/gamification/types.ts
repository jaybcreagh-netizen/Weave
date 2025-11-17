/**
 * Gamification Module Types
 */

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  unlockedAt?: Date;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  points: number;
  unlockedAt?: Date;
}

export interface BadgeCheckResult {
  newBadges: Badge[];
  totalBadges: number;
}
