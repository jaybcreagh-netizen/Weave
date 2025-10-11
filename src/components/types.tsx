export type Tier = 'InnerCircle' | 'CloseFriends' | 'Community';
export type Archetype = 'Emperor' | 'Empress' | 'HighPriestess' | 'Fool' | 'Sun' | 'Hermit' | 'Magician';
export type InteractionType = 'Event' | 'Meal' | 'Home' | 'Coffee' | 'Call' | 'Text';
export type Duration = 'Quick' | 'Standard' | 'Extended';
export type Vibe = 'NewMoon' | 'WaxingCrescent' | 'FirstQuarter' | 'WaxingGibbous' | 'FullMoon';

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
  interactionType: InteractionType;
  duration: Duration | null;
  vibe: Vibe | null;
  note: string | null;
};

export type FriendFormData = {
  name: string;
  tier: string; // 'inner', 'close', or 'community'
  archetype: Archetype;
  notes: string;
  photoUrl: string;
};