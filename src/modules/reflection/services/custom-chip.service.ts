// src/modules/intelligence/services/custom-chip.service.ts
import type CustomChip from '@/db/models/CustomChip';

export async function incrementUsage(customChip: CustomChip): Promise<void> {
  await customChip.update(chip => {
    chip.usageCount = chip.usageCount + 1;
    chip.lastUsedAt = Date.now();
  });
}
