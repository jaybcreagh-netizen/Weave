import { Tier, InteractionType, InteractionCategory, Duration, Vibe, Archetype } from '@/components/types';

export const TierDecayRates: Record<Tier, number> = {
  InnerCircle: 2.5,
  CloseFriends: 1.5,
  Community: 0.5,
};

/**
 * Maximum points that can be earned from a single interaction.
 * This prevents extreme outliers from multiplicative stacking of bonuses.
 * Even with perfect conditions (FullMoon vibe, Extended duration, archetype alignment,
 * event multiplier, momentum, etc.), scores are capped to maintain balance.
 */
export const MAX_INTERACTION_SCORE = 50;

/**
 * Group dilution curve parameters.
 * Uses a smooth logarithmic decay instead of discrete buckets.
 * Formula: 1 / (1 + DILUTION_RATE * ln(groupSize))
 * - groupSize 1: 1.0 (no dilution)
 * - groupSize 2: ~0.87
 * - groupSize 4: ~0.71
 * - groupSize 8: ~0.54
 * - groupSize 15: ~0.43
 */
export const GROUP_DILUTION_RATE = 0.35;
export const GROUP_DILUTION_FLOOR = 0.25; // Minimum dilution factor (never below 25%)

/**
 * Personalized attention threshold configuration.
 * Thresholds are calculated based on friend's historical score patterns.
 */
export const PersonalizedThresholdConfig = {
  // Base thresholds by tier (used when no historical data)
  baseThresholds: {
    InnerCircle: 50,
    CloseFriends: 40,
    Community: 30,
  } as Record<Tier, number>,

  // How much the threshold can be adjusted based on history
  // If friend typically hovers at 75, threshold becomes: 75 * 0.65 = ~49
  historicalFactor: 0.65,

  // Minimum interactions needed to use personalized threshold
  minInteractionsForPersonalization: 5,

  // Weight given to historical average vs base threshold (0-1)
  // Higher = more weight to friend's actual patterns
  personalizationWeight: 0.6,
};

// DEPRECATED: Old activity-based scores (kept for backwards compatibility)
export const InteractionBaseScores: Record<InteractionType, number> = {
  // Original
  Event: 30,
  Meal: 25,
  Home: 25,
  Coffee: 20,
  Call: 15,
  Text: 5,

  // New Additions
  'Walk': 20,
  'Chat': 15,
  'Video Call': 15,
  'Party': 25,
  'Dinner Party': 25,
  'Hangout': 20,
  'Game Night': 20,
  'Birthday': 30,
  'Anniversary': 30,
  'Milestone': 30,
  'Holiday': 25,
  'Achievement': 30,
  'DM': 5,
  'Quick Visit': 15,
  'Voice Note': 10,
  'Movie Night': 20,
  'Cooking': 25,
  'Tea Time': 15,
  'Reading Together': 20,
  'Hike': 25,
  'Concert': 30,
  'Museum': 20,
  'Shopping': 15,
  'Adventure': 30,
  'Something else': 15,
};

// NEW: Simplified category-based scores for the 9 universal types
export const CategoryBaseScores: Record<InteractionCategory, number> = {
  'text-call': 10,       // 💬 Quick digital connection
  'voice-note': 12,      // 🎤 Async voice - slightly more personal
  'meal-drink': 22,      // 🍽️ Classic quality time
  'hangout': 20,         // 🏠 Casual in-person time
  'deep-talk': 28,       // 💭 Meaningful, vulnerable conversation
  'event-party': 27,     // 🎉 Social gathering energy
  'activity-hobby': 25,  // 🎨 Shared activities/adventures
  'favor-support': 24,   // 🤝 Help or emotional support
  'celebration': 32,     // 🎂 Peak moments - birthdays, milestones
};

export const DurationModifiers: Record<Duration, number> = {
  Quick: 0.8,
  Standard: 1.0,
  Extended: 1.2,
};

export const VibeMultipliers: Record<Vibe, number> = {
  NewMoon: 0.8,        // Was 0.9 - slightly more penalizing for bad vibes
  WaxingCrescent: 1.0, // Unchanged
  FirstQuarter: 1.1,   // Unchanged
  WaxingGibbous: 1.3,  // Was 1.2 - rewarding good vibes
  FullMoon: 1.5,       // Was 1.3 - significantly rewarding great vibes
  WaningGibbous: 1.3,  // Mirroring WaxingGibbous
  LastQuarter: 1.1,    // Mirroring FirstQuarter
  WaningCrescent: 1.0, // Mirroring WaxingCrescent
};

export const RecencyFactors: { min: number; max: number; factor: number }[] = [
  { min: 0, max: 30, factor: 1.2 },
  { min: 31, max: 70, factor: 1.0 },
  { min: 71, max: 100, factor: 0.7 },
];

