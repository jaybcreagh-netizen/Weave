
import { Model } from '@nozbe/watermelondb'
import { field, date, text } from '@nozbe/watermelondb/decorators'

export default class UserFact extends Model {
    static table = 'user_facts'

    @text('fact_content') factContent!: string
    @text('category') category!: string // 'social_preference', 'logistics', 'value'
    @field('confidence') confidence!: number
    @text('source') source!: string // 'oracle_feedback', 'explicit_entry'
    @text('relevant_friend_id') relevantFriendId?: string

    @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date
}
