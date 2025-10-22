export const lightTheme = {
  colors: {
      primary: '#B58A6C',
      secondary: '#E5E1DC',
      background: '#FFF14F17',
      foreground: '#3C3C3C',
      muted: '#E5E1DC',
      'muted-foreground': '#8A8A8A',
      destructive: '#ef4444',
      card: '#FFFFFF',
      'card-foreground': '#3C3C3C',
      border: '#E5E1DC',
      input: 'transparent',
      'input-background': '#FFFFFF',
      accent: '#B58A6C',
      'accent-foreground': '#FFFFFF',
      'primary-foreground': '#FFFFFF',
      'secondary-foreground': '#3C3C3C',
      'destructive-foreground': '#FFFFFF',
      ring: '#B58A6C',
      tier: {
          inner: '#D4AF37',   // Gold
          close: '#A9A9A9',   // Darker Silver for contrast
          community: '#CD7F32',// Bronze
      },
      living: {
        healthy: ['#6EE7B7', '#34D399'],   // A gentle, warm mint green
        stable: ['#FCD34D', '#FBBF24'],    // A vibrant, friendly gold
        attention: ['#FCA5A5', '#F87171'], // A soft, warm coral-red (less alarming)
      },
      // Timeline colors
      'weave-vibrant': '#10b981',
      'weave-neutral': '#f59e0b',
      'weave-fading': '#8A8A8A',
      'ring-warm': '#fbbf24',
      'ring-neutral': '#9ca3af',
      'ring-cool': '#6b7280',
  },
  spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 40,
  },
};

export const darkTheme = {
  colors: {
      // Mystic Arcane Dark Mode
      primary: '#7c3aed',
      secondary: '#3d2f54',
      background: '#1a1625',
      foreground: '#e6e4f0',
      muted: '#3d2f54',
      'muted-foreground': '#9d95b2',
      destructive: '#ef4444',
      card: '#252138',
      'card-foreground': '#e6e4f0',
      border: 'rgba(139, 92, 246, 0.15)',
      input: 'transparent',
      'input-background': '#252138',
      accent: '#8b5cf6',
      'accent-foreground': '#f8fafc',
      'primary-foreground': '#f8fafc',
      'secondary-foreground': '#e6e4f0',
      'destructive-foreground': '#f8fafc',
      ring: '#7c3aed',
      tier: {
          inner: '#fbbf24',   // Gold
          close: '#e5e7eb',   // Silver
          community: '#d97706', // Bronze
      },
      living: {
        healthy: ['#10b981', '#059669'],   // Green
        stable: ['#f59e0b', '#d97706'],    // Amber
        attention: ['#ef4444', '#dc2626'], // Red
      },
      // Timeline colors for dark mode
      'weave-vibrant': '#10b981',
      'weave-neutral': '#f59e0b',
      'weave-fading': '#9d95b2',
      'ring-warm': '#fbbf24',
      'ring-neutral': '#9ca3af',
      'ring-cool': '#6b7280',
      // Chart colors
      'chart-1': '#7c3aed',
      'chart-2': '#10b981',
      'chart-3': '#f59e0b',
      'chart-4': '#ef4444',
      'chart-5': '#6366f1',
  },
  spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 40,
  },
};

// Default export for backward compatibility
export const theme = lightTheme;

export const getThemeColors = (isDarkMode: boolean) => {
  return isDarkMode ? darkTheme.colors : lightTheme.colors;
}

export const getTheme = (isDarkMode: boolean) => {
  return isDarkMode ? darkTheme : lightTheme;
}

// Add a constant for spacing to be used in stylesheets
export const spacing = lightTheme.spacing;
