import { tokens } from './src/shared/theme/tokens';
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
        'display-lg': ['32px', { lineHeight: '40px' }],

        // Headings
        'h1': ['24px', { lineHeight: '32px' }],
        'h2': ['20px', { lineHeight: '28px' }],
        'h3': ['17px', { lineHeight: '24px' }],

        // Body
        'body-lg': ['17px', { lineHeight: '26px' }],
        'body': ['15px', { lineHeight: '22px' }],
        'body-sm': ['13px', { lineHeight: '18px' }],

        // UI
        'label': ['13px', { lineHeight: '16px' }],
        'label-sm': ['11px', { lineHeight: '14px', letterSpacing: '0.5px' }],
        'caption': ['12px', { lineHeight: '16px' }],
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        full: '9999px',
      },
      spacing: {
        // Mapping tokens.ts spacing
        0.5: '2px',
        1: '4px',
        1.5: '6px',
        2: '8px',
        2.5: '10px',
        3: '12px',
        4: '16px',
        5: '20px',
        6: '24px',
        8: '32px',
        10: '40px',
        12: '48px',
        16: '64px',
      }
    },
  },
  plugins: [],
};

export default config;
