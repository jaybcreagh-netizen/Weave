# Phase 1, Week 1: Technical Implementation Plan
## Interaction System Redesign

**Goal:** Replace mode→activity two-step system with 8 universal interaction types

**Timeline:** 5 days

---

## Current State Analysis

### Existing Architecture:

**Schema (v8):**
```typescript
interactions table:
  - mode: string           // 'one-on-one', 'group-flow', 'celebration', etc.
  - activity: string       // 'Coffee', 'Meal', 'Walk', etc.
  - interaction_type: string  // 'log' | 'plan'
  - interaction_date: number
  - duration: string
  - vibe: string
  - note: string
  - status: string
  - created_at: number
```

**Interaction Model:**
```typescript
class Interaction extends Model {
  @text('mode') mode!: string;
  @text('activity') activity!: string;
  @field('interaction_type') interactionType!: string;
  // ... other fields
}
```

**Constants:**
- 6 modes in `app/interaction-form.tsx`
- 6 activities per mode = 36 total activity options
- Base scores for ~30 activities in `InteractionBaseScores`

**UI:**
- `app/interaction-form.tsx` - Two-phase form
- Radial menu uses activity strings directly

---

## Target State

### New Schema (v9):

```typescript
interactions table:
  - interaction_category: string  // NEW: 'text-call', 'meal-drink', etc.
  - mode: string                  // DEPRECATED (keep for migration)
  - activity: string              // DEPRECATED (keep for migration)
  - interaction_type: string      // KEEP: 'log' | 'plan'
  - interaction_date: number
  - duration: string
  - vibe: string
  - note: string                  // Will become 'reflection' later
  - status: string
  - created_at: number

  // New reflection fields (added in Phase 2)
  + reflection: string (optional)
  + deep_weave_data: string (optional)
  + context_signals: string (optional)
  + context_score_multiplier: number (default: 1.0)
  + last_edited: number (optional)
```

### New Types:

```typescript
// src/components/types.tsx
export type InteractionCategory =
  | 'text-call'
  | 'voice-note'
  | 'meal-drink'
  | 'hangout'
  | 'deep-talk'
  | 'event-party'
  | 'activity-hobby'
  | 'celebration'
  | 'acts-of-care';  // TBD: May become a tag instead

export type InteractionType = 'log' | 'plan';  // Keep as-is

// OLD InteractionType becomes ActivityType (for scoring lookup)
export type ActivityType =
  'Event' | 'Meal' | 'Home' | 'Coffee' | 'Call' | 'Text' |
  'Walk' | 'Chat' | 'Video Call' | 'Something else' | 'Party' |
  'Dinner Party' | 'Hangout' | 'Game Night' | 'Birthday' | 'Anniversary' |
  'Milestone' | 'Holiday' | 'Achievement' | 'DM' | 'Quick Visit' |
  'Voice Note' | 'Movie Night' | 'Cooking' | 'Tea Time' | 'Reading Together' |
  'Hike' | 'Concert' | 'Museum' | 'Shopping' | 'Adventure';
```

---

## Implementation Tasks

### Day 1: Schema & Types

#### Task 1.1: Update TypeScript Types
**File:** `src/components/types.tsx`

```typescript
// Add new type
export type InteractionCategory =
  | 'text-call'
  | 'voice-note'
  | 'meal-drink'
  | 'hangout'
  | 'deep-talk'
  | 'event-party'
  | 'activity-hobby'
  | 'celebration';

// Rename existing InteractionType
export type ActivityType =
  'Event' | 'Meal' | 'Home' | 'Coffee' | 'Call' | 'Text' |
  // ... rest of activities

// Keep InteractionType for log vs plan
export type InteractionType = 'log' | 'plan';

// Update Interaction type interface
export type Interaction = {
  id: string;
  friendIds: string[];
  createdAt: Date;
  interactionDate: Date;
  category: InteractionCategory;        // NEW
  interactionType: InteractionType;     // RENAMED (was using InteractionType for activities)
  duration: Duration | null;
  vibe: Vibe | null;
  note: string | null;
  mode?: string;                        // DEPRECATED
  activity?: string;                    // DEPRECATED
  source?: 'quick-weave' | 'full-form' | 'import';
  photos?: string[];
};
```

**Testing:** TypeScript should compile without errors

---

#### Task 1.2: Database Schema Migration
**File:** `src/db/schema.ts`

