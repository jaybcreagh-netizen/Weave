/**
 * Global Achievement Definitions
 *
 * Defines account-wide achievements that track progress across the entire weave
 * Achievements are categorized and include both visible and hidden unlocks
 */

import { database } from '@/db';
import UserProgress from '@/db/models/UserProgress';
import Friend from '@/db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { calculateCurrentScore } from '@/modules/intelligence';

/**
 * @interface GlobalAchievement
 * @property {string} id - The unique identifier for the achievement.
 * @property {string} name - The name of the achievement.
 * @property {string} icon - The icon for the achievement.
 * @property {string} description - The description of the achievement.
 * @property {number} threshold - The threshold to unlock the achievement.
 * @property {'weaving' | 'consistency' | 'depth' | 'social' | 'hidden'} category - The category of the achievement.
 * @property {'common' | 'rare' | 'epic' | 'legendary'} rarity - The rarity of the achievement.
 * @property {string} [flavorText] - Optional flavor text for the achievement.
 * @property {(userProgress: UserProgress) => number | Promise<number>} calculateProgress - Function to calculate the progress of the achievement.
 */
export interface GlobalAchievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  threshold: number;
  category: 'weaving' | 'consistency' | 'depth' | 'social' | 'hidden';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  flavorText?: string;
  calculateProgress: (userProgress: UserProgress) => number | Promise<number>;
}

// ============================================================================
// WEAVING MASTERY (total weaves logged)
// ============================================================================

export const WEAVING_ACHIEVEMENTS: GlobalAchievement[] = [
  {
    id: 'apprentice_weaver',
    name: 'Apprentice Weaver',
    icon: '🧵',
    description: 'Log 50 total weaves',
    threshold: 50,
    category: 'weaving',
    rarity: 'common',
    flavorText: 'Your journey as a weaver begins',
    calculateProgress: (up) => up.totalWeaves,
  },
  {
    id: 'journeyman_weaver',
    name: 'Journeyman Weaver',
    icon: '🎨',
    description: 'Log 200 total weaves',
    threshold: 200,
    category: 'weaving',
    rarity: 'rare',
    flavorText: 'Your skill in weaving connections grows',
    calculateProgress: (up) => up.totalWeaves,
  },
  {
    id: 'master_weaver',
    name: 'Master Weaver',
    icon: '🏆',
    description: 'Log 500 total weaves',
    threshold: 500,
    category: 'weaving',
    rarity: 'epic',
    flavorText: 'A master of the sacred art',
    calculateProgress: (up) => up.totalWeaves,
  },
  {
    id: 'grandmaster_weaver',
    name: 'Grandmaster Weaver',
    icon: '👑',
    description: 'Log 1,000 total weaves',
    threshold: 1000,
    category: 'weaving',
    rarity: 'legendary',
    flavorText: 'Your tapestry of connection is legendary',
    calculateProgress: (up) => up.totalWeaves,
  },
  {
    id: 'legendary_weaver',
    name: 'Legendary Weaver',
    icon: '💫',
    description: 'Log 2,500 total weaves',
    threshold: 2500,
    category: 'weaving',
    rarity: 'legendary',
    flavorText: 'Legends are woven from threads like these',
    calculateProgress: (up) => up.totalWeaves,
  },
];

// NOTE: CONSISTENCY_ACHIEVEMENTS are derived from milestones and will be handled in the achievement service

// ============================================================================
// SOULCRAFT (reflection depth)
// ============================================================================

