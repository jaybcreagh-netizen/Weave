import { Tier, Archetype, InteractionCategory, ActivityType } from '../types/common';

export const TIER_CONFIG = {
  InnerCircle: {
    displayName: 'Inner Circle',
    maxCount: 5,
    decayRate: 0.05, // 5% per week
    idealFrequency: 7, // Days
  },
  CloseFriends: {
    displayName: 'Close Friends',
    maxCount: 15,
    decayRate: 0.10, // 10% per week
    idealFrequency: 14, // Days
  },
  Community: {
    displayName: 'Community',
    maxCount: 50, // Soft limit, Dunbar says 150 total relationships
    decayRate: 0.15, // 15% per week
    idealFrequency: 30, // Days
  },
} as const;

export const getTierDisplayName = (tier?: string) => {
  if (tier === 'InnerCircle' || tier === 'inner') return 'Inner Circle';
  if (tier === 'CloseFriends' || tier === 'close') return 'Close Friends';
  return 'Community';
};

export const getTierCapacity = (tier?: string) => {
  if (tier === 'InnerCircle' || tier === 'inner') return 5;
  if (tier === 'CloseFriends' || tier === 'close') return 15;
  return 50;
};

export const isTierAtCapacity = (currentCount: number, tier: string) => {
  const capacity = getTierCapacity(tier);
  return currentCount >= capacity;
};

export const archetypeData: Record<Archetype, { name: string; essence: string; description: string; traits: string[]; icon: string; careStyle: string }> = {
  Emperor: {
    name: 'The Emperor',
    essence: 'Protector & Builder',
    description: 'Provides stability, structure, and practical support. They are reliable foundations in your life.',
    traits: ['Reliable', 'Protective', 'Structured', 'Practical'],
    icon: '🏰',
    careStyle: 'Acts of Service'
  },
  Empress: {
    name: 'The Empress',
    essence: 'Nurturer & Creator',
    description: 'Brings warmth, abundance, and emotional nourishment. They help you grow and feel cared for.',
    traits: ['Nurturing', 'Creative', 'Warm', 'Abundant'],
    icon: '🌱',
    careStyle: 'Gifts & Nurturing'
  },
  HighPriestess: {
    name: 'The High Priestess',
    essence: 'Intuitive & Confidant',
    description: 'Understands the unspoken. A safe harbor for secrets, deep feelings, and spiritual connection.',
    traits: ['Intuitive', 'Deep', 'Mysterious', 'Understanding'],
    icon: '🌙',
    careStyle: 'Deep Listening'
  },
  Fool: {
    name: 'The Fool',
    essence: 'Adventurer & Joy-Bringer',
    description: 'Brings spontaneity, fun, and new experiences. They remind you not to take life too seriously.',
    traits: ['Spontaneous', 'Playful', 'Optimistic', 'Free-spirited'],
    icon: '🎒',
    careStyle: 'Play & Adventure'
  },
  Sun: {
    name: 'The Sun',
    essence: 'Optimist & Energizer',
    description: 'Radiates positivity and vitality. Being around them recharges your batteries and lifts your spirits.',
    traits: ['Radiant', 'Optimistic', 'Energetic', 'Joyful'],
    icon: '☀️',
    careStyle: 'Celebration & Energy'
  },
  Hermit: {
    name: 'The Hermit',
    essence: 'Guide & Truth-Seeker',
    description: 'Values deep, one-on-one connection and wisdom. They help you find clarity and inner truth.',
    traits: ['Wise', 'Introspective', 'Authentic', 'Patient'],
    icon: '🏮',
    careStyle: 'Presence & Wisdom'
  },
  Magician: {
    name: 'The Magician',
    essence: 'Catalyst & Inspirer',
    description: 'Makes things happen. They inspire you to take action, transform, and realize your potential.',
    traits: ['Transformative', 'Inspiring', 'Resourceful', 'Active'],
    icon: '✨',
    careStyle: 'Shared Projects'
  },
  Lovers: {
    name: 'The Lovers',
    essence: 'Mirror & Harmonizer',
    description: 'Reflects your values and seeks harmony. A connection based on mutual choice and deep alignment.',
    traits: ['Harmonious', 'Aligned', 'Reflective', 'Connected'],
    icon: '❤️',
    careStyle: 'Quality Time'
  },
  Unknown: {
    name: 'Unknown',
    essence: 'Unassigned Archetype',
    description: 'This friend has not been assigned an archetype yet.',
    traits: [],
    icon: '❓',
    careStyle: 'Unknown'
  }
};

