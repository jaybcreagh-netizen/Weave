/**
 * KeyboardScrollView
 *
 * A drop-in replacement for ScrollView with sensible keyboard handling defaults.
 * Use this instead of raw ScrollView whenever the scroll content contains
 * TextInputs or other interactive elements.
 *
 * ⚠️ WARNING: Do NOT use this inside a Bottom Sheet. Use `BottomSheetScrollView` from `@gorhom/bottom-sheet` instead.
 *
 *
 * Default behaviors:
 * - keyboardShouldPersistTaps="handled" - Taps on buttons work while keyboard is open
 * - keyboardDismissMode="interactive" - Keyboard dismisses smoothly on scroll (iOS)
 * - showsVerticalScrollIndicator={false} - Cleaner UI (can be overridden)
 *
 * @example
 * // Basic usage
 * <KeyboardScrollView className="flex-1 px-4">
 *   <TextInput ... />
 *   <Button onPress={...} />
 * </KeyboardScrollView>
 *
 * // Horizontal usage
 * <KeyboardScrollView horizontal className="flex-row">
 *   {items.map(item => <Chip key={item.id} />)}
 * </KeyboardScrollView>
 */

import React, { forwardRef } from 'react';
import { ScrollView, ScrollViewProps } from 'react-native';

export interface KeyboardScrollViewProps extends ScrollViewProps {
  /**
   * Controls keyboard behavior when tapping inside ScrollView.
   * - "handled": Taps are handled by children (buttons work while keyboard open)
   * - "always": Always persist keyboard
   * - "never": Always dismiss keyboard on tap
   * @default "handled"
   */
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';

  /**
   * Controls how keyboard dismisses on scroll.
   * - "interactive": Smooth dismiss following scroll gesture (iOS only)
   * - "on-drag": Dismiss when drag begins
   * - "none": Never dismiss on scroll
   * @default "interactive"
   */
  keyboardDismissMode?: 'none' | 'on-drag' | 'interactive';
}

export const KeyboardScrollView = forwardRef<ScrollView, KeyboardScrollViewProps>(
  (
    {
      keyboardShouldPersistTaps = 'handled',
      keyboardDismissMode = 'interactive',
      showsVerticalScrollIndicator = false,
      showsHorizontalScrollIndicator = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <ScrollView
        ref={ref}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        keyboardDismissMode={keyboardDismissMode}
        showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
);

KeyboardScrollView.displayName = 'KeyboardScrollView';

export default KeyboardScrollView;
