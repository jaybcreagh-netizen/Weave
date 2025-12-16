// src/db/models/OracleInsight.ts
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, text } from '@nozbe/watermelondb/decorators';


export interface OracleMetadata {
  tarotCard?: string;
  confidence?: number;
  relatedFriends?: string[];
  [key: string]: unknown;
}

export default class OracleInsight extends Model {
  static table = 'oracle_insights';

  @field('insight_type') insightType!: 'weekly' | 'pattern' | 'suggestion' | 'tarot';
  @field('content') content!: string;
  @text('metadata') _metadata!: string;

  get metadata(): OracleMetadata {
    if (!this._metadata) return {};
    try {
      return JSON.parse(this._metadata);
    } catch {
      return {};
    }
  }

  set metadata(value: OracleMetadata) {
    this._metadata = JSON.stringify(value);
  }
  @date('valid_until') validUntil!: Date; // Cache expiry
  @readonly @date('created_at') createdAt!: Date;
}
