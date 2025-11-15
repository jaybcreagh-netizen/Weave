// src/db/models/OracleUsage.ts
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export default class OracleUsage extends Model {
  static table = 'oracle_usage';

  @field('endpoint') endpoint!: string; // 'journal', 'weekly', etc.
  @field('tokens_used') tokensUsed!: number;
  @field('cost_cents') costCents!: number;
  @readonly @date('created_at') createdAt!: Date;
}
