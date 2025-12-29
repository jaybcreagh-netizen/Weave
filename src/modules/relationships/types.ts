// src/modules/relationships/types.ts
export type Tier = 'InnerCircle' | 'CloseFriends' | 'Community';
export type Archetype = 'Emperor' | 'Empress' | 'HighPriestess' | 'Fool' | 'Sun' | 'Hermit' | 'Magician' | 'Lovers' | 'Unknown';
export type RelationshipType = 'friend' | 'family' | 'partner' | 'colleague' | 'neighbor' | 'mentor' | 'creative';
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

export type FriendFormData = {
  name: string;
  tier: string;
  archetype: Archetype;
  notes: string;
  photoUrl: string;
  birthday?: string;
  anniversary?: string;
  relationshipType?: RelationshipType;
  phoneNumber?: string;
  email?: string;
};
