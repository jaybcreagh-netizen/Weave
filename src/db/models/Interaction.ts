import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

export default class Interaction extends Model {
  static table = 'interactions'

  @text('friend_ids') friendIds!: string
  @field('type') type!: string
  @text('activity') activity!: string
  @text('mode') mode?: string
  @date('date') date!: Date
  @field('status') status!: string
  @text('moon_phase') moonPhase?: string
  @text('notes') notes?: string
  @text('title') title?: string
  @text('location') location?: string
  @text('tags') tags?: string
  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date
}