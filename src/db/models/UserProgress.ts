import { Model } from '@nozbe/watermelondb';
import { field, date, json } from '@nozbe/watermelondb/decorators';

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

  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
}
