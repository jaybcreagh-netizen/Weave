/**
 * Standardized Bottom Sheet Components
 *
 * This module provides two sheet implementations for different use cases:
 *
 * 1. StandardBottomSheet - Uses @gorhom/bottom-sheet
 *    - Best for: Most sheet use cases
 *    - Features: Native gesture handling, snap points, smooth performance
 *    - Use when: You need reliable, gesture-driven sheets
 *
 * 2. AnimatedBottomSheet - Uses Reanimated directly
 *    - Best for: Custom animation control, integration with other Reanimated animations
 *    - Features: Full control over animation timing, onCloseComplete callback
 *    - Use when: You need custom animation sequences or completion callbacks
 *
 * Height Variants:
 * - 'action': 35% - Quick action sheets (2-3 options)
 * - 'form': 65% - Forms and moderate content
 * - 'full': 90% - Complex content and long forms
 *
 * @example
 * // Standard usage (recommended for most cases)
 * import { StandardBottomSheet } from '@/shared/ui/Sheet';
 *
 * <StandardBottomSheet
 *   visible={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   height="form"
 *   title="Edit Details"
 * >
 *   <FormContent />
 * </StandardBottomSheet>
 *
 * @example
 * // Animated version for custom control
 * import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
 *
 * <AnimatedBottomSheet
 *   visible={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onCloseComplete={() => resetForm()}
 *   height="action"
 * >
 *   <ActionOptions />
 * </AnimatedBottomSheet>
 */

// Components
export { StandardBottomSheet } from './StandardBottomSheet';
export { AnimatedBottomSheet, type AnimatedBottomSheetRef } from './AnimatedBottomSheet';

// Legacy export for backwards compatibility during migration
export { CustomBottomSheet } from './BottomSheet';

// Types
export type { StandardBottomSheetProps } from './types';

// Constants (for advanced customization)
export {
  SHEET_HEIGHTS,
  SHEET_SPRING_CONFIG,
  SHEET_TIMING,
  BACKDROP_OPACITY,
  BLUR_INTENSITY,
  SHEET_BORDER_RADIUS,
  type SheetHeight,
} from './constants';
