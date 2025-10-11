import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date, lazy } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { associations } from '@nozbe/watermelondb/Model'

export default class Friend extends Model {
  static table = 'friends'

  // This tells WatermelonDB about the join table relationship
  static associations = associations(
    'interaction_friends', { type: 'has_many', foreignKey: 'friend_id' },
  )

  @text('name') name!: string
  @field('dunbar_tier') dunbarTier!: string
  @text('archetype') archetype!: string
  @field('weave_score') weaveScore!: number
  @date('last_updated') lastUpdated!: Date
  @readonly @date('created_at') createdAt!: Date

  @lazy interactions = this.collections.get('interactions').query(
    Q.on('interaction_friends', 'friend_id', this.id)
  )
}