/**
 * Gamification Module
 *
 * Handles badges, achievements, and milestone tracking.
 *
 * @public API
 */

// Services
export {
  checkAndAwardFriendBadges,
  checkSpecialBadges,
  getUncelebratedBadgeUnlocks,
  markBadgeAsCelebrated,
  type BadgeUnlock
} from './services/badge.service';
export * from './services/achievement.service';

// Types
export * from './types';

// Constants
export * from './constants/badge-definitions';
export * from './constants/achievement-definitions';
