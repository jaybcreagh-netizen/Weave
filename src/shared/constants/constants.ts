import { Tier, Archetype } from '../components/types';

// Tier capacity limits (based on Dunbar's layers)
export const TierCapacity: Record<Tier, number> = {
  InnerCircle: 5,
  CloseFriends: 15,
  Community: 50,
};

// Tier health thresholds - what score is considered "healthy" for each tier
// Accounts for different natural interaction frequencies
export const TierHealthThresholds: Record<Tier, number> = {
  InnerCircle: 75,     // Inner circle needs frequent attention
  CloseFriends: 65,    // Close friends need regular connection
  Community: 50,       // Community can be healthy with less frequent contact
};

// Tier weights for calculating overall network health
// Closer relationships contribute more to overall wellbeing
export const TierWeights: Record<Tier, number> = {
  InnerCircle: 0.50,   // 50% of network health
  CloseFriends: 0.35,  // 35% of network health
  Community: 0.15,     // 15% of network health
};

// Helper to get tier capacity by tier name
export const getTierCapacity = (tier: Tier | string): number => {
  if (tier === 'inner' || tier === 'InnerCircle') return TierCapacity.InnerCircle;
  if (tier === 'close' || tier === 'CloseFriends') return TierCapacity.CloseFriends;
  if (tier === 'community' || tier === 'Community') return TierCapacity.Community;
  return 50; // default to Community capacity
};

// Check if a tier is at or over its recommended capacity
export const isTierAtCapacity = (currentCount: number, tier: Tier | string): boolean => {
  return currentCount >= getTierCapacity(tier);
};

// Get the tier display name for educational messaging
export const getTierDisplayName = (tier: Tier | string): string => {
  if (tier === 'inner' || tier === 'InnerCircle') return 'Inner Circle';
  if (tier === 'close' || tier === 'CloseFriends') return 'Close Friends';
  if (tier === 'community' || tier === 'Community') return 'Community';
  return 'Community';
};

export const archetypeData: Record<Archetype, { name: string; essence: string; description: string; careStyle: string; icon: string; }> = {
    Emperor: {
        icon: "👑",
        name: "The Emperor",
        essence: "Structure & Leadership",
        description: "In tarot, the Emperor represents authority, stability, and order. In friendship, this means valuing reliability and commitment. They appreciate when plans are made and kept, when you show up on time, and when intentions are clear.",
        careStyle: "Structured dinners • Planned outings • Regular check-ins • Achievement celebrations • Goal-oriented activities • Milestone events"
    },
    Empress: {
        icon: "🌹",
        name: "The Empress",
        essence: "Abundance & Nurture",
        description: "In tarot, the Empress embodies nurturing, sensory pleasure, and creation. In friendship, this means caring through comfort and generosity. They notice when you need support and create warmth through food, beauty, and cozy spaces.",
        careStyle: "Cooking together • Home hangs • Sharing meals • Gift-giving • Nature walks • Cozy gatherings • Comfort food"
    },
    HighPriestess: {
        icon: "🌙",
        name: "The High Priestess",
        essence: "Intuition & Mystery",
        description: "In tarot, the High Priestess represents inner wisdom, intuition, and the unseen. In friendship, this means valuing depth and privacy. They prefer meaningful one-on-one connection over surface-level socializing and need space to recharge.",
        careStyle: "Deep conversations • Quiet cafes • Long phone calls • Tea time • Thoughtful messages • One-on-one hangs • Contemplative activities"
    },
    Fool: {
        icon: "🃏",
        name: "The Fool",
        essence: "Freedom & Adventure",
        description: "In tarot, the Fool represents new beginnings, spontaneity, and trust in the journey. In friendship, this means embracing playfulness and novelty. They keep things light, suggest last-minute plans, and turn ordinary moments into adventures.",
        careStyle: "Spontaneous hangs • Trying new things • Quick texts • Adventures • Playful activities • Exploring new places • Last-minute plans"
    },
    Sun: {
        icon: "☀️",
        name: "The Sun",
        essence: "Vitality & Celebration",
        description: "In tarot, the Sun represents joy, success, and radiant energy. In friendship, this means loving celebration and visibility. They bring warmth to gatherings, make others feel special, and thrive when there's something to celebrate together.",
        careStyle: "Parties • Group events • Birthdays • Achievement celebrations • Social gatherings • Public celebrations • Big moments"
    },
    Hermit: {
        icon: "🏮",
        name: "The Hermit",
        essence: "Solitude & Reflection",
        description: "In tarot, the Hermit represents introspection, wisdom through withdrawal, and inner guidance. In friendship, this means needing solitude to recharge while valuing deep connection with a select few. They prefer quiet settings and meaningful presence.",
        careStyle: "Walks • One-on-one time • Video calls • Quiet spaces • Tea time • Thoughtful check-ins • Low-key hangs"
    },
    Magician: {
        icon: "⚡",
        name: "The Magician",
        essence: "Skill & Manifestation",
        description: "In tarot, the Magician represents resourcefulness, transformation, and bringing ideas to life. In friendship, this means loving collaboration and creation. They enjoy building things together, exploring possibilities, and celebrating growth.",
        careStyle: "Creative projects • Game nights • Building things together • Learning new skills • Problem-solving • Brainstorming • Shared goals"
    },
    Lovers: {
        icon: "💞",
        name: "The Lovers",
        essence: "Union & Harmony",
        description: "In tarot, the Lovers represent partnership, choice, and meaningful connection. In friendship, this means valuing reciprocity and balance. They need to feel equally seen and valued, and they notice when effort flows only one way.",
        careStyle: "Deep conversations • Reciprocal check-ins • Shared experiences • Equal give-and-take • Emotional support • Quality time • Meaningful dialogue"
    },
    Unknown: {
        icon: "❓",
        name: "Unknown",
        essence: "Awaiting Discovery",
        description: "This friend's archetype hasn't been defined yet. As you get to know them better, you'll discover their unique connection style and what helps your relationship thrive.",
        careStyle: "Take time to observe how this friend naturally connects. Do they prefer deep talks or light fun? Planned events or spontaneity? Large groups or one-on-one time? Let the relationship guide you to their archetype."
    },
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
