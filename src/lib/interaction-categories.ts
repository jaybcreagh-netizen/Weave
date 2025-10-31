import { InteractionCategory, ActivityType } from '../components/types';

/**
 * Metadata for the 8 universal interaction categories
 */
export interface CategoryMetadata {
  category: InteractionCategory;
  label: string;
  icon: string;
  description: string;
  baseScore: number;
}

export const CATEGORY_METADATA: Record<InteractionCategory, CategoryMetadata> = {
  'text-call': {
    category: 'text-call',
    label: 'Text/Call',
    icon: '💬',
    description: 'Quick messages or phone calls',
    baseScore: 10,
  },
  'voice-note': {
    category: 'voice-note',
    label: 'Voice Note',
    icon: '🎤',
    description: 'Asynchronous voice messages',
    baseScore: 12,
  },
  'meal-drink': {
    category: 'meal-drink',
    label: 'Meal/Drink',
    icon: '🍽️',
    description: 'Coffee, meals, or drinks together',
    baseScore: 22,
  },
  'hangout': {
    category: 'hangout',
    label: 'Hangout',
    icon: '🏠',
    description: 'Casual time together at home or out',
    baseScore: 20,
  },
  'deep-talk': {
    category: 'deep-talk',
    label: 'Deep Talk',
    icon: '💭',
    description: 'Meaningful, vulnerable conversations',
    baseScore: 28,
  },
  'event-party': {
    category: 'event-party',
    label: 'Event/Party',
    icon: '🎉',
    description: 'Social gatherings and events',
    baseScore: 27,
  },
  'activity-hobby': {
    category: 'activity-hobby',
    label: 'Activity/Hobby',
    icon: '🎨',
    description: 'Shared activities, hobbies, or adventures',
    baseScore: 25,
  },
  'favor-support': {
    category: 'favor-support',
    label: 'Support',
    icon: '🤝',
    description: 'Help or emotional support',
    baseScore: 24,
  },
  'celebration': {
    category: 'celebration',
    label: 'Celebration',
    icon: '🎂',
    description: 'Birthdays, milestones, and special occasions',
    baseScore: 32,
  },
};

/**
 * Migration map: Old activity type → New category
 * Used to migrate existing interactions to the new system
 */
export const ACTIVITY_TO_CATEGORY_MAP: Record<ActivityType, InteractionCategory> = {
  // Text/Call category
  'Text': 'text-call',
  'DM': 'text-call',
  'Call': 'text-call',
  'Video Call': 'text-call',

  // Voice Note category
  'Voice Note': 'voice-note',

  // Meal/Drink category
  'Coffee': 'meal-drink',
  'Meal': 'meal-drink',
  'Tea Time': 'meal-drink',

  // Hangout category
  'Home': 'hangout',
  'Hangout': 'hangout',
  'Quick Visit': 'hangout',
  'Walk': 'hangout',
  'Movie Night': 'hangout',
  'Game Night': 'hangout',

  // Deep Talk category (context-dependent)
  'Chat': 'deep-talk', // Default to deep-talk, can be overridden by context

  // Event/Party category
  'Event': 'event-party',
  'Party': 'event-party',
  'Dinner Party': 'event-party',

  // Activity/Hobby category
  'Cooking': 'activity-hobby',
  'Reading Together': 'activity-hobby',
  'Hike': 'activity-hobby',
  'Concert': 'activity-hobby',
  'Museum': 'activity-hobby',
  'Shopping': 'activity-hobby',
  'Adventure': 'activity-hobby',

  // Celebration category
  'Birthday': 'celebration',
  'Anniversary': 'celebration',
  'Milestone': 'celebration',
  'Holiday': 'celebration',
  'Achievement': 'celebration',

  // Catch-all
  'Something else': 'hangout',
};

/**
 * Get category metadata for a given category
 */
export function getCategoryMetadata(category: InteractionCategory): CategoryMetadata {
  return CATEGORY_METADATA[category];
}

/**
 * Array of all interaction categories in display order
 */
export const INTERACTION_CATEGORIES: InteractionCategory[] = [
  'text-call',
  'voice-note',
  'meal-drink',
  'hangout',
  'deep-talk',
  'event-party',
  'activity-hobby',
  'favor-support',
  'celebration',
];

/**
 * Get all categories in display order
 */
export function getAllCategories(): CategoryMetadata[] {
  return [
    CATEGORY_METADATA['text-call'],
    CATEGORY_METADATA['voice-note'],
    CATEGORY_METADATA['meal-drink'],
    CATEGORY_METADATA['hangout'],
    CATEGORY_METADATA['deep-talk'],
    CATEGORY_METADATA['event-party'],
    CATEGORY_METADATA['activity-hobby'],
    CATEGORY_METADATA['favor-support'],
    CATEGORY_METADATA['celebration'],
  ];
}

/**
 * Migrate an old activity type to the new category system
 */
export function migrateActivityToCategory(activity: ActivityType): InteractionCategory {
  return ACTIVITY_TO_CATEGORY_MAP[activity] || 'hangout'; // Default fallback
}
