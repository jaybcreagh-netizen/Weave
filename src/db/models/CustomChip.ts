/**
 * CustomChip Model
 * Stores user-created custom story chips for adaptive suggestions
 */

import { Model } from '@nozbe/watermelondb';
import { field, text, readonly, date } from '@nozbe/watermelondb/decorators';
import { ChipType } from '@/lib/story-chips';

export default class CustomChip extends Model {
  static table = 'custom_chips';

  // Chip data
  @field('chip_id') chipId!: string; // Unique chip ID
  @field('chip_type') chipType!: ChipType; // Type of chip
  @text('plain_text') plainText!: string; // The chip text
  @text('template') template!: string; // Template (same as plain_text for custom chips)
  @text('components') componentsRaw?: string; // JSON: Optional components

  // Usage tracking
  @field('usage_count') usageCount!: number; // How many times used
  @field('last_used_at') lastUsedAt?: number; // Last time this chip was used

  // Metadata
  @readonly @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  // Components getter/setter
  get components(): Record<string, any> | undefined {
    if (!this.componentsRaw) return undefined;
    try {
      return JSON.parse(this.componentsRaw);
    } catch {
      return undefined;
    }
  }

  set components(components: Record<string, any> | undefined) {
    this.componentsRaw = components ? JSON.stringify(components) : undefined;
  }

  // Convert to StoryChip format
  toStoryChip() {
    return {
      id: this.chipId,
      type: this.chipType,
      template: this.template,
      plainText: this.plainText,
      components: this.components,
      isCustom: true,
      createdAt: this.createdAt.getTime(),
      userId: 'local', // In a multi-user system, this would be the actual user ID
    };
  }

}
