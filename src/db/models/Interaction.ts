import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date, lazy } from '@nozbe/watermelondb/decorators'
import { Q } from '@nozbe/watermelondb'
import { associations } from '@nozbe/watermelondb/Model'

export default class Interaction extends Model {
  static table = 'interactions'

  // This tells WatermelonDB about the join table relationship
  static associations = associations(
    'interaction_friends', { type: 'has_many', foreignKey: 'interaction_id' },
  )

  @date('interaction_date') interactionDate!: Date
  @field('interaction_type') interactionType!: string
  @field('duration') duration?: string
  @field('vibe') vibe?: string
  @text('note') note?: string
  @readonly @date('created_at') createdAt!: Date

  @lazy friends = this.collections.get('friends').query(
    Q.on('interaction_friends', 'interaction_id', this.id)
  )
}