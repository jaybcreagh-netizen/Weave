import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators';
import type {
  OpportunityPresentationCopy,
  SelectorPacingSnapshot,
  SelectorSurfaceRequestKind,
} from '@/modules/interactions/services/opportunity-system/types';

export default class SurfacingLog extends Model {
  static table = 'surfacing_log';

  @text('opportunity_pool_id') opportunityPoolId!: string;
  @text('event_type') eventType!: string;
  @field('timestamp') timestamp!: number;
  @text('window') window?: string;
  @field('composite_score') compositeScore?: number;
  @text('score_breakdown_json') scoreBreakdownJson?: string;
  @text('feedback_type') feedbackType?: string;
  @text('surface_source') surfaceSource?: string;
  @text('selection_reason') selectionReason?: string;
  @text('surface_slot') surfaceSlot?: string;
  @text('opportunity_source') opportunitySource?: string;
  @text('threshold_variant') thresholdVariant?: string;
  @text('copy_variant') copyVariant?: string;
  @text('quiet_reason') quietReason?: string;
  @text('surface_request_kind') surfaceRequestKind?: SelectorSurfaceRequestKind;
  @text('pacing_snapshot_json') pacingSnapshotJson?: string;
  @text('presentation_copy_json') presentationCopyJson?: string;
  @readonly @date('created_at') createdAt!: Date;

  get scoreBreakdown(): Record<string, number> {
    try {
      return this.scoreBreakdownJson ? JSON.parse(this.scoreBreakdownJson) : {};
    } catch {
      return {};
    }
  }

  get presentationCopy(): OpportunityPresentationCopy | null {
    try {
      return this.presentationCopyJson ? JSON.parse(this.presentationCopyJson) : null;
    } catch {
      return null;
    }
  }

  get pacingSnapshot(): SelectorPacingSnapshot | null {
    try {
      return this.pacingSnapshotJson ? JSON.parse(this.pacingSnapshotJson) : null;
    } catch {
      return null;
    }
  }
}