```typescript
export default appSchema({
  version: 9,  // Increment from 8
  tables: [
    // ... friends table unchanged ...

    tableSchema({
      name: 'interactions',
      columns: [
        // Existing fields
        { name: 'interaction_date', type: 'number' },
        { name: 'interaction_type', type: 'string' },
        { name: 'duration', type: 'string', isOptional: true },
        { name: 'vibe', type: 'string', isOptional: true },
        { name: 'note', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'status', type: 'string' },

        // NEW FIELD
        { name: 'interaction_category', type: 'string' },

        // DEPRECATED (keep for data integrity)
        { name: 'mode', type: 'string', isOptional: true },
        { name: 'activity', type: 'string', isOptional: true },
      ]
    }),

    // ... interaction_friends table unchanged ...
  ]
})
```

---

#### Task 1.3: Create Migration Script
**File:** `src/db/migrations.ts` (NEW FILE)

```typescript
import { schemaMigrations, addColumns } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 9,
      steps: [
        addColumns({
          table: 'interactions',
          columns: [
            { name: 'interaction_category', type: 'string' },
          ]
        })
      ]
    }
  ]
});
```

**File:** `src/db.ts`

Update to include migrations:
```typescript
import { migrations } from './db/migrations';

const adapter = new SQLiteAdapter({
  schema,
  migrations,  // ADD THIS
  onSetUpError: error => {
    console.error('Database setup error:', error);
  }
});
```

---

#### Task 1.4: Data Migration Function
**File:** `src/db/data-migration.ts` (NEW FILE)

```typescript
import { database } from './db';
import Interaction from './db/models/Interaction';
import { Q } from '@nozbe/watermelondb';

/**
 * Maps old mode+activity combinations to new InteractionCategory
 */
export const CATEGORY_MIGRATION_MAP: Record<string, string> = {
  // One-on-One mode
  'one-on-one:Coffee': 'meal-drink',
  'one-on-one:Meal': 'meal-drink',
  'one-on-one:Walk': 'hangout',
  'one-on-one:Chat': 'deep-talk',
  'one-on-one:Video Call': 'text-call',
  'one-on-one:Something else': 'hangout',

  // Quick Touch mode
  'quick-touch:Text': 'text-call',
  'quick-touch:Call': 'text-call',
  'quick-touch:DM': 'text-call',
  'quick-touch:Quick Visit': 'hangout',
  'quick-touch:Voice Note': 'voice-note',
  'quick-touch:Something else': 'text-call',

  // Group Flow mode
  'group-flow:Event': 'event-party',
  'group-flow:Party': 'event-party',
  'group-flow:Dinner Party': 'meal-drink',
  'group-flow:Hangout': 'hangout',
  'group-flow:Game Night': 'activity-hobby',
  'group-flow:Something else': 'event-party',

  // Celebration mode
  'celebration:Birthday': 'celebration',
  'celebration:Anniversary': 'celebration',
  'celebration:Milestone': 'celebration',
  'celebration:Holiday': 'celebration',
  'celebration:Achievement': 'celebration',
  'celebration:Something else': 'celebration',

  // Cozy Time mode
  'cozy-time:Home': 'hangout',
  'cozy-time:Movie Night': 'hangout',
  'cozy-time:Cooking': 'activity-hobby',
  'cozy-time:Tea Time': 'meal-drink',
  'cozy-time:Reading Together': 'activity-hobby',
  'cozy-time:Something else': 'hangout',

  // Out and About mode
  'out-and-about:Hike': 'activity-hobby',
  'out-and-about:Concert': 'event-party',
  'out-and-about:Museum': 'activity-hobby',
  'out-and-about:Shopping': 'hangout',
  'out-and-about:Adventure': 'activity-hobby',
  'out-and-about:Something else': 'activity-hobby',
};

/**
 * Detect if a text-based interaction might be a "deep talk"
 * based on note content
 */
function detectDeepTalk(note: string | undefined, activity: string): boolean {
  if (!note) return false;

  const deepTalkKeywords = [
    'opened up', 'shared', 'talked about', 'discussed',
    'deep', 'meaningful', 'important', 'vulnerable'
  ];

  const lowerNote = note.toLowerCase();
  const hasKeywords = deepTalkKeywords.some(kw => lowerNote.includes(kw));

  // If it's a chat/call and has depth markers, upgrade to deep-talk
  return (activity === 'Chat' || activity === 'Call') && hasKeywords;
}

/**
 * Migrate all existing interactions to new category system
 */
export async function migrateInteractionCategories(): Promise<{
  total: number;
  migrated: number;
  skipped: number;
  errors: number;
}> {
  const stats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Get all interactions that need migration
    const interactions = await database.get<Interaction>('interactions')
      .query(
        Q.where('interaction_category', null)  // Only unmigrated
      )
      .fetch();

    stats.total = interactions.length;

    await database.write(async () => {
      for (const interaction of interactions) {
        try {
          const mode = interaction.mode || 'unknown';
          const activity = interaction.activity || 'unknown';
          const key = `${mode}:${activity}`;

          let category = CATEGORY_MIGRATION_MAP[key];

          // If no direct mapping, make educated guess
          if (!category) {
            if (activity.includes('Text') || activity.includes('DM')) {
              category = 'text-call';
            } else if (activity.includes('Call')) {
              category = 'text-call';
            } else if (activity.includes('Meal') || activity.includes('Coffee') || activity.includes('Dinner')) {
              category = 'meal-drink';
            } else if (activity.includes('Party') || activity.includes('Event')) {
              category = 'event-party';
            } else {
              category = 'hangout';  // Default fallback
            }
          }

          // Special case: Detect deep talks from note content
          if ((category === 'hangout' || category === 'text-call') &&
              detectDeepTalk(interaction.note, activity)) {
            category = 'deep-talk';
          }

          await interaction.update(record => {
            record._raw.interaction_category = category;
          });

          stats.migrated++;
        } catch (error) {
          console.error(`Failed to migrate interaction ${interaction.id}:`, error);
          stats.errors++;
        }
      }
    });

  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }

  return stats;
}

/**
 * Verify migration success
 */
export async function verifyMigration(): Promise<{
  total: number;
  categorized: number;
  uncategorized: number;
}> {
  const total = await database.get('interactions').query().fetchCount();
  const categorized = await database.get('interactions')
    .query(Q.where('interaction_category', Q.notEq(null)))
    .fetchCount();

  return {
    total,
    categorized,
    uncategorized: total - categorized,
  };
}
```

