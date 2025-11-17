# Weave Modular Refactor - Agent-Optimized Roadmap v2.0

**Version:** 2.0 (REVISED - Scope Reduced)
**Date:** 2025-11-17
**Optimized for:** Claude Code / Agentic Coding Assistants
**Total Phases:** 18 micro-phases (reduced from 24)
**Estimated Timeline:** 10-12 weeks (with agent assistance)

---

## 🚨 CRITICAL CHANGES FROM V1.0

**REMOVED:**
- ❌ Phase 1.3: Repository Pattern (scope creep - separate future project)
- ❌ Phase 1.1-1.2: Database model cleanup (deferred to end)

**REORDERED:**
- ✅ Start with Gamification Module (safest, isolated)
- ✅ Database cleanup moved to Phase 6 (after modules stable)

**CLARIFIED:**
- ✅ Event Bus pattern: Commands = Direct calls, Events = Side effects
- ✅ Each module proven working before moving to next

---

## How to Use This Document

**FOR AGENTS:**
Each phase is a self-contained unit with:
- ✅ **Acceptance Criteria** - Explicit pass/fail conditions
- 📁 **Files to Change** - Exact file paths
- 🧪 **Verification** - Command to run to verify success
- ⚠️ **Rollback** - What to do if it fails

**FOR HUMANS:**
- Review output after each phase
- Run verification commands
- Approve before moving to next phase
- Flag issues immediately

---

## Phase Overview

### Foundation (Week 1)
- Phase 0.1: Setup module structure
- Phase 0.2: Create shared utilities
- Phase 0.3: Setup event bus (clarified pattern)
- Phase 0.4: Create DTO layer

### Gamification Module - PROOF OF CONCEPT (Weeks 2-3)
- Phase 1.1: Create gamification module structure
- Phase 1.2: Migrate badge system
- Phase 1.3: Migrate achievement system
- Phase 1.4: Update weave-engine to use gamification module

### Intelligence Module (Weeks 4-7)
- Phase 2.1: Create intelligence module structure
- Phase 2.2: Extract scoring service
- Phase 2.3: Extract decay service
- Phase 2.4: Migrate weave-engine to intelligence module

### Interactions Module (Weeks 7-9)
- Phase 3.1: Create interactions module
- Phase 3.2: Migrate interaction logging
- Phase 3.3: Update interaction store

### Insights Module (Weeks 9-11)
- Phase 4.1: Create insights module
- Phase 4.2: Migrate pattern analysis
- Phase 4.3: Update weave-engine consumers

### Database Cleanup (Weeks 11-12)
- Phase 5.1: Extract Friend model business logic
- Phase 5.2: Extract Interaction model business logic

### Final Integration (Week 12)
- Phase 6.1: Delete old lib/ files
- Phase 6.2: Add ESLint enforcement
- Phase 6.3: Performance audit

---

## PHASE 0.1: Setup Module Structure

**Goal:** Create the basic folder structure for all modules without any logic migration.

**Estimated Time:** 30 minutes
**Risk Level:** Low ⚠️

### Files to Create:

```
src/modules/
  gamification/
    index.ts
    types.ts
    store.ts
    services/.gitkeep
    components/.gitkeep
  intelligence/
    index.ts
    types.ts
    store.ts
    services/.gitkeep
  interactions/
    index.ts
    types.ts
    store.ts
    services/.gitkeep
    components/.gitkeep
  insights/
    index.ts
    types.ts
    store.ts
    services/.gitkeep
  relationships/
    index.ts
    types.ts
    store.ts
    services/.gitkeep
```

### Starter Content for Each `index.ts`:

```typescript
// src/modules/gamification/index.ts
/**
 * Gamification Module
 * 
 * Handles badges, achievements, and milestone tracking.
 * 
 * @public
 */

// Placeholder - will be populated in later phases
export {};
```

### Acceptance Criteria:

