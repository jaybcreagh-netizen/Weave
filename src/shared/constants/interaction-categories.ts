import { InteractionCategory, ActivityType } from '../types/common';
import { LucideIcon, MessageCircle, Mic, Utensils, Home, MessageSquareHeart, PartyPopper, Palette, Heart, Cake } from 'lucide-react-native';

export const INTERACTION_CATEGORIES: InteractionCategory[] = [
  'text-call',
  'voice-note',
  'meal-drink',
  'hangout',
  'deep-talk',
  'event-party',
  'activity-hobby',
  'favor-support',
  'celebration'
];

export interface CategoryMetadata {
  id: InteractionCategory;
  label: string;
  icon: string; // Legacy emoji, kept for backward compatibility
  iconComponent: LucideIcon; // Lucide icon component
  description: string;
  color: string; // Tailwind class or hex
  defaultDuration: 'Quick' | 'Standard' | 'Extended';
  energyLevel: 'low' | 'medium' | 'high';
}

export const CATEGORY_METADATA: Record<InteractionCategory, CategoryMetadata> = {
  'text-call': {
    id: 'text-call',
    label: 'Chat',
    icon: '💬',
    iconComponent: MessageCircle,
    description: 'Text, call, or quick check-in',
    color: 'bg-blue-100 text-blue-700',
    defaultDuration: 'Quick',
    energyLevel: 'low'
  },
  'voice-note': {
    id: 'voice-note',
    label: 'Voice Note',
    icon: '🎤',
    iconComponent: Mic,
    description: 'Audio message or update',
    color: 'bg-indigo-100 text-indigo-700',
    defaultDuration: 'Quick',
    energyLevel: 'low'
  },
  'meal-drink': {
    id: 'meal-drink',
    label: 'Meal/Drink',
    icon: '🍽️',
    iconComponent: Utensils,
    description: 'Coffee, lunch, dinner, or drinks',
    color: 'bg-orange-100 text-orange-700',
    defaultDuration: 'Standard',
    energyLevel: 'medium'
  },
  'hangout': {
    id: 'hangout',
    label: 'Hangout',
    icon: '🏠',
    iconComponent: Home,
    description: 'Casual time together at home',
    color: 'bg-green-100 text-green-700',
    defaultDuration: 'Extended',
    energyLevel: 'low'
  },
  'deep-talk': {
    id: 'deep-talk',
    label: 'Deep Talk',
    icon: '💭',
    iconComponent: MessageSquareHeart,
    description: 'Meaningful conversation or catch-up',
    color: 'bg-purple-100 text-purple-700',
    defaultDuration: 'Standard',
    energyLevel: 'medium'
  },
  'event-party': {
    id: 'event-party',
    label: 'Event/Party',
    icon: '🎉',
    iconComponent: PartyPopper,
    description: 'Social gathering, party, or show',
    color: 'bg-pink-100 text-pink-700',
    defaultDuration: 'Extended',
    energyLevel: 'high'
  },
  'activity-hobby': {
    id: 'activity-hobby',
    label: 'Activity',
    icon: '🎨',
    iconComponent: Palette,
    description: 'Sport, hobby, game, or adventure',
    color: 'bg-yellow-100 text-yellow-700',
    defaultDuration: 'Extended',
    energyLevel: 'high'
  },
  'favor-support': {
    id: 'favor-support',
    label: 'Support',
    icon: '🤝',
    iconComponent: Heart,
    description: 'Helping out or emotional support',
    color: 'bg-teal-100 text-teal-700',
    defaultDuration: 'Standard',
    energyLevel: 'medium'
  },
  'celebration': {
    id: 'celebration',
    label: 'Celebration',
    icon: '🎂',
    iconComponent: Cake,
    description: 'Birthday, milestone, or holiday',
    color: 'bg-red-100 text-red-700',
    defaultDuration: 'Extended',
    energyLevel: 'high'
  }
};

export function getCategoryMetadata(category: InteractionCategory): CategoryMetadata {
  return CATEGORY_METADATA[category] || CATEGORY_METADATA['hangout'];
}

// Mapping old activity types to new categories for migration
export const ACTIVITY_TO_CATEGORY_MAP: Record<ActivityType, InteractionCategory> = {
  'Text': 'text-call',
  'Call': 'text-call',
  'DM': 'text-call',
  'Chat': 'text-call',
  'Voice Note': 'voice-note',
  'Coffee': 'meal-drink',
  'Meal': 'meal-drink',
  'Dinner Party': 'meal-drink',
  'Tea Time': 'meal-drink',
  'Cooking': 'meal-drink',
  'Home': 'hangout',
  'Hangout': 'hangout',
  'Quick Visit': 'hangout',
  'Movie Night': 'hangout',
  'Reading Together': 'hangout',
  'Something else': 'hangout', // Default fallback
  'Event': 'event-party',
  'Party': 'event-party',
  'Concert': 'event-party',
  'Walk': 'activity-hobby',
  'Hike': 'activity-hobby',
  'Game Night': 'activity-hobby',
  'Shopping': 'activity-hobby',
  'Museum': 'activity-hobby',
  'Adventure': 'activity-hobby',
  'Video Call': 'text-call', // Could be deep-talk depending on context
  'Birthday': 'celebration',
  'Anniversary': 'celebration',
  'Holiday': 'celebration',
  'Milestone': 'celebration',
  'Achievement': 'celebration',
};

export function getAllCategories(): InteractionCategory[] {
  return INTERACTION_CATEGORIES;
}
