export const theme = {
    colors: {
        primary: '#B58A6C',
        secondary: '#E5E1DC',
        background: '#F7F5F2',
        foreground: '#3C3C3C',
        muted: '#E5E1DC',
        'muted-foreground': '#8A8A8A',
        destructive: '#ef4444',
        card: '#FFFFFF',
        border: '#E5E1DC',
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
  ...theme,
  colors: {
    ...theme.colors,
    background: '#1C1C1E',
    foreground: '#FFFFFF',
    card: '#2C2C2E',
    border: '#3A3A3C',
    muted: '#3A3A3C',
    'muted-foreground': '#8E8E93',
  }
}

export const getThemeColors = (isDarkMode: boolean) => {
  return isDarkMode ? darkTheme.colors : theme.colors;
}

// Add a constant for spacing to be used in stylesheets
export const spacing = theme.spacing;
