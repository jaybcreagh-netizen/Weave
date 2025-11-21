import { Archetype } from '../types/core';
import { InteractionCategory } from '../types/suggestions';

export const ARCHETYPE_PREFERRED_CATEGORIES: Record<Archetype, InteractionCategory> = {
  'The High Priestess': 'deep-talk',
  'The Adventurer': 'activity-hobby',
  'The Sun': 'event-party',
  'The Hermit': 'deep-talk',
  'The Magician': 'activity-hobby',
  'The Empress': 'meal-drink',
  'The Emperor': 'hangout',
};

export const ARCHETYPE_DRIFT_SUGGESTIONS: Record<Archetype, string> = {
  'The High Priestess': 'The High Priestess values deep, meaningful conversations. Invite them for a one-on-one coffee to reconnect.',
  'The Adventurer': 'The Adventurer loves shared experiences. Suggest a hike or trying something new together.',
  'The Sun': 'The Sun thrives in joyful moments. Plan a fun hangout or celebrate something together.',
  'The Hermit': 'The Hermit appreciates quiet, intimate time. Reach out for a thoughtful conversation.',
  'The Magician': 'The Magician values creativity and collaboration. Suggest working on a project or exploring ideas together.',
  'The Empress': 'The Empress nurtures through presence. Share a meal or spend quality time together.',
  'The Emperor': 'The Emperor values loyalty and consistency. Show up and spend solid time together.',
};

export const ARCHETYPE_MOMENTUM_SUGGESTIONS: Record<Archetype, string> = {
  'The High Priestess': 'Deepen your conversations - they value insight and truth.',
  'The Adventurer': "Plan an adventure - they'd love to explore something new with you.",
  'The Sun': 'Celebrate this connection - create a joyful moment together.',
  'The Hermit': 'Create space for depth - they appreciate meaningful solitude with you.',
  'The Magician': 'Collaborate on something creative - they love co-creating magic.',
  'The Empress': 'Nurture each other - share warmth and care.',
  'The Emperor': 'Build something together - they value purposeful connection.',
};

export function getArchetypePreferredCategory(archetype: Archetype): InteractionCategory {
  return ARCHETYPE_PREFERRED_CATEGORIES[archetype] || 'hangout';
}

export function getArchetypeDriftSuggestion(archetype: Archetype): string {
  return ARCHETYPE_DRIFT_SUGGESTIONS[archetype] || 'Reach out and reconnect.';
}

export function getArchetypeMomentumSuggestion(archetype: Archetype): string {
  return ARCHETYPE_MOMENTUM_SUGGESTIONS[archetype] || 'Keep nurturing this connection.';
}
