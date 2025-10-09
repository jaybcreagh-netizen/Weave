// Centralized type definitions for the Weave app

export type Archetype =
  | "Emperor"
  | "Empress"
  | "HighPriestess"
  | "Fool"
  | "Sun"
  | "Hermit"
  | "Magician";

export type Tier = "InnerCircle" | "CloseFriends" | "Community";

export type Status = "Green" | "Yellow" | "Red";

export type MoonPhase = "NewMoon" | "WaxingCrescent" | "FirstQuarter" | "WaxingGibbous" | "FullMoon";

export interface Interaction {
  id?: number | string;
  friendIds: string[];
  type: "log" | "plan";
  activity: string; // e.g., "Coffee", "Meal"
  mode?: string; // e.g., "one-on-one", "quick-touch"
  date: Date | string; // Date object or ISO string
  status: "completed" | "pending"; // For plans
  moonPhase?: MoonPhase; // Optional for logged interactions
  notes?: string;
  title?: string; // For planned events
  location?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Friend {
  id: string;
  name: string;
  status: Status;
  statusText: string;
  archetype: Archetype;
  tier: Tier;
  photoUrl?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}