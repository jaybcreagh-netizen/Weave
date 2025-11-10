import { Tier, InteractionType, InteractionCategory, Duration, Vibe, Archetype } from '../components/types';

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
  // The Emperor values structure and achievement. High-impact, planned events are best.
  Emperor: {
    Event: 1.8, Meal: 1.4, Home: 1.2, Coffee: 1.0, Call: 0.9, Text: 0.6,
    Walk: 1.1, Chat: 0.8, 'Video Call': 1.0, 'Something else': 1.0, Party: 1.5,
    'Dinner Party': 1.6, Hangout: 1.0, 'Game Night': 1.3, Birthday: 1.9, Anniversary: 1.9,
    Milestone: 2.0, Holiday: 1.7, Achievement: 2.0, DM: 0.6, 'Quick Visit': 0.9,
    'Voice Note': 0.7, 'Movie Night': 1.1, Cooking: 1.3, 'Tea Time': 0.9, 'Reading Together': 1.0,
    Hike: 1.2, Concert: 1.6, Museum: 1.4, Shopping: 0.8, Adventure: 1.5,
  },
  // The Empress values comfort, generosity, and sensory experiences.
  Empress: {
    Event: 0.8, Meal: 1.6, Home: 2.0, Coffee: 1.2, Call: 1.1, Text: 0.9,
    Walk: 1.4, Chat: 1.0, 'Video Call': 1.1, 'Something else': 1.0, Party: 1.2,
    'Dinner Party': 1.9, Hangout: 1.5, 'Game Night': 1.4, Birthday: 1.8, Anniversary: 2.0,
    Milestone: 1.6, Holiday: 1.8, Achievement: 1.5, DM: 0.9, 'Quick Visit': 1.3,
    'Voice Note': 1.0, 'Movie Night': 1.8, Cooking: 2.0, 'Tea Time': 1.7, 'Reading Together': 1.6,
    Hike: 1.1, Concert: 1.0, Museum: 1.3, Shopping: 1.5, Adventure: 1.2,
  },
  // The High Priestess values deep, intuitive, and private connection.
  HighPriestess: {
    Event: 0.6, Meal: 1.0, Home: 1.4, Coffee: 1.8, Call: 2.0, Text: 0.7,
    Walk: 1.7, Chat: 1.9, 'Video Call': 1.8, 'Something else': 1.0, Party: 0.5,
    'Dinner Party': 1.1, Hangout: 1.2, 'Game Night': 1.0, Birthday: 0.9, Anniversary: 1.2,
    Milestone: 1.0, Holiday: 0.8, Achievement: 0.9, DM: 0.8, 'Quick Visit': 1.0,
    'Voice Note': 1.5, 'Movie Night': 1.6, Cooking: 1.2, 'Tea Time': 2.0, 'Reading Together': 1.9,
    Hike: 1.4, Concert: 0.7, Museum: 1.6, Shopping: 0.6, Adventure: 1.1,
  },
  // The Fool values spontaneity, novelty, and light-hearted fun.
  Fool: {
    Event: 1.2, Meal: 0.9, Home: 0.8, Coffee: 1.5, Call: 1.0, Text: 1.8,
    Walk: 1.6, Chat: 1.7, 'Video Call': 1.1, 'Something else': 1.9, Party: 1.8,
    'Dinner Party': 1.0, Hangout: 1.6, 'Game Night': 1.7, Birthday: 1.5, Anniversary: 1.0,
    Milestone: 1.2, Holiday: 1.4, Achievement: 1.3, DM: 1.9, 'Quick Visit': 1.4,
    'Voice Note': 1.6, 'Movie Night': 1.0, Cooking: 0.9, 'Tea Time': 1.2, 'Reading Together': 0.7,
    Hike: 1.8, Concert: 1.9, Museum: 1.4, Shopping: 1.6, Adventure: 2.0,
  },
  // The Sun values celebration, visibility, and high-energy social gatherings.
  Sun: {
    Event: 2.0, Meal: 1.6, Home: 1.1, Coffee: 1.3, Call: 0.7, Text: 0.8,
    Walk: 1.2, Chat: 0.9, 'Video Call': 0.8, 'Something else': 1.1, Party: 2.0,
    'Dinner Party': 1.7, Hangout: 1.5, 'Game Night': 1.6, Birthday: 2.0, Anniversary: 1.8,
    Milestone: 1.9, Holiday: 1.9, Achievement: 2.0, DM: 0.8, 'Quick Visit': 1.0,
    'Voice Note': 0.7, 'Movie Night': 1.2, Cooking: 1.3, 'Tea Time': 1.0, 'Reading Together': 0.9,
    Hike: 1.4, Concert: 1.9, Museum: 1.2, Shopping: 1.3, Adventure: 1.8,
  },
  // The Hermit values solitude, quiet contemplation, and meaningful one-on-one time.
  Hermit: {
    Event: 0.6, Meal: 0.8, Home: 1.0, Coffee: 1.2, Call: 1.8, Text: 1.6,
    Walk: 1.8, Chat: 2.0, 'Video Call': 1.9, 'Something else': 1.0, Party: 0.4,
    'Dinner Party': 0.9, Hangout: 0.8, 'Game Night': 1.1, Birthday: 0.7, Anniversary: 1.0,
    Milestone: 0.9, Holiday: 0.6, Achievement: 0.8, DM: 1.5, 'Quick Visit': 0.9,
    'Voice Note': 1.7, 'Movie Night': 1.2, Cooking: 1.0, 'Tea Time': 1.9, 'Reading Together': 2.0,
    Hike: 1.5, Concert: 0.5, Museum: 1.4, Shopping: 0.7, Adventure: 1.0,
  },
  // The Magician values creativity, focused energy, and shared projects or ideas.
  Magician: {
    Event: 1.7, Meal: 1.1, Home: 0.9, Coffee: 1.6, Call: 1.2, Text: 1.0,
    Walk: 1.4, Chat: 1.3, 'Video Call': 1.4, 'Something else': 1.8, Party: 1.5,
    'Dinner Party': 1.2, Hangout: 1.3, 'Game Night': 1.8, Birthday: 1.6, Anniversary: 1.4,
    Milestone: 1.8, Holiday: 1.3, Achievement: 1.9, DM: 1.0, 'Quick Visit': 1.1,
    'Voice Note': 1.1, 'Movie Night': 1.0, Cooking: 1.5, 'Tea Time': 1.3, 'Reading Together': 1.2,
    Hike: 1.5, Concert: 1.7, Museum: 1.6, Shopping: 1.0, Adventure: 1.8,
  },
  // The Lovers values harmony, reciprocal dialogue, and the beauty of mirrored connection.
  Lovers: {
    Event: 0.9, Meal: 1.5, Home: 1.6, Coffee: 1.5, Call: 1.9, Text: 1.2,
    Walk: 1.8, Chat: 2.0, 'Video Call': 1.9, 'Something else': 1.0, Party: 0.8,
    'Dinner Party': 1.8, Hangout: 1.5, 'Game Night': 1.3, Birthday: 1.4, Anniversary: 2.0,
    Milestone: 1.1, Holiday: 1.0, Achievement: 1.1, DM: 1.2, 'Quick Visit': 1.0,
    'Voice Note': 1.3, 'Movie Night': 1.4, Cooking: 1.7, 'Tea Time': 1.9, 'Reading Together': 1.6,
    Hike: 1.0, Concert: 0.7, Museum: 1.2, Shopping: 1.1, Adventure: 0.9,
  },
  // Unknown archetype - neutral multipliers for batch-added friends awaiting archetype assignment
  Unknown: {
    Event: 1.0, Meal: 1.0, Home: 1.0, Coffee: 1.0, Call: 1.0, Text: 1.0,
    Walk: 1.0, Chat: 1.0, 'Video Call': 1.0, 'Something else': 1.0, Party: 1.0,
    'Dinner Party': 1.0, Hangout: 1.0, 'Game Night': 1.0, Birthday: 1.0, Anniversary: 1.0,
    Milestone: 1.0, Holiday: 1.0, Achievement: 1.0, DM: 1.0, 'Quick Visit': 1.0,
    'Voice Note': 1.0, 'Movie Night': 1.0, Cooking: 1.0, 'Tea Time': 1.0, 'Reading Together': 1.0,
    Hike: 1.0, Concert: 1.0, Museum: 1.0, Shopping: 1.0, Adventure: 1.0,
  },
};

