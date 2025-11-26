// src/modules/intelligence/services/chip-usage.service.ts
import type ChipUsage from '@/db/models/ChipUsage';
import { daysSince } from '@/shared/utils/date-utils';

export function isRecent(chipUsage: ChipUsage): boolean {
  return daysSince(chipUsage.usedAt) <= 30;
}
