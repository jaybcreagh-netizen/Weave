import { Model } from '@nozbe/watermelondb';
import { field, date, json, text } from '@nozbe/watermelondb/decorators';

/**
 * UserProgress Model
 *
 * Tracks the user's journey across multiple milestone paths:
 * - Path of Consistency (Practice Streak)
 * - Path of Depth (Reflection Journey)
 * - Path of Nurturing (Friendship Milestones)
 */
export default class UserProgress extends Model {
  static table = 'user_progress';

  // Path of Consistency - tracks "practice" streak (any intentional action)
  @field('current_streak') currentStreak!: number;
  @field('best_streak') bestStreak!: number;
  @date('last_practice_date') lastPracticeDate!: Date;

  // Streak forgiveness mechanics (v30)
  @field('last_streak_count') lastStreakCount!: number; // Count before break
  @date('streak_released_date') streakReleasedDate?: Date; // When streak was released
  @field('longest_streak_ever') longestStreakEver!: number; // Never decreases

  // JSON array of unlocked consistency milestone IDs
  // e.g., ['thread-starter', 'consistent-weaver']
  @json('consistency_milestones', (json) => json) consistencyMilestones!: string[];

  // Path of Depth - tracks reflections (weaves with notes OR vibe)
  @field('total_reflections') totalReflections!: number;

  // JSON array of unlocked reflection milestone IDs
  // e.g., ['thoughtful-scribe', 'insightful-chronicler']
  @json('reflection_milestones', (json) => json) reflectionMilestones!: string[];

  // Path of Nurturing - per-friend milestones
  // JSON array of { friendId: string, milestones: string[] }
  @json('friendship_milestones', (json) => json) friendshipMilestones!: Array<{
    friendId: string;
    milestones: string[];
  }>;

  // New Achievements
  @field('catalyst_progress') catalystProgress!: number;
  @field('high_priestess_progress') highPriestessProgress!: number;
  @field('scribe_progress') scribeProgress!: number;
  @field('curator_progress') curatorProgress!: number;

  // Global Achievement System
  @field('total_weaves') totalWeaves!: number; // Total completed interactions
  @json('global_achievements', (json) => json) globalAchievements!: string[]; // Unlocked global achievement IDs
  @json('hidden_achievements', (json) => json) hiddenAchievements!: string[]; // Unlocked hidden achievement IDs

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  // Cloud sync fields (v31)
  @field('user_id') userId?: string;
  @field('synced_at') syncedAt?: number;
  @text('sync_status') syncStatus?: string;
  @field('server_updated_at') serverUpdatedAt?: number;
}
