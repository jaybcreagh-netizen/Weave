/**
 * Global Achievement Definitions
 *
 * Defines account-wide achievements that track progress across the entire weave
 * Achievements are categorized and include both visible and hidden unlocks
 */

import { database } from '../db';
import UserProgress from '../db/models/UserProgress';
import Friend from '../db/models/Friend';
import { Q } from '@nozbe/watermelondb';
import { CONSISTENCY_MILESTONES } from './milestone-tracker';
import { calculateCurrentScore } from './weave-engine';

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

// ============================================================================
// CONSISTENCY PATH (streaks)
// ============================================================================

// Convert existing CONSISTENCY_MILESTONES to GlobalAchievements
export const CONSISTENCY_ACHIEVEMENTS: GlobalAchievement[] = CONSISTENCY_MILESTONES.map(m => ({
  id: m.id,
  name: m.name,
  icon: m.icon,
  description: m.description,
  threshold: m.threshold,
  category: 'consistency' as const,
  rarity: m.threshold >= 365
    ? 'legendary'
    : m.threshold >= 100
    ? 'epic'
    : m.threshold >= 21
    ? 'rare'
    : 'common',
  flavorText: undefined,
  calculateProgress: (up: UserProgress) => up.currentStreak,
}));

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
  {
    id: 'perfect_week',
    name: 'Perfect Week',
    icon: '✨',
    description: 'Contact every friend in 7 days',
    threshold: 1,
    category: 'hidden',
    rarity: 'epic',
    flavorText: 'A week of perfect balance',
    calculateProgress: () => 0, // Special trigger-based
  },
  {
    id: 'renaissance_soul',
    name: 'Renaissance Soul',
    icon: '🎨',
    description: 'Use every interaction type at least once',
    threshold: 1,
    category: 'hidden',
    rarity: 'rare',
    flavorText: 'You explore all forms of connection',
    calculateProgress: () => 0, // Special trigger-based
  },
  {
    id: 'rekindle_master',
    name: 'Rekindle Master',
    icon: '🔥',
    description: 'Restore 3 dormant friendships',
    threshold: 3,
    category: 'hidden',
    rarity: 'epic',
    flavorText: 'You breathe life into fading embers',
    calculateProgress: () => 0, // Special trigger-based
  },
  {
    id: 'planning_prodigy',
    name: 'Planning Prodigy',
    icon: '📅',
    description: 'Complete 10 planned weaves on time',
    threshold: 10,
    category: 'hidden',
    rarity: 'rare',
    flavorText: 'Your plans become reality',
    calculateProgress: () => 0, // Special trigger-based
  },
  {
    id: 'marathon_conversation',
    name: 'Marathon Conversation',
    icon: '💬',
    description: 'Log an extended duration weave (4+ hours)',
    threshold: 1,
    category: 'hidden',
    rarity: 'rare',
    flavorText: 'Time disappears when you connect deeply',
    calculateProgress: () => 0, // Special trigger-based
  },
  {
    id: 'year_of_connection',
    name: 'Year of Connection',
    icon: '🌟',
    description: 'Celebrate your 1 year anniversary with Weave',
    threshold: 1,
    category: 'hidden',
    rarity: 'legendary',
    flavorText: 'One year of mindful connection',
    calculateProgress: () => 0, // Special trigger-based
  },
];

// ============================================================================
// GLOBAL ACHIEVEMENTS REGISTRY
// ============================================================================

export const GLOBAL_ACHIEVEMENTS: GlobalAchievement[] = [
  ...WEAVING_ACHIEVEMENTS,
  ...CONSISTENCY_ACHIEVEMENTS,
  ...SOULCRAFT_ACHIEVEMENTS,
  ...SOCIAL_ACHIEVEMENTS,
];

// Hidden achievements are separate
export { HIDDEN_ACHIEVEMENTS };

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get achievement by ID
 */
export function getAchievementById(achievementId: string): GlobalAchievement | null {
  const all = [...GLOBAL_ACHIEVEMENTS, ...HIDDEN_ACHIEVEMENTS];
  return all.find(a => a.id === achievementId) || null;
}

/**
 * Get achievements by category
 */
export function getAchievementsByCategory(
  category: GlobalAchievement['category']
): GlobalAchievement[] {
  return GLOBAL_ACHIEVEMENTS.filter(a => a.category === category);
}

/**
 * Get achievements by rarity
 */
export function getAchievementsByRarity(
  rarity: GlobalAchievement['rarity']
): GlobalAchievement[] {
  return GLOBAL_ACHIEVEMENTS.filter(a => a.rarity === rarity);
}

/**
 * Check if achievement is hidden
 */
export function isHiddenAchievement(achievementId: string): boolean {
  return HIDDEN_ACHIEVEMENTS.some(a => a.id === achievementId);
}
