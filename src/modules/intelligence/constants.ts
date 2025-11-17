import { Tier, InteractionType, InteractionCategory, Duration, Vibe, Archetype } from '@/components/types';

export const TierDecayRates: Record<Tier, number> = {
  InnerCircle: 2.5,
  CloseFriends: 1.5,
  Community: 0.5,
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
  NewMoon: 0.9,
  WaxingCrescent: 1.0,
  FirstQuarter: 1.1,
  WaxingGibbous: 1.2,
  FullMoon: 1.3,
};

export const RecencyFactors: { min: number; max: number; factor: number }[] = [
  { min: 0, max: 30, factor: 1.2 },
  { min: 31, max: 70, factor: 1.0 },
  { min: 71, max: 100, factor: 0.7 },
];

export const ArchetypeMatrixV2: Record<Archetype, Record<InteractionType, number>> = {
  // ... Archetype matrix data ...
  Unknown: {
    Event: 1.0, Meal: 1.0, Home: 1.0, Coffee: 1.0, Call: 1.0, Text: 1.0,
    Walk: 1.0, Chat: 1.0, 'Video Call': 1.0, 'Something else': 1.0, Party: 1.0,
    'Dinner Party': 1.0, Hangout: 1.0, 'Game Night': 1.0, Birthday: 1.0, Anniversary: 1.0,
    Milestone: 1.0, Holiday: 1.0, Achievement: 1.0, DM: 1.0, 'Quick Visit': 1.0,
    'Voice Note': 1.0, 'Movie Night': 1.0, Cooking: 1.0, 'Tea Time': 1.0, 'Reading Together': 1.0,
    Hike: 1.0, Concert: 1.0, Museum: 1.0, Shopping: 1.0, Adventure: 1.0,
  },
};

export const CategoryArchetypeMatrix: Record<Archetype, Record<InteractionCategory, number>> = {
  // ... Category archetype matrix data ...
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
};
