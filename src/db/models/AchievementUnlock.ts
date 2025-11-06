import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

/**
 * AchievementUnlock Model
 *
 * Tracks all achievement unlocks with timestamps and celebration status
 * Used for:
 * - Showing unlock history/timeline
 * - Queuing unlock celebration modals
 * - Tracking which unlocks user has seen
 * - Analytics and progress tracking
 */
export default class AchievementUnlock extends Model {
  static table = 'achievement_unlocks';

  @field('achievement_id') achievementId!: string;
  @field('achievement_type') achievementType!: string; // 'global' | 'friend_badge' | 'hidden'
  @field('related_friend_id') relatedFriendId?: string; // For friend badges, reference to friend
  @date('unlocked_at') unlockedAt!: Date;
  @field('has_been_celebrated') hasBeenCelebrated!: boolean; // Track if user saw unlock modal
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
}