---

### Day 2: Update Models & Constants

#### Task 2.1: Update Interaction Model
**File:** `src/db/models/Interaction.ts`

```typescript
import { Model } from '@nozbe/watermelondb'
import { field, text, readonly, date, children } from '@nozbe/watermelondb/decorators'

export default class Interaction extends Model {
  static table = 'interactions'

  static associations = {
    interaction_friends: { type: 'has_many', foreignKey: 'interaction_id' }
  }

  @children('interaction_friends') interactionFriends

  @date('interaction_date') interactionDate!: Date
  @field('interaction_type') interactionType!: string  // 'log' | 'plan'
  @field('interaction_category') category!: string      // NEW
  @field('duration') duration?: string
  @field('vibe') vibe?: string
  @text('note') note?: string
  @readonly @date('created_at') createdAt!: Date
  @text('status') status!: string

  // DEPRECATED - Keep for data integrity
  @text('mode') mode?: string
  @text('activity') activity?: string
}
```

---

#### Task 2.2: Create Category Constants
**File:** `src/lib/interaction-categories.ts` (NEW FILE)

```typescript
import { InteractionCategory } from '../components/types';

export interface CategoryDefinition {
  id: InteractionCategory;
  icon: string;
  label: string;
  description: string;
  baseScore: number;
  examples: string[];
}

export const INTERACTION_CATEGORIES: Record<InteractionCategory, CategoryDefinition> = {
  'text-call': {
    id: 'text-call',
    icon: '💬',
    label: 'Text/Call',
    description: 'Quick messages and calls',
    baseScore: 10,
    examples: ['Text message', 'Phone call', 'Video call', 'DM', 'Quick chat']
  },

  'voice-note': {
    id: 'voice-note',
    icon: '🎤',
    label: 'Voice Note',
    description: 'Audio messages',
    baseScore: 12,
    examples: ['Voice message', 'Voice memo', 'Audio recording']
  },

  'meal-drink': {
    id: 'meal-drink',
    icon: '🍽️',
    label: 'Meal/Drink',
    description: 'Coffee, meals, drinks together',
    baseScore: 22,
    examples: ['Coffee', 'Lunch', 'Dinner', 'Drinks', 'Tea', 'Breakfast']
  },

  'hangout': {
    id: 'hangout',
    icon: '🌿',
    label: 'Hangout',
    description: 'Casual time together',
    baseScore: 20,
    examples: ['At home', 'Walking', 'Shopping', 'Hanging out', 'Visiting']
  },

  'deep-talk': {
    id: 'deep-talk',
    icon: '💭',
    label: 'Deep Talk',
    description: 'Meaningful conversation',
    baseScore: 28,
    examples: ['Heart-to-heart', 'Deep discussion', 'Vulnerable sharing']
  },

  'event-party': {
    id: 'event-party',
    icon: '🎉',
    label: 'Event/Party',
    description: 'Social gatherings and events',
    baseScore: 27,
    examples: ['Party', 'Concert', 'Show', 'Festival', 'Group event']
  },

  'activity-hobby': {
    id: 'activity-hobby',
    icon: '🏃‍♀️',
    label: 'Activity/Hobby',
    description: 'Shared activities and hobbies',
    baseScore: 25,
    examples: ['Hike', 'Museum', 'Cooking', 'Game night', 'Workout', 'Creative project']
  },

  'celebration': {
    id: 'celebration',
    icon: '🎂',
    label: 'Celebration',
    description: 'Milestones and special moments',
    baseScore: 32,
    examples: ['Birthday', 'Anniversary', 'Achievement', 'Milestone', 'Holiday']
  },
};

export function getCategoryDefinition(category: InteractionCategory): CategoryDefinition {
  return INTERACTION_CATEGORIES[category];
}

export function getAllCategories(): CategoryDefinition[] {
  return Object.values(INTERACTION_CATEGORIES);
}
```

