import { Model } from '@nozbe/watermelondb';
import { field, text, relation } from '@nozbe/watermelondb/decorators';
import JournalEntry from './JournalEntry';
import Friend from './Friend';

export default class JournalEntryFriend extends Model {
  static table = 'journal_entry_friends';

  @field('journal_entry_id') journalEntryId!: string;
  @field('friend_id') friendId!: string;

  @relation('journal_entries', 'journal_entry_id') journalEntry!: JournalEntry;
  @relation('friends', 'friend_id') friend!: Friend;
}
