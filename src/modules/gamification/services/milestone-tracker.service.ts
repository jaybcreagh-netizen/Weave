import { database } from '@/db';
import UserProgress from '@/db/models/UserProgress';
import PracticeLog from '@/db/models/PracticeLog';
import { startOfDay, differenceInDays } from 'date-fns';
import { LucideIcon, Scroll, Trophy, Sparkles, Star, Crown, PenTool, Book, BookOpen, Mountain, Flame, Award, Gem } from 'lucide-react-native';

/**
 * Milestone Tracker
 *
 * Tracks user progress across three paths:
 * 1. Path of Consistency (Practice Streak)
 * 2. Path of Depth (Reflection Journey)
 * 3. Path of Nurturing (Friendship Milestones)
 */

// ============================================================================
// MILESTONE DEFINITIONS
// ============================================================================

export interface Milestone {
  id: string;
  name: string;
  icon: string;
  iconComponent: LucideIcon;
  description: string;
  threshold: number;
}

/**
 * Path of Consistency - Practice Streak
 * Unlocked by maintaining daily practice (any intentional action)
 */
export const CONSISTENCY_MILESTONES: Milestone[] = [
  {
    id: 'thread-starter',
    name: 'Thread Starter',
    icon: '🧵',
    iconComponent: Scroll,
    description: 'Your first week of weaving practice',
    threshold: 7,
  },
  {
    id: 'consistent-weaver',
    name: 'Consistent Weaver',
    icon: '🏆',
    iconComponent: Trophy,
    description: 'Three weeks of daily intentionality',
    threshold: 21,
  },
  {
    id: 'social-architect',
    name: 'Social Architect',
    icon: '✨',
    iconComponent: Sparkles,
    description: 'Two months of dedicated practice',
    threshold: 60,
  },
  {
    id: 'weave-master',
    name: 'Weave Master',
    icon: '🌟',
    iconComponent: Star,
    description: '100 days of nurturing your connections',
    threshold: 100,
  },
  {
    id: 'constellation-keeper',
    name: 'Constellation Keeper',
    icon: '👑',
    iconComponent: Crown,
    description: 'A full year of mindful connection',
    threshold: 365,
  },
];

/**
 * Path of Depth - Reflection Journey
 * Unlocked by total number of reflections (weaves with notes or vibe)
 */
export const DEPTH_MILESTONES: Milestone[] = [
  {
    id: 'thoughtful-scribe',
    name: 'Thoughtful Scribe',
    icon: '🖋️',
    iconComponent: PenTool,
    description: 'Your first reflections on connection',
    threshold: 10,
  },
  {
    id: 'insightful-chronicler',
    name: 'Insightful Chronicler',
    icon: '📖',
    iconComponent: Book,
    description: 'A growing practice of self-awareness',
    threshold: 50,
  },
  {
    id: 'keeper-of-wisdom',
    name: 'Keeper of Wisdom',
    icon: '🦉',
    iconComponent: BookOpen,
    description: 'Deep commitment to reflection',
    threshold: 150,
  },
];

/**
 * Path of Nurturing - Friendship Milestones
 * Unlocked per friend based on specific achievements
 */
