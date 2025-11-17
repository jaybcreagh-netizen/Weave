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
  @text('story_chips') storyChipsRaw?: string; // JSON: Array of story chip selections

  // Metadata
  @readonly @date('created_at') createdAt!: Date;
  @date('completed_at') completedAt!: Date; // When user completed reflection

  // Story chips getter/setter
  get storyChips(): Array<{ chipId: string; customText?: string }> {
    if (!this.storyChipsRaw) return [];
    try {
      return JSON.parse(this.storyChipsRaw);
    } catch {
      return [];
    }
  }

  set storyChips(chips: Array<{ chipId: string; customText?: string }>) {
    this.storyChipsRaw = JSON.stringify(chips);
  }

}