export const archetypeIcons: Record<Archetype, any> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Emperor: require('@/assets/icon.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Empress: require('@/assets/icon.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  HighPriestess: require('@/assets/icon.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Fool: require('@/assets/icon.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sun: require('@/assets/icon.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Hermit: require('@/assets/icon.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Magician: require('@/assets/icon.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Lovers: require('@/assets/icon.png'),
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Unknown: require('@/assets/icon.png'),
};

export const tierColors = {
  InnerCircle: '#10B981',
  CloseFriends: '#3B82F6',
  Community: '#8B5CF6',
};

export const tierMap: Record<string, Tier> = {
  inner: 'InnerCircle',
  close: 'CloseFriends',
  community: 'Community',
  InnerCircle: 'InnerCircle',
  CloseFriends: 'CloseFriends',
  Community: 'Community',
};

export const moonPhasesData = {
  NewMoon: { icon: '🌑', label: 'New Moon' },
  WaxingCrescent: { icon: '🌒', label: 'Waxing Crescent' },
  FirstQuarter: { icon: '🌓', label: 'First Quarter' },
  WaxingGibbous: { icon: '🌔', label: 'Waxing Gibbous' },
  FullMoon: { icon: '🌕', label: 'Full Moon' },
};

export const modeIcons = {
  light: '☀️',
  dark: '🌙',
  system: '⚙️',
};

// V2 Matrix: Maps Archetype -> Interaction Category -> Multiplier (0.5 to 2.0)
// This replaces the old Activity-based matrix
export const CategoryArchetypeMatrix: Record<Archetype, Record<InteractionCategory, number>> = {
  Emperor: {
    'favor-support': 2.0,    // Loves being useful
    'meal-drink': 1.5,       // Traditional bonding
    'text-call': 1.2,        // Keeping in touch
    'activity-hobby': 1.0,
    'event-party': 0.8,      // Can be overwhelming
    'hangout': 1.2,
    'deep-talk': 1.0,
    'celebration': 1.0,
    'voice-note': 0.8,
  },
  Empress: {
    'meal-drink': 1.8,       // Nurturing through food
    'favor-support': 2.0,    // Acts of service
    'deep-talk': 1.6,        // Emotional connection
    'text-call': 1.2,
    'hangout': 1.5,
    'activity-hobby': 1.0,
    'event-party': 1.2,      // Hosting energy
    'celebration': 1.5,
    'voice-note': 1.2,
  },
  HighPriestess: {
    'deep-talk': 2.2,        // Soul connection
    'voice-note': 1.5,       // Intuitive sharing
    'text-call': 1.0,
    'meal-drink': 1.2,
    'hangout': 1.2,          // Quiet presence
    'activity-hobby': 0.8,
    'event-party': 0.5,      // Draining
    'favor-support': 1.5,    // Emotional support
    'celebration': 0.8,
  },
  Fool: {
    'activity-hobby': 2.0,   // Adventure
    'event-party': 1.8,      // Social chaos
    'hangout': 1.5,          // Spontaneity
    'text-call': 1.0,
    'meal-drink': 1.2,
    'deep-talk': 0.8,        // Too serious
    'favor-support': 1.0,
    'celebration': 2.0,
    'voice-note': 1.2,
  },
  Sun: {
    'event-party': 2.2,      // Being seen, joy
    'celebration': 2.2,      // Radiance
    'activity-hobby': 1.8,   // Fun
    'meal-drink': 1.5,
    'hangout': 1.5,
    'text-call': 1.5,
    'deep-talk': 1.2,
    'favor-support': 1.5,
    'voice-note': 1.5,
  },
  Hermit: {
    'deep-talk': 2.0,        // One-on-one depth
    'text-call': 0.8,        // Disturbance
    'meal-drink': 1.2,       // Quiet coffee
    'hangout': 1.5,          // Parallel play
    'activity-hobby': 1.2,   // Shared interest, low talk
    'event-party': 0.2,      // Nightmare
    'favor-support': 1.0,
    'celebration': 0.5,
    'voice-note': 1.0,
  },
  Magician: {
    'activity-hobby': 2.2,   // Creating together
    'deep-talk': 1.8,        // Intellectual sparring
    'text-call': 1.5,        // Idea sharing
    'meal-drink': 1.2,
    'hangout': 1.2,
    'event-party': 1.5,      // Networking
    'favor-support': 1.2,
    'celebration': 1.5,
    'voice-note': 1.8,
  },
  Lovers: {
    'deep-talk': 2.0,
    'meal-drink': 1.8,
    'hangout': 1.8,
    'text-call': 1.5,
    'voice-note': 1.5,
    'event-party': 1.2,
    'activity-hobby': 1.5,
    'favor-support': 1.8,
    'celebration': 1.8,
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
};

export const ITEM_LABELS: Record<string, string> = {
  'text-call': 'Text/Call',
  'meal-drink': 'Meal/Drink',
  'hangout': 'Hangout',
  'deep-talk': 'Deep Talk',
  'activity-hobby': 'Activity',
  'voice-note': 'Voice Note',
  'event-party': 'Event',
  'favor-support': 'Support',
  'celebration': 'Celebration',
  'sleepover': 'Sleepover',
  'date': 'Date',
  'workout': 'Workout',
  'co-working': 'Co-working',
  'travel': 'Travel',
};

export const REVERSE_ITEM_LABELS: Record<string, string> = Object.entries(ITEM_LABELS).reduce((acc, [key, value]) => {
  acc[value] = key;
  return acc;
}, {} as Record<string, string>);

export const ARCHETYPE_GRADIENTS: Record<Archetype, string[]> = {
  Emperor: ['#ef4444', '#dc2626'],
  Empress: ['#10b981', '#059669'],
  HighPriestess: ['#8b5cf6', '#7c3aed'],
  Fool: ['#f59e0b', '#d97706'],
  Sun: ['#eab308', '#ca8a04'],
  Hermit: ['#6366f1', '#4f46e5'],
  Magician: ['#ec4899', '#db2777'],
  Lovers: ['#fb7185', '#f43f5e'],
  Unknown: ['#9ca3af', '#6b7280'],
};
