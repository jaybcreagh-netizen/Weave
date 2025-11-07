/**
 * WeeklyReflection Model
 * Stores weekly reflection journal entries with stats
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class WeeklyReflection extends Model {
  static table = 'weekly_reflections';

  // Week metadata
  @field('week_start_date') weekStartDate!: number; // Timestamp of week start
  @field('week_end_date') weekEndDate!: number; // Timestamp of week end

  // Stats from the week
  @field('total_weaves') totalWeaves!: number;
  @field('friends_contacted') friendsContacted!: number;
  @text('top_activity') topActivity!: string;
  @field('top_activity_count') topActivityCount!: number;
  @field('missed_friends_count') missedFriendsCount!: number;

  // Gratitude entry
  @text('gratitude_text') gratitudeText?: string; // User's gratitude journal entry
  @text('gratitude_prompt') gratitudePrompt?: string; // The prompt they responded to
  @text('prompt_context') promptContext?: string; // Why this prompt was chosen

  // Metadata
  @readonly @date('created_at') createdAt!: Date;
  @date('completed_at') completedAt!: Date; // When user completed reflection

  // Helper to check if this is the current week
  isCurrentWeek(): boolean {
    const now = Date.now();
    return now >= this.weekStartDate && now <= this.weekEndDate;
  }

  // Helper to format week range
  getWeekRange(): string {
    const start = new Date(this.weekStartDate);
    const end = new Date(this.weekEndDate);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }

  // Helper to get days ago
  getDaysAgo(): number {
    const now = Date.now();
    const days = Math.floor((now - this.weekEndDate) / (24 * 60 * 60 * 1000));
    return days;
  }
}
