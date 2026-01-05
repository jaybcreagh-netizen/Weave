/**
 * LLMQualityLog Model
 * Tracks LLM request/response quality for prompt iteration.
 * 
 * Used to:
 * - Monitor latency and token usage per prompt
 * - Track user feedback (accepted/rejected/edited)
 * - Identify prompts that need improvement
 * - Debug production issues
 */

import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators'

export type UserFeedback = 'accepted' | 'rejected' | 'edited'

export default class LLMQualityLog extends Model {
    static table = 'llm_quality_log'

    @text('prompt_id') promptId!: string
    @text('prompt_version') promptVersion!: string
    @text('input_hash') inputHash!: string
    @text('output_hash') outputHash!: string
    @field('latency_ms') latencyMs!: number
    @field('tokens_used') tokensUsed!: number
    @text('error_type') errorType?: string
    @text('user_feedback') userFeedback?: UserFeedback
    @readonly @date('created_at') createdAt!: Date

    /** Check if this was a successful request */
    get isSuccess(): boolean {
        return !this.errorType
    }

    /** Check if this was a slow request (>3s) */
    get isSlow(): boolean {
        return this.latencyMs > 3000
    }

    /** Check if user provided positive feedback */
    get wasAccepted(): boolean {
        return this.userFeedback === 'accepted'
    }

    /** Calculate approximate cost in cents (Gemini Flash pricing) */
    get estimatedCostCents(): number {
        // Gemini 2.0 Flash: ~$0.075 per 1M input tokens, ~$0.30 per 1M output tokens
        // Approximate: ~$0.15 per 1M tokens average
        return (this.tokensUsed / 1_000_000) * 15
    }
}
