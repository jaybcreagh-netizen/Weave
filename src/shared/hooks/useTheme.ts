import { useMemo } from 'react';
import { useGlobalUI } from '@/shared/context/GlobalUIContext';
import {
  getTokens,
  createLegacyTheme,
  typography,
  spacing,
  layout,
  radius,
  shadows
} from '@/shared/theme/tokens';

export function useTheme() {
  const { isDarkMode } = useGlobalUI();

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
    isDark: isDarkMode
  }), [isDarkMode]);
}
