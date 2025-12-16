/**
 * JournalEntry Model
 * Stores ad-hoc journal entries (separate from weekly reflections)
 */

import { Model, Query } from '@nozbe/watermelondb';
import { Associations } from '@nozbe/watermelondb/Model';
import { field, text, date, readonly, children } from '@nozbe/watermelondb/decorators';
import JournalEntryFriend from './JournalEntryFriend';

export default class JournalEntry extends Model {
  static table = 'journal_entries';

  static associations: Associations = {
    journal_entry_friends: { type: 'has_many', foreignKey: 'journal_entry_id' },
  };

  @children('journal_entry_friends') journalEntryFriends!: Query<JournalEntryFriend>;

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

  // Cloud sync fields (v31)
  @field('user_id') userId?: string;
  @field('synced_at') syncedAt?: number;
  @text('sync_status') customSyncStatus?: string;
  @field('server_updated_at') serverUpdatedAt?: number;

  async prepareDestroyWithChildren() {
    const friends = await this.journalEntryFriends.fetch();
    const friendsToDelete = friends.map((friend: JournalEntryFriend) => friend.prepareDestroyPermanently());
    await this.batch(...friendsToDelete);
    return this.prepareDestroyPermanently()
  }

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
