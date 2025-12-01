import { Model, Query } from '@nozbe/watermelondb';
import { field, date, text, writer, readonly, children } from '@nozbe/watermelondb/decorators'
import IntentionFriend from './IntentionFriend';

export default class Intention extends Model {
  static table = 'intentions';

  static associations = {
    intention_friends: { type: 'has_many', foreignKey: 'intention_id' },
  };

  @children('intention_friends') intentionFriends!: Query<IntentionFriend>;


  // Flexible description - can be vague or specific
  @text('description') description?: string;

  // Optional category if they have specific activity in mind
  @field('interaction_category') interactionCategory?: string;

  // Status tracking
  @field('status') status!: 'active' | 'converted' | 'dismissed' | 'fulfilled';

  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  // Cloud sync fields (v31)
  @field('user_id') userId?: string;
  @field('synced_at') syncedAt?: number;
  @text('sync_status') syncStatus?: string;
  @field('server_updated_at') serverUpdatedAt?: number;

  async prepareDestroyWithChildren() {
    // Delete all associated intention friends
    const friends = await this.intentionFriends.fetch();
    const friendsToDelete = friends.map(friend => friend.prepareDestroyPermanently());
    await this.batch(...friendsToDelete);

    return this.prepareDestroyPermanently();
  }

  // Track when last reminded (for suggestion engine)
  @date('last_reminded_at') lastRemindedAt?: Date;

  // v29: Fulfillment tracking for pattern analysis and celebration
  @text('linked_interaction_id') linkedInteractionId?: string; // The interaction that fulfilled this intention
  @date('fulfilled_at') fulfilledAt?: Date; // When it was fulfilled
  @field('days_to_fulfillment') daysToFulfillment?: number; // Time from creation to fulfillment
}
