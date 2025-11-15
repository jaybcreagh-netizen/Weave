// src/db/models/OracleInsight.ts
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly, json } from '@nozbe/watermelondb/decorators';

const sanitizeMetadata = (rawJson) => {
  // A basic sanitizer function, customize as needed
  if (typeof rawJson !== 'object' || rawJson === null) {
    return {};
  }
  // Example: ensure no deeply nested objects are stored, or strip certain keys
  return rawJson;
};
export default class OracleInsight extends Model {
  static table = 'oracle_insights';

  @field('insight_type') insightType!: 'weekly' | 'pattern' | 'suggestion' | 'tarot';
  @field('content') content!: string;
  @json('metadata', sanitizeMetadata) metadata!: any;
  @date('valid_until') validUntil!: Date; // Cache expiry
  @readonly @date('created_at') createdAt!: Date;
}