export const ArchetypeMatrixV2: Record<Archetype, Record<InteractionType, number>> = {
  Emperor: {
    Event: 1.2, Meal: 1.1, Home: 1.0, Coffee: 1.0, Call: 0.9, Text: 0.8,
    Walk: 1.1, Chat: 0.9, 'Video Call': 1.0, 'Something else': 1.0, Party: 1.2,
    'Dinner Party': 1.2, Hangout: 1.0, 'Game Night': 1.1, Birthday: 1.2, Anniversary: 1.2,
    Milestone: 1.2, Holiday: 1.1, Achievement: 1.2, DM: 0.8, 'Quick Visit': 1.0,
    'Voice Note': 0.9, 'Movie Night': 1.0, Cooking: 1.1, 'Tea Time': 1.0, 'Reading Together': 1.0,
    Hike: 1.1, Concert: 1.2, Museum: 1.1, Shopping: 1.0, Adventure: 1.2,
  },
  Empress: {
    Event: 1.1, Meal: 1.2, Home: 1.2, Coffee: 1.1, Call: 1.0, Text: 0.9,
    Walk: 1.0, Chat: 1.0, 'Video Call': 1.0, 'Something else': 1.0, Party: 1.1,
    'Dinner Party': 1.2, Hangout: 1.2, 'Game Night': 1.0, Birthday: 1.2, Anniversary: 1.2,
    Milestone: 1.1, Holiday: 1.2, Achievement: 1.1, DM: 0.9, 'Quick Visit': 1.1,
    'Voice Note': 1.0, 'Movie Night': 1.1, Cooking: 1.2, 'Tea Time': 1.1, 'Reading Together': 1.1,
    Hike: 1.0, Concert: 1.1, Museum: 1.0, Shopping: 1.1, Adventure: 1.0,
  },
  HighPriestess: {
    Event: 1.0, Meal: 1.1, Home: 1.1, Coffee: 1.2, Call: 1.2, Text: 1.0,
    Walk: 1.1, Chat: 1.1, 'Video Call': 1.1, 'Something else': 1.0, Party: 1.0,
    'Dinner Party': 1.1, Hangout: 1.1, 'Game Night': 0.9, Birthday: 1.1, Anniversary: 1.2,
    Milestone: 1.1, Holiday: 1.0, Achievement: 1.1, DM: 1.0, 'Quick Visit': 1.0,
    'Voice Note': 1.2, 'Movie Night': 1.0, Cooking: 1.0, 'Tea Time': 1.2, 'Reading Together': 1.2,
    Hike: 1.1, Concert: 1.0, Museum: 1.2, Shopping: 0.9, Adventure: 1.0,
  },
  Fool: {
    Event: 1.2, Meal: 1.0, Home: 0.9, Coffee: 1.0, Call: 1.0, Text: 1.1,
    Walk: 1.2, Chat: 1.1, 'Video Call': 1.0, 'Something else': 1.2, Party: 1.2,
    'Dinner Party': 1.0, Hangout: 1.1, 'Game Night': 1.2, Birthday: 1.2, Anniversary: 1.0,
    Milestone: 1.1, Holiday: 1.1, Achievement: 1.1, DM: 1.1, 'Quick Visit': 1.1,
    'Voice Note': 1.0, 'Movie Night': 1.1, Cooking: 0.9, 'Tea Time': 1.0, 'Reading Together': 0.9,
    Hike: 1.2, Concert: 1.2, Museum: 1.0, Shopping: 1.1, Adventure: 1.2,
  },
  Sun: {
    Event: 1.2, Meal: 1.1, Home: 1.1, Coffee: 1.0, Call: 1.0, Text: 1.0,
    Walk: 1.1, Chat: 1.0, 'Video Call': 1.0, 'Something else': 1.1, Party: 1.2,
    'Dinner Party': 1.2, Hangout: 1.1, 'Game Night': 1.1, Birthday: 1.2, Anniversary: 1.2,
    Milestone: 1.2, Holiday: 1.2, Achievement: 1.2, DM: 1.0, 'Quick Visit': 1.0,
    'Voice Note': 1.0, 'Movie Night': 1.1, Cooking: 1.1, 'Tea Time': 1.0, 'Reading Together': 1.0,
    Hike: 1.1, Concert: 1.2, Museum: 1.0, Shopping: 1.0, Adventure: 1.2,
  },
  Hermit: {
    Event: 0.9, Meal: 1.1, Home: 1.2, Coffee: 1.1, Call: 1.1, Text: 1.0,
    Walk: 1.2, Chat: 1.1, 'Video Call': 1.0, 'Something else': 0.9, Party: 0.9,
    'Dinner Party': 1.1, Hangout: 1.2, 'Game Night': 1.0, Birthday: 1.1, Anniversary: 1.2,
    Milestone: 1.1, Holiday: 1.0, Achievement: 1.1, DM: 1.0, 'Quick Visit': 1.1,
    'Voice Note': 1.1, 'Movie Night': 1.1, Cooking: 1.2, 'Tea Time': 1.2, 'Reading Together': 1.2,
    Hike: 1.2, Concert: 0.9, Museum: 1.1, Shopping: 0.9, Adventure: 1.0,
  },
  Magician: {
    Event: 1.1, Meal: 1.1, Home: 1.0, Coffee: 1.1, Call: 1.0, Text: 1.0,
    Walk: 1.1, Chat: 1.0, 'Video Call': 1.0, 'Something else': 1.2, Party: 1.1,
    'Dinner Party': 1.1, Hangout: 1.0, 'Game Night': 1.2, Birthday: 1.1, Anniversary: 1.1,
    Milestone: 1.2, Holiday: 1.0, Achievement: 1.2, DM: 1.0, 'Quick Visit': 1.0,
    'Voice Note': 1.0, 'Movie Night': 1.1, Cooking: 1.1, 'Tea Time': 1.1, 'Reading Together': 1.1,
    Hike: 1.2, Concert: 1.1, Museum: 1.2, Shopping: 1.0, Adventure: 1.2,
  },
  Unknown: {
    Event: 1.0, Meal: 1.0, Home: 1.0, Coffee: 1.0, Call: 1.0, Text: 1.0,
    Walk: 1.0, Chat: 1.0, 'Video Call': 1.0, 'Something else': 1.0, Party: 1.0,
    'Dinner Party': 1.0, Hangout: 1.0, 'Game Night': 1.0, Birthday: 1.0, Anniversary: 1.0,
    Milestone: 1.0, Holiday: 1.0, Achievement: 1.0, DM: 1.0, 'Quick Visit': 1.0,
    'Voice Note': 1.0, 'Movie Night': 1.0, Cooking: 1.0, 'Tea Time': 1.0, 'Reading Together': 1.0,
    Hike: 1.0, Concert: 1.0, Museum: 1.0, Shopping: 1.0, Adventure: 1.0,
  },
  Lovers: {
    Event: 1.1, Meal: 1.2, Home: 1.1, Coffee: 1.2, Call: 1.1, Text: 1.1,
    Walk: 1.2, Chat: 1.1, 'Video Call': 1.1, 'Something else': 1.1, Party: 1.1,
    'Dinner Party': 1.1, Hangout: 1.1, 'Game Night': 1.1, Birthday: 1.2, Anniversary: 1.3,
    Milestone: 1.2, Holiday: 1.2, Achievement: 1.1, DM: 1.1, 'Quick Visit': 1.1,
    'Voice Note': 1.1, 'Movie Night': 1.2, Cooking: 1.2, 'Tea Time': 1.1, 'Reading Together': 1.1,
    Hike: 1.1, Concert: 1.1, Museum: 1.1, Shopping: 1.1, Adventure: 1.2,
  },
};

