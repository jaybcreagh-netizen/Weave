/**
 * Standardized animation constants for bottom sheets
 *
 * These values ensure consistent, smooth animations across all modal interactions.
 * The spring configuration provides a gentle, natural feel without excessive bounce.
 */

/**
 * Standard spring animation configuration
 * - damping: 28 provides smooth deceleration without bounce
 * - stiffness: 220 gives responsive but not jarring movement
 */
export const SHEET_SPRING_CONFIG = {
  damping: 28,
  stiffness: 220,
} as const;

/**
 * Standard timing durations (in milliseconds)
 */
export const SHEET_TIMING = {
  /** Backdrop fade in/out duration */
  backdropFade: 200,
  /** Sheet exit animation duration */
  sheetExit: 200,
  /** Delay before cleanup after close */
  cleanupDelay: 250,
} as const;

/**
 * Sheet height variants as percentage of screen height
 *
 * @variant action - Small action sheets for quick choices (35%)
 * @variant form - Medium sheets for forms and inputs (65%)
 * @variant full - Large sheets for complex content (90%)
 */
export const SHEET_HEIGHTS = {
  action: '35%',
  form: '65%',
  full: '90%',
} as const;

export type SheetHeight = keyof typeof SHEET_HEIGHTS;

/**
 * Backdrop opacity values
 */
export const BACKDROP_OPACITY = {
  visible: 0.5,
  hidden: 0,
} as const;

/**
 * Blur intensity values for backdrop
 */
export const BLUR_INTENSITY = {
  light: 15,
  dark: 25,
} as const;

/**
 * Standard border radius for sheet corners
 */
export const SHEET_BORDER_RADIUS = 24;
