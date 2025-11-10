/**
 * JournalEntry Model
 * Stores ad-hoc journal entries (separate from weekly reflections)
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class JournalEntry extends Model {
  static table = 'journal_entries';

  // Entry content
  @field('entry_date') entryDate!: number; // Date this entry is associated with
  @text('title') title?: string; // Optional title
  @text('content') content!: string; // Main journal text
  @text('story_chips') storyChipsRaw?: string; // JSON: Array of story chip selections
  @text('friend_ids') friendIdsRaw?: string; // JSON: Array of friend IDs tagged in this entry

  // Metadata
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

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

  // Friend IDs getter/setter
  get friendIds(): string[] {
    if (!this.friendIdsRaw) return [];
    try {
      return JSON.parse(this.friendIdsRaw);
    } catch {
      return [];
    }
  }

  set friendIds(ids: string[]) {
    this.friendIdsRaw = JSON.stringify(ids);
  }

  // Helper to format entry date
  getFormattedDate(): string {
    const date = new Date(this.entryDate);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Helper to get days ago
  getDaysAgo(): number {
    const now = Date.now();
    const days = Math.floor((now - this.entryDate) / (24 * 60 * 60 * 1000));
    return days;
  }
}
