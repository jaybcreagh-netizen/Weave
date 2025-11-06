import { Model } from '@nozbe/watermelondb';
import { field, relation, date, readonly } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import type Friend from './Friend';

/**
 * FriendBadge Model
 *
 * Tracks achievement badges earned for specific friendships
 * Badges represent milestones in individual relationships:
 * - Weave count (10, 25, 50, 100, 250, 500 weaves)
 * - Depth (reflections with this friend)
 * - Consistency (consecutive contact streaks)
 * - Special moments (birthday, first weave, peak moments, etc.)
 */
export default class FriendBadge extends Model {
  static table = 'friend_badges';

  static associations: Associations = {
    friends: { type: 'belongs_to', key: 'friend_id' },
  };

  @field('friend_id') friendId!: string;
  @field('badge_type') badgeType!: string; // 'weave_count' | 'depth' | 'consistency' | 'special'
  @field('badge_id') badgeId!: string; // e.g., 'growing_bond', 'deep_roots', etc.
  @field('tier') tier!: number; // 1-7 for progression tiers
  @date('unlocked_at') unlockedAt!: Date;
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;

  @relation('friends', 'friend_id') friend!: Friend;
}
