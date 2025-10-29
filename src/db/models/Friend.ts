import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date, lazy, children } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'

export default class Friend extends Model {
  static table = 'friends'

  static associations = {
    interaction_friends: { type: 'has_many', foreignKey: 'friend_id' }
  }

  @children('interaction_friends') interactionFriends

  @text('name') name!: string
  @field('dunbar_tier') dunbarTier!: string
  @text('archetype') archetype!: string
  @field('weave_score') weaveScore!: number
  @date('last_updated') lastUpdated!: Date
  @readonly @date('created_at') createdAt!: Date

  @text('photo_url') photoUrl?: string
  @text('notes') notes?: string

  @field('resilience') resilience!: number
  @field('rated_weaves_count') ratedWeavesCount!: number
  @field('momentum_score') momentumScore!: number
  @date('momentum_last_updated') momentumLastUpdated!: Date
  @field('is_dormant') isDormant!: boolean
  @date('dormant_since') dormantSince?: Date

  // Life events and relationship context
  @date('birthday') birthday?: Date
  @date('anniversary') anniversary?: Date
  @text('relationship_type') relationshipType?: string

}