✅ All module folders exist
✅ Each module has index.ts, types.ts, store.ts
✅ App still compiles with no errors
✅ No imports from modules yet (they're empty)

### Verification Command:

```bash
# Check structure exists
ls -R src/modules/

# Verify app compiles
npm run build
```

### Rollback:

```bash
rm -rf src/modules/
```

---

## PHASE 0.2: Create Shared Utilities

**Goal:** Setup shared folder with cross-module utilities and UI primitives.

**Estimated Time:** 1 hour
**Risk Level:** Low ⚠️

### Files to Create:

```
src/shared/
  components/
    index.ts
  hooks/
    index.ts
  utils/
    index.ts
    date.utils.ts
    string.utils.ts
    number.utils.ts
  types/
    common.types.ts
```

### Example: `src/shared/utils/date.utils.ts`

```typescript
/**
 * Shared date utilities
 * Used across multiple modules
 */

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function daysSince(date: Date): number {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}
```

### Files to Update:

**`tsconfig.json`** - Add path aliases:

```json
{
  "compilerOptions": {
    "paths": {
      "@/modules/*": ["src/modules/*"],
      "@/shared/*": ["src/shared/*"],
      "@/db/*": ["src/db/*"],
      "@/app/*": ["app/*"]
    }
  }
}
```

### Acceptance Criteria:

✅ src/shared/ structure exists
✅ Path aliases work in tsconfig.json
✅ Can import from @/shared/* in any file
✅ App still compiles

### Verification Command:

```bash
# Test import
echo "import { formatDate } from '@/shared/utils/date.utils';" > test-import.ts
npx tsc --noEmit test-import.ts
rm test-import.ts

# Verify app compiles
npm run build
```

---

## PHASE 0.3: Setup Event Bus (CLARIFIED PATTERN)

**Goal:** Create a type-safe event bus for **side effects only** - NOT for primary commands.

**Estimated Time:** 1 hour
**Risk Level:** Medium ⚠️⚠️

### 🎯 CRITICAL PATTERN CLARIFICATION

**EVENT BUS USAGE:**

✅ **USE for:** Side effects, notifications, non-critical flows
- Badge checking after interaction
- Pattern analysis after interaction
- Analytics tracking
- UI notifications

❌ **DON'T USE for:** Critical business logic, synchronous flows
- Calculating scores (use direct import)
- Updating friend records (use direct import)
- Creating interactions (use direct import)

### Example of Correct Pattern:

```typescript
// ✅ CORRECT: Direct call for critical logic
import { calculateScoreAfterInteraction } from '@/modules/intelligence';
const newScore = calculateScoreAfterInteraction(currentScore, quality, days);

// ✅ CORRECT: Event for side effects
await eventBus.emit(DomainEvent.INTERACTION_LOGGED, {
  friendId,
  type,
  quality,
  timestamp,
});

// Other modules listen:
// - Gamification checks for badges
// - Insights analyzes patterns
// - Analytics logs event
```

### Files to Create:

**`src/shared/events/event-bus.ts`**

```typescript
type EventCallback<T = any> = (data: T) => void | Promise<void>;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  /**
   * Subscribe to an event
   */
  on<T = any>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  /**
   * Emit an event
   */
  async emit<T = any>(event: string, data: T): Promise<void> {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    const promises = Array.from(callbacks).map(cb => {
      try {
        return Promise.resolve(cb(data));
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
        return Promise.resolve();
      }
    });

    await Promise.all(promises);
  }

  /**
   * Remove all listeners for an event
   */
  off(event: string): void {
    this.listeners.delete(event);
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
```

**`src/shared/events/domain-events.ts`**

```typescript
/**
 * Domain Events
 * 
 * These are SIDE-EFFECT events, not commands.
 * They notify other modules that something happened.
 */

export enum DomainEvent {
  // Interaction Events (after interaction is logged)
  INTERACTION_LOGGED = 'interaction.logged',
  
  // Scoring Events (after score is updated)
  SCORE_UPDATED = 'score.updated',
  
  // Relationship Events (after friend status changes)
  FRIEND_DORMANT = 'friend.dormant',
  FRIEND_TIER_CHANGED = 'friend.tier_changed',
}

// Event Payloads (type-safe!)
export interface InteractionLoggedPayload {
  friendId: string;
  type: string;
  quality: number;
  timestamp: Date;
}

export interface ScoreUpdatedPayload {
  friendId: string;
  oldScore: number;
  newScore: number;
  reason: string;
}

// Type map for type-safe event handling
export interface DomainEventMap {
  [DomainEvent.INTERACTION_LOGGED]: InteractionLoggedPayload;
  [DomainEvent.SCORE_UPDATED]: ScoreUpdatedPayload;
  // Add more as needed
}
```

**`src/shared/events/index.ts`**

```typescript
export { eventBus } from './event-bus';
export { DomainEvent, type DomainEventMap } from './domain-events';
```

### Acceptance Criteria:

✅ Event bus created
✅ Domain events typed
✅ Can emit and subscribe to events
✅ Pattern documented (commands vs events)
✅ App still compiles

### Verification Command:

```bash
npm run build
npm run typecheck
```

---

## PHASE 0.4: Create DTO Layer

**Goal:** Create Data Transfer Objects (DTOs) to decouple modules from database models.

**Estimated Time:** 1 hour
**Risk Level:** Low ⚠️

### Files to Create:

**`src/shared/types/dtos.ts`**

```typescript
/**
 * Data Transfer Objects (DTOs)
 * 
 * These are plain objects that carry data between modules.
 * They are NOT database models - they're serializable snapshots.
 */

// Friend DTO - snapshot of friend data
export interface FriendDTO {
  id: string;
  name: string;
  currentScore: number;
  tier: number;
  createdAt: Date;
  updatedAt: Date;
  lastContactDate?: Date;
  isDormant: boolean;
}

// Interaction DTO - snapshot of interaction data
export interface InteractionDTO {
  id: string;
  friendId: string;
  type: string;
  quality: number;
  timestamp: Date;
  notes?: string;
  isPlanned: boolean;
}

// Score Components DTO - breakdown of scoring
export interface ScoreComponentsDTO {
  baseScore: number;
  decayedScore: number;
  qualityMultiplier: number;
  momentumBonus: number;
  finalScore: number;
}
```

**`src/shared/types/common.types.ts`**

```typescript
/**
 * Common types used across modules
 */

export type UUID = string;

export enum Tier {
  CORE = 1,
  MEANINGFUL = 2,
  FAMILIAR = 3,
  ACQUAINTANCE = 4,
}

export enum InteractionType {
  CALL = 'call',
  MESSAGE = 'message',
  IN_PERSON = 'in_person',
  VIDEO_CALL = 'video_call',
  EMAIL = 'email',
}
```

### Acceptance Criteria:

✅ DTOs created for Friend and Interaction
✅ Common types defined
✅ Types are importable from @/shared/types
✅ App still compiles

### Verification Command:

```bash
npm run typecheck
```

---

## PHASE 1.1: Create Gamification Module Structure

**Goal:** Create the gamification module skeleton. This is our PROOF OF CONCEPT.

**Estimated Time:** 1 hour
**Risk Level:** Low ⚠️

### Why Start Here?

**Gamification is the safest module to start with:**
- ✅ Isolated (doesn't affect core functionality)
- ✅ Non-critical (app works without badges)
- ✅ Clear boundaries (badge-*.ts files are obvious)
- ✅ Small scope (6 files total)

### Files to Create:

**`src/modules/gamification/index.ts`**

```typescript
/**
 * Gamification Module
 * 
 * Handles badges, achievements, and milestone tracking.
 * This is a NON-CRITICAL module - if it fails, core app still works.
 * 
 * @public API
 */

// Services
export * from './services/badge.service';
export * from './services/achievement.service';

// Types
export * from './types';

// Store
export { useGamificationStore } from './store';
```

**`src/modules/gamification/types.ts`**

```typescript
/**
 * Gamification Module Types
 */

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  requirement: string;
  unlockedAt?: Date;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  points: number;
  unlockedAt?: Date;
}

export interface BadgeCheckResult {
  newBadges: Badge[];
  totalBadges: number;
}
```

**`src/modules/gamification/store.ts`**

```typescript
import { create } from 'zustand';
import type { Badge, Achievement } from './types';

/**
 * Gamification Store
 * 
 * Manages badge and achievement state.
 */

interface GamificationState {
  badges: Badge[];
  achievements: Achievement[];
  
  // Actions
  addBadge: (badge: Badge) => void;
  addAchievement: (achievement: Achievement) => void;
  getBadgesForFriend: (friendId: string) => Badge[];
}

export const useGamificationStore = create<GamificationState>((set, get) => ({
  badges: [],
  achievements: [],
  
  addBadge: (badge) => {
    set((state) => ({
      badges: [...state.badges, badge],
    }));
  },
  
  addAchievement: (achievement) => {
    set((state) => ({
      achievements: [...state.achievements, achievement],
    }));
  },
  
  getBadgesForFriend: (friendId) => {
    // Placeholder - will be implemented later
    return [];
  },
}));
```

**Create empty service files:**

```typescript
// src/modules/gamification/services/badge.service.ts
// Placeholder - will be implemented in Phase 1.2
export {};

// src/modules/gamification/services/achievement.service.ts
// Placeholder - will be implemented in Phase 1.3
export {};
```

### Acceptance Criteria:

✅ Gamification module structure created
✅ Types defined
✅ Store created (with placeholders)
✅ Service files created (empty)
✅ Can import from @/modules/gamification
✅ App compiles

### Verification Command:

```bash
# Test import
echo "import { useGamificationStore } from '@/modules/gamification';" > test.ts
npx tsc --noEmit test.ts
rm test.ts

npm run build
```

---

## PHASE 1.2: Migrate Badge System

**Goal:** Move badge logic from lib/ to gamification module.

**Estimated Time:** 3 hours
**Risk Level:** Medium 🔥🔥

### Current Files to Migrate:

- `src/lib/badge-tracker.ts`
- `src/lib/badge-calculator.ts`
- `src/lib/badge-definitions.ts`

### Step 1: Copy badge definitions

**`src/modules/gamification/constants/badge-definitions.ts`**

```typescript
/**
 * Badge Definitions
 * 
 * Copied from src/lib/badge-definitions.ts
 */

export const BADGE_DEFINITIONS = {
  FIRST_CONTACT: {
    id: 'first_contact',
    name: 'First Contact',
    description: 'Log your first interaction',
    icon: '👋',
    requirement: 'Log 1 interaction',
  },
  WEEKLY_WARRIOR: {
    id: 'weekly_warrior',
    name: 'Weekly Warrior',
    description: 'Log interactions for 7 consecutive days',
    icon: '🔥',
    requirement: 'Log interactions 7 days in a row',
  },
  // ... copy all badge definitions from badge-definitions.ts
} as const;

export type BadgeId = keyof typeof BADGE_DEFINITIONS;
```

### Step 2: Create badge service

**`src/modules/gamification/services/badge.service.ts`**

```typescript
import { database } from '@/db';
import { BADGE_DEFINITIONS, type BadgeId } from '../constants/badge-definitions';
import type { Badge, BadgeCheckResult } from '../types';

/**
 * Badge Service
 * 
 * Pure functions for badge checking and awarding.
 * 
 * IMPORTANT: This uses DIRECT database calls (for now).
 * We are NOT introducing a repository pattern in this phase.
 */

/**
 * Check if friend earned any new badges
 */
export async function checkAndAwardBadges(friendId: string): Promise<BadgeCheckResult> {
  // Get friend's interactions
  const interactions = await database.collections
    .get('interactions')
    .query()
    .where('friend_id', friendId)
    .fetch();

  const newBadges: Badge[] = [];

  // Check each badge condition
  if (shouldAwardBadge('FIRST_CONTACT', interactions)) {
    const badge = await awardBadge(friendId, 'FIRST_CONTACT');
    if (badge) newBadges.push(badge);
  }

  if (shouldAwardBadge('WEEKLY_WARRIOR', interactions)) {
    const badge = await awardBadge(friendId, 'WEEKLY_WARRIOR');
    if (badge) newBadges.push(badge);
  }

  // Get total badges for friend
  const totalBadges = await database.collections
    .get('badges')
    .query()
    .where('friend_id', friendId)
    .fetchCount();

  return {
    newBadges,
    totalBadges,
  };
}

/**
 * Check if badge should be awarded
 */
function shouldAwardBadge(badgeId: BadgeId, interactions: any[]): boolean {
  switch (badgeId) {
    case 'FIRST_CONTACT':
      return interactions.length >= 1;
    
    case 'WEEKLY_WARRIOR':
      return checkConsecutiveDays(interactions, 7);
    
    default:
      return false;
  }
}

/**
 * Award a badge to a friend
 */
async function awardBadge(friendId: string, badgeId: BadgeId): Promise<Badge | null> {
  // Check if already awarded
  const existing = await database.collections
    .get('badges')
    .query()
    .where('friend_id', friendId)
    .where('badge_id', badgeId)
    .fetch();

  if (existing.length > 0) return null;

  // Create badge record
  const badgeDef = BADGE_DEFINITIONS[badgeId];
  const badge = await database.collections
    .get('badges')
    .create((record: any) => {
      record.friend_id = friendId;
      record.badge_id = badgeId;
      record.name = badgeDef.name;
      record.description = badgeDef.description;
      record.icon = badgeDef.icon;
      record.unlocked_at = new Date();
    });

  return {
    id: badge.id,
    name: badgeDef.name,
    description: badgeDef.description,
    icon: badgeDef.icon,
    requirement: badgeDef.requirement,
    unlockedAt: new Date(),
  };
}

/**
 * Check for consecutive days of interactions
 */
function checkConsecutiveDays(interactions: any[], days: number): boolean {
  if (interactions.length < days) return false;

  // Sort by timestamp
  const sorted = [...interactions].sort((a, b) => 
    b.timestamp.getTime() - a.timestamp.getTime()
  );

  let consecutiveDays = 1;
  let lastDate = new Date(sorted[0].timestamp);

  for (let i = 1; i < sorted.length; i++) {
    const currentDate = new Date(sorted[i].timestamp);
    const daysDiff = Math.floor(
      (lastDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 1) {
      consecutiveDays++;
      if (consecutiveDays >= days) return true;
    } else if (daysDiff > 1) {
      break; // Streak broken
    }

    lastDate = currentDate;
  }

  return false;
}

/**
 * Get all badges for a friend
 */
export async function getBadgesForFriend(friendId: string): Promise<Badge[]> {
  const records = await database.collections
    .get('badges')
    .query()
    .where('friend_id', friendId)
    .fetch();

  return records.map((record: any) => ({
    id: record.id,
    name: record.name,
    description: record.description,
    icon: record.icon,
    requirement: record.requirement || '',
    unlockedAt: record.unlocked_at,
  }));
}
```

### Step 3: Export from module

**Update `src/modules/gamification/index.ts`:**

```typescript
export { checkAndAwardBadges, getBadgesForFriend } from './services/badge.service';
export { BADGE_DEFINITIONS } from './constants/badge-definitions';
export * from './types';
export { useGamificationStore } from './store';
```

### Step 4: Update weave-engine.ts (TEMPORARY)

**Find the badge import in `src/lib/weave-engine.ts`:**

```typescript
// BEFORE
import { checkAndAwardFriendBadges } from './badge-tracker';

// AFTER
import { checkAndAwardBadges } from '@/modules/gamification';
```

**Find badge checking calls:**

```typescript
// BEFORE
await checkAndAwardFriendBadges(friendId);

// AFTER
await checkAndAwardBadges(friendId);
```

### Step 5: Comment out old files (DO NOT DELETE YET)

```typescript
// src/lib/badge-tracker.ts
// DEPRECATED - Moved to @/modules/gamification
// Delete after Phase 1.4 is complete
// export function checkAndAwardFriendBadges(...) { ... }
```

### Acceptance Criteria:

✅ Badge service created in gamification module
✅ Badge definitions moved
✅ weave-engine.ts uses new badge service
✅ Old files commented out (not deleted)
✅ App compiles
✅ Badges still work (manual test)

### Verification Command:

```bash
# Check new service exists
ls -la src/modules/gamification/services/badge.service.ts

# Check weave-engine imports from module
grep -n "@/modules/gamification" src/lib/weave-engine.ts

# Build
npm run build

# Manual test
npm start
```

### Manual Testing Checklist:

- [ ] Log an interaction
- [ ] Check if badge appears
- [ ] View friend's badges
- [ ] No console errors

---

## PHASE 1.3: Migrate Achievement System

**Goal:** Move achievement logic from lib/ to gamification module.

**Estimated Time:** 2 hours
**Risk Level:** Low 🔥

### Files to Migrate:

- `src/lib/achievement-tracker.ts`
- `src/lib/achievement-definitions.ts`

### Similar Process to Phase 1.2:

1. Copy achievement definitions to `src/modules/gamification/constants/achievement-definitions.ts`
2. Create `src/modules/gamification/services/achievement.service.ts`
3. Update weave-engine.ts imports
4. Comment out old files

### `src/modules/gamification/services/achievement.service.ts`

```typescript
import { database } from '@/db';
import { ACHIEVEMENT_DEFINITIONS, type AchievementId } from '../constants/achievement-definitions';
import type { Achievement } from '../types';

/**
 * Achievement Service
 * 
 * Checks and awards global achievements.
 */

export async function checkAndAwardAchievements(userId: string): Promise<Achievement[]> {
  const newAchievements: Achievement[] = [];

  // Get all friends
  const friends = await database.collections
    .get('friends')
    .query()
    .fetch();

  // Get all interactions
  const interactions = await database.collections
    .get('interactions')
    .query()
    .fetch();

  // Check achievement conditions
  if (shouldAwardAchievement('SOCIAL_BUTTERFLY', friends, interactions)) {
    const achievement = await awardAchievement(userId, 'SOCIAL_BUTTERFLY');
    if (achievement) newAchievements.push(achievement);
  }

  // Add more achievement checks...

  return newAchievements;
}

function shouldAwardAchievement(
  achievementId: AchievementId,
  friends: any[],
  interactions: any[]
): boolean {
  switch (achievementId) {
    case 'SOCIAL_BUTTERFLY':
      return interactions.length >= 100;
    
    default:
      return false;
  }
}

async function awardAchievement(
  userId: string,
  achievementId: AchievementId
): Promise<Achievement | null> {
  // Check if already awarded
  const existing = await database.collections
    .get('achievements')
    .query()
    .where('user_id', userId)
    .where('achievement_id', achievementId)
    .fetch();

  if (existing.length > 0) return null;

  const achievementDef = ACHIEVEMENT_DEFINITIONS[achievementId];
  
  const achievement = await database.collections
    .get('achievements')
    .create((record: any) => {
      record.user_id = userId;
      record.achievement_id = achievementId;
      record.name = achievementDef.name;
      record.description = achievementDef.description;
      record.points = achievementDef.points;
      record.unlocked_at = new Date();
    });

  return {
    id: achievement.id,
    name: achievementDef.name,
    description: achievementDef.description,
    points: achievementDef.points,
    unlockedAt: new Date(),
  };
}
```

### Acceptance Criteria:

✅ Achievement service created
✅ Achievement definitions moved
✅ weave-engine.ts updated
✅ Old files commented out
✅ App compiles
✅ Achievements work (manual test)

### Verification Command:

```bash
npm run build
npm start # Test achievements
```

---

## PHASE 1.4: Setup Event Subscriptions for Gamification

**Goal:** Make gamification module listen to INTERACTION_LOGGED events instead of being called directly.

**Estimated Time:** 2 hours
**Risk Level:** Medium 🔥🔥

### Why This Matters:

Currently, weave-engine.ts calls gamification directly. We want to decouple this using events.

### Create Event Listener:

**`src/modules/gamification/listeners/interaction-listener.ts`**

```typescript
import { eventBus, DomainEvent } from '@/shared/events';
import type { InteractionLoggedPayload } from '@/shared/events/domain-events';
import { checkAndAwardBadges } from '../services/badge.service';
import { checkAndAwardAchievements } from '../services/achievement.service';

/**
 * Gamification Interaction Listener
 * 
 * Listens for INTERACTION_LOGGED events and checks for badges/achievements.
 * This is a SIDE EFFECT - not critical to the interaction flow.
 */

export function setupGamificationListeners(): void {
  // Listen for new interactions
  eventBus.on<InteractionLoggedPayload>(
    DomainEvent.INTERACTION_LOGGED,
    async (data) => {
      try {
        // Check for badges
        const badgeResult = await checkAndAwardBadges(data.friendId);
        
        if (badgeResult.newBadges.length > 0) {
          console.log(`🎉 Awarded ${badgeResult.newBadges.length} new badges!`);
        }

        // Check for achievements (global)
        // Note: You'll need to get userId from somewhere
        // const achievements = await checkAndAwardAchievements(userId);
        
      } catch (error) {
        console.error('Error in gamification listener:', error);
        // Don't throw - this is a non-critical side effect
      }
    }
  );
}
```

### Initialize Listeners:

**Update `app/_layout.tsx`:**

```typescript
import { setupGamificationListeners } from '@/modules/gamification/listeners/interaction-listener';

// In app initialization
useEffect(() => {
  setupGamificationListeners();
}, []);
```

### Update weave-engine.ts:

**Remove direct gamification calls:**

```typescript
// BEFORE - Direct call
import { checkAndAwardBadges } from '@/modules/gamification';
await checkAndAwardBadges(friendId);

// AFTER - Emit event
import { eventBus, DomainEvent } from '@/shared/events';
await eventBus.emit(DomainEvent.INTERACTION_LOGGED, {
  friendId,
  type,
  quality,
  timestamp: new Date(),
});
```

### Acceptance Criteria:

✅ Event listener created
✅ Listeners initialized in app startup
✅ weave-engine.ts emits events instead of calling directly
✅ Badges still awarded (now via events)
✅ App compiles
✅ Manual test passes

### Verification Command:

```bash
npm run build
npm start

# Test:
# 1. Log an interaction
# 2. Check console for "🎉 Awarded X new badges!"
# 3. Verify badges appear in UI
```

### Manual Testing Checklist:

- [ ] Log interaction
- [ ] Badge event fires (check console)
- [ ] Badge appears in UI
- [ ] No errors

---

## PHASE 2.1: Create Intelligence Module Structure

**Goal:** Create intelligence module skeleton for scoring logic.

**Estimated Time:** 1 hour
**Risk Level:** Low ⚠️

### Files to Create:

**`src/modules/intelligence/index.ts`**

```typescript
/**
 * Intelligence Module
 * 
 * Handles scoring calculations, decay, and quality assessment.
 * This is the "brain" of Weave's relationship scoring system.
 * 
 * @public API
 */

// Services
export * from './services/scoring.service';
export * from './services/decay.service';
export * from './services/quality.service';

// Types
export * from './types';

// Store
export { useIntelligenceStore } from './store';
```

**`src/modules/intelligence/types.ts`**

```typescript
import type { ScoreComponentsDTO } from '@/shared/types/dtos';

export interface ScoringInput {
  currentScore: number;
  interactionQuality: number;
  daysSinceLastInteraction: number;
}

export interface ScoringOutput extends ScoreComponentsDTO {
  friendId: string;
  timestamp: Date;
}

export interface DecayParams {
  baseScore: number;
  daysSinceLastContact: number;
  tier: number;
}
```

**`src/modules/intelligence/store.ts`**

```typescript
import { create } from 'zustand';

interface IntelligenceState {
  scoreCache: Map<string, number>;
  lastCalculation: Date | null;
  
  cacheScore: (friendId: string, score: number) => void;
  getCachedScore: (friendId: string) => number | undefined;
  clearCache: () => void;
}

export const useIntelligenceStore = create<IntelligenceState>((set, get) => ({
  scoreCache: new Map(),
  lastCalculation: null,
  
  cacheScore: (friendId, score) => {
    set((state) => {
      const newCache = new Map(state.scoreCache);
      newCache.set(friendId, score);
      return { scoreCache: newCache, lastCalculation: new Date() };
    });
  },
  
  getCachedScore: (friendId) => get().scoreCache.get(friendId),
  
  clearCache: () => set({ scoreCache: new Map(), lastCalculation: null }),
}));
```

### Acceptance Criteria:

✅ Intelligence module structure created
✅ Types defined
✅ Store created
✅ Can import from @/modules/intelligence
✅ App compiles

### Verification Command:

```bash
npm run build
```

---

## PHASE 2.2: Extract Scoring Service

**Goal:** Extract core scoring logic from weave-engine.ts

**Estimated Time:** 4 hours
**Risk Level:** High 🔥🔥🔥

### Create Scoring Service:

**`src/modules/intelligence/services/scoring.service.ts`**

```typescript
import type { ScoringInput, ScoringOutput } from '../types';
import { database } from '@/db';

/**
 * Scoring Service
 * 
 * Pure functions for calculating relationship scores.
 */

const SCORING_CONSTANTS = {
  BASE_MULTIPLIER: 1.0,
  QUALITY_WEIGHT: 0.4,
  FREQUENCY_WEIGHT: 0.3,
  RECENCY_WEIGHT: 0.3,
} as const;

/**
 * Calculate new score after an interaction
 */
export function calculateScoreAfterInteraction(
  currentScore: number,
  interactionQuality: number,
  daysSinceLastInteraction: number
): number {
  const baseIncrease = interactionQuality * 10; // Max +10 points
  const recencyBonus = Math.max(0, 5 - daysSinceLastInteraction * 0.1);
  
  const newScore = currentScore + baseIncrease + recencyBonus;
  
  return Math.max(0, Math.min(100, newScore));
}

/**
 * Calculate the current score for a friend (with all factors)
 */
export async function calculateCurrentScore(friendId: string): Promise<number> {
  // Get friend
  const friend = await database.collections.get('friends').find(friendId);
  
  // Get recent interactions
  const interactions = await database.collections
    .get('interactions')
    .query()
    .where('friend_id', friendId)
    .sortBy('timestamp', 'desc')
    .take(10)
    .fetch();

  const baseScore = friend.weave_score;
  
  if (interactions.length === 0) return baseScore;

  // Calculate quality average
  const avgQuality = interactions.reduce((sum, i) => sum + i.quality, 0) / interactions.length;
  
  // Quality multiplier (0.5 to 1.5)
  const qualityMultiplier = 0.5 + avgQuality;
  
  // Frequency score (interactions per week)
  const frequencyScore = calculateFrequencyScore(interactions);
  
  // Recency score
  const recencyScore = calculateRecencyScore(friend.last_contact_at);
  
  // Weighted final score
  const finalScore = 
    baseScore * SCORING_CONSTANTS.BASE_MULTIPLIER +
    (avgQuality * SCORING_CONSTANTS.QUALITY_WEIGHT) +
    (frequencyScore * SCORING_CONSTANTS.FREQUENCY_WEIGHT) +
    (recencyScore * SCORING_CONSTANTS.RECENCY_WEIGHT);
  
  return Math.max(0, Math.min(100, finalScore));
}

function calculateFrequencyScore(interactions: any[]): number {
  if (interactions.length === 0) return 0;
  
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const recentCount = interactions.filter(
    i => new Date(i.timestamp) >= oneWeekAgo
  ).length;
  
  return Math.min(recentCount / 3, 1.0);
}

function calculateRecencyScore(lastContactDate?: Date): number {
  if (!lastContactDate) return 0.5;
  
  const daysSince = Math.floor(
    (Date.now() - lastContactDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  
  return Math.exp(-daysSince / 30);
}
```

### Acceptance Criteria:

✅ scoring.service.ts created
✅ Functions are pure where possible
✅ Uses direct database calls (as per current pattern)
✅ App compiles

### Verification Command:

```bash
npm run build
```

---

## PHASE 2.3: Extract Decay Service

**Goal:** Extract decay logic into separate service.

**Estimated Time:** 2 hours
**Risk Level:** Low 🔥

### `src/modules/intelligence/services/decay.service.ts`

```typescript
import type { DecayParams } from '../types';

const DECAY_RATES = {
  [1]: 0.95, // Core: 5% decay per week
  [2]: 0.90, // Meaningful: 10% decay
  [3]: 0.85, // Familiar: 15% decay
  [4]: 0.80, // Acquaintance: 20% decay
} as const;

export function calculateDecay(params: DecayParams): number {
  const { baseScore, daysSinceLastContact, tier } = params;
  
  if (daysSinceLastContact === 0) return baseScore;
  
  const weeksSinceContact = daysSinceLastContact / 7;
  const decayRate = DECAY_RATES[tier as keyof typeof DECAY_RATES] || 0.85;
  
  const decayedScore = baseScore * Math.pow(decayRate, weeksSinceContact);
  
  return Math.max(0, decayedScore);
}
```

### Acceptance Criteria:

✅ decay.service.ts created
✅ Pure functions
✅ App compiles

### Verification Command:

```bash
npm run build
```

---

## PHASE 2.4: Migrate Weave-Engine to Intelligence Module

**Goal:** Update weave-engine.ts to import from intelligence module.

**Estimated Time:** 4 hours
**Risk Level:** High 🔥🔥🔥

### Strategy:

Find all scoring function calls in weave-engine.ts and update imports.

### Example Migration:

```typescript
// BEFORE
function calculateNewScore(friend, interaction) {
  // ... inline scoring logic
}

// AFTER
import { calculateScoreAfterInteraction } from '@/modules/intelligence';

const newScore = calculateScoreAfterInteraction(
  friend.weave_score,
  interaction.quality,
  daysSinceLastInteraction
);
```

### Acceptance Criteria:

✅ weave-engine.ts imports from @/modules/intelligence
✅ No duplicate scoring logic
✅ Old scoring functions commented out
✅ App compiles
✅ Scores calculate correctly (manual test)

### Verification Command:

```bash
# Check imports
grep -n "@/modules/intelligence" src/lib/weave-engine.ts

npm run build
npm start # Manual test
```

### Manual Testing:

- [ ] Log interaction
- [ ] Score updates correctly
- [ ] Friend list shows correct scores
- [ ] No console errors

---

## PHASE 3.1: Create Interactions Module

**Goal:** Create interactions module for logging and planning.

**Estimated Time:** 3 hours
**Risk Level:** Medium 🔥🔥

### `src/modules/interactions/services/logging.service.ts`

```typescript
import { database } from '@/db';
import { eventBus, DomainEvent } from '@/shared/events';
import { calculateScoreAfterInteraction } from '@/modules/intelligence';

export async function logInteraction(input: {
  friendId: string;
  type: string;
  quality: number;
  notes?: string;
}): Promise<void> {
  const { friendId, type, quality, notes } = input;
  
  // 1. Get friend
  const friend = await database.collections.get('friends').find(friendId);
  
  // 2. Create interaction
  await database.collections.get('interactions').create((record: any) => {
    record.friend_id = friendId;
    record.type = type;
    record.quality = quality;
    record.notes = notes;
    record.timestamp = new Date();
    record.is_planned = false;
  });
  
  // 3. Calculate new score
  const daysSinceLastContact = friend.last_contact_at
    ? Math.floor((Date.now() - friend.last_contact_at.getTime()) / (1000 * 60 * 60 * 24))
    : 30;
  
  const newScore = calculateScoreAfterInteraction(
    friend.weave_score,
    quality,
    daysSinceLastContact
  );
  
  // 4. Update friend
  await friend.update({
    weave_score: newScore,
    last_contact_at: new Date(),
    is_dormant: false,
  });
  
  // 5. Emit event for side effects
  await eventBus.emit(DomainEvent.INTERACTION_LOGGED, {
    friendId,
    type,
    quality,
    timestamp: new Date(),
  });
}
```

### Acceptance Criteria:

✅ Interactions module created
✅ Logging service implemented
✅ Uses intelligence module for scoring
✅ Emits events
✅ App compiles

### Verification Command:

```bash
npm run build
```

---

## PHASE 3.2: Migrate Interaction Logging

**Goal:** Update interaction store to use interactions module.

**Estimated Time:** 2 hours
**Risk Level:** Medium 🔥🔥

### Update `src/stores/interactionStore.ts`:

```typescript
// BEFORE
import { logNewWeave } from '../lib/weave-engine';
await logNewWeave(friendId, data);

// AFTER
import { logInteraction } from '@/modules/interactions';
await logInteraction({
  friendId,
  type: data.type,
  quality: data.quality,
  notes: data.notes,
});
```

### Acceptance Criteria:

✅ interactionStore.ts uses interactions module
✅ No direct weave-engine calls for logging
✅ App compiles
✅ Logging works (manual test)

### Verification Command:

```bash
npm run build
npm start # Test logging
```

---

## PHASE 4.1: Create Insights Module

**Goal:** Create insights module for pattern analysis.

**Estimated Time:** 3 hours
**Risk Level:** Medium 🔥🔥

### Files to Create:

**`src/modules/insights/services/pattern.service.ts`**

```typescript
import { database } from '@/db';

export async function analyzePatterns(friendId: string): Promise<any> {
  // Get interactions
  const interactions = await database.collections
    .get('interactions')
    .query()
    .where('friend_id', friendId)
    .sortBy('timestamp', 'desc')
    .fetch();

  // Analyze patterns
  // ... pattern logic from pattern-analyzer.ts
  
  return {
    patternType: 'regular',
    confidence: 0.8,
  };
}
```

### Acceptance Criteria:

✅ Insights module created
✅ Pattern service implemented
✅ App compiles

### Verification Command:

```bash
npm run build
```

---

## PHASE 4.2: Migrate Pattern Analysis

**Goal:** Update weave-engine to use insights module.

**Estimated Time:** 2 hours
**Risk Level:** Low 🔥

### Update weave-engine.ts:

```typescript
// BEFORE
import { analyzeInteractionPattern } from './pattern-analyzer';

// AFTER
import { analyzePatterns } from '@/modules/insights';
```

### Acceptance Criteria:

✅ weave-engine uses insights module
✅ Old pattern files commented out
✅ App compiles

### Verification Command:

```bash
npm run build
```

---

## PHASE 5.1: Extract Friend Model Business Logic

**Goal:** Move business logic from Friend model to services (DEFERRED until now).

**Estimated Time:** 3 hours
**Risk Level:** High 🔥🔥🔥

### Why Now?

We saved this for the end because:
- ✅ All modules are working
- ✅ Clear where logic should go
- ✅ Less risk to stable modules

### Similar to original Phase 1.1, but now we have destination modules ready.

### Acceptance Criteria:

✅ Business logic removed from Friend model
✅ Logic moved to appropriate modules
✅ App compiles

### Verification Command:

```bash
npm run build
```

---

## PHASE 5.2: Extract Interaction Model Business Logic

**Goal:** Clean up Interaction model.

**Estimated Time:** 2 hours
**Risk Level:** Medium 🔥🔥

### Acceptance Criteria:

✅ Business logic removed from Interaction model
✅ App compiles

---

## PHASE 6.1: Delete Old lib/ Files

**Goal:** Remove all commented-out lib/ files.

**Estimated Time:** 1 hour
**Risk Level:** Low ⚠️

### Strategy:

```bash
# List all commented files
grep -r "DEPRECATED" src/lib/

# Delete each one
rm src/lib/badge-tracker.ts
rm src/lib/weave-engine.ts
# ... etc
```

### Acceptance Criteria:

✅ All old lib/ files deleted
✅ src/lib/ is empty or minimal
✅ No imports from deleted files
✅ App compiles

### Verification Command:

```bash
# Should find no imports
grep -r "from.*lib/" src/

npm run build
```

---

## PHASE 6.2: Add ESLint Enforcement

**Goal:** Prevent future violations of module boundaries.

**Estimated Time:** 1 hour
**Risk Level:** Low ⚠️

### Add to `.eslintrc.js`:

```javascript
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../modules/*'],
            message: 'Import from module index.ts only',
          },
          {
            group: ['../../*'],
            message: 'Use absolute imports (@/)',
          },
        ],
      },
    ],
  },
};
```

### Acceptance Criteria:

✅ ESLint rules added
✅ Violations caught
✅ npm run lint passes

### Verification Command:

```bash
npm run lint
```

---

## PHASE 6.3: Performance Audit

**Goal:** Verify bundle size and performance.

**Estimated Time:** 2 hours
**Risk Level:** Low ⚠️

### Metrics to Check:

- Bundle size (should be <5% increase)
- App startup time
- Interaction logging speed
- Score calculation speed

### Tools:

```bash
# Bundle analysis
npx react-native-bundle-visualizer

# Performance profiling
# Use React DevTools Profiler
```

### Acceptance Criteria:

✅ Bundle size acceptable
✅ No performance regressions
✅ App feels responsive

---

## Success Metrics

**After complete refactor:**

✅ 0 files in `src/lib/` (or <5 utility files)
✅ All business logic in domain modules
✅ Modules communicate via clear APIs
✅ Event bus used for side effects only
✅ All features working
✅ <5% bundle size increase
✅ No TypeScript errors
✅ ESLint enforces boundaries

---

## Git Strategy

```bash
# Create feature branch
git checkout -b refactor/modular-architecture-v2

# Commit after each phase
git add .
git commit -m "Phase X.X: [Description]"

# Tag major milestones
git tag gamification-complete
git tag intelligence-complete
git tag refactor-complete
```

---

## Communication Protocol for Agents

After each phase, report:

```
PHASE [X.X] COMPLETE
✅ Files created: [list]
✅ Files updated: [list]
✅ Verification: [PASS/FAIL]
✅ Manual test: [PASS/FAIL/SKIPPED]

Ready for human review.
```

If verification fails:

```
PHASE [X.X] FAILED
❌ Error: [error message]
❌ Failed at: [step]
🔄 Suggested fix: [suggestion]
⏸️ Waiting for human decision
```

---

**READY TO START PHASE 0.1!**

This revised plan:
- ✅ Removes repository pattern scope creep
- ✅ Starts with safest module (gamification)
- ✅ Clarifies event bus usage
- ✅ Defers database cleanup to end
- ✅ 18 phases vs 24 (more focused)
- ✅ Each phase is <4 hours
- ✅ Clear rollback strategy
