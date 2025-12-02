/**
 * Weave Design System Tokens
 * 
 * Light Mode: Warm, earthy, handcrafted — aged paper, natural linen, afternoon sun
 * Dark Mode: Refined mystical — warm shadows, aged gold, contemplative depth
 * 
 * Usage:
 * - Legacy: const { colors } = useTheme() — backward compatible
 * - New: const tokens = getTokens(isDarkMode) — preferred going forward
 */

// ============================================
// PRIMITIVE PALETTE (internal use only)
// ============================================

const palette = {
  // Warm Neutrals (for light mode)
  cream: {
    50: '#FDFCFA',
    100: '#F7F5F2',
    200: '#EFEBE6',
  },
  stone: {
    50: '#FAFAF9',
    100: '#F5F5F4',
    200: '#E7E5E4',
    300: '#D6D3D1',
    400: '#A8A29E',
    500: '#78716C',
    600: '#57534E',
    700: '#44403C',
    800: '#292524',
    900: '#1C1917',
  },

  // Mystical Darks (for dark mode — warm plum-charcoal, not cold gray)
  // Mystical Darks (for dark mode — deep mystical purple)
  night: {
    950: '#0D0B14',      // Deepest void purple
    900: '#14101F',      // Primary background - deep mystical purple
    850: '#1C1629',      // Slightly lifted
    800: '#241C33',      // Elevated surfaces (cards)
    750: '#2D233D',      // Subtle backgrounds
    700: '#392E4D',      // Borders
    600: '#4D3E66',      // Strong borders
    500: '#6B5A8A',      // Disabled states
    400: '#9D8CB0',      // Muted text (dusty lavender)
    300: '#C4B5D6',      // Secondary text
  },

  // Amber/Gold spectrum
  amber: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
    950: '#451A03',
  },

  // Aged Gold (for dark mode accents — dusty, not bright)
  gold: {
    light: '#D4A855',    // Primary accent in dark
    muted: '#C9985A',    // Secondary accent
    subtle: '#8B7355',   // Tertiary
    dim: '#5C4D3D',      // Very subtle backgrounds
  },

  // Mystical accent (for special moments only)
  mystic: {
    400: '#A78BFA',      // Bright violet (sparingly)
    500: '#8B5CF6',      // Medium violet
    600: '#7C3AED',      // Deep violet
    900: '#2E1F47',      // Very dark violet
  },

  // Semantic colors
  red: {
    400: '#F87171',
    500: '#EF4444',
    600: '#DC2626',
    900: '#7F1D1D',
    950: '#3B1010',
  },
  emerald: {
    400: '#34D399',
    500: '#10B981',
    600: '#059669',
    900: '#064E3B',
    950: '#021F17',
  },
  sky: {
    400: '#38BDF8',
    500: '#0EA5E9',
    600: '#0284C7',
    900: '#0C4A6E',
    950: '#071D2E',
  },

  // Tier colors (consistent across modes)
  tier: {
    gold: '#EAB308',
    silver: '#9CA3AF',
    bronze: '#CD7F32',
  },

  // Pure
  white: '#FFFFFF',
  black: '#000000',
} as const;

// ============================================
// SEMANTIC TOKENS: LIGHT MODE
// ============================================

const lightTokens = {
  // Backgrounds
  background: palette.cream[50],
  backgroundElevated: palette.cream[100],
  backgroundSubtle: palette.cream[100],
  backgroundMuted: palette.amber[50],

  // Foregrounds
  foreground: palette.stone[900],
  foregroundMuted: palette.stone[500],
  foregroundSubtle: palette.stone[400],

  // Borders
  border: palette.stone[200],
  borderSubtle: palette.stone[100],
  borderFocus: palette.amber[600],

  // Primary (warm amber-brown)
  primary: palette.amber[800],
  primaryHover: palette.amber[900],
  primaryForeground: palette.white,
  primaryMuted: palette.amber[600],
  primarySubtle: palette.amber[100],

  // Secondary
  secondary: palette.stone[200],
  secondaryHover: palette.stone[300],
  secondaryForeground: palette.stone[800],

  // Semantic status colors
  success: palette.emerald[600],
  successForeground: palette.white,
  successSubtle: '#D1FAE5',

  warning: palette.amber[600],
  warningForeground: palette.white,
  warningSubtle: palette.amber[100],

  destructive: palette.red[600],
  destructiveForeground: palette.white,
  destructiveSubtle: '#FEE2E2',

  info: palette.sky[600],
  infoForeground: palette.white,
  infoSubtle: '#E0F2FE',

  // Component tokens
  card: {
    background: palette.cream[50],
    foreground: palette.stone[900],
    border: palette.stone[200],
  },
  input: {
    background: palette.cream[50],
    border: palette.stone[200],
    borderFocus: palette.amber[600],
    placeholder: palette.stone[400],
  },

  // Domain-specific tokens
  tier: {
    inner: palette.tier.gold,
    close: palette.tier.silver,
    community: palette.tier.bronze,
  },
  weave: {
    vibrant: palette.emerald[500],
    stable: palette.amber[500],
    fading: palette.stone[400],
  },

  // Season gradients (for SocialSeasonWidget)
  season: {
    resting: ['#78716C', '#57534E'] as const,
    balanced: ['#D97706', '#B45309'] as const,
    blooming: ['#059669', '#047857'] as const,
  },

  // Shadow configuration
  shadow: {
    color: palette.stone[900],
    opacity: {
      sm: 0.03,
      md: 0.05,
      lg: 0.08,
    },
  },
} as const;

