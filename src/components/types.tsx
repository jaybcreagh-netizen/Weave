export type Tier = 'InnerCircle' | 'CloseFriends' | 'Community';
export type Archetype = 'Emperor' | 'Empress' | 'HighPriestess' | 'Fool' | 'Sun' | 'Hermit' | 'Magician';

// Relationship types for understanding friend context
export type RelationshipType = 'friend' | 'close_friend' | 'family' | 'partner' | 'colleague' | 'acquaintance';

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

// NEW: Simplified 9 universal interaction categories
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
export type Vibe = 'NewMoon' | 'WaxingCrescent' | 'FirstQuarter' | 'WaxingGibbous' | 'FullMoon';

// Reflection chip structure
export interface ReflectionChip {
  chipId: string;
  componentOverrides: Record<string, string>;
}

export interface StructuredReflection {
  chips?: ReflectionChip[];
  customNotes?: string;
}

// Used for manually added friends during onboarding
export type MockContact = {
  id: string;
  name: string;
  imageAvailable?: boolean;
  image?: { uri: string };
};

export type Friend = {
  id: string;
  name: string;
  createdAt: Date;
  dunbarTier: Tier;
  archetype: Archetype;
  weaveScore: number;
  lastUpdated: Date;
};

export type Interaction = {
  id: string;
  friendIds: string[];
  createdAt: Date;
  interactionDate: Date;
  category?: InteractionCategory; // NEW: Simplified interaction category
  interactionType: InteractionType; // DEPRECATED: Old activity (kept for migration)
  duration: Duration | null;
  vibe: Vibe | null;
  note: string | null;
  source?: 'quick-weave' | 'full-form' | 'import'; // Track entry method for node sizing
  photos?: string[]; // Photo URIs for rich content detection
  reflection?: StructuredReflection; // NEW: Structured reflection data
};

export type FriendFormData = {
  name: string;
  tier: string; // 'inner', 'close', or 'community'
  archetype: Archetype;
  notes: string;
  photoUrl: string;
  // Life events and relationship context
  birthday?: Date;
  anniversary?: Date;
  relationshipType?: RelationshipType;
};