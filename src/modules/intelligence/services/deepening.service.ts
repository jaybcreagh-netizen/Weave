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
  isOracleGuided?: boolean;
}

/**
 * Calculate deepening level based on reflection data
 *
 * Scale:
 * - None: No reflection
 * - Light: 1 chip OR just notes OR Oracle with 1-2 turns
 * - Moderate: 2 chips OR Oracle with 3 turns
 * - Deep: 3+ chips OR 2 chips + notes OR Oracle with 4+ turns or deepening (gets sparkle badge)
 * - Profound: 5 chips OR Oracle with deepening + long content (complete story)
 */
export function calculateDeepeningLevel(reflection?: StructuredReflection): DeepeningMetrics {
  if (!reflection || (!reflection.chips?.length && !reflection.customNotes && !reflection.oracleGuided)) {
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
  const oracle = reflection.oracleGuided;

  // Check if this is an Oracle-guided reflection
  if (oracle) {
    return calculateOracleDeepening(oracle, chipCount, hasCustomNotes);
  }

  // Original chip-based calculation
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
 * Calculate deepening level for Oracle-guided reflections
 *
 * Considers:
 * - turnCount: Number of Q&A exchanges (more = richer)
 * - hasDeepened: Used "Go Deeper" feature (shows extra effort)
 * - contentLength: Longer content = more thoughtful
 * - extractedThemes: More themes = varied/rich content
 * - Any existing chips from manual reflection
 */
function calculateOracleDeepening(
  oracle: NonNullable<StructuredReflection['oracleGuided']>,
  chipCount: number,
  hasCustomNotes: boolean
): DeepeningMetrics {
  const { turnCount, hasDeepened, contentLength, extractedThemes } = oracle;
  const themeCount = extractedThemes?.length || 0;

  let level: DeepeningLevel;
  let completionPercentage: number;
  let intensity: number;

  // Calculate a richness score based on multiple factors
  let richness = 0;

  // Turn count contributes to richness (max 4 points)
  richness += Math.min(turnCount, 4);

  // Deepening adds significant richness (2 points)
  if (hasDeepened) {
    richness += 2;
  }

  // Content length contributes (0-3 points)
  if (contentLength > 500) richness += 3;
  else if (contentLength > 200) richness += 2;
  else if (contentLength > 50) richness += 1;

  // Extracted themes contribute (0-2 points)
  if (themeCount >= 4) richness += 2;
  else if (themeCount >= 2) richness += 1;

  // Existing chips add to richness
  richness += chipCount;

  // Determine level based on richness score
  if (richness >= 8 || (hasDeepened && contentLength > 300)) {
    // Profound: Used deepening with substantial content OR very high richness
    level = 'profound';
    completionPercentage = 100;
    intensity = 1.0;
  } else if (richness >= 5 || (turnCount >= 4 && contentLength > 150)) {
    // Deep: Good engagement with Oracle
    level = 'deep';
    completionPercentage = Math.min(90, 60 + richness * 5);
    intensity = 0.75;
  } else if (richness >= 3 || turnCount >= 3) {
    // Moderate: Basic engagement
    level = 'moderate';
    completionPercentage = Math.min(60, 30 + richness * 10);
    intensity = 0.5;
  } else {
    // Light: Minimal Oracle use
    level = 'light';
    completionPercentage = 20;
    intensity = 0.3;
  }

  return {
    level,
    chipCount,
    hasCustomNotes,
    completionPercentage,
    intensity,
    isOracleGuided: true,
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
