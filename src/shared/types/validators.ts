import { z } from 'zod';

// Common Types Enums
export const TierSchema = z.enum(['InnerCircle', 'CloseFriends', 'Community']);
export const ArchetypeSchema = z.enum([
  'Emperor', 'Empress', 'HighPriestess', 'Fool', 'Sun', 'Hermit', 'Magician', 'Lovers', 'Unknown'
]);
export const RelationshipTypeSchema = z.enum([
  'friend', 'family', 'partner', 'colleague', 'neighbor', 'mentor', 'creative'
]);
export const InteractionCategorySchema = z.enum([
  'text-call', 'voice-note', 'meal-drink', 'hangout', 'deep-talk',
  'event-party', 'activity-hobby', 'favor-support', 'celebration'
]);
export const DurationSchema = z.enum(['Quick', 'Standard', 'Extended']);
export const VibeSchema = z.enum(['NewMoon', 'WaxingCrescent', 'FirstQuarter', 'WaxingGibbous', 'FullMoon']);

// Structured Reflection
export const ReflectionChipSchema = z.object({
  chipId: z.string(),
  componentOverrides: z.record(z.string(), z.string()),
});

export const StructuredReflectionSchema = z.object({
  chips: z.array(ReflectionChipSchema).optional(),
  customNotes: z.string().optional(),
});

// Friend Schema
export const FriendSchema = z.object({
  id: z.string(),
  name: z.string(),
  dunbarTier: TierSchema.optional(), // Marked as @field in model, but seemingly required. treating as optional in schema if nullable in DB? Model says `!string`, so required.
  archetype: ArchetypeSchema.optional(), // Model says `!string`, so required.
  weaveScore: z.number().default(0),
  lastUpdated: z.date(),
  createdAt: z.date(),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
  resilience: z.number().default(0),
  ratedWeavesCount: z.number().default(0),
  momentumScore: z.number().default(0),
  momentumLastUpdated: z.date(),
  isDormant: z.boolean().default(false),
  dormantSince: z.date().optional(),
  birthday: z.string().optional(), // "MM-DD"
  anniversary: z.string().optional(), // "MM-DD"
  relationshipType: RelationshipTypeSchema.optional(),
  typicalIntervalDays: z.number().optional(),
  toleranceWindowDays: z.number().optional(),
  categoryEffectiveness: z.string().optional(), // JSON
  outcomeCount: z.number().default(0),
  initiationRatio: z.number().default(0.5),
  lastInitiatedBy: z.enum(['user', 'friend', 'mutual']).optional(),
  consecutiveUserInitiations: z.number().default(0),
  totalUserInitiations: z.number().default(0),
  totalFriendInitiations: z.number().default(0),
});

// Interaction Schema
export const InteractionSchema = z.object({
  id: z.string(),
  interactionDate: z.date(),
  interactionType: z.string(),
  duration: DurationSchema.optional(), // Using enum schema or string? Model says string. But type says Duration.
  vibe: VibeSchema.optional(),
  note: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  activity: z.string(),
  status: z.enum(['planned', 'pending_confirm', 'completed', 'cancelled', 'missed']),
  mode: z.string(),
  interactionCategory: InteractionCategorySchema.optional(),
  reflectionJSON: z.string().optional(),
  title: z.string().optional(),
  location: z.string().optional(),
  completionPromptedAt: z.number().optional(),
  calendarEventId: z.string().optional(),
  eventImportance: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  initiator: z.enum(['user', 'friend', 'mutual']).optional(),
});

// WeaveLog Schema (InteractionFormData)
export const WeaveLogSchema = z.object({
  friendIds: z.array(z.string()).min(1, "At least one friend must be selected"),
  activity: z.string().min(1, "Activity is required"),
  notes: z.string().optional(),
  date: z.date(),
  type: z.enum(['log', 'plan']),
  status: z.enum(['completed', 'planned']),
  mode: z.string(),
  vibe: VibeSchema.nullable().optional(),
  duration: DurationSchema.nullable().optional(),
  category: InteractionCategorySchema.optional(),
  reflection: StructuredReflectionSchema.optional(),
  title: z.string().optional(),
  location: z.string().optional(),
  eventImportance: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  initiator: z.enum(['user', 'friend', 'mutual']).optional(),
});

// Infer Types
export type FriendDTO = z.infer<typeof FriendSchema>;
export type InteractionDTO = z.infer<typeof InteractionSchema>;
export type WeaveLogDTO = z.infer<typeof WeaveLogSchema>;
