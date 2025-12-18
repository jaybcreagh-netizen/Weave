/**
 * Gamification Module
 *
 * Handles badges, achievements, and milestone tracking.
 *
 * @public API
 */

// Hooks
export { useAchievements } from './hooks/useAchievements';

// Services
export {
  checkAndAwardFriendBadges,
  checkSpecialBadges,
  getUncelebratedBadgeUnlocks,
  markBadgeAsCelebrated,
  type BadgeUnlock
} from './services/badge.service';
export * from './services/badge-calculator.service';
export * from './services/achievement.service';
export * from './services/milestone-tracker.service';

// Types
export * from './types';

// Constants
export * from './constants/badge-definitions';
export * from './constants/achievement-definitions';

// Listeners
export * from './listeners/gamification.listener';

// Components
export { AchievementCard } from './components/AchievementCard'; // Note: AchievementCard might be a sub-component of AchievementsModal or missing, checking later. 
export { TrophyCabinetModal } from './components/TrophyCabinetModal';
export { AchievementsModal } from './components/AchievementsModal';
export { BadgeUnlockModal } from './components/BadgeUnlockModal';
export { MilestoneCelebration } from './components/MilestoneCelebration';
export { PatternBadge } from './components/PatternBadge';