export const SOULCRAFT_ACHIEVEMENTS: GlobalAchievement[] = [
  {
    id: 'thoughtful_scribe',
    name: 'Thoughtful Scribe',
    icon: '🖋️',
    description: 'Log 10 reflections',
    threshold: 10,
    category: 'depth',
    rarity: 'common',
    flavorText: 'You begin to document your journey',
    calculateProgress: (up) => up.totalReflections,
  },
  {
    id: 'insightful_chronicler',
    name: 'Insightful Chronicler',
    icon: '📖',
    description: 'Log 50 reflections',
    threshold: 50,
    category: 'depth',
    rarity: 'rare',
    flavorText: 'Your insights grow ever deeper',
    calculateProgress: (up) => up.totalReflections,
  },
  {
    id: 'keeper_of_wisdom',
    name: 'Keeper of Wisdom',
    icon: '🦉',
    description: 'Log 150 reflections',
    threshold: 150,
    category: 'depth',
    rarity: 'epic',
    flavorText: 'Wisdom flows through your reflections',
    calculateProgress: (up) => up.totalReflections,
  },
  {
    id: 'sage_of_connections',
    name: 'Sage of Connections',
    icon: '🔮',
    description: 'Log 500 reflections',
    threshold: 500,
    category: 'depth',
    rarity: 'legendary',
    flavorText: 'A sage understands the depth of all bonds',
    calculateProgress: (up) => up.totalReflections,
  },
];

// ============================================================================
// SOCIAL MASTERY (friend management)
// ============================================================================

export const SOCIAL_ACHIEVEMENTS: GlobalAchievement[] = [
  {
    id: 'inner_circle_guardian',
    name: 'Inner Circle Guardian',
    icon: '🛡️',
    description: 'Maintain 5 inner circle friends above 80 score',
    threshold: 5,
    category: 'social',
    rarity: 'epic',
    flavorText: 'You protect and nurture your closest bonds',
    calculateProgress: async () => {
      const friends = await database
        .get<Friend>('friends')
        .query(Q.where('dunbar_tier', 'InnerCircle'))
        .fetch();

      return friends.filter(f => calculateCurrentScore(f) > 80).length;
    },
  },
  {
    id: 'community_shepherd',
    name: 'Community Shepherd',
    icon: '🌐',
    description: 'Maintain 20+ active friends',
    threshold: 20,
    category: 'social',
    rarity: 'rare',
    flavorText: 'You tend a thriving community',
    calculateProgress: async () => {
      const friends = await database
        .get<Friend>('friends')
        .query(Q.where('is_dormant', false))
        .fetch();

      return friends.length;
    },
  },
  {
    id: 'archetype_curator',
    name: 'Archetype Curator',
    icon: '🎭',
    description: 'Have friends in all 7 archetypes',
    threshold: 7,
    category: 'social',
    rarity: 'epic',
    flavorText: 'You appreciate all forms of connection',
    calculateProgress: async () => {
      const friends = await database
        .get<Friend>('friends')
        .query(Q.where('is_dormant', false))
        .fetch();

      const archetypes = new Set(friends.map(f => f.archetype));
      return archetypes.size;
    },
  },
  {
    id: 'peak_collector',
    name: 'Peak Collector',
    icon: '⛰️',
    description: 'Have 10 profound reflections',
    threshold: 10,
    category: 'social',
    rarity: 'legendary',
    flavorText: 'You have climbed many peaks together',
    calculateProgress: async () => {
      // This would need to count interactions with deepening level 'profound'
      // For now, return 0 - will implement when we have deepening data
      return 0;
    },
  },
];

// ============================================================================
// HIDDEN ACHIEVEMENTS (secrets to discover)
// ============================================================================

export const HIDDEN_ACHIEVEMENTS: GlobalAchievement[] = [
  {
    id: 'night_owl',
    name: 'Night Owl',
    icon: '🦉',
    description: 'Log a weave at 2am',
    threshold: 1,
    category: 'hidden',
    rarity: 'rare',
    flavorText: 'Some of the best moments happen in the quiet hours',
    calculateProgress: () => 0, // Special trigger-based
  },
  // ... and the rest of the hidden achievements
];

// ============================================================================
// GLOBAL ACHIEVEMENTS REGISTRY
// ============================================================================

export const GLOBAL_ACHIEVEMENTS: GlobalAchievement[] = [
  ...WEAVING_ACHIEVEMENTS,
  // ...CONSISTENCY_ACHIEVEMENTS, // Will be added in the service
  ...SOULCRAFT_ACHIEVEMENTS,
  ...SOCIAL_ACHIEVEMENTS,
];

export function getAchievementById(id: string): GlobalAchievement | undefined {
  return [...GLOBAL_ACHIEVEMENTS, ...HIDDEN_ACHIEVEMENTS].find(a => a.id === id);
}