export const CategoryArchetypeMatrix: Record<Archetype, Record<InteractionCategory, number>> = {
  Emperor: {
    'text-call': 0.9, 'voice-note': 0.9, 'meal-drink': 1.1, 'hangout': 1.0,
    'deep-talk': 1.1, 'event-party': 1.2, 'activity-hobby': 1.1, 'favor-support': 1.0, 'celebration': 1.2,
  },
  Empress: {
    'text-call': 1.0, 'voice-note': 1.1, 'meal-drink': 1.2, 'hangout': 1.2,
    'deep-talk': 1.1, 'event-party': 1.1, 'activity-hobby': 1.0, 'favor-support': 1.2, 'celebration': 1.2,
  },
  HighPriestess: {
    'text-call': 1.1, 'voice-note': 1.2, 'meal-drink': 1.1, 'hangout': 1.0,
    'deep-talk': 1.3, 'event-party': 0.9, 'activity-hobby': 1.0, 'favor-support': 1.1, 'celebration': 1.1,
  },
  Fool: {
    'text-call': 1.1, 'voice-note': 1.0, 'meal-drink': 1.0, 'hangout': 1.1,
    'deep-talk': 0.9, 'event-party': 1.2, 'activity-hobby': 1.2, 'favor-support': 0.9, 'celebration': 1.1,
  },
  Sun: {
    'text-call': 1.0, 'voice-note': 1.0, 'meal-drink': 1.1, 'hangout': 1.1,
    'deep-talk': 1.0, 'event-party': 1.3, 'activity-hobby': 1.2, 'favor-support': 1.0, 'celebration': 1.3,
  },
  Hermit: {
    'text-call': 1.0, 'voice-note': 1.1, 'meal-drink': 1.1, 'hangout': 1.2,
    'deep-talk': 1.2, 'event-party': 0.8, 'activity-hobby': 1.1, 'favor-support': 1.1, 'celebration': 1.0,
  },
  Magician: {
    'text-call': 1.0, 'voice-note': 1.0, 'meal-drink': 1.1, 'hangout': 1.0,
    'deep-talk': 1.1, 'event-party': 1.1, 'activity-hobby': 1.3, 'favor-support': 1.0, 'celebration': 1.2,
  },
  Unknown: {
    'text-call': 1.0,
    'voice-note': 1.0,
    'meal-drink': 1.0,
    'hangout': 1.0,
    'deep-talk': 1.0,
    'event-party': 1.0,
    'activity-hobby': 1.0,
    'favor-support': 1.0,
    'celebration': 1.0,
  },
  Lovers: {
    'text-call': 1.1, 'voice-note': 1.1, 'meal-drink': 1.2, 'hangout': 1.1,
    'deep-talk': 1.2, 'event-party': 1.1, 'activity-hobby': 1.1, 'favor-support': 1.2, 'celebration': 1.3,
  },
};
