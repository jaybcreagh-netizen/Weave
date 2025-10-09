import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

export default class Friend extends Model {
  static table = 'friends'

  @text('name') name!: string
  @field('status') status!: string
  @text('status_text') statusText!: string
  @text('archetype') archetype!: string
  @field('tier') tier!: string
  @text('photo_url') photoUrl?: string
  @text('notes') notes?: string
  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date
}