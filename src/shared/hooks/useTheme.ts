import { useMemo } from 'react';
import { useUIStore } from '@/stores/uiStore';
import {
  getTheme,
  getThemeColors,
  getTokens,
  typography,
  spacing,
  layout,
  radius,
  shadows
} from '@/shared/theme/theme';

/**
 * Custom hook to access the current theme based on dark mode state
 * @returns Object with theme, colors, and isDarkMode
 */
export function useTheme() {
  const isDarkMode = useUIStore((state) => state.isDarkMode);

  return useMemo(() => ({
    // Legacy support
    theme: getTheme(isDarkMode),
    colors: getThemeColors(isDarkMode),

    // New Design System
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
