import { Model } from '@nozbe/watermelondb';
import { field, text, date, readonly } from '@nozbe/watermelondb/decorators';

export default class InteractionOutcome extends Model {
  static table = 'interaction_outcomes';

  @text('interaction_id') interactionId!: string;
  @text('friend_id') friendId!: string;

  // Score context
  @field('score_before') scoreBefore!: number;
  @field('score_after') scoreAfter!: number;
  @field('score_change') scoreChange!: number;

  // Interaction details
  @text('category') category!: string;
  @text('duration') duration?: string;
  @text('vibe') vibe?: string;
  @field('had_reflection') hadReflection!: boolean;

  // Effectiveness metrics
  @field('expected_impact') expectedImpact!: number;
  @field('actual_impact') actualImpact!: number;
  @field('effectiveness_ratio') effectivenessRatio!: number;

  // Timestamps
  @date('interaction_date') interactionDate!: Date;
  @date('measured_at') measuredAt!: Date;
  @readonly @date('created_at') createdAt!: Date;
}
