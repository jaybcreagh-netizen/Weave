import { Tier, InteractionType, Duration, Vibe, Archetype } from '../components/types';

export const TierDecayRates: Record<Tier, number> = {
  InnerCircle: 2.5,
  CloseFriends: 1.5,
  Community: 0.5,
};

export const InteractionBaseScores: Record<InteractionType, number> = {
  Event: 30,
  Meal: 25,
  Home: 25,
  Coffee: 20,
  Call: 15,
  Text: 5,
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
  Emperor:       { Event: 1.8, Meal: 1.4, Home: 1.2, Coffee: 1.0, Call: 0.9, Text: 0.6 },
  Empress:       { Event: 0.8, Meal: 1.6, Home: 2.0, Coffee: 1.2, Call: 1.1, Text: 0.9 },
  HighPriestess: { Event: 0.6, Meal: 1.0, Home: 1.4, Coffee: 1.8, Call: 2.0, Text: 0.7 },
  Fool:          { Event: 1.2, Meal: 0.9, Home: 0.8, Coffee: 1.5, Call: 1.0, Text: 1.8 },
  Sun:           { Event: 2.0, Meal: 1.6, Home: 1.1, Coffee: 1.3, Call: 0.7, Text: 0.8 },
  Hermit:        { Event: 0.6, Meal: 0.8, Home: 1.0, Coffee: 1.2, Call: 1.8, Text: 1.6 },
  Magician:      { Event: 1.7, Meal: 1.1, Home: 0.9, Coffee: 1.6, Call: 1.2, Text: 1.0 },
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