/**
 * Archetype Actions Mapping
 * Maps each archetype to suggested connection actions for weekly reflection
 */

import { Archetype } from '@/shared/types/legacy-types';

/**
 * Suggested actions for each archetype when they appear in "missed connections"
 */
export const ARCHETYPE_ACTIONS: Record<Archetype, string[]> = {
  Emperor: [
    'Schedule a structured catch-up',
    'Plan an achievement-focused meetup',
    'Organize a milestone celebration',
    'Invite them to a goal-oriented activity',
  ],
  Empress: [
    'Host them for a cozy meal',
    'Cook or bake something together',
    'Create a nurturing space to connect',
    'Plan a comfort-focused gathering',
  ],
  HighPriestess: [
    'Have a deep one-on-one conversation',
    'Schedule intimate tea or coffee time',
    'Send a heartfelt, personal message',
    'Arrange a meaningful private moment',
  ],
  Fool: [
    'Plan a spontaneous adventure',
    'Try something new and fun together',
    'Surprise them with a playful outing',
    'Suggest an unexpected activity',
  ],
  Sun: [
    'Organize an energetic group gathering',
    'Throw a celebration or party',
    'Plan a vibrant social event',
    'Invite them to a joyful occasion',
  ],
  Hermit: [
    'Schedule quiet one-on-one quality time',
    'Go for a peaceful walk together',
    'Arrange a thoughtful private dinner',
    'Create space for reflective connection',
  ],
  Magician: [
    'Collaborate on a creative project',
    'Plan something unique and experiential',
    'Create or build something together',
    'Explore a transformative activity',
  ],
  Lovers: [
    'Plan a romantic date night',
    'Share a heartfelt appreciation',
    'Create a special memory together',
    'Spend quality time connecting',
  ],
  Unknown: [
    'Reach out to reconnect',
    'Plan a casual catch-up',
    'Send a friendly message',
    'Suggest a low-pressure hangout',
  ],
};

/**
 * What each archetype values in relationships (for explanation text)
 */
export const ARCHETYPE_VALUES: Record<Archetype, string> = {
  Emperor: 'structure and achievement',
  Empress: 'comfort and nurturing',
  HighPriestess: 'depth and intuition',
  Fool: 'spontaneity and play',
  Sun: 'celebration and energy',
  Hermit: 'solitude and reflection',
  Magician: 'creativity and transformation',
  Lovers: 'intimacy and connection',
  Unknown: 'potential and discovery',
};

/**
 * Get a random suggested action for an archetype
 */
export function getRandomActionForArchetype(archetype: Archetype): string {
  const actions = ARCHETYPE_ACTIONS[archetype];
  const randomIndex = Math.floor(Math.random() * actions.length);
  return actions[randomIndex];
}

/**
 * Get what an archetype values (for displaying in UI)
 */
export function getArchetypeValue(archetype: Archetype): string {
  return ARCHETYPE_VALUES[archetype];
}