// ============================================
// SEMANTIC TOKENS: DARK MODE (Refined Mystical)
// ============================================

const darkTokens = {
  // Backgrounds (warm plum-charcoal, not cold gray)
  background: palette.night[900],
  backgroundElevated: palette.night[800],
  backgroundSubtle: palette.night[750],
  backgroundMuted: palette.night[800],

  // Foregrounds (warm cream, not stark white)
  foreground: '#F5F2ED',
  foregroundMuted: palette.night[400],      // Dusty lavender
  foregroundSubtle: palette.night[500],

  // Borders (warm plum-gray)
  border: palette.night[700],
  borderSubtle: palette.night[750],
  borderFocus: palette.gold.light,

  // Primary (aged gold, not bright yellow)
  primary: palette.gold.light,
  primaryHover: palette.gold.muted,
  primaryForeground: palette.night[900],
  primaryMuted: palette.gold.muted,
  primarySubtle: palette.gold.dim,

  // Secondary
  secondary: palette.night[700],
  secondaryHover: palette.night[600],
  secondaryForeground: '#F5F2ED',

  // Semantic status colors (slightly muted for dark mode)
  success: palette.emerald[400],
  successForeground: palette.night[900],
  successSubtle: palette.emerald[950],

  warning: palette.amber[400],
  warningForeground: palette.night[900],
  warningSubtle: palette.amber[950],

  destructive: palette.red[400],
  destructiveForeground: palette.night[900],
  destructiveSubtle: palette.red[950],

  info: palette.sky[400],
  infoForeground: palette.night[900],
  infoSubtle: palette.sky[950],

  // Component tokens
  card: {
    background: palette.night[800],
    foreground: '#F5F2ED',
    border: palette.night[700],
  },
  input: {
    background: palette.night[800],
    border: palette.night[700],
    borderFocus: palette.gold.light,
    placeholder: palette.night[500],
  },

  // Domain-specific tokens
  tier: {
    inner: palette.tier.gold,
    close: palette.tier.silver,
    community: palette.tier.bronze,
  },
  weave: {
    vibrant: palette.emerald[400],
    stable: palette.gold.light,
    fading: palette.night[500],
  },

  // Season gradients (mystical versions)
  season: {
    resting: [palette.night[600], palette.night[700]] as const,
    balanced: [palette.gold.light, palette.gold.muted] as const,
    blooming: [palette.emerald[400], palette.emerald[500]] as const,
  },

  // Mystic accent (for special moments only — use sparingly!)
  mystic: {
    glow: palette.mystic[400],
    accent: palette.mystic[500],
    subtle: palette.mystic[900],
  },

  // Shadow configuration
  shadow: {
    color: palette.black,
    opacity: {
      sm: 0.25,
      md: 0.35,
      lg: 0.45,
    },
  },
} as const;

// ============================================
// COMBINED TOKENS EXPORT
// ============================================

export const tokens = {
  light: lightTokens,
  dark: darkTokens,
} as const;

// ============================================
// TYPOGRAPHY
// ============================================

