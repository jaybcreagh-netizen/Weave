import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date, relation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import Friend from './Friend';

export type LifeEventType =
  | 'birthday'
  | 'anniversary'
  | 'new_job'
  | 'moving'
  | 'graduation'
  | 'health_event'
  | 'celebration'
  | 'loss'
  | 'wedding'
  | 'baby'
  | 'other';

export type LifeEventImportance = 'low' | 'medium' | 'high' | 'critical';
export type LifeEventSource = 'manual' | 'keyword_detected' | 'recurring';

export default class LifeEvent extends Model {
  static table = 'life_events';

  static associations: Associations = {
    friends: { type: 'belongs_to', key: 'friend_id' },
  };

  @text('friend_id') friendId!: string;
  @relation('friends', 'friend_id') friend!: Friend;

  @text('event_type') eventType!: LifeEventType;
  @date('event_date') eventDate!: Date;
  @text('title') title!: string;
  @text('notes') notes?: string;
  @text('importance') importance!: LifeEventImportance;
  @text('source') source!: LifeEventSource;
  @field('is_recurring') isRecurring!: boolean;
  @field('reminded') reminded!: boolean;

  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  // Cloud sync fields (v31)
  @field('user_id') userId?: string;
  @field('synced_at') syncedAt?: number;
  @text('sync_status') customSyncStatus?: string;
  @field('server_updated_at') serverUpdatedAt?: number;

}
