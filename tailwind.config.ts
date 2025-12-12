import { tokens, typography, spacing, radius } from './src/shared/theme/tokens';
import { type Config } from 'tailwindcss';

/**
 * Tailwind Configuration
 * Source of Truth: src/shared/theme/tokens.ts
 *
 * This config maps our Design System tokens to Tailwind utility classes.
 * Currently mapping the LIGHT theme as the default root values.
 *
 * TODO: Implement CSS variables or dark mode strategy if dynamic switching
 * without nativewind's specific "dark" modifier is needed.
 */

// Helper to flatten nested objects for Tailwind if needed,
// but Tailwind supports nested colors structure natively.

const config: Config = {
  // NOTE: NativeWind v4 usually scans these paths
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Semantic Colors (Mapped from Light Theme)
        background: tokens.light.background,
        'background-elevated': tokens.light.backgroundElevated,
        'background-subtle': tokens.light.backgroundSubtle,
        'background-muted': tokens.light.backgroundMuted,

        foreground: tokens.light.foreground,
        'foreground-muted': tokens.light.foregroundMuted,
        'foreground-subtle': tokens.light.foregroundSubtle,

        primary: tokens.light.primary,
        'primary-hover': tokens.light.primaryHover,
        'primary-foreground': tokens.light.primaryForeground,
        'primary-muted': tokens.light.primaryMuted,
        'primary-subtle': tokens.light.primarySubtle,

        secondary: tokens.light.secondary,
        'secondary-hover': tokens.light.secondaryHover,
        'secondary-foreground': tokens.light.secondaryForeground,

        destructive: tokens.light.destructive,
        'destructive-foreground': tokens.light.destructiveForeground,
        'destructive-subtle': tokens.light.destructiveSubtle,

        success: tokens.light.success,
        'success-foreground': tokens.light.successForeground,
        'success-subtle': tokens.light.successSubtle,

        warning: tokens.light.warning,
        'warning-foreground': tokens.light.warningForeground,
        'warning-subtle': tokens.light.warningSubtle,

        info: tokens.light.info,
        'info-foreground': tokens.light.infoForeground,
        'info-subtle': tokens.light.infoSubtle,

        border: tokens.light.border,
        'border-subtle': tokens.light.borderSubtle,
        'border-focus': tokens.light.borderFocus,

        // Component specific
        card: tokens.light.card.background,
        'card-foreground': tokens.light.card.foreground,
        'card-border': tokens.light.card.border,

        input: tokens.light.input.background,
        'input-border': tokens.light.input.border,
        'input-focus': tokens.light.input.borderFocus,
        'input-placeholder': tokens.light.input.placeholder,

        // Domain specific
        'tier-inner': tokens.light.tier.inner,
        'tier-close': tokens.light.tier.close,
        'tier-community': tokens.light.tier.community,

        'weave-vibrant': tokens.light.weave.vibrant,
        'weave-stable': tokens.light.weave.stable,
        'weave-fading': tokens.light.weave.fading,
      },
      fontFamily: {
        serif: ['Lora_400Regular'],
        'serif-bold': ['Lora_700Bold'],
        sans: ['Inter_400Regular'],
        'sans-medium': ['Inter_500Medium'],
        'sans-semibold': ['Inter_600SemiBold'],
      },
      fontSize: {
        // Display
        'display-lg': [`${typography.scale.displayLarge.fontSize}px`, { lineHeight: `${typography.scale.displayLarge.lineHeight}px` }],

        // Headings
        'h1': [`${typography.scale.h1.fontSize}px`, { lineHeight: `${typography.scale.h1.lineHeight}px` }],
        'h2': [`${typography.scale.h2.fontSize}px`, { lineHeight: `${typography.scale.h2.lineHeight}px` }],
        'h3': [`${typography.scale.h3.fontSize}px`, { lineHeight: `${typography.scale.h3.lineHeight}px` }],

        // Body
        'body-lg': [`${typography.scale.bodyLarge.fontSize}px`, { lineHeight: `${typography.scale.bodyLarge.lineHeight}px` }],
        'body': [`${typography.scale.body.fontSize}px`, { lineHeight: `${typography.scale.body.lineHeight}px` }],
        'body-sm': [`${typography.scale.bodySmall.fontSize}px`, { lineHeight: `${typography.scale.bodySmall.lineHeight}px` }],

        // UI
        'label': [`${typography.scale.label.fontSize}px`, { lineHeight: `${typography.scale.label.lineHeight}px` }],
        'label-sm': [`${typography.scale.labelSmall.fontSize}px`, { lineHeight: `${typography.scale.labelSmall.lineHeight}px`, letterSpacing: `${typography.scale.labelSmall.letterSpacing}px` }],
        'caption': [`${typography.scale.caption.fontSize}px`, { lineHeight: `${typography.scale.caption.lineHeight}px` }],
      },
      borderRadius: {
        xs: `${radius.xs}px`,
        sm: `${radius.sm}px`,
        md: `${radius.md}px`,
        lg: `${radius.lg}px`,
        xl: `${radius.xl}px`,
        full: `${radius.full}px`,
      },
      spacing: {
        // Mapping tokens.ts spacing
        0.5: `${spacing[0.5]}px`,
        1: `${spacing[1]}px`,
        1.5: `${spacing[1.5]}px`,
        2: `${spacing[2]}px`,
        2.5: `${spacing[2.5]}px`,
        3: `${spacing[3]}px`,
        4: `${spacing[4]}px`,
        5: `${spacing[5]}px`,
        6: `${spacing[6]}px`,
        8: `${spacing[8]}px`,
        10: `${spacing[10]}px`,
        12: `${spacing[12]}px`,
        16: `${spacing[16]}px`,
      }
    },
  },
  plugins: [],
};

export default config;