---

#### Task 2.3: Update Scoring Constants
**File:** `src/lib/constants.ts`

Add new section:
```typescript
import { InteractionCategory } from '../components/types';

// NEW: Category-based scoring (replaces per-activity scoring)
export const CategoryBaseScores: Record<InteractionCategory, number> = {
  'text-call': 10,
  'voice-note': 12,
  'meal-drink': 22,
  'hangout': 20,
  'deep-talk': 28,
  'event-party': 27,
  'activity-hobby': 25,
  'celebration': 32,
};

// DEPRECATED: Keep for migration reference
export const InteractionBaseScores: Record<InteractionType, number> = {
  // ... existing scores ...
};
```

---

### Day 3: Update UI - Interaction Form

#### Task 3.1: Rebuild Interaction Form
**File:** `app/interaction-form.tsx`

Major rewrite needed. Key changes:

**OLD structure:**
```tsx
1. Select Mode (6 options)
2. Select Activity (6 options based on mode)
3. Select Date + Vibe + Notes
```

**NEW structure:**
```tsx
1. Select Category (8 options)
2. Select Date + Vibe + Notes (with contextual prompt)
```

**Implementation:**
```tsx
const CATEGORIES = [
  { id: 'text-call', icon: '💬', label: 'Text/Call', sublabel: 'Messages & calls' },
  { id: 'voice-note', icon: '🎤', label: 'Voice Note', sublabel: 'Audio messages' },
  { id: 'meal-drink', icon: '🍽️', label: 'Meal/Drink', sublabel: 'Coffee, meals, drinks' },
  { id: 'hangout', icon: '🌿', label: 'Hangout', sublabel: 'Casual time together' },
  { id: 'deep-talk', icon: '💭', label: 'Deep Talk', sublabel: 'Meaningful conversation' },
  { id: 'event-party', icon: '🎉', label: 'Event/Party', sublabel: 'Social gatherings' },
  { id: 'activity-hobby', icon: '🏃‍♀️', label: 'Activity', sublabel: 'Hobbies & experiences' },
  { id: 'celebration', icon: '🎂', label: 'Celebration', sublabel: 'Milestones & moments' },
];

export default function InteractionFormScreen() {
  const [selectedCategory, setSelectedCategory] = useState<InteractionCategory | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedVibe, setSelectedVibe] = useState<Vibe | null>(null);
  const [notes, setNotes] = useState('');

  const handleSave = async () => {
    if (!selectedCategory || !friendId || !mode || !selectedDate) return;

    await addInteraction({
      friendIds: [friendId],
      category: selectedCategory,  // NEW
      notes,
      date: selectedDate,
      type: mode,  // 'log' or 'plan'
      status: mode === 'log' ? 'completed' : 'planned',
      vibe: selectedVibe,
      // activity and mode no longer needed
    });

    router.back();
  };

  return (
    <SafeAreaView>
      {/* Step 1: Select Category */}
      <Animated.View style={styles.section}>
        <Text style={styles.sectionTitle}>What did you do together?</Text>
        <View style={styles.gridContainer}>
          {CATEGORIES.map((cat, index) => (
            <Animated.View key={cat.id} style={{ width: '48%' }}>
              <TouchableOpacity
                style={[styles.gridItem, selectedCategory === cat.id && styles.gridItemSelected]}
                onPress={() => setSelectedCategory(cat.id as InteractionCategory)}
              >
                <Text style={styles.gridItemIcon}>{cat.icon}</Text>
                <Text style={styles.gridItemLabel}>{cat.label}</Text>
                <Text style={styles.gridItemSublabel}>{cat.sublabel}</Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
      </Animated.View>

      {/* Step 2: Details (only shows after category selected) */}
      {selectedCategory && (
        <Animated.View style={styles.section}>
          <Text style={styles.sectionTitle}>Add Details</Text>

          {/* Date selection */}
          {/* ... existing date picker code ... */}

          {/* Vibe selection */}
          {isLogging && (
            <MoonPhaseSelector onSelect={setSelectedVibe} selectedVibe={selectedVibe} />
          )}

          {/* Notes with contextual placeholder */}
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder={getContextualPlaceholder(selectedCategory)}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

function getContextualPlaceholder(category: InteractionCategory): string {
  const prompts = {
    'text-call': 'What did you chat about?',
    'voice-note': 'What did you share?',
    'meal-drink': 'What did you talk about over your meal?',
    'hangout': 'What did you do together?',
    'deep-talk': 'What truth or insight was shared?',
    'event-party': 'What moment stands out?',
    'activity-hobby': 'What did you do/create together?',
    'celebration': 'What are you celebrating?',
  };

  return prompts[category] || 'Notes...';
}
```

