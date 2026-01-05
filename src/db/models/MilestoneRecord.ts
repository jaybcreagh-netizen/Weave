import { Model } from '@nozbe/watermelondb'
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators'

export type MilestoneScope = 'lifetime' | 'yearly' | 'streak'

export default class MilestoneRecord extends Model {
    static table = 'milestone_records'

    @text('friend_id') friendId?: string
    @text('milestone_type') milestoneType!: string
    @text('scope') scope!: MilestoneScope

    @field('threshold') threshold!: number
    @date('achieved_at') achievedAt!: Date
    @field('year') year?: number

    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date
}
