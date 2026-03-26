import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators';
import type {
  OpportunityCopyContext,
  OpportunityExplanation,
  OpportunityPresentationCopy,
  OpportunitySuggestionPayload,
  OpportunityTimeRelevance,
} from '@/modules/interactions/services/opportunity-system/types';

export default class OpportunityPool extends Model {
  static table = 'opportunity_pool';

  @text('opportunity_id') opportunityId!: string;
  @text('friend_id') friendId?: string;
  @text('friend_name') friendName?: string;
  @text('friend_tier') friendTier?: string;
  @text('category') category!: string;
  @text('generator_source') generatorSource!: string;
  @field('urgency') urgency!: number;
  @field('confidence') confidence!: number;
  @text('effort_level') effortLevel!: string;
  @field('estimated_duration') estimatedDuration?: number;
  @field('momentum_score') momentumScore?: number;
  @text('intention_id') intentionId?: string;
  @field('intention_boost') intentionBoost?: number;
  @text('context_hash') contextHash!: string;
  @text('explanation_json') explanationJson!: string;
  @text('time_relevance_json') timeRelevanceJson!: string;
  @text('copy_context_json') copyContextJson?: string;
  @text('suggestion_payload_json') suggestionPayloadJson?: string;
  @text('presentation_copy_json') presentationCopyJson?: string;
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;
  @field('expires_at') expiresAt!: number;
  @field('surfaced_at') surfacedAt?: number;
  @field('surface_count') surfaceCount!: number;
  @field('last_score') lastScore?: number;
  @field('is_active') isActive!: boolean;

  get explanation(): OpportunityExplanation | null {
    try {
      return JSON.parse(this.explanationJson);
    } catch {
      return null;
    }
  }

  get timeRelevance(): OpportunityTimeRelevance | null {
    try {
      return JSON.parse(this.timeRelevanceJson);
    } catch {
      return null;
    }
  }

  get copyContext(): OpportunityCopyContext | null {
    try {
      return this.copyContextJson ? JSON.parse(this.copyContextJson) : null;
    } catch {
      return null;
    }
  }

  get presentationCopy(): OpportunityPresentationCopy | null {
    try {
      return this.presentationCopyJson ? JSON.parse(this.presentationCopyJson) : null;
    } catch {
      return null;
    }
  }

  get suggestionPayload(): OpportunitySuggestionPayload | null {
    try {
      return this.suggestionPayloadJson ? JSON.parse(this.suggestionPayloadJson) : null;
    } catch {
      return null;
    }
  }
}
