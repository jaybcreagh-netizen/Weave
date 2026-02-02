import { Model } from '@nozbe/watermelondb';
import { field, date, text, readonly } from '@nozbe/watermelondb/decorators';

/**
 * RelationshipInsight
 * 
 * Stores AI-generated insights about relationships.
 * Replaces the badge/achievement popup system with understanding-based insights.
 */

// Type definitions
export type InsightType =
    | 'observation'       // Pattern noticed
    | 'milestone'         // Narrative moment reached
    | 'reflection_prompt' // Question to consider
    | 'gentle_nudge'      // Soft suggestion
    | 'celebration';      // Something to feel good about

export type InsightTone =
    | 'curious'      // "I noticed..."
    | 'affirming'    // "You've been..."
    | 'celebratory'  // "Something special..."
    | 'gentle'       // "It might be worth..."
    | 'reflective';  // "Have you considered..."

export type InsightStatus = 'active' | 'viewed' | 'acted_on' | 'dismissed' | 'expired';

export interface InsightGrounding {
    signals: string[];
    dataPoints: Record<string, unknown>;
    confidence: number;
}

export interface SuggestedAction {
    type: 'reflect' | 'reach_out' | 'plan' | 'journal' | 'oracle_chat';
    label: string;
    params?: Record<string, unknown>;
}

export default class RelationshipInsight extends Model {
    static table = 'relationship_insights';

    // Type and tone
    @text('insight_type') insightType!: InsightType;
    @text('tone') tone!: InsightTone;

    // Content
    @text('opener') opener!: string;
    @text('message') message!: string;
    @text('context') context?: string;

    // Relation (optional)
    @text('friend_id') friendId?: string;
    @text('friend_name') friendName?: string;

    // Grounding data
    @text('grounding_json') groundingJson!: string;
    @text('suggested_action_json') suggestedActionJson?: string;

    // Lifecycle
    @text('status') status!: InsightStatus;
    @field('generated_at') generatedAt!: number;
    @field('expires_at') expiresAt!: number;
    @field('viewed_at') viewedAt?: number;
    @field('acted_on_at') actedOnAt?: number;

    @readonly @date('created_at') createdAt!: Date;
    @date('updated_at') updatedAt!: Date;

    // Parsed getters
    get grounding(): InsightGrounding | null {
        try {
            return JSON.parse(this.groundingJson);
        } catch {
            return null;
        }
    }

    get suggestedAction(): SuggestedAction | null {
        if (!this.suggestedActionJson) return null;
        try {
            return JSON.parse(this.suggestedActionJson);
        } catch {
            return null;
        }
    }

    get isExpired(): boolean {
        return Date.now() > this.expiresAt;
    }

    get isActive(): boolean {
        return this.status === 'active' && !this.isExpired;
    }
}