export const NURTURING_MILESTONES: Milestone[] = [
  {
    id: 'first-peak',
    name: 'First Peak Moment',
    icon: '⛰️',
    iconComponent: Mountain,
    description: 'A deeply meaningful connection',
    threshold: 1, // Detected by NLP on first highly positive interaction
  },
  {
    id: 'rekindled-flame',
    name: 'Rekindled Flame',
    icon: '🔥',
    iconComponent: Flame,
    description: 'Revived a dormant connection',
    threshold: 1, // Achieved when dormant friend becomes active again
  },
  {
    id: 'centennial-weave',
    name: 'Centennial Weave',
    icon: '💯',
    iconComponent: Award,
    description: '100 weaves with this friend',
    threshold: 100,
  },
  {
    id: 'kindred-spirit',
    name: 'Kindred Spirit',
    icon: '💫',
    iconComponent: Gem,
    description: '500 weaves together - a rare bond',
    threshold: 500,
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get or create the singleton UserProgress record
 */
export async function getUserProgress(): Promise<UserProgress> {
  const collection = database.get<UserProgress>('user_progress');
  const records = await collection.query().fetch();

  if (records.length === 0) {
    // Initialize if doesn't exist
    return await database.write(async () => {
      return await collection.create(p => {
        p.currentStreak = 0;
        p.bestStreak = 0;
        p.totalReflections = 0;
        p.consistencyMilestones = [];
        p.reflectionMilestones = [];
        p.friendshipMilestones = [];
      });
    });
  }

  return records[0];
}

/**
 * Get next milestone on a given path
 */
export function getNextMilestone(
  currentValue: number,
  milestones: Milestone[],
  unlockedIds: string[]
): Milestone | null {
  const nextMilestone = milestones.find(
    m => !unlockedIds.includes(m.id) && currentValue < m.threshold
  );
  return nextMilestone || null;
}

/**
 * Get current milestone (last unlocked) on a given path
 */
export function getCurrentMilestone(
  unlockedIds: string[],
  milestones: Milestone[]
): Milestone | null {
  if (unlockedIds.length === 0) return null;
  const lastUnlockedId = unlockedIds[unlockedIds.length - 1];
  return milestones.find(m => m.id === lastUnlockedId) || null;
}

// ============================================================================
// PRACTICE TRACKING (Path of Consistency)
// ============================================================================

/**
 * Record a "practice" action to maintain streak
 * Call this whenever user performs ANY intentional action:
 * - Logs a weave
 * - Adds reflection to past weave
 * - Acts on a suggestion
 * - Creates an intention
 * - Plans a weave
 *
 * Returns: Array of newly unlocked milestone IDs (if any)
 */
export async function recordPractice(practiceType: string = 'log_weave', relatedId?: string): Promise<string[]> {
  const progress = await getUserProgress();
  const today = startOfDay(new Date());
  const todayTimestamp = today.getTime();

  return await database.write(async () => {
    const newMilestones: string[] = [];

    // Log the practice to practice_log table
    await database.get<PracticeLog>('practice_log').create(log => {
      (log as any).practiceDate = new Date(todayTimestamp);
      (log as any).practiceType = practiceType;
      (log as any).relatedId = relatedId;
    });

    // Check if already practiced today
    if (progress.lastPracticeDate) {
      const lastPractice = startOfDay(progress.lastPracticeDate);
      const daysSinceLastPractice = differenceInDays(today, lastPractice);

      if (daysSinceLastPractice === 0) {
        // Already practiced today, no streak change (but still logged above)
        return newMilestones;
      }

      if (daysSinceLastPractice === 1) {
        // Consecutive day - increment streak
        await progress.update(p => {
          p.currentStreak = progress.currentStreak + 1;
          p.bestStreak = Math.max(progress.bestStreak, progress.currentStreak + 1);
          p.lastPracticeDate = new Date(todayTimestamp);
        });

        // Check for new milestones
        const newStreak = progress.currentStreak + 1;
        const unlockedMilestones = progress.consistencyMilestones || [];

        for (const milestone of CONSISTENCY_MILESTONES) {
          if (
            newStreak >= milestone.threshold &&
            !unlockedMilestones.includes(milestone.id)
          ) {
            unlockedMilestones.push(milestone.id);
            newMilestones.push(milestone.id);
          }
        }

        if (newMilestones.length > 0) {
          await progress.update(p => {
            p.consistencyMilestones = unlockedMilestones;
          });
        }
      } else {
        // Streak broken - reset to 1
        await progress.update(p => {
          p.currentStreak = 1;
          p.lastPracticeDate = new Date(todayTimestamp);
        });
      }
    } else {
      // First practice ever
      await progress.update(p => {
        p.currentStreak = 1;
        p.bestStreak = 1;
        p.lastPracticeDate = new Date(todayTimestamp);
      });
    }

    return newMilestones;
  });
}

// ============================================================================
// REFLECTION TRACKING (Path of Depth)
// ============================================================================

/**
 * Record a reflection (weave with notes or vibe)
 * Call this when user adds reflection to a weave
 *
 * Returns: Array of newly unlocked milestone IDs (if any)
 */
export async function recordReflection(): Promise<string[]> {
  const progress = await getUserProgress();

  return await database.write(async () => {
    const newMilestones: string[] = [];
    const newTotal = progress.totalReflections + 1;
    const unlockedMilestones = progress.reflectionMilestones || [];

    // Check for new milestones
    for (const milestone of DEPTH_MILESTONES) {
      if (
        newTotal >= milestone.threshold &&
        !unlockedMilestones.includes(milestone.id)
      ) {
        unlockedMilestones.push(milestone.id);
        newMilestones.push(milestone.id);
      }
    }

    await progress.update(p => {
      p.totalReflections = newTotal;
      if (newMilestones.length > 0) {
        p.reflectionMilestones = unlockedMilestones;
      }
    });

    return newMilestones;
  });
}

// ============================================================================
// FRIENDSHIP MILESTONES (Path of Nurturing)
// ============================================================================

/**
 * Check and unlock friendship milestone for a specific friend
 * Call this after significant friend events
 *
 * Returns: Array of newly unlocked milestone IDs for this friend (if any)
 */
export async function checkFriendshipMilestone(
  friendId: string,
  milestoneId: string
): Promise<string[]> {
  const progress = await getUserProgress();

  return await database.write(async () => {
    const friendshipMilestones = progress.friendshipMilestones || [];
    const friendRecord = friendshipMilestones.find(f => f.friendId === friendId);

    if (!friendRecord) {
      // First milestone for this friend
      const newRecord = {
        friendId,
        milestones: [milestoneId],
      };
      await progress.update(p => {
        p.friendshipMilestones = [...friendshipMilestones, newRecord];
      });
      return [milestoneId];
    }

    if (friendRecord.milestones.includes(milestoneId)) {
      // Already unlocked
      return [];
    }

    // Add new milestone
    const updatedFriendships = friendshipMilestones.map(f =>
      f.friendId === friendId
        ? { ...f, milestones: [...f.milestones, milestoneId] }
        : f
    );

    await progress.update(p => {
      p.friendshipMilestones = updatedFriendships;
    });

    return [milestoneId];
  });
}

/**
 * Get all unlocked milestones for a specific friend
 */
export async function getFriendMilestones(friendId: string): Promise<Milestone[]> {
  const progress = await getUserProgress();
  const friendshipMilestones = progress.friendshipMilestones || [];
  const friendRecord = friendshipMilestones.find(f => f.friendId === friendId);

  if (!friendRecord) return [];

  return NURTURING_MILESTONES.filter(m => friendRecord.milestones.includes(m.id));
}
