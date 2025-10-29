import { SocialSeason, SeasonContext } from './season-types';

export interface SeasonGreeting {
  headline: string;
  subtext: string;
  emoji: string;
}

export interface SeasonStyle {
  primaryColor: string;
  lightColor: string;
  darkColor: string;
  gradientColorsLight: string[]; // For light theme
  gradientColorsDark: string[]; // For dark theme
  animation: 'gentle-pulse' | 'subtle-wave' | 'sparkle';
}

/**
 * Visual styling for each season
 * Uses the app's existing "living" theme colors for consistency
 */
export const SEASON_STYLES: Record<SocialSeason, SeasonStyle> = {
  resting: {
    primaryColor: '#F87171', // Soft coral-red
    lightColor: '#FCA5A5',
    darkColor: '#DC2626',
    gradientColorsLight: ['#FCA5A5', '#F87171'], // living.attention (light)
    gradientColorsDark: ['#f472b6', '#ec4899'], // living.attention (dark)
    animation: 'gentle-pulse',
  },
  flowing: {
    primaryColor: '#FBBF24', // Vibrant gold
    lightColor: '#FCD34D',
    darkColor: '#D97706',
    gradientColorsLight: ['#FCD34D', '#FBBF24'], // living.stable (light)
    gradientColorsDark: ['#a78bfa', '#8b5cf6'], // living.stable (dark)
    animation: 'subtle-wave',
  },
  blooming: {
    primaryColor: '#34D399', // Mint green
    lightColor: '#6EE7B7',
    darkColor: '#10B981',
    gradientColorsLight: ['#6EE7B7', '#34D399'], // living.healthy (light)
    gradientColorsDark: ['#2dd4bf', '#14b8a6'], // living.healthy (dark)
    animation: 'sparkle',
  },
};

/**
 * Season greetings organized by season and context
 */
const SEASON_GREETINGS: Record<
  SocialSeason,
  {
    default: SeasonGreeting;
    contextVariants: Partial<Record<string, SeasonGreeting>>;
  }
> = {
  resting: {
    default: {
      headline: 'Resting Season',
      subtext: 'This is a time for quiet reflection and gentle care. Your connections are patient.',
      emoji: '🌙',
    },
    contextVariants: {
      innerCircleWeak: {
        headline: 'Taking Space',
        subtext: "Even your closest friends understand when you need to rest. They'll be here when you're ready.",
        emoji: '🌙',
      },
      lowActivity: {
        headline: 'Quiet Time',
        subtext: 'Rest is productive. Your weave will bloom again when the time is right.',
        emoji: '✨',
      },
      batteryLow: {
        headline: 'Low Energy, High Compassion',
        subtext: 'Honor your need for solitude. Quality over quantity, always.',
        emoji: '🌑',
      },
    },
  },
  flowing: {
    default: {
      headline: 'Flowing Season',
      subtext: "You're finding a sustainable rhythm. Keep weaving at your own pace.",
      emoji: '🌊',
    },
    contextVariants: {
      innerCircleStrong: {
        headline: 'Steady & Strong',
        subtext: 'Your closest connections are thriving. This is what balance feels like.',
        emoji: '💛',
      },
      highActivity: {
        headline: 'Active Flow',
        subtext: 'Lots of weaving lately—make sure to balance action with rest.',
        emoji: '🌊',
      },
      batteryHigh: {
        headline: 'Energized Connection',
        subtext: 'Your social battery is charged. Ride this wave of positive momentum.',
        emoji: '⚡',
      },
      innerCircleWeak: {
        headline: 'Finding Balance',
        subtext: "You're active, but your Inner Circle needs a little extra care right now.",
        emoji: '🌊',
      },
    },
  },
  blooming: {
    default: {
      headline: 'Blooming Season',
      subtext: "You're in full bloom! Your social garden is flourishing. 🌸",
      emoji: '🌸',
    },
    contextVariants: {
      innerCircleStrong: {
        headline: 'Thriving Together',
        subtext: 'Your Inner Circle is radiant. This is the magic of intentional connection.',
        emoji: '✨',
      },
      highActivity: {
        headline: 'Connection Abundance',
        subtext: "You're weaving at a beautiful pace. All your relationships are feeling the love.",
        emoji: '🌟',
      },
      batteryHigh: {
        headline: 'Peak Energy',
        subtext: 'Your social battery is full and your connections are glowing. Keep this magic alive!',
        emoji: '🔥',
      },
    },
  },
};

/**
 * Get the appropriate greeting for the current season and context
 */
export function getSeasonGreeting(
  season: SocialSeason,
  context: SeasonContext
): SeasonGreeting {
  const seasonData = SEASON_GREETINGS[season];

  // Try to find a matching context variant
  if (context.innerCircleWeak && seasonData.contextVariants.innerCircleWeak) {
    return seasonData.contextVariants.innerCircleWeak;
  }

  if (context.innerCircleStrong && seasonData.contextVariants.innerCircleStrong) {
    return seasonData.contextVariants.innerCircleStrong;
  }

  if (context.highActivity && seasonData.contextVariants.highActivity) {
    return seasonData.contextVariants.highActivity;
  }

  if (context.lowActivity && seasonData.contextVariants.lowActivity) {
    return seasonData.contextVariants.lowActivity;
  }

  if (context.batteryLow && seasonData.contextVariants.batteryLow) {
    return seasonData.contextVariants.batteryLow;
  }

  if (context.batteryHigh && seasonData.contextVariants.batteryHigh) {
    return seasonData.contextVariants.batteryHigh;
  }

  // Default greeting
  return seasonData.default;
}

/**
 * Get season icon emoji
 */
export function getSeasonIcon(season: SocialSeason): string {
  const icons: Record<SocialSeason, string> = {
    resting: '🌙',
    flowing: '🌊',
    blooming: '🌸',
  };
  return icons[season];
}

/**
 * Get season display name
 */
export function getSeasonDisplayName(season: SocialSeason): string {
  const names: Record<SocialSeason, string> = {
    resting: 'Resting',
    flowing: 'Flowing',
    blooming: 'Blooming',
  };
  return names[season];
}
