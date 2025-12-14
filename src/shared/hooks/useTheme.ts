import { useMemo } from 'react';
import { useUIStore } from '@/shared/stores/uiStore';
import {
  getTokens,
  createLegacyTheme,
  typography,
  spacing,
  layout,
  radius,
  shadows
} from '@/shared/theme/tokens';

/**
 * Custom hook to access the current theme based on dark mode state
 * @returns Object with theme, colors, and isDarkMode
 */
export function useTheme() {
  const isDarkMode = useUIStore((state) => state.isDarkMode);

  return useMemo(() => ({
    // Legacy API (backward compatible)
    ...createLegacyTheme(isDarkMode),

    // New API
    tokens: getTokens(isDarkMode),
    typography,
    spacing,
    layout,
    radius,
    shadows,

    // State
    isDarkMode,
  }), [isDarkMode]);
}
