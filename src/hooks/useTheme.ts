import { useUIStore } from '../stores/uiStore';
import { getTheme, getThemeColors } from '../theme';

/**
 * Custom hook to access the current theme based on dark mode state
 * @returns Object with theme, colors, and isDarkMode
 */
export function useTheme() {
  const isDarkMode = useUIStore((state) => state.isDarkMode);

  return {
    theme: getTheme(isDarkMode),
    colors: getThemeColors(isDarkMode),
    isDarkMode,
  };
}
