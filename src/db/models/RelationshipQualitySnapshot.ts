import { Model } from '@nozbe/watermelondb';
import { field, date, text, readonly } from '@nozbe/watermelondb/decorators';

/**
 * RelationshipQualitySnapshot
 * 
 * Stores periodic RQS calculations for each friendship.
 * RQS is never shown as a number - it produces human-readable texture and trajectory.
 */
export default class RelationshipQualitySnapshot extends Model {
    static table = 'relationship_quality_snapshots';

    @text('friend_id') friendId!: string;
    @field('calculated_at') calculatedAt!: number;

    // Component scores (0-100)
    @field('depth_score') depthScore!: number;
    @field('consistency_score') consistencyScore!: number;
    @field('reciprocity_score') reciprocityScore!: number; // 0-1 where 0.5 = balanced
    @field('growth_score') growthScore!: number;
    @field('resilience_score') resilienceScore!: number;

    // Composite score (weighted average)
    @field('composite_score') compositeScore!: number;

    // Human-readable outputs
    @text('texture_json') textureJson!: string;
    @text('trajectory') trajectory!: string; // 'strengthening' | 'stable' | 'fading' | 'new'
    @text('notable_patterns_json') notablePatternsJson?: string;

    @readonly @date('created_at') createdAt!: Date;
    @date('updated_at') updatedAt!: Date;

    // Getters for parsed JSON fields
    get texture(): RelationshipTexture | null {
        try {
            return JSON.parse(this.textureJson);
        } catch {
            return null;
        }
    }

    get notablePatterns(): string[] {
        try {
            return this.notablePatternsJson ? JSON.parse(this.notablePatternsJson) : [];
        } catch {
            return [];
        }
    }
}

// Type definitions
export interface RelationshipTexture {
    depth: 'acquaintance' | 'friendly' | 'meaningful' | 'profound';
    rhythm: 'sporadic' | 'occasional' | 'regular' | 'frequent';
    balance: 'you_carry' | 'balanced' | 'they_carry';
    summary: string;
}
