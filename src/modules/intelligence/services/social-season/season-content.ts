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
    primaryColor: '#818CF8', // Soft indigo/purple
    lightColor: '#A5B4FC',
    darkColor: '#6366F1',
    gradientColorsLight: ['#A5B4FC', '#818CF8'], // Calming blue-purple
    gradientColorsDark: ['#6366F1', '#4F46E5'], // Deep indigo
    animation: 'gentle-pulse',
  },
  balanced: {
    primaryColor: '#7DD3FC', // Softer sky blue - calm, sustainable, encouraging
    lightColor: '#A5F3FC',
    darkColor: '#38BDF8',
    gradientColorsLight: ['#BAE6FD', '#7DD3FC'], // Very soft sky blue
    gradientColorsDark: ['#38BDF8', '#0EA5E9'], // Gentle ocean blue
    animation: 'subtle-wave',
  },
  blooming: {
    primaryColor: '#34D399', // Emerald green - growth, thriving
    lightColor: '#6EE7B7',
    darkColor: '#10B981',
    gradientColorsLight: ['#6EE7B7', '#34D399'], // Soft emerald
    gradientColorsDark: ['#10B981', '#059669'], // Rich green
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
      headline: "You're in a resting season",
      subtext: 'Your weave holds even when you need space. This is a time for restoration.',
      emoji: '🌙',
    },
    contextVariants: {
      innerCircleWeak: {
        headline: 'Taking gentle space',
        subtext: "Even your closest friends understand when you need to rest. They'll be here when you're ready.",
        emoji: '🌙',
      },
      lowActivity: {
        headline: 'Quiet restoration',
        subtext: 'Rest is productive. Your weave will bloom again when the time is right.',
        emoji: '🌙',
      },
      batteryLow: {
        headline: 'Honoring your limits',
        subtext: 'This low energy is temporary. Quality over quantity, always.',
        emoji: '🌙',
      },
    },
  },
  balanced: {
    default: {
      headline: "You're in a beautiful rhythm",
      subtext: 'Connecting mindfully and listening to your needs. This consistency is something to celebrate.',
      emoji: '💧',
    },
    contextVariants: {
      innerCircleStrong: {
        headline: 'Steady & strong',
        subtext: 'Your closest connections are thriving. This is what balance feels like.',
        emoji: '💧',
      },
      highActivity: {
        headline: 'Mindful momentum',
        subtext: 'Lots of weaving lately—remember to check in with your energy.',
        emoji: '💧',
      },
      batteryHigh: {
        headline: 'Energized balance',
        subtext: 'Your social battery is charged and your rhythm is sustainable.',
        emoji: '💧',
      },
      innerCircleWeak: {
        headline: 'Rebalancing',
        subtext: "You're active, but your Inner Circle could use a little extra care.",
        emoji: '💧',
      },
    },
  },
  blooming: {
    default: {
      headline: "You're blooming!",
      subtext: "You're radiating connection. Remember to check in with yourself.",
      emoji: '🌱',
    },
    contextVariants: {
      innerCircleStrong: {
        headline: 'Thriving together',
        subtext: 'Your Inner Circle is radiant. This is the magic of intentional connection.',
        emoji: '🌱',
      },
      highActivity: {
        headline: 'Connection abundance',
        subtext: "You're weaving at a beautiful pace. Stay mindful of your energy.",
        emoji: '🌱',
      },
      batteryHigh: {
        headline: 'Peak bloom',
        subtext: 'Your connections are glowing. Remember: this season is temporary too.',
        emoji: '🌱',
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
    balanced: '💧',
    blooming: '🌱',
  };
  return icons[season];
}

/**
 * Get season display name
 */
export function getSeasonDisplayName(season: SocialSeason): string {
  const names: Record<SocialSeason, string> = {
    resting: 'Resting',
    balanced: 'Balanced',
    blooming: 'Blooming',
  };
  return names[season];
}
