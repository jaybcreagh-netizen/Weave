/**
 * JournalEntry Model
 * Stores ad-hoc journal entries (separate from weekly reflections)
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly, children } from '@nozbe/watermelondb/decorators';

export default class JournalEntry extends Model {
  static table = 'journal_entries';

  static associations = {
    journal_entry_friends: { type: 'has_many', foreignKey: 'journal_entry_id' },
  } as const;

  @children('journal_entry_friends') journalEntryFriends: any;

  // Entry content
  @field('entry_date') entryDate!: number; // Date this entry is associated with
  @text('title') title?: string; // Optional title
  @text('content') content!: string; // Main journal text
  @text('story_chips') storyChipsRaw?: string; // JSON: Array of story chip selections
  @field('is_draft') isDraft?: boolean;
  @field('prompt_used') promptUsed?: string;
  @field('linked_weave_id') linkedWeaveId?: string;

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

}
