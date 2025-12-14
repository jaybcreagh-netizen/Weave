import { type StructuredReflection } from '@/shared/types/legacy-types';

/**
 * Deepening levels based on how much reflection was added
 */
export type DeepeningLevel = 'none' | 'light' | 'moderate' | 'deep' | 'profound';

export interface DeepeningMetrics {
  level: DeepeningLevel;
  chipCount: number;
  hasCustomNotes: boolean;
  completionPercentage: number; // 0-100
  intensity: number; // 0-1 for visual effects
}

/**
 * Calculate deepening level based on reflection data
 *
 * Scale:
 * - None: No reflection
 * - Light: 1 chip OR just notes
 * - Moderate: 2 chips
 * - Deep: 3+ chips OR 2 chips + notes (gets single sparkle badge)
 * - Profound: 5 chips (complete story only)
 */
export function calculateDeepeningLevel(reflection?: StructuredReflection): DeepeningMetrics {
  if (!reflection || (!reflection.chips?.length && !reflection.customNotes)) {
    return {
      level: 'none',
      chipCount: 0,
      hasCustomNotes: false,
      completionPercentage: 0,
      intensity: 0,
    };
  }

  const chipCount = reflection.chips?.length || 0;
  const hasCustomNotes = !!reflection.customNotes && reflection.customNotes.trim().length > 0;

  // Max is 5 chip types (activity, people, topic, feeling, moment)
  const maxChips = 5;
  let level: DeepeningLevel;
  let completionPercentage: number;
  let intensity: number;

  if (chipCount === 0 && hasCustomNotes) {
    // Only custom notes
    level = 'light';
    completionPercentage = 20;
    intensity = 0.2;
  } else if (chipCount === 1) {
    // 1 chip (± notes)
    level = 'light';
    completionPercentage = 20;
    intensity = 0.3;
  } else if (chipCount === 2 && !hasCustomNotes) {
    // 2 chips only
    level = 'moderate';
    completionPercentage = 40;
    intensity = 0.5;
  } else if (chipCount === 2 && hasCustomNotes) {
    // 2 chips + notes (gets sparkle badge)
    level = 'deep';
    completionPercentage = 60;
    intensity = 0.7;
  } else if (chipCount >= 3 && chipCount < 5) {
    // 3-4 chips (gets sparkle badge)
    level = 'deep';
    completionPercentage = Math.min(80, (chipCount / maxChips) * 100);
    intensity = 0.75;
  } else if (chipCount >= 5) {
    // 5 chips (complete story) - Profound badge
    level = 'profound';
    completionPercentage = 100;
    intensity = 1.0;
  } else {
    level = 'moderate';
    completionPercentage = 50;
    intensity = 0.5;
  }

  return {
    level,
    chipCount,
    hasCustomNotes,
    completionPercentage,
    intensity,
  };
}

/**
 * Get visual styling based on deepening level
 */
export function getDeepeningVisuals(metrics: DeepeningMetrics, colors: any, isDarkMode: boolean) {
  const { level, intensity } = metrics;

  // Border intensity
  const borderOpacity = Math.floor(intensity * 100);
  const borderWidth = 1 + intensity; // 1px to 2px

  // Shadow intensity
  const shadowOpacity = isDarkMode ? intensity * 0.4 : intensity * 0.3;
  const shadowRadius = 4 + intensity * 8; // 4px to 12px

  // Tint intensity
  const baseTintOpacity = isDarkMode ? 40 : 15;
  const tintOpacity = Math.floor(baseTintOpacity + intensity * 30); // e.g., 40-70 for dark, 15-45 for light

  // Badge text
  const badgeText = {
    none: '',
    light: 'Started',
    moderate: 'Deepened',
    deep: 'Rich',
    profound: 'Profound',
  }[level];

  // Badge emoji
  const badgeEmoji = {
    none: '',
    light: '',
    moderate: '',
    deep: '✨',
    profound: '🔮',
  }[level];

  return {
    borderWidth,
    borderOpacity,
    shadowOpacity,
    shadowRadius,
    tintOpacity,
    badgeText,
    badgeEmoji,
  };
}