---

### Day 4: Update Stores & Engine

#### Task 4.1: Update InteractionStore
**File:** `src/stores/interactionStore.ts`

```typescript
export interface InteractionFormData {
  friendIds: string[];
  category: InteractionCategory;  // NEW (was: activity: string)
  notes?: string;
  date: Date;
  type: 'log' | 'plan';
  status: 'completed' | 'planned';
  vibe?: Vibe | null;
  duration?: Duration | null;
  // mode is removed
}

export const useInteractionStore = create<InteractionStore>(() => ({
  addInteraction: async (data: InteractionFormData) => {
    const friends = await database.get<FriendModel>('friends')
      .query(Q.where('id', Q.oneOf(data.friendIds)))
      .fetch();

    if (friends.length > 0) {
      await logNewWeave(friends, data, database);
    }
  },
  // ... rest unchanged
}));
```

---

#### Task 4.2: Update Weave Engine
**File:** `src/lib/weave-engine.ts`

```typescript
import { InteractionCategory } from '../components/types';
import { CategoryBaseScores } from './constants';

// OLD FUNCTION (deprecated)
// export function calculatePointsForWeave(friend, weaveData: { interactionType: InteractionType, ... })

// NEW FUNCTION
export function calculatePointsForWeave(
  friend: FriendModel,
  weaveData: {
    category: InteractionCategory;
    duration: Duration | null;
    vibe: Vibe | null;
  }
): number {
  // Get base score from category
  const baseScore = CategoryBaseScores[weaveData.category];

  // Get archetype multiplier for this category
  const archetypeMultiplier = getArchetypeCategoryMultiplier(
    friend.archetype as Archetype,
    weaveData.category
  );

  const durationModifier = DurationModifiers[weaveData.duration || 'Standard'];
  const vibeMultiplier = VibeMultipliers[weaveData.vibe || 'WaxingCrescent'];

  const eventMultiplier = 1.0;  // For future life events
  const groupDilutionFactor = 1.0;

  // Calculate momentum
  const daysSinceMomentumUpdate = (Date.now() - friend.momentumLastUpdated.getTime()) / 86400000;
  const currentMomentumScore = Math.max(0, friend.momentumScore - daysSinceMomentumUpdate);

  let finalPoints = baseScore * archetypeMultiplier * durationModifier * vibeMultiplier * eventMultiplier * groupDilutionFactor;

  if (currentMomentumScore > 0) {
    finalPoints *= 1.15;
  }

  return finalPoints;
}

export async function logNewWeave(
  friendsToUpdate: FriendModel[],
  weaveData: InteractionFormData,
  database: Database
): Promise<void> {
  await database.write(async () => {
    const newInteraction = await database.get<InteractionModel>('interactions').create(interaction => {
      interaction.interactionDate = weaveData.date;
      interaction.interactionType = weaveData.type;
      interaction.category = weaveData.category;  // NEW
      interaction.status = weaveData.status;
      interaction.note = weaveData.notes;
      interaction.vibe = weaveData.vibe;
      interaction.duration = weaveData.duration;
      // mode and activity no longer set
    });

    for (const friend of friendsToUpdate) {
      if (weaveData.type === 'plan') {
        await database.get<InteractionFriend>('interaction_friends').create(ifriend => {
          ifriend.interactionId = newInteraction.id;
          ifriend.friendId = friend.id;
        });
        continue;
      }

      const currentScore = calculateCurrentScore(friend);
      const pointsToAdd = calculatePointsForWeave(friend, {
        category: weaveData.category,
        duration: weaveData.duration,
        vibe: weaveData.vibe
      });
      const newWeaveScore = Math.min(100, currentScore + pointsToAdd);

      await friend.update(record => {
        record.weaveScore = newWeaveScore;
        record.lastUpdated = new Date();
        // ... momentum & resilience logic unchanged
      });

      await database.get<InteractionFriend>('interaction_friends').create(ifriend => {
        ifriend.interactionId = newInteraction.id;
        ifriend.friendId = friend.id;
      });
    }
  });
}
```

