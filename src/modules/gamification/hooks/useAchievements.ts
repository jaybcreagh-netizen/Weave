import { useState, useEffect } from 'react';
import { database } from '@/db';
import UserProgress from '@/db/models/UserProgress';
import { CONSISTENCY_MILESTONES, Milestone } from '../services/milestone-tracker.service';

/**
 * @interface Achievement
 * @extends Milestone
 * @property {boolean} isUnlocked - Whether the achievement is unlocked.
 * @property {number} progress - The progress towards the achievement.
 */
export interface Achievement extends Milestone {
  isUnlocked: boolean;
  progress: number;
}

/**
 * A custom hook to fetch and manage the user's achievements.
 * @returns {{achievements: Achievement[], loading: boolean}} An object containing the achievements and a loading state.
 */
export const useAchievements = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAchievements = async () => {
      try {
        const userProgress = await database.get<UserProgress>('user_progress').query().fetch();
        const progress = userProgress[0];

        const unlockedMilestones = progress.consistencyMilestones || [];
        const nextMilestone = CONSISTENCY_MILESTONES.find(m => !unlockedMilestones.includes(m.id));

        const consistencyAchievement: Achievement = {
          id: 'consistency',
          name: 'Consistency',
          description: 'Maintain a daily streak of interacting with the app.',
          threshold: nextMilestone ? nextMilestone.threshold : 0,
          isUnlocked: !nextMilestone,
          progress: nextMilestone ? (progress.currentStreak / nextMilestone.threshold) * 100 : 100,
          icon: 'Flame',
        };

        const newAchievements: Achievement[] = [
          {
            id: 'catalyst',
            name: 'The Catalyst',
            description: 'Initiate 10 plans that get marked as "completed".',
            threshold: 10,
            isUnlocked: progress.catalystProgress >= 10,
            progress: (progress.catalystProgress / 10) * 100,
            icon: 'Zap',
          },
          {
            id: 'high_priestess',
            name: 'The High Priestess',
            description: 'Log 5 reflections of 100 characters or more.',
            threshold: 5,
            isUnlocked: progress.highPriestessProgress >= 5,
            progress: (progress.highPriestessProgress / 5) * 100,
            icon: 'Scroll',
          },
          {
            id: 'scribe',
            name: 'The Scribe',
            description: 'Add a "Life Event" for a friend.',
            threshold: 1,
            isUnlocked: progress.scribeProgress >= 1,
            progress: (progress.scribeProgress / 1) * 100,
            icon: 'PenTool',
          },
          {
            id: 'curator',
            name: 'The Curator',
            description: 'Have at least one friend in all 7 Archetypes.',
            threshold: 7,
            isUnlocked: progress.curatorProgress >= 7,
            progress: (progress.curatorProgress / 7) * 100,
            icon: 'Library',
          },
        ];

        setAchievements([consistencyAchievement, ...newAchievements]);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching achievements:', error);
        setLoading(false);
      }
    };

    fetchAchievements();
  }, []);

  return { achievements, loading };
};
