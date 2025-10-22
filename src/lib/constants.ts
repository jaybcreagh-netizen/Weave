import { Tier, InteractionType, Duration, Vibe, Archetype } from '../components/types';

export const TierDecayRates: Record<Tier, number> = {
  InnerCircle: 2.5,
  CloseFriends: 1.5,
  Community: 0.5,
};

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
};

export const archetypeData: Record<Archetype, { name: string; essence: string; careStyle: string; icon: string; }> = {
    Emperor: { icon: "👑", name: "The Emperor", essence: "The Architect of Order", careStyle: "A promise honored, a plan fulfilled." },
    Empress: { icon: "🌹", name: "The Empress", essence: "The Nurturer of Comfort", careStyle: "Where care flows, where beauty is made." },
    HighPriestess: { icon: "🌙", name: "The High Priestess", essence: "The Keeper of Depth", careStyle: "In quiet corners, in the truths beneath words." },
    Fool: { icon: "🃏", name: "The Fool", essence: "The Spirit of Play", careStyle: "With laughter, with a door left open." },
    Sun: { icon: "☀️", name: "The Sun", essence: "The Bringer of Joy", careStyle: "In celebration, in the radiance of being seen." },
    Hermit: { icon: "🏮", name: "The Hermit", essence: "The Guardian of Solitude", careStyle: "In patience, in the glow of stillness." },
    Magician: { icon: "⚡", name: "The Magician", essence: "The Spark of Possibility", careStyle: "At thresholds, where sparks leap into being." },
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