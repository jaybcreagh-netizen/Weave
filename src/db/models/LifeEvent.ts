import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date, relation } from '@nozbe/watermelondb/decorators';
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

  static associations = {
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

}
