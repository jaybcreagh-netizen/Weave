// src/components/types.tsx
// Re-export from shared/types/common for backward compatibility
export * from '@/shared/types/common';

// Re-exporting types that were defined here but not yet moved to common if any unique ones exist
// In this case, we moved everything to common.ts, so we just re-export.
import { InteractionCategory, InteractionType, Duration, Vibe, StructuredReflection, ActivityType, Archetype, Tier, RelationshipType, LifeEventType, LifeEventImportance, LifeEventSource } from '@/shared/types/common';
export type MoonPhase = Vibe;

// Re-declaring types that might be used as values or need specific augmentation if any (none for now)
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
  photoUrl?: string;
  notes?: string;
  isDormant?: boolean;
  birthday?: string;
  anniversary?: string;
  relationshipType?: RelationshipType;
  toleranceWindowDays?: number;
  resilience: number;
  typicalIntervalDays?: number;
};

export type Interaction = {
  id: string;
  friendIds?: string[];
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

  // Missing properties added to fix build errors
  activity: string;
  status: string;
  mode: string;
  title?: string;
  location?: string;
  eventImportance?: string;
  initiator?: string;
  updatedAt: Date;
  interactionCategory?: InteractionCategory;
};

export type FriendFormData = {
  name: string;
  tier: string; // 'inner', 'close', or 'community'
  archetype: Archetype;
  notes: string;
  photoUrl: string;
  // Life events and relationship context
  birthday?: string; // Format: "MM-DD"
  anniversary?: string; // Format: "MM-DD"
  relationshipType?: RelationshipType;

  // Contact details
  phoneNumber?: string;
  email?: string;
  preferredMessagingApp?: 'whatsapp' | 'telegram' | 'sms' | 'email';
};

export interface LifeEvent {
  id: string;
  friendId: string;
  title: string;
  date: Date; // mapped from eventDate
  eventType: LifeEventType;
  description?: string;
  importance: LifeEventImportance;
  isRecurring: boolean;
  source: LifeEventSource;
  createdAt: Date;
  updatedAt: Date;
}

export interface Intention {
  id: string;
  description?: string;
  interactionCategory?: string;
  status: 'active' | 'converted' | 'dismissed' | 'fulfilled';
  createdAt: Date;
  updatedAt: Date;
  lastRemindedAt?: Date;
  linkedInteractionId?: string;
  fulfilledAt?: Date;
  daysToFulfillment?: number;
  friendIds: string[];
}