// NEW: Simplified archetype multipliers for 8 universal categories
export const CategoryArchetypeMatrix: Record<Archetype, Record<InteractionCategory, number>> = {
  // The Emperor values structure and achievement. High-impact, planned events are best.
  Emperor: {
    'text-call': 0.7,        // Low - prefers structured, planned interaction
    'voice-note': 0.8,       // Low - asynchronous feels less intentional
    'meal-drink': 1.4,       // Good - structured social time
    'hangout': 1.1,          // Moderate - depends on purpose
    'deep-talk': 1.3,        // Good - values meaningful exchange
    'event-party': 1.7,      // High - loves organized gatherings
    'activity-hobby': 1.5,   // High - goal-oriented activities
    'favor-support': 1.4,    // Good - practical help and problem-solving
    'celebration': 1.9,      // Peak - milestones and achievements
  },
  // The Empress values comfort, generosity, and sensory experiences.
  Empress: {
    'text-call': 0.9,        // Low-moderate - prefers richer connection
    'voice-note': 1.1,       // Moderate - appreciates warmth in voice
    'meal-drink': 1.8,       // Peak - loves sharing meals
    'hangout': 1.7,          // High - thrives in cozy, comfortable spaces
    'deep-talk': 1.4,        // Good - values emotional connection
    'event-party': 1.3,      // Moderate - social but prefers intimate
    'activity-hobby': 1.4,   // Good - enjoys shared creative experiences
    'favor-support': 1.9,    // Peak - loves nurturing and caring for others
    'celebration': 1.9,      // Peak - loves celebrating others
  },
  // The High Priestess values deep, intuitive, and private connection.
  HighPriestess: {
    'text-call': 0.8,        // Low - prefers depth over speed
    'voice-note': 1.4,       // Good - appreciates thoughtful async
    'meal-drink': 1.6,       // High - intimate setting for depth
    'hangout': 1.2,          // Moderate - depends on energy
    'deep-talk': 2.0,        // Peak - this is the sweet spot
    'event-party': 0.6,      // Very low - draining social energy
    'activity-hobby': 1.3,   // Moderate - prefers contemplative activities
    'favor-support': 1.7,    // High - values emotional support and deep care
    'celebration': 1.0,      // Low-moderate - tolerates for close friends
  },
  // The Fool values spontaneity, novelty, and light-hearted fun.
  Fool: {
    'text-call': 1.7,        // High - loves quick, playful exchanges
    'voice-note': 1.6,       // High - fun and spontaneous
    'meal-drink': 1.3,       // Moderate - good but not peak
    'hangout': 1.6,          // High - casual and fun
    'deep-talk': 1.1,        // Low-moderate - can feel heavy
    'event-party': 1.8,      // High - loves social energy
    'activity-hobby': 1.9,   // Peak - adventures and new experiences
    'favor-support': 1.2,    // Low-moderate - less comfortable with serious support
    'celebration': 1.5,      // Good - loves the party vibe
  },
  // The Sun values celebration, visibility, and high-energy social gatherings.
  Sun: {
    'text-call': 0.8,        // Low - prefers visibility
    'voice-note': 0.7,       // Low - not enough presence
    'meal-drink': 1.6,       // High - social eating experience
    'hangout': 1.4,          // Good - enjoys group energy
    'deep-talk': 1.0,        // Moderate - not the focus
    'event-party': 2.0,      // Peak - this is the sweet spot
    'activity-hobby': 1.6,   // High - loves shared excitement
    'favor-support': 1.5,    // Good - enjoys being there for friends
    'celebration': 2.0,      // Peak - lives for these moments
  },
  // The Hermit values solitude, quiet contemplation, and meaningful one-on-one time.
  Hermit: {
    'text-call': 1.5,        // Good - controlled, low-energy connection
    'voice-note': 1.7,       // High - appreciates thoughtful messages
    'meal-drink': 1.2,       // Moderate - okay in small doses
    'hangout': 0.9,          // Low - depends on energy level
    'deep-talk': 1.9,        // Peak - craves meaningful exchange
    'event-party': 0.5,      // Very low - draining
    'activity-hobby': 1.4,   // Good - prefers quiet, focused activities
    'favor-support': 1.6,    // High - values one-on-one support conversations
    'celebration': 0.8,      // Low - tolerates for loved ones
  },
  // The Magician values creativity, focused energy, and shared projects or ideas.
  Magician: {
    'text-call': 1.1,        // Moderate - efficient for coordination
    'voice-note': 1.2,       // Moderate - good for ideas
    'meal-drink': 1.4,       // Good - brainstorming over coffee
    'hangout': 1.3,          // Moderate - depends on purpose
    'deep-talk': 1.5,        // High - loves intellectual exchange
    'event-party': 1.6,      // High - networking and inspiration
    'activity-hobby': 1.9,   // Peak - collaborative creation
    'favor-support': 1.5,    // Good - enjoys helping solve problems
    'celebration': 1.7,      // High - enjoys meaningful milestones
  },
  // The Lovers values harmony, reciprocal dialogue, and the beauty of mirrored connection.
  Lovers: {
    'text-call': 1.5,        // Good - maintaining connection
    'voice-note': 1.4,       // Good - thoughtful exchanges
    'meal-drink': 1.8,       // High - shared meals for dialogue
    'hangout': 1.6,          // High - quality time together
    'deep-talk': 2.0,        // Peak - reciprocal dialogue is the sweet spot
    'event-party': 0.9,      // Low - too many people, less intimate
    'activity-hobby': 1.5,   // Good - building we-ness through shared activities
    'favor-support': 1.7,    // High - reciprocal care and support
    'celebration': 1.5,      // Good - celebrating relationship milestones
  },
  // Unknown archetype - neutral multipliers for batch-added friends awaiting archetype assignment
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

export const archetypeData: Record<Archetype, { name: string; essence: string; careStyle: string; icon: string; }> = {
    Emperor: { icon: "👑", name: "The Emperor", essence: "The Architect of Order", careStyle: "A promise honored, a plan fulfilled." },
    Empress: { icon: "🌹", name: "The Empress", essence: "The Nurturer of Comfort", careStyle: "Where care flows, where beauty is made." },
    HighPriestess: { icon: "🌙", name: "The High Priestess", essence: "The Keeper of Depth", careStyle: "In quiet corners, in the truths beneath words." },
    Fool: { icon: "🃏", name: "The Fool", essence: "The Spirit of Play", careStyle: "With laughter, with a door left open." },
    Sun: { icon: "☀️", name: "The Sun", essence: "The Bringer of Joy", careStyle: "In celebration, in the radiance of being seen." },
    Hermit: { icon: "🏮", name: "The Hermit", essence: "The Guardian of Solitude", careStyle: "In patience, in the glow of stillness." },
    Magician: { icon: "⚡", name: "The Magician", essence: "The Spark of Possibility", careStyle: "At thresholds, where sparks leap into being." },
    Lovers: { icon: "💞", name: "The Lovers", essence: "The Mirror of Connection", careStyle: "In reciprocal dialogue, in the beauty of a mirrored soul." },
    Unknown: { icon: "❓", name: "Unknown", essence: "Awaiting Discovery", careStyle: "A connection yet to be defined." },
};

export const tierMap: Record<string, Tier> = {
  inner: "InnerCircle",
  close: "CloseFriends",
  community: "Community",
};

export const tierColors: Record<Tier, string> = {
  InnerCircle: '#A56A43', // A warm, deep brown for the closest circle
  CloseFriends: '#E58A57', // A friendly, approachable orange
  Community: '#6C8EAD',    // A calm, gentle blue for the wider community
};

export const archetypeIcons: Record<Archetype, string> = {
  Emperor: "👑",
  Empress: "🌹",
  HighPriestess: "🌙",
  Fool: "🃏",
  Sun: "☀️",
  Hermit: "🏮",
  Magician: "⚡",
  Lovers: "💞",
  Unknown: "❓",
};

export const modeIcons: Record<string, string> = {
  'one-on-one': '🌿',
  'group-flow': '🌊',
  'celebration': '🔥',
  'quick-touch': '🌀',
  'cozy-time': '🌙',
  'out-and-about': '☀️',
  default: '💫',
};

export const moonPhasesData: { phase: string; icon: string; microcopy: string }[] = [
  { phase: "NewMoon", icon: "🌑", microcopy: "The night is dark. A new thread awaits." },
  { phase: "WaxingCrescent", icon: "🌒", microcopy: "The crescent stirs with quiet promise." },
  { phase: "FirstQuarter", icon: "🌓", microcopy: "Steady light holds the weave." },
  { phase: "WaxingGibbous", icon: "🌔", microcopy: "The glow gathers strength." },
  { phase: "FullMoon", icon: "🌕", microcopy: "The moon is full, the bond complete." },
];