import { Model } from '@nozbe/watermelondb'
import { field, text, date, json, readonly } from '@nozbe/watermelondb/decorators'

export type InsightType = 'friend' | 'pattern' | 'milestone'
export type InsightStatus = 'unseen' | 'seen' | 'acted_on' | 'dismissed' | 'expired' | 'invalidated'
export type InsightFeedback = 'helpful' | 'not_helpful' | null

export default class ProactiveInsight extends Model {
    static table = 'proactive_insights'

    @text('rule_id') ruleId!: string
    @text('type') type!: InsightType

    @text('friend_id') friendId?: string

    @text('headline') headline!: string
    @text('body') body!: string
    @text('grounding_data_json') groundingDataJson!: string

    @text('action_type') actionType!: string
    @text('action_params_json') actionParamsJson!: string
    @text('action_label') actionLabel!: string

    @field('severity') severity?: number

    @date('generated_at') generatedAt!: Date
    @date('expires_at') expiresAt!: Date

    @text('status') status!: InsightStatus
    @text('feedback') feedback?: InsightFeedback
    @date('status_changed_at') statusChangedAt?: Date

    @readonly @date('created_at') createdAt!: Date
    @readonly @date('updated_at') updatedAt!: Date

    get groundingData(): any {
        if (!this.groundingDataJson) return {}
        try {
            return JSON.parse(this.groundingDataJson)
        } catch {
            return {}
        }
    }

    get actionParams(): any {
        if (!this.actionParamsJson) return {}
        try {
            return JSON.parse(this.actionParamsJson)
        } catch {
            return {}
        }
    }
}
