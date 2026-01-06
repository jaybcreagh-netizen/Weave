import { Model } from '@nozbe/watermelondb'
import { field, text, date, json, readonly } from '@nozbe/watermelondb/decorators'

export interface OracleTurnJSON {
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    action?: any
}

export default class OracleConversation extends Model {
    static table = 'oracle_conversations'

    @text('title') title!: string
    @text('context') context!: string // 'consultation' | 'guided_reflection' | etc
    @field('friend_id') friendId?: string // Optional link to a specific friend context

    @text('turns_json') turnsJson!: string

    @field('turn_count') turnCount!: number
    @field('is_archived') isArchived!: boolean

    @date('started_at') startedAt!: Date
    @date('last_message_at') lastMessageAt!: Date

    @readonly @date('created_at') createdAt!: Date
    @date('updated_at') updatedAt!: Date

    get turns(): OracleTurnJSON[] {
        try {
            return JSON.parse(this.turnsJson)
        } catch {
            return []
        }
    }

    set turns(value: OracleTurnJSON[]) {
        this.turnsJson = JSON.stringify(value)
    }
}
