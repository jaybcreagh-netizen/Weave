// src/shared/types/common.ts

export type Tier = 'InnerCircle' | 'CloseFriends' | 'Community';
export type Archetype = 'Emperor' | 'Empress' | 'HighPriestess' | 'Fool' | 'Sun' | 'Hermit' | 'Magician' | 'Lovers' | 'Unknown';

// Relationship types for understanding friend context
export type RelationshipType = 'friend' | 'family' | 'partner' | 'colleague' | 'neighbor' | 'mentor' | 'creative';

// Life event types for tracking important moments
export type LifeEventType =
  | 'birthday'
  | 'anniversary'
  | 'new_job'
  | 'moving'
  | 'graduation'
  | 'health_event'
  | 'celebration'
  | 'loss'
  | 'wedding'
  | 'baby'
  | 'other';

export type LifeEventImportance = 'low' | 'medium' | 'high' | 'critical';
export type LifeEventSource = 'manual' | 'keyword_detected' | 'recurring';

// Simplified 9 universal interaction categories
export type InteractionCategory =
  | 'text-call'       // 💬 Text/Call
  | 'voice-note'      // 🎤 Voice Note
  | 'meal-drink'      // 🍽️ Meal/Drink
  | 'hangout'         // 🏠 Hangout
  | 'deep-talk'       // 💭 Deep Talk
  | 'event-party'     // 🎉 Event/Party
  | 'activity-hobby'  // 🎨 Activity/Hobby
  | 'favor-support'   // 🤝 Support
  | 'celebration';    // 🎂 Celebration

// DEPRECATED: Old activity types (kept for backwards compatibility during migration)
export type ActivityType =
  // Original
  'Event' | 'Meal' | 'Home' | 'Coffee' | 'Call' | 'Text' |
  // New Additions
  'Walk' | 'Chat' | 'Video Call' | 'Something else' | 'Party' |
  'Dinner Party' | 'Hangout' | 'Game Night' | 'Birthday' | 'Anniversary' |
  'Milestone' | 'Holiday' | 'Achievement' | 'DM' | 'Quick Visit' |
  'Voice Note' | 'Movie Night' | 'Cooking' | 'Tea Time' | 'Reading Together' |
  'Hike' | 'Concert' | 'Museum' | 'Shopping' | 'Adventure';

// For backwards compatibility - will be removed after migration
export type InteractionType = ActivityType;

export type Duration = 'Quick' | 'Standard' | 'Extended';
export type Vibe = 'NewMoon' | 'WaxingCrescent' | 'FirstQuarter' | 'WaxingGibbous' | 'FullMoon' | 'WaningGibbous' | 'LastQuarter' | 'WaningCrescent';

// Reflection chip structure
export interface ReflectionChip {
  chipId: string;
  componentOverrides: Record<string, string>;
}

export interface StructuredReflection {
  chips?: ReflectionChip[];
  customNotes?: string;
}

export interface Suggestion {
  id: string;
  type: 'connect' | 'deepen' | 'reconnect' | 'celebrate';
  friendId: string;
  title: string;
  subtitle: string;
  icon: string;
  score?: number;
  reason?: string;
  priority?: 'high' | 'medium' | 'low';
  action: {
    type: 'plan' | 'log' | 'reflect' | 'connect';
    interactionId?: string;
  };
  category?: string;
  friendName?: string;
  urgency?: 'critical' | 'high' | 'medium' | 'low';
}
