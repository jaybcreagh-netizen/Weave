import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class PortfolioSnapshot extends Model {
  static table = 'portfolio_snapshots';

  @date('snapshot_date') snapshotDate!: Date;
  @field('overall_health_score') overallHealthScore!: number;
  @field('total_friends') totalFriends!: number;
  @field('active_friends') activeFriends!: number;
  @field('drifting_friends') driftingFriends!: number;
  @field('thriving_friends') thrivingFriends!: number;

  // Tier averages
  @field('inner_circle_avg') innerCircleAvg!: number;
  @field('close_friends_avg') closeFriendsAvg!: number;
  @field('community_avg') communityAvg!: number;

  // Activity metrics
  @field('interactions_per_week') interactionsPerWeek!: number;
  @field('diversity_score') diversityScore!: number;

  @readonly @date('created_at') createdAt!: Date;
}
