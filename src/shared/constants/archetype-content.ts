import { Archetype, InteractionCategory } from '../types/common';

export const ARCHETYPE_PREFERRED_CATEGORIES: Record<Archetype, InteractionCategory> = {
  'HighPriestess': 'deep-talk',
  'Fool': 'activity-hobby',
  'Sun': 'event-party',
  'Hermit': 'deep-talk',
  'Magician': 'activity-hobby',
  'Empress': 'meal-drink',
  'Emperor': 'hangout',
  'Lovers': 'deep-talk',
  'Unknown': 'hangout',
};

export const ARCHETYPE_DRIFT_SUGGESTIONS: Record<Archetype, string> = {
  'HighPriestess': 'The High Priestess values deep, meaningful conversations. Invite them for a one-on-one coffee to reconnect.',
  'Fool': 'The Adventurer loves shared experiences. Suggest a hike or trying something new together.',
  'Sun': 'The Sun thrives in joyful moments. Plan a fun hangout or celebrate something together.',
  'Hermit': 'The Hermit appreciates quiet, intimate time. Reach out for a thoughtful conversation.',
  'Magician': 'The Magician values creativity and collaboration. Suggest working on a project or exploring ideas together.',
  'Empress': 'The Empress nurtures through presence. Share a meal or spend quality time together.',
  'Emperor': 'The Emperor values loyalty and consistency. Show up and spend solid time together.',
  'Lovers': 'The Lovers value connection and harmony. Spend quality time together.',
  'Unknown': 'Reach out and reconnect.',
};

export const ARCHETYPE_MOMENTUM_SUGGESTIONS: Record<Archetype, string> = {
  'HighPriestess': 'Deepen your conversations - they value insight and truth.',
  'Fool': "Plan an adventure - they'd love to explore something new with you.",
  'Sun': 'Celebrate this connection - create a joyful moment together.',
  'Hermit': 'Create space for depth - they appreciate meaningful solitude with you.',
  'Magician': 'Collaborate on something creative - they love co-creating magic.',
  'Empress': 'Nurture each other - share warmth and care.',
  'Emperor': 'Build something together - they value purposeful connection.',
  'Lovers': 'Deepen your bond - they value closeness.',
  'Unknown': 'Keep nurturing this connection.',
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