export const typography = {
  fonts: {
    serif: 'Lora_400Regular',
    serifBold: 'Lora_700Bold',
    sans: 'Inter_400Regular',
    sansMedium: 'Inter_500Medium',
    sansSemiBold: 'Inter_600SemiBold',
  },
  scale: {
    // Display — hero moments only
    displayLarge: { fontSize: 32, lineHeight: 40 },

    // Headings
    h1: { fontSize: 24, lineHeight: 32 },
    h2: { fontSize: 20, lineHeight: 28 },
    h3: { fontSize: 17, lineHeight: 24 },

    // Body text
    bodyLarge: { fontSize: 17, lineHeight: 26 },
    body: { fontSize: 15, lineHeight: 22 },
    bodySmall: { fontSize: 13, lineHeight: 18 },

    // UI elements
    label: { fontSize: 13, lineHeight: 16 },
    labelSmall: { fontSize: 11, lineHeight: 14, letterSpacing: 0.5 },
    caption: { fontSize: 12, lineHeight: 16 },

    // Statistics
    stat: { fontSize: 28, lineHeight: 34 },
    statSmall: { fontSize: 20, lineHeight: 26 },
  },

  // Usage guidelines:
  // - Lora (serif): Widget titles, stats, display text ONLY
  // - Inter (sans): Everything else — body, labels, buttons, UI
  // - Never mix fonts within a sentence
} as const;

// ============================================
// SPACING & LAYOUT
// ============================================

export const spacing = {
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const layout = {
  screenPadding: 20,      // Consistent screen edge padding
  cardPadding: 16,        // Standard card internal padding
  cardPaddingLarge: 20,   // Hero/primary card padding
  cardGap: 12,            // Gap between cards
  sectionGap: 24,         // Gap between widget sections
  itemGap: 8,             // Gap between list items
  inlineGap: 8,           // Gap between inline elements
} as const;

// ============================================
// SHAPES
// ============================================

export const radius = {
  xs: 4,        // Small elements (badges, small buttons)
  sm: 8,        // Buttons, inputs
  md: 12,       // List items, inner cards
  lg: 16,       // Cards, modals
  xl: 20,       // Hero cards, sheets
  full: 9999,   // Pills, avatars
} as const;

export const shadows = {
  sm: {
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    elevation: 5,
  },
} as const;

// ============================================
// BACKWARD COMPATIBILITY ADAPTER
// ============================================

/**
 * Creates a legacy theme object that maps old keys to new tokens.
 * Use this during migration to avoid breaking existing components.
 * 
 * @param isDarkMode - Whether to use dark mode tokens
 * @returns Legacy theme object with `colors` and `spacing`
 */
export const createLegacyTheme = (isDarkMode: boolean) => {
  const t = isDarkMode ? tokens.dark : tokens.light;

  return {
    colors: {
      // Core
      primary: t.primary,
      secondary: t.secondary,
      background: t.background,
      foreground: t.foreground,
      muted: t.backgroundMuted,
      'muted-foreground': t.foregroundMuted,
      destructive: t.destructive,

      // Card
      card: t.card.background,
      'card-foreground': t.card.foreground,
      border: t.border,

      // Input
      input: 'transparent',
      'input-background': t.input.background,

      // Accent
      accent: t.primaryMuted,
      'accent-foreground': t.primaryForeground,

      // Foregrounds
      'primary-foreground': t.primaryForeground,
      'secondary-foreground': t.secondaryForeground,
      'destructive-foreground': t.destructiveForeground,

      // Focus ring
      ring: t.borderFocus,

      // Domain-specific
      tier: t.tier,
      living: {
        healthy: [t.success, t.success],
        stable: [t.warning, t.warning],
        attention: [t.foregroundSubtle, t.foregroundMuted],
      },

      // Weave status
      'weave-vibrant': t.weave.vibrant,
      'weave-neutral': t.weave.stable,
      'weave-fading': t.weave.fading,

      // Ring colors (for visualizations)
      'ring-warm': t.tier.inner,
      'ring-neutral': t.foregroundMuted,
      'ring-cool': t.foregroundSubtle,
    },
    spacing: {
      xs: spacing[1],
      sm: spacing[2],
      md: spacing[4],
      lg: spacing[6],
      xl: spacing[10],
    },
    isDarkMode,
  };
};

// ============================================
// TYPE EXPORTS
// ============================================

export type ThemeTokens = typeof tokens.light;
export type DarkThemeTokens = typeof tokens.dark;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type Layout = typeof layout;
export type Radius = typeof radius;
export type Shadows = typeof shadows;

// ============================================
// PUBLIC API
// ============================================

// Legacy exports (backward compatibility — use during migration)
export const lightTheme = createLegacyTheme(false);
export const darkTheme = createLegacyTheme(true);
export const theme = lightTheme;

export const getThemeColors = (isDarkMode: boolean) => {
  return createLegacyTheme(isDarkMode).colors;
};

export const getTheme = (isDarkMode: boolean) => {
  return createLegacyTheme(isDarkMode);
};

// New API (prefer this going forward)
export const getTokens = (isDarkMode: boolean): ThemeTokens | DarkThemeTokens => {
  return isDarkMode ? tokens.dark : tokens.light;
};
