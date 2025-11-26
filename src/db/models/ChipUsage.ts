/**
 * ChipUsage Model
 * Tracks when and how story chips are used for adaptive suggestions
 */

import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';
import { ChipType } from '@/modules/reflection';

export default class ChipUsage extends Model {
  static table = 'chip_usage';

  // References
  @field('chip_id') chipId!: string; // Reference to chip (can be standard or custom)
  @field('interaction_id') interactionId!: string; // Reference to interaction where used
  @field('friend_id') friendId?: string; // Optional: which friend it was used for

  // Metadata
  @field('chip_type') chipType!: ChipType; // For faster filtering
  @field('is_custom') isCustom!: boolean; // Whether this is a custom chip
  @date('used_at') usedAt!: Date; // Timestamp of usage

  // System
  @readonly @date('created_at') createdAt!: Date;

}
