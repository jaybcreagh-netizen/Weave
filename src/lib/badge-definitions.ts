/**
 * Badge Definitions
 *
 * Defines all per-friend relationship badges that can be earned
 * Badges are organized into categories with progressive tiers
 */

export interface BadgeDefinition {
  id: string;
  name: string;
  icon: string;
  description: string;
  threshold: number;
  tier: number; // 1-7 for progression tiers
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  flavorText?: string; // Optional poetic description
}

export interface BadgeCategory {
  type: string;
  name: string;
  icon: string;
  badges: BadgeDefinition[];
}

// ============================================================================
// WEAVE COUNT BADGES (7 tiers)
// ============================================================================

export const WEAVE_COUNT_BADGES: BadgeDefinition[] = [
  {
    id: 'first_thread',
    name: 'First Thread',
    icon: '🌱',
    description: 'Your first weave together',
    threshold: 1,
    tier: 1,
    rarity: 'common',
    flavorText: 'Every great bond begins with a single thread',
  },
  {
    id: 'growing_bond',
    name: 'Growing Bond',
    icon: '🪴',
    description: '10 weaves logged',
    threshold: 10,
    tier: 2,
    rarity: 'common',
    flavorText: 'The seedling of friendship takes root',
  },
  {
    id: 'strong_connection',
    name: 'Strong Connection',
    icon: '🌿',
    description: '25 weaves logged',
    threshold: 25,
    tier: 3,
    rarity: 'rare',
    flavorText: 'A connection that grows stronger with each passing day',
  },
  {
    id: 'deep_roots',
    name: 'Deep Roots',
    icon: '🌳',
    description: '50 weaves logged',
    threshold: 50,
    tier: 4,
    rarity: 'rare',
    flavorText: 'Your bond has taken deep root',
  },
  {
    id: 'towering_bond',
    name: 'Towering Bond',
    icon: '🌲',
    description: '100 weaves logged',
    threshold: 100,
    tier: 5,
    rarity: 'epic',
    flavorText: 'A towering testament to your dedication',
  },
  {
    id: 'eternal_weave',
    name: 'Eternal Weave',
    icon: '🌌',
    description: '250 weaves logged',
    threshold: 250,
    tier: 6,
    rarity: 'epic',
    flavorText: 'Among the stars, your connection shines eternal',
  },
  {
    id: 'kindred_spirit',
    name: 'Kindred Spirit',
    icon: '✨',
    description: '500 weaves logged',
    threshold: 500,
    tier: 7,
    rarity: 'legendary',
    flavorText: 'A bond that transcends time itself',
  },
];

// ============================================================================
// DEPTH BADGES (reflection quality)
// ============================================================================

export const DEPTH_BADGES: BadgeDefinition[] = [
  {
    id: 'thoughtful',
    name: 'Thoughtful',
    icon: '💭',
    description: '5 reflections with this friend',
    threshold: 5,
    tier: 1,
    rarity: 'common',
    flavorText: 'You pause to reflect on your time together',
  },
  {
    id: 'deep_thinker',
    name: 'Deep Thinker',
    icon: '🧠',
    description: '15 reflections with this friend',
    threshold: 15,
    tier: 2,
    rarity: 'rare',
    flavorText: 'Your reflections reveal profound awareness',
  },
  {
    id: 'soul_witness',
    name: 'Soul Witness',
    icon: '🦉',
    description: '50 reflections with this friend',
    threshold: 50,
    tier: 3,
    rarity: 'epic',
    flavorText: 'You truly see and are seen',
  },
  {
    id: 'life_chronicler',
    name: 'Life Chronicler',
    icon: '📚',
    description: '3 profound reflections',
    threshold: 3,
    tier: 4,
    rarity: 'legendary',
    flavorText: 'You chronicle the story of your friendship',
  },
];

// ============================================================================
// CONSISTENCY BADGES (per-friend streaks)
// ============================================================================

export const CONSISTENCY_BADGES: BadgeDefinition[] = [
  {
    id: 'weekly_regular',
    name: 'Weekly Regular',
    icon: '⚡',
    description: 'Contacted 3 weeks in a row',
    threshold: 3,
    tier: 1,
    rarity: 'common',
    flavorText: 'Consistency is the foundation of connection',
  },
  {
    id: 'monthly_rhythm',
    name: 'Monthly Rhythm',
    icon: '🔥',
    description: 'Contacted 3 months in a row',
    threshold: 3,
    tier: 2,
    rarity: 'rare',
    flavorText: 'A rhythm has formed in your friendship',
  },
  {
    id: 'unbreakable',
    name: 'Unbreakable',
    icon: '💎',
    description: 'Contacted 6 months in a row',
    threshold: 6,
    tier: 3,
    rarity: 'epic',
    flavorText: 'Your bond is unbreakable through time',
  },
];