---

#### Task 4.3: Create Archetype-Category Multipliers
**File:** `src/lib/constants.ts`

Add new mapping:
```typescript
export const ArchetypeCategoryMultipliers: Record<Archetype, Record<InteractionCategory, number>> = {
  Emperor: {
    'text-call': 0.7,
    'voice-note': 0.8,
    'meal-drink': 1.4,
    'hangout': 1.1,
    'deep-talk': 1.2,
    'event-party': 1.7,
    'activity-hobby': 1.4,
    'celebration': 1.9,
  },

  Empress: {
    'text-call': 0.9,
    'voice-note': 1.0,
    'meal-drink': 1.8,
    'hangout': 1.6,
    'deep-talk': 1.3,
    'event-party': 1.3,
    'activity-hobby': 1.4,
    'celebration': 1.8,
  },

  HighPriestess: {
    'text-call': 1.2,
    'voice-note': 1.5,
    'meal-drink': 1.5,
    'hangout': 1.4,
    'deep-talk': 2.0,
    'event-party': 0.6,
    'activity-hobby': 1.2,
    'celebration': 1.0,
  },

  Fool: {
    'text-call': 1.7,
    'voice-note': 1.6,
    'meal-drink': 1.0,
    'hangout': 1.5,
    'deep-talk': 0.9,
    'event-party': 1.8,
    'activity-hobby': 1.9,
    'celebration': 1.4,
  },

  Sun: {
    'text-call': 0.8,
    'voice-note': 0.7,
    'meal-drink': 1.5,
    'hangout': 1.3,
    'deep-talk': 1.0,
    'event-party': 2.0,
    'activity-hobby': 1.5,
    'celebration': 2.0,
  },

  Hermit: {
    'text-call': 1.6,
    'voice-note': 1.7,
    'meal-drink': 1.3,
    'hangout': 1.4,
    'deep-talk': 1.9,
    'event-party': 0.5,
    'activity-hobby': 1.2,
    'celebration': 0.8,
  },

  Magician: {
    'text-call': 1.1,
    'voice-note': 1.2,
    'meal-drink': 1.3,
    'hangout': 1.2,
    'deep-talk': 1.5,
    'event-party': 1.6,
    'activity-hobby': 1.8,
    'celebration': 1.7,
  },
};

export function getArchetypeCategoryMultiplier(
  archetype: Archetype,
  category: InteractionCategory
): number {
  return ArchetypeCategoryMultipliers[archetype]?.[category] || 1.0;
}
```

---

### Day 5: Update Radial Menu & Testing

#### Task 5.1: Update Radial Menu Activities
**File:** `src/context/CardGestureContext.tsx`