// ============================================================================
// SPECIAL MOMENT BADGES (event-based)
// ============================================================================

export const SPECIAL_BADGES: BadgeDefinition[] = [
  {
    id: 'first_connection',
    name: 'First Connection',
    icon: '🎉',
    description: 'Your very first weave with this friend',
    threshold: 1,
    tier: 1,
    rarity: 'common',
    flavorText: 'The beginning of something beautiful',
  },
  {
    id: 'dawn_of_friendship',
    name: 'Dawn of Friendship',
    icon: '🌅',
    description: 'Known for less than 30 days',
    threshold: 1,
    tier: 1,
    rarity: 'common',
    flavorText: 'A new friendship blooms',
  },
  {
    id: 'peak_moment',
    name: 'Peak Moment',
    icon: '⛰️',
    description: 'First highly positive interaction',
    threshold: 1,
    tier: 1,
    rarity: 'rare',
    flavorText: 'A moment of pure connection',
  },
  {
    id: 'phoenix_rising',
    name: 'Phoenix Rising',
    icon: '🔥',
    description: 'Rekindled a dormant friendship',
    threshold: 1,
    tier: 1,
    rarity: 'epic',
    flavorText: 'From the ashes, connection rises again',
  },
  {
    id: 'birthday_celebrated',
    name: 'Birthday Celebrated',
    icon: '🎂',
    description: 'Logged interaction on their birthday',
    threshold: 1,
    tier: 1,
    rarity: 'rare',
    flavorText: 'You remembered their special day',
  },
  {
    id: 'anniversary_keeper',
    name: 'Anniversary Keeper',
    icon: '💝',
    description: 'Logged on friendship anniversary',
    threshold: 1,
    tier: 1,
    rarity: 'rare',
    flavorText: 'You honor the day you met',
  },
  {
    id: 'midnight_chat',
    name: 'Midnight Chat',
    icon: '🌙',
    description: 'Logged a late-night connection (after 11pm)',
    threshold: 1,
    tier: 1,
    rarity: 'rare',
    flavorText: 'The best conversations happen under moonlight',
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    icon: '🌄',
    description: 'Logged an early morning hangout (before 7am)',
    threshold: 1,
    tier: 1,
    rarity: 'rare',
    flavorText: 'You greet the dawn together',
  },
];

// ============================================================================
// BADGE REGISTRY
// ============================================================================

export const FRIEND_BADGE_CATEGORIES: BadgeCategory[] = [
  {
    type: 'weave_count',
    name: 'Weaves Together',
    icon: '🧵',
    badges: WEAVE_COUNT_BADGES,
  },
  {
    type: 'depth',
    name: 'Depth of Connection',
    icon: '🦉',
    badges: DEPTH_BADGES,
  },
  {
    type: 'consistency',
    name: 'Consistency',
    icon: '⚡',
    badges: CONSISTENCY_BADGES,
  },
  {
    type: 'special',
    name: 'Special Moments',
    icon: '✨',
    badges: SPECIAL_BADGES,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get badge definition by ID
 */
export function getBadgeById(badgeId: string): BadgeDefinition | null {
  for (const category of FRIEND_BADGE_CATEGORIES) {
    const badge = category.badges.find(b => b.id === badgeId);
    if (badge) return badge;
  }
  return null;
}

/**
 * Get next badge in tier for a category
 */
export function getNextBadgeInCategory(
  categoryType: string,
  currentTier: number
): BadgeDefinition | null {
  const category = FRIEND_BADGE_CATEGORIES.find(c => c.type === categoryType);
  if (!category) return null;

  return category.badges.find(b => b.tier === currentTier + 1) || null;
}

/**
 * Get all badges in a category
 */
export function getBadgesByCategory(categoryType: string): BadgeDefinition[] {
  const category = FRIEND_BADGE_CATEGORIES.find(c => c.type === categoryType);
  return category?.badges || [];
}

/**
 * Get badge category info
 */
export function getBadgeCategory(categoryType: string): BadgeCategory | null {
  return FRIEND_BADGE_CATEGORIES.find(c => c.type === categoryType) || null;
}