Update activities to use new categories:
```typescript
const ACTIVITIES = [
  { id: 'meal-drink', icon: '🍽️', label: 'Meal' },
  { id: 'text-call', icon: '📞', label: 'Call' },
  { id: 'text-call', icon: '💬', label: 'Chat' },
  { id: 'hangout', icon: '🚶', label: 'Hangout' },
  { id: 'activity-hobby', icon: '🎨', label: 'Activity' },
  { id: 'event-party', icon: '🎉', label: 'Event' },
];

const handleInteraction = async (activityId: string, activityLabel: string, friendId: string) => {
  const friend = await database.get<Friend>(Friend.table).find(friendId);
  if (!friend) return;

  addInteraction({
    friendIds: [friendId],
    category: activityId as InteractionCategory,  // Now using category
    notes: '',
    date: new Date(),
    type: 'log',
    status: 'completed',
    vibe: null,
    duration: null,
  });

  // ... haptics and toast
};
```

---

#### Task 5.2: Run Data Migration
**File:** `app/_layout.tsx`

Add one-time migration on app launch:
```typescript
import { migrateInteractionCategories, verifyMigration } from '../src/db/data-migration';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RootLayout() {
  useEffect(() => {
    async function runMigrationIfNeeded() {
      const migrationCompleted = await AsyncStorage.getItem('@weave:migration_v9_completed');

      if (!migrationCompleted) {
        console.log('Running interaction category migration...');
        const stats = await migrateInteractionCategories();
        console.log('Migration complete:', stats);

        const verification = await verifyMigration();
        console.log('Verification:', verification);

        await AsyncStorage.setItem('@weave:migration_v9_completed', 'true');
      }
    }

    runMigrationIfNeeded();
  }, []);

  // ... rest of layout
}
```

---

#### Task 5.3: Testing Checklist

**Unit Tests:**
- [ ] Category base scores match design
- [ ] Archetype multipliers are reasonable
- [ ] Migration map covers all mode+activity combos
- [ ] Deep talk detection logic works

**Integration Tests:**
- [ ] Schema migration runs without errors
- [ ] Data migration maps 95%+ of interactions correctly
- [ ] New interactions save with category field
- [ ] Weave score calculation uses new system
- [ ] Radial menu creates interactions with categories

**Manual Testing:**
- [ ] Create new interaction via form - saves correctly
- [ ] Create interaction via radial menu - saves correctly
- [ ] View old interactions in timeline - still display
- [ ] Edit friend profile - no errors
- [ ] Score calculations match expected values

---

## Files Created/Modified Summary

### New Files (7):
1. `src/db/migrations.ts` - Migration configuration
2. `src/db/data-migration.ts` - Data migration logic
3. `src/lib/interaction-categories.ts` - Category definitions
4. `PHASE1_WEEK1_TECHNICAL_PLAN.md` - This file

### Modified Files (8):
1. `src/components/types.tsx` - Add InteractionCategory type
2. `src/db/schema.ts` - Add interaction_category column, increment version
3. `src/db.ts` - Include migrations
4. `src/db/models/Interaction.ts` - Add category field
5. `src/lib/constants.ts` - Add category scores & multipliers
6. `src/lib/weave-engine.ts` - Update scoring logic
7. `app/interaction-form.tsx` - Rebuild UI for categories
8. `src/stores/interactionStore.ts` - Update interface
9. `src/context/CardGestureContext.tsx` - Update radial menu
10. `app/_layout.tsx` - Add migration runner

---

## Rollback Plan

If migration fails:
1. Revert schema to v8
2. Remove `interaction_category` column
3. Continue using mode+activity system
4. All existing data intact

**Rollback command:**
```bash
git revert HEAD
npm run reinstall
```

---

## Success Criteria

**Week 1 Complete When:**
- [ ] Schema v9 deployed
- [ ] 95%+ of existing interactions migrated successfully
- [ ] New interactions save with category field
- [ ] Interaction form uses 8-category system
- [ ] Radial menu updated for categories
- [ ] Scoring system uses new multipliers
- [ ] All tests passing
- [ ] No user-facing errors

**Metrics:**
- Logging speed: 30% faster (1 tap vs 2 taps)
- Migration success: 95%+ accuracy
- User feedback: Categories make sense

---

## Next Steps (Week 2)

After Week 1 complete:
1. Build contextual reflection prompts
2. Create archetype-aware placeholder system
3. Add first pass of basic NLP
4. Begin micro-reflection for quick-touch

This sets foundation for intelligent reflection system!
