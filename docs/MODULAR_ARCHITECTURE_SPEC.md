# Weave Modular Architecture Refactor - Technical Specification

**Version:** 2.0
**Date:** 2025-11-16
**Status:** Planning Phase - Ready for Implementation
**Author:** Architecture Review
**Reviewed By:** Claude Code (Critical Issues Addressed)

---

## Executive Summary

This document outlines a comprehensive plan to refactor Weave from a monolithic structure to a **feature-based modular architecture**. The current codebase organizes code by technical concerns (stores, hooks, lib), which has led to unclear domain boundaries, tight coupling, and maintainability challenges. This refactor will reorganize code by business domains, creating clear module boundaries with well-defined APIs.

**Key Metrics:**
- **73 library files** in `src/lib/` to be reorganized into 8 domain modules
- **9 Zustand stores** to be module-scoped
- **16 custom hooks** to be distributed to appropriate modules
- **99+ components** to be organized by feature
- **Estimated Timeline:** 12-16 weeks (conservative estimate for solo developer)
- **Risk Level:** Medium (with careful phased approach)

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Target Architecture](#target-architecture)
3. [Module Definitions](#module-definitions)
4. [Migration Strategy](#migration-strategy)
5. [Implementation Phases](#implementation-phases)
6. [Dependency Management](#dependency-management)
7. [Testing Strategy](#testing-strategy)
8. [Risk Assessment](#risk-assessment)
9. [Success Metrics](#success-metrics)

---

## 1. Current State Analysis

### 1.1 Current Structure

```
src/
  components/          # 99+ components (mixed concerns)
  stores/             # 9 Zustand stores
  hooks/              # 16 custom hooks
  lib/                # 73 utility/service files ⚠️
  db/                 # Database models & schema
  context/            # React contexts
  types/              # Type definitions
  theme.ts            # Theme configuration
```

### 1.2 Key Problems Identified

#### Problem 1: Monolithic `src/lib/` Directory
**73 files** performing disparate functions:
- Scoring engine (`weave-engine.ts` - 718 LOC)
- Badge tracking (`badge-tracker.ts`, `badge-calculator.ts`, `badge-definitions.ts`)
- Achievement tracking (`achievement-tracker.ts`, `achievement-definitions.ts`)
- Analytics (`analytics.ts`, `view-analytics.ts`)
- Pattern detection (`pattern-analyzer.ts`, `pattern-detection.ts`)
- Notifications (`notification-manager-enhanced.ts`, `smart-notification-scheduler.ts`)
- Feedback analysis (`feedback-analyzer.ts`)
- Reciprocity tracking (`reciprocity-analyzer.ts`)
- And 50+ more files...

**Impact:**
- Hard to locate related functionality
- No clear ownership boundaries
- Difficult to reason about dependencies
- High cognitive load for new features

#### Problem 2: God Object - `weave-engine.ts`
The weave engine handles too many responsibilities:

```typescript
// Current imports (17 different systems!)
import { checkAndAwardFriendBadges } from './badge-tracker';
import { checkAndAwardGlobalAchievements } from './achievement-tracker';
import { analyzeInteractionPattern } from './pattern-analyzer';
import { captureInteractionOutcome } from './feedback-analyzer';
import { updateInitiationStats } from './reciprocity-analyzer';
import { trackEvent, AnalyticsEvents } from './analytics';
// ... and more
```

**Responsibilities:**
- Scoring calculations
- Decay management
- Momentum tracking
- Badge awarding
- Achievement tracking
- Pattern analysis
- Feedback capture
- Analytics tracking

**Impact:**
- Changes ripple across multiple domains
- Testing requires mocking many unrelated systems
- Hard to isolate for performance optimization

#### Problem 3: Tight Coupling Between Layers

```typescript
// interactionStore.ts directly imports weave-engine
import { logNewWeave } from '../lib/weave-engine';

// weave-engine imports from stores
import { type InteractionFormData } from '../stores/interactionStore';

// Components import from multiple lib files
import { useEventSuggestionStore } from '../stores/eventSuggestionStore';
import { calculateCurrentScore } from '../lib/weave-engine';
import { trackEvent } from '../lib/analytics';
```

**Impact:**
- Circular dependency risks
- Hard to understand data flow
- Difficult to refactor individual pieces

#### Problem 4: Unclear Domain Boundaries

Files with related functionality are scattered:

**Gamification (currently split across 6 files):**
- `lib/badge-tracker.ts`
- `lib/badge-calculator.ts`
- `lib/badge-definitions.ts`
- `lib/achievement-tracker.ts`
- `lib/achievement-definitions.ts`
- `lib/milestone-tracker.ts`

**Insights (currently split across 10+ files):**
- `lib/pattern-analyzer.ts`
- `lib/pattern-detection.ts`
- `lib/feedback-analyzer.ts`
- `lib/reciprocity-analyzer.ts`
- `lib/predictive-insights.ts`
- `lib/portfolio-analyzer.ts`
- `lib/trend-analyzer.ts`
- `lib/weaving-insights.ts`
- And more...

#### Problem 5: Business Logic in Database Models

Database models currently contain business logic mixed with data access:

```typescript
// db/models/Friend.ts
@lazy currentScore = this.observe('weave_score').pipe(
  map(() => calculateCurrentScore(this))  // Imports from lib/
);

async checkAndMarkDormant() {
  // Business logic in model...
}
```

**Impact:**
- Models import from `lib/` → Circular dependency risks
- Logic is hidden → Not discoverable in module services
- Hard to test → Requires database mocks
- Violates separation of concerns → Models should only persist data

### 1.3 Current Dependencies

**Store Dependencies:**
```
interactionStore → weave-engine → [badges, achievements, patterns, feedback, analytics]
friendStore → [analytics, lifecycle-manager, image-service]
eventSuggestionStore → [event-suggestion-learning, suggestion-engine]
authStore → [supabase, sync-engine]
```

**Component Dependencies:**
```
Components → Stores (good ✓)
Components → Lib files directly (problematic ✗)
Stores → Multiple lib files (problematic ✗)
Lib files → Other lib files (uncontrolled ✗)
```

---

## 2. Target Architecture

### 2.1 Guiding Principles

1. **Domain-Driven Design**: Organize by business capability, not technical layer
2. **Vertical Slicing**: Each module contains its own UI, logic, and state
3. **Explicit Dependencies**: Modules communicate through well-defined public APIs
4. **Single Responsibility**: Each module owns one business domain
5. **Dependency Inversion**: Modules depend on abstractions, not concrete implementations
6. **Event-Driven Communication**: Modules publish domain events for side effects; other modules subscribe as needed to avoid tight coupling

### 2.2 New Structure

```
src/
  modules/
    relationships/           # Friend management, tiers, Dunbar layers
      components/
      hooks/
      services/
      store.ts
      types.ts
      index.ts              # Public API

    interactions/           # Logging & planning weaves
      components/
      hooks/
      services/
      store.ts
      types.ts
      index.ts

    intelligence/          # Scoring, decay, momentum
      components/
      services/
        scoring.service.ts
        decay.service.ts
        quality.service.ts
        momentum.service.ts
      store.ts
      types.ts
      index.ts

    insights/             # Analytics, patterns, predictions
      components/
      services/
        pattern.service.ts
        effectiveness.service.ts
        reciprocity.service.ts
        trend.service.ts
        portfolio.service.ts
      store.ts
      types.ts
      index.ts

    gamification/        # Achievements & badges
      components/
      services/
        badge.service.ts
        achievement.service.ts
        milestone.service.ts
      store.ts
      types.ts
      index.ts

    reflection/          # Journal, weekly reflection, deepening
      components/
      services/
      store.ts
      types.ts
      index.ts

    notifications/       # Smart scheduling, reminders
      services/
        scheduler.service.ts
        event-reminders.service.ts
        grace-periods.service.ts
      store.ts
      types.ts
      index.ts

    auth/               # Authentication & sync
      components/
      services/
        auth.service.ts
        sync.service.ts
      store.ts
      types.ts
      index.ts

  shared/              # Cross-module utilities
    components/        # UI primitives (buttons, cards, etc.)
    hooks/            # Generic React hooks
    utils/            # Pure utility functions
    constants/        # Global constants
    theme/            # Theme configuration
    types/            # Shared type definitions

  db/                 # Database layer (unchanged)
    models/
    schema.ts
    index.ts

  app/                # Routes (unchanged)
```

### 2.3 Module Architecture Pattern

Each module follows a **layered architecture**:

```
module/
  ├── components/           # Presentation Layer
  │   └── *.tsx            # React components for this domain
  │
  ├── hooks/               # React Integration Layer
  │   └── use*.ts          # Custom hooks wrapping services/stores
  │
  ├── services/            # Domain Logic Layer
  │   └── *.service.ts     # Pure business logic (no React, no state)
  │
  ├── store.ts             # Application State Layer
  │                        # Zustand store (UI state only, orchestrates services)
  │
  ├── types.ts             # Module-specific types
  ├── constants.ts         # Module-specific constants
  └── index.ts             # Public API (ONLY way to access module)
```

**Layer Responsibilities:**

**Services:**
- Pure business logic (scoring, validation, calculations)
- No React dependencies (can run in Node.js, browser, React Native)
- Async operations (database, network)
- Stateless - accept parameters, return results
- Highly testable with unit tests

**Stores (Zustand):**
- **UI state only** (loading flags, modal visibility, form state)
- Orchestrate service calls
- Subscribe to WatermelonDB observables for reactive data
- Should NOT duplicate database state
- Cache transient data (search results, filters)

**Example:**
```typescript
// ✅ Service - Pure logic
export async function calculateBadgesToAward(input: BadgeInput): Promise<string[]> {
  // Pure calculation, no state
}

// ✅ Store - UI state + orchestration
export const useGamificationStore = create((set) => ({
  isUnlockModalOpen: false,  // UI state
  unlockedBadges: [],        // Transient cache

  checkBadges: async (friendId: string) => {
    const badges = await calculateBadgesToAward(friendId);  // Call service
    set({ unlockedBadges: badges, isUnlockModalOpen: badges.length > 0 });
  }
}));
```

**Dependency Rules:**
```
Components → Hooks
Hooks → Services + Stores
Services → Database + Other Services (same module) + DTOs from other modules
Stores → Services
Events → Any module can publish/subscribe

Cross-Module:
Module A → Module B's index.ts ONLY
```

---

## 3. Module Definitions

### 3.1 Relationships Module

**Responsibility:** Friend management, Dunbar tiers, archetype system

**Current Files to Migrate:**
- `stores/friendStore.ts` (516 LOC)
- `hooks/useFriends.ts`
- `hooks/useFriendActionState.ts`
- `lib/lifecycle-manager.ts`
- `lib/image-service.ts`
- `lib/image-utils.ts`
- `lib/archetype-data.ts`
- `lib/archetype-content.ts`
- Components: `FriendCard.tsx`, `FriendForm.tsx`, `FriendListRow.tsx`, etc.

**Public API (`modules/relationships/index.ts`):**
```typescript
// Hooks
export { useFriends } from './hooks/useFriends';
export { useFriendActions } from './hooks/useFriendActions';

// Services
export { getFriend, updateFriend, deleteFriend } from './services/friend.service';
export { checkDormancy } from './services/lifecycle.service';

// Store
export { useRelationshipsStore } from './store';

// Types
export type { Friend, Tier, Archetype, RelationshipType } from './types';

// Components
export { FriendCard } from './components/FriendCard';
export { FriendForm } from './components/FriendForm';
```

**Dependencies:**
- `db/models/Friend`
- `shared/utils`
- `modules/intelligence` (for weave score display)

---

### 3.2 Interactions Module

**Responsibility:** Weave logging, planning, Quick Weave overlay

**Current Files to Migrate:**
- `stores/interactionStore.ts` (526 LOC)
- `stores/intentionStore.ts` (154 LOC)
- `hooks/usePendingPlans.ts`
- `hooks/useIntentions.ts`
- `lib/plan-lifecycle-manager.ts`
- `lib/interaction-categories.ts`
- `lib/calendar-service.ts`
- `lib/calendar-sync-service.ts`
- Components: `QuickWeaveOverlay.tsx`, `PlanWizard.tsx`, `InteractionForm.tsx`, etc.

**Public API:**
```typescript
// Hooks
export { useInteractions } from './hooks/useInteractions';
export { usePlans } from './hooks/usePlans';
export { useQuickWeave } from './hooks/useQuickWeave';

// Services
export { logWeave, planWeave } from './services/weave-logging.service';
export { updatePlan, completePlan } from './services/plan.service';

// Store
export { useInteractionsStore } from './store';

// Types
export type { Interaction, InteractionFormData, Plan } from './types';

// Components
export { QuickWeaveOverlay } from './components/QuickWeaveOverlay';
export { PlanWizard } from './components/PlanWizard';
```

**Dependencies:**
- `db/models/Interaction`
- `modules/intelligence` (for core scoring logic)
- `modules/relationships` (for friend data)
- `shared/events` (publishes events for side effects)

**Publishes Events:**
- `weave:logged` - When interaction is created (consumed by gamification, insights, notifications)
- `plan:created` - When plan is scheduled
- `plan:completed` - When plan is marked done
- `plan:missed` - When plan deadline passes

---

### 3.3 Intelligence Module

**Responsibility:** Core scoring engine, decay, momentum, quality metrics

**Current Files to Migrate:**
- `lib/weave-engine.ts` (718 LOC - SPLIT THIS!)
- `lib/constants.ts` (scoring-related constants)
- `lib/season-aware-streak.ts`
- `lib/deepening-utils.ts`

**New Service Structure:**
```
services/
  scoring.service.ts       # Core point calculation
  decay.service.ts         # Time-based decay
  quality.service.ts       # Quality metrics
  momentum.service.ts      # Momentum tracking
  resilience.service.ts    # Resilience updates
  orchestrator.service.ts  # Coordinates score updates
```

**Public API:**
```typescript
// Types (DTOs - plain objects, no database models)
export type {
  FriendScoringInput,
  InteractionScoringInput,
  RecentActivityInput,
  ScoreResult,
  DecayResult,
  QualityMetrics,
  MomentumState
} from './types';

// Services (pure functions accepting DTOs)
export { calculateInteractionPoints } from './services/scoring.service';
export { applyDecay, getCurrentScore } from './services/decay.service';
export { calculateQuality } from './services/quality.service';
export { calculateMomentumBonus, updateMomentum } from './services/momentum.service';
export { updateResilience } from './services/resilience.service';

// Constants
export {
  TIER_DECAY_RATES,
  DURATION_MODIFIERS,
  VIBE_MULTIPLIERS,
  INTERACTION_SCORES,
  ARCHETYPE_AFFINITY_MATRIX
} from './constants';
```

**Dependencies:**
- `shared/types` (for Tier, Archetype, Duration, Vibe enums)
- `shared/constants` (if needed)

**NO dependencies on:**
- ❌ `db/models` (uses DTOs instead)
- ❌ Other modules
- ❌ React
- ❌ WatermelonDB

**Note:** This is the **CORE** module. It contains **pure business logic** with zero side effects. Other modules depend on it, but it depends on NO other modules (except shared). All functions accept DTOs (plain objects) as parameters, making them:
- Testable without database
- Portable across platforms
- Reusable (could extract to `@weave/scoring` package)

### 3.3.1 Data Transfer Objects (DTOs)

The Intelligence module uses DTOs to maintain independence from database models.

**Why DTOs?**
- **Testable** - No database required for unit tests
- **Portable** - Works in Node.js, browser, React Native, or any JavaScript environment
- **No hidden dependencies** - Explicit inputs/outputs
- **Future-proof** - Can extract to standalone npm package
- **Performance** - Pure functions with no I/O

**DTO Examples:**

```typescript
// modules/intelligence/types.ts

/** Input for scoring calculations - plain object, no database model */
export interface FriendScoringInput {
  tier: Tier;
  archetype: Archetype;
  weaveScore: number;
  lastUpdated: Date;
  resilience: number;
  momentumScore: number;
  momentumLastUpdated: Date | null;
}

export interface InteractionScoringInput {
  type: InteractionType;
  duration: Duration;
  vibe: Vibe;
  quality?: number;
}

export interface ScoreResult {
  pointsEarned: number;
  newScore: number;
  decayApplied: number;
  momentumBonus: number;
  qualityMultiplier: number;
}
```

**Service Using DTOs:**

```typescript
// modules/intelligence/services/scoring.service.ts
import { FriendScoringInput, InteractionScoringInput, ScoreResult } from '../types';

// ✅ Pure function - accepts DTOs, returns DTO
export function calculateInteractionPoints(
  friend: FriendScoringInput,  // DTO, not database model
  interaction: InteractionScoringInput,  // DTO, not database model
  recentActivity: RecentActivityInput
): ScoreResult {
  const baseScore = INTERACTION_SCORES[interaction.type] || 10;
  const affinityMultiplier = getAffinityMultiplier(friend.archetype, interaction.type);
  const durationMultiplier = DURATION_MODIFIERS[interaction.duration] || 1.0;

  const points = baseScore * affinityMultiplier * durationMultiplier;

  return {
    pointsEarned: points,
    newScore: Math.min(100, friend.weaveScore + points),
    decayApplied: 0,
    momentumBonus: 0,
    qualityMultiplier: affinityMultiplier * durationMultiplier
  };
}
```

**Calling Module Converts Models → DTOs:**

```typescript
// modules/interactions/services/weave-logging.service.ts
import { calculateInteractionPoints } from '@/modules/intelligence';
import type { FriendScoringInput } from '@/modules/intelligence';

export async function logWeave(data: InteractionFormData) {
  const friends = await database.get('friends').query(...).fetch();

  for (const friend of friends) {
    // Convert database model → DTO
    const friendInput: FriendScoringInput = {
      tier: friend.tier,
      archetype: friend.archetype,
      weaveScore: friend.weaveScore,
      lastUpdated: friend.lastUpdated,
      resilience: friend.resilience,
      momentumScore: friend.momentumScore,
      momentumLastUpdated: friend.momentumLastUpdated
    };

    // Call Intelligence service with DTO
    const result = calculateInteractionPoints(friendInput, interactionInput, activityInput);

    // Apply result to database
    await friend.update(f => {
      f.weaveScore = result.newScore;
      f.lastUpdated = new Date();
    });
  }
}
```

**Conversion Responsibility:**
- **Calling modules** (Interactions, Relationships) fetch database models
- **Calling modules** convert models → DTOs
- **Intelligence module** processes DTOs (pure logic)
- **Calling modules** convert results → database updates

---

### 3.4 Insights Module

**Responsibility:** Pattern detection, effectiveness analysis, predictions, trends

**Current Files to Migrate:**
- `lib/pattern-analyzer.ts`
- `lib/pattern-detection.ts`
- `lib/feedback-analyzer.ts`
- `lib/reciprocity-analyzer.ts`
- `lib/predictive-insights.ts`
- `lib/portfolio-analyzer.ts`
- `lib/portfolio-insights.ts`
- `lib/trend-analyzer.ts`
- `lib/weaving-insights.ts`
- `lib/text-analysis.ts`
- `hooks/useEffectiveness.ts`
- `hooks/useReciprocity.ts`
- `hooks/useTrendsAndPredictions.ts`
- `hooks/usePortfolio.ts`

**New Service Structure:**
```
services/
  pattern.service.ts          # Interaction pattern detection
  effectiveness.service.ts    # Category effectiveness learning
  reciprocity.service.ts      # Initiation tracking
  trend.service.ts           # Trend analysis
  portfolio.service.ts       # Relationship portfolio insights
  prediction.service.ts      # Predictive insights
```

**Public API:**
```typescript
// Hooks
export { usePatterns } from './hooks/usePatterns';
export { useEffectiveness } from './hooks/useEffectiveness';
export { useReciprocity } from './hooks/useReciprocity';
export { useTrends } from './hooks/useTrends';

// Services
export { analyzePattern } from './services/pattern.service';
export { captureOutcome } from './services/effectiveness.service';
export { trackInitiation } from './services/reciprocity.service';

// Store
export { useInsightsStore } from './store';

// Types
export type { Pattern, EffectivenessData, ReciprocityMetrics } from './types';
```

**Dependencies:**
- `db/models` (Friend, Interaction, InteractionOutcome)
- `modules/intelligence` (for score calculations)

---

### 3.5 Gamification Module

**Responsibility:** Badges, achievements, milestones

**Current Files to Migrate:**
- `lib/badge-tracker.ts`
- `lib/badge-calculator.ts`
- `lib/badge-definitions.ts`
- `lib/achievement-tracker.ts`
- `lib/achievement-definitions.ts`
- `lib/milestone-tracker.ts`
- `hooks/useAchievements.ts`
- Components: `BadgeUnlockModal.tsx`, achievement displays

**New Service Structure:**
```
services/
  badge.service.ts           # Badge logic
  achievement.service.ts     # Achievement logic
  milestone.service.ts       # Milestone tracking
```

**Public API:**
```typescript
// Hooks
export { useAchievements } from './hooks/useAchievements';
export { useBadges } from './hooks/useBadges';

// Services
export { checkBadges } from './services/badge.service';
export { checkAchievements } from './services/achievement.service';
export { recordMilestone } from './services/milestone.service';

// Store
export { useGamificationStore } from './store';

// Types
export type { Badge, Achievement, Milestone } from './types';

// Definitions
export { BADGE_DEFINITIONS } from './constants/badges';
export { ACHIEVEMENT_DEFINITIONS } from './constants/achievements';

// Components
export { BadgeUnlockModal } from './components/BadgeUnlockModal';
```

**Dependencies:**
- `db/models` (FriendBadge, AchievementUnlock)
- `modules/relationships` (for friend data)
- `shared/events` (subscribes to weave:logged)

**Subscribes to Events:**
- `weave:logged` → Check and award friend badges
- `weave:logged` → Check and award global achievements
- `plan:completed` → Award consistency badges

**Note:** Gamification does NOT directly import from Interactions module. It reacts to events to avoid circular dependencies.

---

### 3.6 Reflection Module

**Responsibility:** Journal, weekly reflection, Year in Moons, deepening

**Current Files to Migrate:**
- Components: `Journal/`, `WeeklyReflection/`, `YearInMoons/`, `ReflectionJourney/`
- `lib/reflection-prompts.ts`
- `lib/reflection-sentences.ts`
- `lib/reflection-tags.ts`
- `lib/adaptive-chips.ts`
- `lib/story-chips.ts`
- `lib/weekly-reflection/` (all files)
- `lib/weekly-event-review.ts`
- `lib/year-in-moons-data.ts`
- `lib/narrative-generator.ts`

**Public API:**
```typescript
// Hooks
export { useJournal } from './hooks/useJournal';
export { useWeeklyReflection } from './hooks/useWeeklyReflection';
export { useReflectionPrompts } from './hooks/useReflectionPrompts';

// Services
export { generatePrompts } from './services/prompts.service';
export { createJournalEntry } from './services/journal.service';

// Store
export { useReflectionStore } from './store';

// Components
export { JournalView } from './components/JournalView';
export { WeeklyReflectionView } from './components/WeeklyReflectionView';
export { YearInMoonsView } from './components/YearInMoonsView';
```

**Dependencies:**
- `db/models` (JournalEntry, WeeklyReflection)
- `modules/interactions` (for interaction data)
- `modules/relationships` (for friend data)

---

### 3.7 Notifications Module

**Responsibility:** Smart scheduling, reminders, notification grace periods

**Current Files to Migrate:**
- `lib/notification-manager-enhanced.ts`
- `lib/smart-notification-scheduler.ts`
- `lib/event-notifications.ts`
- `lib/notification-grace-periods.ts`
- `lib/notification-response-handler.ts`

**Public API:**
```typescript
// Services
export { scheduleReminder } from './services/scheduler.service';
export { scheduleEventReminder } from './services/event-reminders.service';
export { requestPermissions } from './services/permissions.service';

// Store
export { useNotificationsStore } from './store';

// Types
export type { NotificationConfig, ReminderSchedule } from './types';
```

**Dependencies:**
- `db/models/Interaction`
- `modules/interactions` (for event data)

---

### 3.8 Auth Module

**Responsibility:** Authentication, user profile, sync

**Current Files to Migrate:**
- `stores/authStore.ts` (281 LOC)
- `stores/userProfileStore.ts` (190 LOC)
- `stores/backgroundSyncStore.ts` (176 LOC)
- `lib/supabase.ts`
- `lib/sync-engine.ts`
- `lib/data-export.ts`
- `lib/data-import.ts`
- `lib/subscription-tiers.ts`
- Components: auth-related components

**Public API:**
```typescript
// Hooks
export { useAuth } from './hooks/useAuth';
export { useUserProfile } from './hooks/useUserProfile';
export { useSync } from './hooks/useSync';

// Services
export { signIn, signOut } from './services/auth.service';
export { syncData } from './services/sync.service';
export { exportData, importData } from './services/data-transfer.service';

// Store
export { useAuthStore } from './store';

// Types
export type { User, UserProfile, SyncStatus } from './types';
```

**Dependencies:**
- `@supabase/supabase-js`
- `db/models/UserProfile`
- All modules (for sync)

---

### 3.9 Shared Module

**Responsibility:** Cross-cutting utilities, UI primitives, constants

**Contents:**
```
shared/
  components/          # Generic UI components
    Button.tsx
    Card.tsx
    Modal.tsx
    Input.tsx
    etc.

  hooks/              # Generic React hooks
    useAppState.ts
    useTheme.ts
    usePausableAnimation.ts
    useActivityKeepAwake.ts

  utils/              # Pure utility functions
    date-utils.ts
    validation-helpers.ts
    format-utils.ts

  constants/          # Global constants
    tier-config.ts
    archetype-config.ts
    interaction-types.ts

  theme/
    theme.ts
    colors.ts
    typography.ts

  types/              # Shared type definitions
    common.ts
```

**Public API:**
```typescript
// Components
export { Button, Card, Modal, Input } from './components';

// Hooks
export { useAppState, useTheme } from './hooks';

// Utils
export { formatDate, validateEmail } from './utils';

// Constants
export { TIER_CONFIG, ARCHETYPE_CONFIG } from './constants';

// Types
export type { Tier, Archetype, Duration, Vibe } from './types';
```

**Dependencies:** None (lowest level)

---

## 4. Migration Strategy

### 4.1 Phased Approach

We will use a **strangler fig pattern** - gradually replace old code with new modules while keeping the app functional.

**Key Principles:**
1. **One module at a time** - Complete migration before starting next
2. **Feature flags** - New modules can run in parallel with old code during testing
3. **Backwards compatibility** - Old code continues working during migration
4. **Incremental testing** - Test thoroughly after each phase
5. **No big bang** - Never refactor everything at once

### 4.2 Migration Order

Modules should be migrated in **dependency order** (least dependent first):

```
Phase 1: Shared (no dependencies)
Phase 2: Gamification (mostly isolated)
Phase 3: Intelligence (core, many dependents)
Phase 4: Relationships (depends on intelligence)
Phase 5: Interactions (depends on multiple modules)
Phase 6: Insights (depends on interactions)
Phase 7: Reflection (depends on interactions)
Phase 8: Notifications (depends on interactions)
Phase 9: Auth (depends on all for sync)
```

### 4.3 Module Migration Checklist

For each module:

- [ ] Create module directory structure
- [ ] Define types.ts
- [ ] Create service files
- [ ] Move and refactor business logic to services
- [ ] Create store.ts (if needed)
- [ ] Create hooks
- [ ] Move components
- [ ] Create index.ts (public API)
- [ ] Update imports in consuming code
- [ ] Add module-level tests
- [ ] Update documentation
- [ ] Delete old files
- [ ] Verify no regressions

---

## 5. Implementation Phases

### Phase 0.5: Database Model Cleanup (Week 0.5)

**Goal:** Remove business logic from database models

**Why First?**
- Models currently import from `lib/` → circular dependencies
- Models have computed properties with logic (@lazy decorators)
- Models have business methods (checkAndMarkDormant(), etc.)
- Must clean this up before modules can depend on clean models

**Current Problems:**

```typescript
// db/models/Friend.ts (BEFORE - BAD)
import { calculateCurrentScore } from '../../lib/weave-engine';  // ❌ Imports from lib

@lazy currentScore = this.observe('weave_score').pipe(
  map(() => calculateCurrentScore(this))  // ❌ Business logic in model
);

async checkAndMarkDormant() {  // ❌ Business method in model
  const daysSince = (Date.now() - this.lastUpdated.getTime()) / 86400000;
  if (daysSince > 60) {
    await this.update(f => { f.isDormant = true; });
  }
}
```

**Tasks:**

1. **Audit all models for business logic:**
   ```bash
   # Find models with imports from lib/
   grep -r "from.*lib/" src/db/models/

   # Find models with @lazy decorators (likely have logic)
   grep -r "@lazy" src/db/models/

   # Find models with methods (beyond simple getters)
   grep -r "async.*(" src/db/models/
   ```

2. **Clean up Friend model:**
   ```typescript
   // db/models/Friend.ts (AFTER - GOOD)
   import { Model, Query } from '@nozbe/watermelondb';
   import { field, date, children } from '@nozbe/watermelondb/decorators';

   export class Friend extends Model {
     static table = 'friends';

     // ✅ Just data fields
     @field('name') name!: string;
     @field('tier') tier!: string;
     @field('archetype') archetype!: string;
     @field('weave_score') weaveScore!: number;
     @field('last_updated') lastUpdated!: Date;
     @field('resilience') resilience!: number;
     @field('is_dormant') isDormant!: boolean;

     // ✅ Relations are OK
     @children('interactions') interactions!: Query<Interaction>;

     // ✅ Timestamps
     @readonly @date('created_at') createdAt!: Date;
     @readonly @date('updated_at') updatedAt!: Date;

     // ❌ NO @lazy decorators with calculations
     // ❌ NO business methods
     // ❌ NO imports from lib/
   }
   ```

3. **Move logic to appropriate modules:**
   - `@lazy currentScore` → `modules/intelligence/services/decay.service.ts::getCurrentScore()`
   - `@lazy isAtRisk` → `modules/relationships/services/friend.service.ts::isFriendAtRisk()`
   - `checkAndMarkDormant()` → `modules/relationships/services/lifecycle.service.ts::checkAndApplyDormancy()`

4. **Update components to call services:**
   ```typescript
   // BEFORE
   const score = friend.currentScore;  // ❌ Using model property

   // AFTER
   import { getCurrentScore } from '@/modules/intelligence';
   const score = getCurrentScore(friend);  // ✅ Calling service
   ```

5. **Clean up Interaction model** (similar process)

6. **Clean up other models** (JournalEntry, etc.)

**Deliverables:**
- [ ] All database models are pure data (no logic)
- [ ] All imports from `lib/` removed from models
- [ ] All `@lazy` computed properties with logic removed
- [ ] All business methods moved to module services
- [ ] Components updated to call services instead of model methods
- [ ] All tests passing

**Time Estimate:** 2-3 days

---

### Phase 1: Foundation (Week 1-2)

**Goal:** Set up module infrastructure and event bus

**Tasks:**
1. Create `src/modules/` directory
2. Create `src/shared/` directory
3. Move shared utilities to `shared/utils/`
4. Move shared types to `shared/types/`
5. Move shared constants to `shared/constants/`
6. **Create `shared/events/event-bus.ts`** (for cross-module communication):
   ```typescript
   // shared/events/event-bus.ts
   type EventHandler = (data: any) => void | Promise<void>;

   class EventBus {
     private handlers: Map<string, EventHandler[]> = new Map();

     on(event: string, handler: EventHandler) {
       if (!this.handlers.has(event)) {
         this.handlers.set(event, []);
       }
       this.handlers.get(event)!.push(handler);
     }

     async emit(event: string, data: any) {
       const handlers = this.handlers.get(event) || [];
       await Promise.all(handlers.map(h => h(data)));
     }

     off(event: string, handler: EventHandler) {
       const handlers = this.handlers.get(event) || [];
       this.handlers.set(event, handlers.filter(h => h !== handler));
     }
   }

   export const eventBus = new EventBus();
   export type { EventHandler };
   ```
7. Create module template/boilerplate
8. Update TypeScript path aliases (`@/modules/*`, `@/shared/*`, etc.)

**Deliverables:**
- [ ] Module directory structure exists
- [ ] Shared module is functional
- [ ] Event bus implemented and tested
- [ ] Path aliases configured
- [ ] Template README for modules created

**Testing:**
- Verify app still runs
- No import errors
- Event bus works (simple test: emit/subscribe)

---

### Phase 2: Gamification Module (Week 2-3)

**Goal:** Extract first isolated module as proof of concept

**Why Gamification First?**
- Relatively isolated (few incoming dependencies)
- Clear boundaries (badges, achievements, milestones)
- Well-defined (6 files to migrate)
- Non-critical (if broken, app still functions)

**Tasks:**

**Week 2:**
1. Create `modules/gamification/` structure
2. Create `types.ts` from badge/achievement types
3. Create `constants/badges.ts` (move from badge-definitions)
4. Create `constants/achievements.ts` (move from achievement-definitions)
5. Create `services/badge.service.ts`:
   ```typescript
   // Move from badge-tracker.ts
   export async function checkFriendBadges(friendId: string): Promise<BadgeUnlock[]>
   export async function awardBadge(friendId: string, badgeId: string): Promise<void>
   export async function checkSpecialBadges(...): Promise<BadgeUnlock[]>
   ```
6. Create `services/achievement.service.ts`:
   ```typescript
   // Move from achievement-tracker.ts
   export async function checkGlobalAchievements(): Promise<AchievementUnlock[]>
   export async function awardAchievement(achievementId: string): Promise<void>
   ```
7. Create `services/milestone.service.ts`:
   ```typescript
   // Move from milestone-tracker.ts
   export async function recordPractice(): Promise<void>
   export async function recordReflection(): Promise<void>
   ```

**Week 3:**
8. Create `store.ts` (lightweight Zustand store for unlocked badges/achievements)
9. Create `hooks/useAchievements.ts`
10. Create `hooks/useBadges.ts`
11. Move `BadgeUnlockModal.tsx` to `components/`
12. Create `index.ts` with public API
13. Update `weave-engine.ts` to use new gamification module:
    ```typescript
    // OLD
    import { checkAndAwardFriendBadges } from './badge-tracker';

    // NEW
    import { checkFriendBadges } from '@/modules/gamification';
    ```
14. Update all other consumers
15. Delete old files: `badge-tracker.ts`, `achievement-tracker.ts`, etc.
16. Write tests

**Deliverables:**
- [ ] Gamification module fully functional
- [ ] All old files removed
- [ ] Tests passing
- [ ] Documentation updated

**Success Criteria:**
- App runs without errors
- Badges still unlock correctly
- Achievements still trigger
- No performance regression

---

### Phase 3: Intelligence Module (Week 3-5)

**Goal:** Extract and refactor the core scoring engine

**Why Intelligence Next?**
- Core module that many others depend on
- Currently the biggest pain point (weave-engine.ts monolith)
- Once refactored, will make other modules easier

**Challenges:**
- Large, complex file (718 LOC)
- Many responsibilities to separate
- Critical functionality (scoring must work perfectly)

**Tasks:**

**Week 3-4: Extract Services**

1. Create `modules/intelligence/` structure
2. Create `types.ts`:
   ```typescript
   export interface ScoreUpdate {
     friendId: string;
     scoreBefore: number;
     scoreAfter: number;
     pointsEarned: number;
   }

   export interface QualityMetrics {
     depthScore: number;
     energyScore: number;
     overallQuality: number;
   }

   export interface DecayResult {
     currentScore: number;
     decayedAmount: number;
     daysSinceUpdate: number;
   }
   ```

3. Create `services/quality.service.ts`:
   ```typescript
   // Move calculateInteractionQuality from weave-engine
   export function calculateInteractionQuality(
     interaction: InteractionData
   ): QualityMetrics { ... }
   ```

4. Create `services/scoring.service.ts`:
   ```typescript
   // Move calculatePointsForWeave from weave-engine
   export function calculateInteractionPoints(
     friend: Friend,
     interaction: InteractionData,
     quality: QualityMetrics
   ): number { ... }
   ```

5. Create `services/decay.service.ts`:
   ```typescript
   // Move calculateCurrentScore (decay part) from weave-engine
   export function applyDecay(friend: Friend): DecayResult { ... }

   export function calculateDecayRate(
     tier: Tier,
     resilience: number
   ): number { ... }
   ```

6. Create `services/momentum.service.ts`:
   ```typescript
   // Move momentum logic from weave-engine
   export function calculateMomentumBonus(friend: Friend): number { ... }

   export function updateMomentum(
     friend: Friend,
     pointsEarned: number
   ): number { ... }
   ```

7. Create `services/resilience.service.ts`:
   ```typescript
   // Move resilience update logic from weave-engine
   export function updateResilience(
     friend: Friend,
     vibe: Vibe
   ): number { ... }
   ```

**Week 4-5: Orchestration & Integration**

8. Create `services/orchestrator.service.ts`:
   ```typescript
   /**
    * Main entry point - coordinates all scoring services
    * This replaces logNewWeave from weave-engine
    */
   export async function processWeaveScoring(
     friendIds: string[],
     interactionData: InteractionFormData,
     database: Database
   ): Promise<ScoreUpdate[]> {
     // 1. Calculate quality
     const quality = calculateInteractionQuality(interactionData);

     // 2. For each friend, calculate points
     // 3. Update momentum
     // 4. Update resilience (if needed)
     // 5. Apply to database
     // 6. Return score updates
   }
   ```

9. Create `index.ts` public API
10. Update `interactionStore.ts`:
    ```typescript
    // OLD
    import { logNewWeave } from '../lib/weave-engine';

    // NEW
    import { processWeaveScoring } from '@/modules/intelligence';
    ```
11. Update all components that import `calculateCurrentScore`
12. Move constants from `lib/constants.ts` to `modules/intelligence/constants.ts`
13. Delete `lib/weave-engine.ts` (🎉 the monolith is dead!)
14. Write comprehensive tests (this is critical!)

**Deliverables:**
- [ ] Intelligence module with 6+ service files
- [ ] Orchestrator coordinates scoring flow
- [ ] All consumers updated
- [ ] weave-engine.ts deleted
- [ ] Test coverage >80%

**Success Criteria:**
- All weaves score identically to before
- Decay still works correctly
- Momentum still triggers
- Performance is same or better

---

### Phase 4: Relationships Module (Week 5-6)

**Goal:** Extract friend management

**Tasks:**

**Week 5:**
1. Create `modules/relationships/` structure
2. Create `types.ts` (Friend-related types)
3. Create `services/friend.service.ts`:
   ```typescript
   export async function createFriend(data: FriendFormData): Promise<Friend>
   export async function updateFriend(id: string, data: FriendFormData): Promise<Friend>
   export async function deleteFriend(id: string): Promise<void>
   export async function batchAddFriends(...): Promise<Friend[]>
   ```
4. Create `services/lifecycle.service.ts`:
   ```typescript
   // Move from lifecycle-manager.ts
   export async function checkAndApplyDormancy(): Promise<void>
   export async function reactivateFriend(id: string): Promise<void>
   ```
5. Create `services/image.service.ts`:
   ```typescript
   // Move from image-service.ts and image-utils.ts
   export async function uploadFriendPhoto(...): Promise<string>
   export async function deleteFriendPhoto(...): Promise<void>
   ```

**Week 6:**
6. Create `store.ts` (move from friendStore.ts)
7. Create `hooks/useFriends.ts`
8. Create `hooks/useFriendActions.ts`
9. Move components: `FriendCard.tsx`, `FriendForm.tsx`, etc.
10. Create `index.ts`
11. Update all imports
12. Delete old files
13. Write tests

**Deliverables:**
- [ ] Relationships module complete
- [ ] Friend management still works
- [ ] Tests passing

---

### Phase 5: Interactions Module (Week 6-7)

**Goal:** Extract weave logging and planning

**Tasks:**

**Week 6:**
1. Create `modules/interactions/` structure
2. Create `types.ts` (Interaction, Plan types)
3. Create `services/weave-logging.service.ts`:
   ```typescript
   export async function logWeave(data: InteractionFormData): Promise<Interaction>
   export async function planWeave(data: InteractionFormData): Promise<Interaction>
   export async function deleteWeave(id: string): Promise<void>
   ```
4. Create `services/plan.service.ts`:
   ```typescript
   // Move from plan-lifecycle-manager.ts
   export async function completePlan(id: string): Promise<void>
   export async function cancelPlan(id: string): Promise<void>
   export async function checkMissedPlans(): Promise<void>
   ```
5. Create `services/calendar.service.ts`:
   ```typescript
   // Move from calendar-service.ts and calendar-sync-service.ts
   export async function syncToCalendar(...): Promise<void>
   export async function removeFromCalendar(...): Promise<void>
   ```

**Week 7:**
6. Create `store.ts` (move from interactionStore.ts and intentionStore.ts)
7. Create `hooks/useInteractions.ts`
8. Create `hooks/usePlans.ts`
9. Move components: `QuickWeaveOverlay.tsx`, `PlanWizard.tsx`, etc.
10. Wire up dependencies using **event-driven architecture**:
    ```typescript
    // Inside weave-logging.service.ts
    import { calculateInteractionPoints } from '@/modules/intelligence';  // Direct dependency - core logic
    import { eventBus } from '@/shared/events';  // For side effects

    export async function logWeave(data: InteractionFormData) {
      const interaction = await createInteractionRecord(data);
      const scoreUpdates = await processWeaveScoring(data);  // Intelligence module

      // Publish event - other modules subscribe
      await eventBus.emit('weave:logged', {
        interaction,
        scoreUpdates,
        friendIds: data.friendIds
      });

      return interaction;
    }
    ```
11. Create `index.ts`
12. Update all imports
13. Delete old files
14. Write tests

**Deliverables:**
- [ ] Interactions module complete
- [ ] Logging and planning still work
- [ ] Cross-module integration works

---

### Phase 6: Insights Module (Week 7-8)

**Goal:** Extract analytics, patterns, predictions

**Tasks:**
1. Create `modules/insights/` structure
2. Create services:
   - `pattern.service.ts`
   - `effectiveness.service.ts`
   - `reciprocity.service.ts`
   - `trend.service.ts`
   - `portfolio.service.ts`
   - `prediction.service.ts`
3. Create `store.ts`
4. Create hooks
5. Move components
6. Create `index.ts`
7. Update imports
8. Delete old files

**Deliverables:**
- [ ] Insights module complete
- [ ] Pattern detection works
- [ ] Analytics tracking works

---

### Phase 7: Reflection Module (Week 8-9)

**Goal:** Extract journal and reflection features

**Tasks:**
1. Create `modules/reflection/` structure
2. Move `Journal/`, `WeeklyReflection/`, `YearInMoons/` components
3. Create services for prompts, chips, narratives
4. Create `store.ts`
5. Create hooks
6. Create `index.ts`
7. Update imports
8. Delete old files

**Deliverables:**
- [ ] Reflection module complete
- [ ] Journal works
- [ ] Weekly reflection works

---

### Phase 8: Notifications Module (Week 9)

**Goal:** Extract notification system

**Tasks:**
1. Create `modules/notifications/` structure
2. Create services
3. Create `store.ts`
4. Create `index.ts`
5. Update imports
6. Delete old files

**Deliverables:**
- [ ] Notifications module complete
- [ ] Reminders still schedule correctly

---

### Phase 9: Auth Module (Week 9-10)

**Goal:** Extract authentication and sync

**Tasks:**
1. Create `modules/auth/` structure
2. Move auth, userProfile, backgroundSync stores
3. Create services
4. Create hooks
5. Move components
6. Create `index.ts`
7. Update imports
8. Delete old files

**Deliverables:**
- [ ] Auth module complete
- [ ] Sign in/out works
- [ ] Sync works

---

### Phase 10: Cleanup & Optimization (Week 10)

**Goal:** Final polish

**Tasks:**
1. Remove empty directories (`src/lib/`, old `src/stores/`, old `src/hooks/`)
2. Update all documentation
3. Optimize imports
4. Run full test suite
5. Performance testing
6. Update CLAUDE.md with new architecture
7. Create architecture diagrams

**Deliverables:**
- [ ] All old code removed
- [ ] Documentation up to date
- [ ] Tests all passing
- [ ] Performance benchmarks meet targets

---

## 6. Dependency Management

### 6.1 Allowed Dependencies

**Module Dependency Matrix:**

| Module         | Direct Imports Allowed                    | Gets Data Via                    |
|----------------|------------------------------------------|----------------------------------|
| **shared**     | (none)                                   | -                                |
| **intelligence** | shared                                   | DTOs passed as parameters        |
| **relationships** | shared, intelligence                     | Database, Intelligence DTOs      |
| **interactions** | shared, intelligence, relationships      | Database, other modules          |
| **gamification** | shared, relationships                    | Database, **events**             |
| **insights**   | shared, relationships                    | Database, **events**             |
| **reflection** | shared, relationships                    | Database, **events**             |
| **notifications** | shared                                   | Database, **events**             |
| **auth**       | shared, (all modules for sync)           | Database, all modules            |

**Key Rules:**

1. ✅ **Interactions** can directly import from Intelligence and Relationships
2. ❌ **Gamification CANNOT** directly import from Interactions (circular dependency risk)
3. ✅ **Gamification** reacts to `weave:logged` event from Interactions
4. ✅ **All modules** can query database directly (no need to go through other modules)
5. ❌ **Never import upward** in the dependency chain (see diagram below)
6. ✅ **Intelligence** accepts DTOs only (no database models as parameters)

### 6.1.1 Dependency Flow Diagram

```
┌─────────────┐
│   shared    │  ← Lowest level (utilities, types, constants)
└──────┬──────┘
       │
┌──────▼──────────┐
│  intelligence   │  ← Pure scoring logic (DTOs only, no modules)
└──────┬──────────┘
       │
┌──────▼──────────┐
│ relationships   │  ← Friend management
└──────┬──────────┘
       │
┌──────▼──────────┐
│  interactions   │  ← Weave logging (HIGH LEVEL - orchestrates)
└─────────────────┘
       │
       │ (publishes events)
       │
       ▼
┌────────────────────────────────────────┐
│  gamification, insights, notifications │  ← React to events (peer modules)
└────────────────────────────────────────┘
```

**Arrows point UP** = "can import from"
- Modules lower in the diagram can import from modules above
- Modules at the same level (gamification, insights, notifications) communicate via **events**, NOT direct imports
- Never import "downward" or "sideways" without events

### 6.2 Preventing Circular Dependencies

**Rules:**
1. Modules can only import from a module's `index.ts` (public API)
2. Never import `../` from inside a module (use absolute paths with `@/`)
3. Dependencies flow in ONE direction (see diagram in 6.1.1)
4. If two modules at same level need to communicate, use **events**
5. Use **ESLint rules** to enforce boundaries (see Section 11.2)

**Example: Avoiding Gamification ↔ Interactions Circular Dependency**

❌ **WRONG:**
```typescript
// modules/gamification/services/badge.service.ts
import { getRecentInteractions } from '@/modules/interactions';  // ❌ Circular dependency!

export async function checkStreakBadge(friendId: string) {
  const recent = await getRecentInteractions(friendId, 7);  // Importing from Interactions
  if (recent.length >= 7) {
    await awardBadge(friendId, 'streak_7_day');
  }
}
```

✅ **RIGHT (Option 1): Query database directly**
```typescript
// modules/gamification/services/badge.service.ts
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';

export async function checkStreakBadge(friendId: string) {
  // Query database directly - no dependency on Interactions module
  const recentCount = await database.get('interactions')
    .query(
      Q.where('friend_id', friendId),
      Q.where('created_at', Q.gt(Date.now() - 7 * 86400000))
    )
    .fetchCount();

  if (recentCount >= 7) {
    await awardBadge(friendId, 'streak_7_day');
  }
}
```

✅ **RIGHT (Option 2): React to events**
```typescript
// modules/gamification/index.ts (module initialization)
import { eventBus } from '@/shared/events';
import { checkStreakBadge } from './services/badge.service';

// Subscribe to event - no import from Interactions module
eventBus.on('weave:logged', async ({ friendId }) => {
  await checkStreakBadge(friendId);
});
```

**Automated Enforcement:**

Add to `.eslintrc.js`:
```javascript
'no-restricted-imports': ['error', {
  patterns: [
    {
      group: ['**/interactions/**'],
      message: 'Gamification cannot import from Interactions. Use events or database queries.'
    }
  ]
}]
```

**Example: Interactions → Intelligence**

```typescript
// modules/interactions/services/weave-logging.service.ts
import { processWeaveScoring } from '@/modules/intelligence';

export async function logWeave(data: InteractionFormData) {
  // 1. Create interaction in database
  const interaction = await createInteractionRecord(data);

  // 2. Trigger scoring (depends on intelligence module)
  const scoreUpdates = await processWeaveScoring(data.friendIds, data, database);

  // 3. Return result
  return { interaction, scoreUpdates };
}
```

**Example: Intelligence cannot depend on Interactions**

If intelligence needs interaction data, it accepts it as parameters:

```typescript
// modules/intelligence/services/scoring.service.ts
export function calculateInteractionPoints(
  friend: Friend,
  interactionData: InteractionData  // Passed in, not imported
): number {
  // Calculate points
}
```

### 6.3 Cross-Module Communication Patterns

**Pattern 1: Direct Dependency (For Core Logic)**

Use when Module A's **primary responsibility** requires Module B.

**Example:** Interactions → Intelligence (scoring is core to logging a weave)

```typescript
// modules/interactions/services/weave-logging.service.ts
import { calculateInteractionPoints } from '@/modules/intelligence';

export async function logWeave(data: InteractionFormData) {
  const interaction = await createInteractionRecord(data);

  // Direct dependency - scoring is core logic
  const scoreResult = calculateInteractionPoints(friendInput, interactionInput);

  await updateFriendScore(scoreResult);
  return interaction;
}
```

**When to use:**
- Module A cannot function without Module B
- The relationship is part of the core domain logic
- Module B is "lower" in dependency hierarchy

---

**Pattern 2: Event Bus (For Side Effects)**

Use when Module A's action triggers **optional side effects** in other modules.

**Implementation:**

```typescript
// shared/events/event-bus.ts
type EventHandler = (data: any) => void | Promise<void>;

class EventBus {
  private handlers: Map<string, EventHandler[]> = new Map();

  on(event: string, handler: EventHandler) {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, []);
    }
    this.handlers.get(event)!.push(handler);
  }

  async emit(event: string, data: any) {
    const handlers = this.handlers.get(event) || [];
    await Promise.all(handlers.map(h => h(data)));
  }

  off(event: string, handler: EventHandler) {
    const handlers = this.handlers.get(event) || [];
    this.handlers.set(event, handlers.filter(h => h !== handler));
  }
}

export const eventBus = new EventBus();
```

**Example:** Interactions publishes, Gamification/Insights/Notifications subscribe

```typescript
// modules/interactions/services/weave-logging.service.ts
import { eventBus } from '@/shared/events';

export async function logWeave(data: InteractionFormData) {
  const interaction = await createInteractionRecord(data);
  const scoreUpdates = await processWeaveScoring(data);

  // Publish event - don't know/care who subscribes
  await eventBus.emit('weave:logged', {
    interaction,
    scoreUpdates,
    friendIds: data.friendIds,
    interactionData: data
  });

  return interaction;
}
```

```typescript
// modules/gamification/index.ts (module initialization)
import { eventBus } from '@/shared/events';
import { checkFriendBadges } from './services/badge.service';

eventBus.on('weave:logged', async ({ friendIds }) => {
  await checkFriendBadges(friendIds);
});
```

```typescript
// modules/insights/index.ts
import { eventBus } from '@/shared/events';
import { analyzePattern, trackInitiation } from './services';

eventBus.on('weave:logged', async ({ interaction, interactionData }) => {
  await analyzePattern(interaction);
  await trackInitiation(interactionData);
});
```

```typescript
// modules/notifications/index.ts
import { eventBus } from '@/shared/events';
import { scheduleReminder } from './services/scheduler.service';

eventBus.on('weave:logged', async ({ interaction }) => {
  if (interaction.scheduledFor) {
    await scheduleReminder(interaction);
  }
});
```

**When to use:**
- Multiple modules need to react to an action
- Reactions are side effects, not core logic
- You want to add/remove features without changing the publisher
- Modules are at same level in dependency hierarchy

**Benefits:**
- **Decoupling** - Interactions doesn't know about Gamification
- **Extensibility** - Add new subscriber without touching publisher
- **Testability** - Test Interactions without mocking 4 modules
- **Feature flags** - Disable gamification by not subscribing

---

**Pattern 3: Callback Pattern (Rare)**

Use only when you need **synchronous notification** AND event bus doesn't fit.

```typescript
export async function processWeaveScoring(
  data: InteractionFormData,
  callbacks?: {
    onScoreUpdated?: (update: ScoreUpdate) => void;
  }
) {
  const update = calculateUpdate(data);
  callbacks?.onScoreUpdated?.(update);  // Synchronous callback
  return update;
}
```

**When to use:**
- Need synchronous execution (rare)
- Caller needs to handle result immediately
- Not suitable for event bus (very rare)

---

**Summary:**

| Pattern | Use Case | Example |
|---------|----------|---------|
| **Direct Dependency** | Core logic | Interactions → Intelligence |
| **Event Bus** | Side effects, fan-out | Interactions publishes, Gamification/Insights subscribe |
| **Callbacks** | Synchronous notification (rare) | Progress updates |

---

## 7. Testing Strategy

### 7.1 Test Levels

**Unit Tests** (for services):
```typescript
// modules/intelligence/services/__tests__/scoring.service.test.ts
describe('calculateInteractionPoints', () => {
  it('calculates base score correctly', () => {
    const points = calculateInteractionPoints(mockFriend, mockInteraction);
    expect(points).toBe(15);
  });

  it('applies archetype affinity multiplier', () => {
    // Test archetype matching
  });

  it('applies duration modifier', () => {
    // Test duration impact
  });
});
```

**Integration Tests** (for modules):
```typescript
// modules/gamification/__tests__/integration.test.ts
describe('Gamification Module', () => {
  it('awards badge when threshold reached', async () => {
    // Setup: Create friend, log 10 interactions
    // Act: Log 11th interaction
    // Assert: Badge unlocked
  });
});
```

**E2E Tests** (for critical flows):
```typescript
// e2e/weave-logging.test.ts
describe('Logging a Weave', () => {
  it('updates score, awards badge, tracks pattern', async () => {
    // Full flow from UI to database
  });
});
```

### 7.1.4 Testability Patterns

**Challenge:** How to test services that access the database without slow integration tests?

**Pattern 1: Pure Functions with DTOs (Preferred)**

Extract business logic into pure functions that accept plain objects.

**Example:**

```typescript
// modules/gamification/services/badge.service.ts

/**
 * Pure function - calculates which badges to award
 * NO database access, NO async, NO side effects
 */
export function calculateBadgesToAward(input: {
  interactionCount: number;
  consecutiveDays: number;
  currentBadges: string[];
}): string[] {
  const badgesToAward: string[] = [];

  // Social Butterfly: 10+ interactions
  if (input.interactionCount >= 10 && !input.currentBadges.includes('social_butterfly')) {
    badgesToAward.push('social_butterfly');
  }

  // Consistency: 7+ consecutive days
  if (input.consecutiveDays >= 7 && !input.currentBadges.includes('consistent_7')) {
    badgesToAward.push('consistent_7');
  }

  return badgesToAward;
}

/**
 * Orchestrator - handles I/O (database, async)
 */
export async function checkAndAwardBadges(friendId: string): Promise<BadgeUnlock[]> {
  // 1. Fetch data from database
  const interactionCount = await database.get('interactions')
    .query(Q.where('friend_id', friendId))
    .fetchCount();

  const currentBadges = await database.get('friend_badges')
    .query(Q.where('friend_id', friendId))
    .fetch();

  // 2. Call pure function (testable!)
  const badgesToAward = calculateBadgesToAward({
    interactionCount,
    consecutiveDays: 0,  // TODO: calculate
    currentBadges: currentBadges.map(b => b.badgeId)
  });

  // 3. Save to database
  const unlocked: BadgeUnlock[] = [];
  await database.write(async () => {
    for (const badgeId of badgesToAward) {
      const badge = await database.get('friend_badges').create(b => {
        b.friendId = friendId;
        b.badgeId = badgeId;
        b.unlockedAt = new Date();
      });
      unlocked.push(badge);
    }
  });

  return unlocked;
}
```

**Test:**

```typescript
// __tests__/badge.service.test.ts
import { calculateBadgesToAward } from '../badge.service';

describe('calculateBadgesToAward', () => {
  it('awards Social Butterfly for 10+ interactions', () => {
    const badges = calculateBadgesToAward({
      interactionCount: 12,
      consecutiveDays: 0,
      currentBadges: []
    });

    expect(badges).toContain('social_butterfly');
  });

  it('does not award duplicate badges', () => {
    const badges = calculateBadgesToAward({
      interactionCount: 12,
      consecutiveDays: 0,
      currentBadges: ['social_butterfly']  // Already has it
    });

    expect(badges).not.toContain('social_butterfly');
  });

  it('awards multiple badges when criteria met', () => {
    const badges = calculateBadgesToAward({
      interactionCount: 15,
      consecutiveDays: 10,
      currentBadges: []
    });

    expect(badges).toHaveLength(2);
    expect(badges).toContain('social_butterfly');
    expect(badges).toContain('consistent_7');
  });
});
```

**Benefits:**
- ✅ **Fast** - No database, no I/O
- ✅ **Simple** - Just input → output
- ✅ **Comprehensive** - Test all edge cases easily
- ✅ **No mocks** - Pure functions need no mocks

---

**Pattern 2: Repository Pattern (When Needed)**

For services with complex data access, use dependency injection with repository interface.

**Example:**

```typescript
// modules/gamification/repositories/friend.repository.ts

export interface IFriendRepository {
  getFriend(id: string): Promise<Friend>;
  getInteractionCount(friendId: string, sinceDate: Date): Promise<number>;
}

export class WatermelonFriendRepository implements IFriendRepository {
  constructor(private db: Database) {}

  async getFriend(id: string): Promise<Friend> {
    return this.db.get('friends').find(id);
  }

  async getInteractionCount(friendId: string, sinceDate: Date): Promise<number> {
    return this.db.get('interactions')
      .query(
        Q.where('friend_id', friendId),
        Q.where('created_at', Q.gte(sinceDate.getTime()))
      )
      .fetchCount();
  }
}
```

**Service accepts repository:**

```typescript
// modules/gamification/services/badge.service.ts
import type { IFriendRepository } from '../repositories/friend.repository';
import { WatermelonFriendRepository } from '../repositories/friend.repository';
import { database } from '@/db';

export async function checkFriendBadges(
  friendId: string,
  repo: IFriendRepository = new WatermelonFriendRepository(database)  // Default
): Promise<BadgeUnlock[]> {
  const friend = await repo.getFriend(friendId);
  const interactionCount = await repo.getInteractionCount(
    friendId,
    new Date(Date.now() - 30 * 86400000)
  );

  // Badge logic...
  return badges;
}
```

**Test with mock:**

```typescript
// __tests__/badge.service.test.ts
import { checkFriendBadges } from '../badge.service';
import type { IFriendRepository } from '../../repositories/friend.repository';

describe('checkFriendBadges', () => {
  it('awards badge for 10+ interactions', async () => {
    // Mock repository
    const mockRepo: IFriendRepository = {
      getFriend: jest.fn().mockResolvedValue({
        id: 'friend-1',
        name: 'Alice',
        tier: 'Inner Circle'
      }),
      getInteractionCount: jest.fn().mockResolvedValue(12)  // 12 interactions
    };

    // Inject mock
    const badges = await checkFriendBadges('friend-1', mockRepo);

    expect(mockRepo.getInteractionCount).toHaveBeenCalledWith(
      'friend-1',
      expect.any(Date)
    );
    expect(badges).toHaveLength(1);
  });
});
```

**Benefits:**
- ✅ **Testable** - Inject mock repository
- ✅ **Flexible** - Can swap database implementations
- ✅ **Isolated** - Test service without real database

---

**When to Use Which:**

| Pattern | Use When | Example |
|---------|----------|---------|
| **Pure Functions + DTOs** | Logic can be separated from I/O (90% of cases) | Scoring calculations, badge logic, validation |
| **Repository Pattern** | Service needs complex database queries | Badge checking with multiple queries |
| **Integration Tests** | Testing full flow with real database | End-to-end weave logging |

### 7.2 Test Coverage Targets

**By Layer:**

- **Pure business logic functions**: 90%+ coverage (easy to test, critical)
- **Service orchestrators** (with I/O): 60%+ coverage
- **Stores**: 70%+ coverage
- **Hooks**: 50%+ coverage
- **Components**: 40%+ coverage (focus on critical components)

**Priority Order:**

1. **Pure functions** (scoring, calculations, badge logic) - Test exhaustively
2. **Service orchestrators** - Test happy path + error cases
3. **Integration tests** - Test critical flows (weave logging, plan completion)
4. **Component tests** - Test critical UI components only

### 7.3 Regression Testing

After each phase:
1. Run full test suite
2. Manual smoke testing:
   - Log a weave
   - Plan a weave
   - View friend profile
   - Check scores
   - View badges/achievements
3. Performance testing (see Section 9.2)

---

## 8. Risk Assessment

### 8.1 Risks & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking scoring logic | High | Critical | Extensive testing, feature flags, gradual rollout |
| Circular dependencies | Medium | High | Strict dependency rules, automated checks |
| Performance regression | Medium | Medium | Benchmark before/after, profiling |
| Introducing bugs | High | Medium | Phased approach, comprehensive testing |
| Taking too long | Medium | Low | Time-box each phase, MVP approach |
| Team confusion | Low | Medium | Clear documentation, pair programming |

### 8.2 Rollback Plan

For each phase:
1. **Feature flags**: Keep old code working in parallel
2. **Git branches**: Each phase on separate branch
3. **Rollback procedure**: If phase fails, merge can be reverted
4. **Database schema**: No breaking schema changes during refactor

### 8.3 Success Gates

Each phase must pass:
- [ ] All tests passing
- [ ] No new console errors
- [ ] No performance regression (see benchmarks)
- [ ] Code review approved
- [ ] Documentation updated

---

## 9. Success Metrics

### 9.1 Code Quality Metrics

**Before Refactor:**
- `src/lib/`: 73 files
- Average file size: ~150 LOC
- Largest file: 718 LOC (weave-engine.ts)
- Cross-file dependencies: ~200+
- Test coverage: ~40%

**After Refactor (Targets):**
- `src/modules/`: 8 modules
- Average service file: <200 LOC
- Largest file: <300 LOC
- Clear dependency graph
- Test coverage: >70%

### 9.2 Performance Benchmarks

**Operations to Benchmark:**
- Log a weave (target: <100ms)
- Calculate decay for 50 friends (target: <500ms)
- Load dashboard (target: <1s)
- Plan a weave (target: <100ms)

**How to Measure:**
```typescript
// Add performance markers
const start = performance.now();
await processWeaveScoring(...);
const duration = performance.now() - start;
console.log(`Scoring took ${duration}ms`);
```

### 9.3 Developer Experience Metrics

**Subjective (Survey After):**
- How easy is it to find code? (1-5)
- How confident are you making changes? (1-5)
- How clear are module boundaries? (1-5)

**Objective:**
- Time to add new feature (before vs after)
- Time to fix a bug (before vs after)
- Number of files touched per feature

---

## 10. Future Enhancements

Once modular architecture is in place:

### 10.1 Potential Monorepo (Phase 11+)

```
packages/
  @weave/core/              # Shared types, utilities
  @weave/intelligence/      # Scoring engine (pure logic)
  @weave/gamification/      # Badges/achievements
  @weave/mobile/            # React Native app
  @weave/web/               # Future web app (shares packages!)
```

**Benefits:**
- Code sharing between mobile and web
- Independent versioning
- Clear dependency graph
- Better CI/CD

**Tools:**
- Turborepo or Nx
- Changesets for versioning

### 10.2 Micro-Frontends (If Web App)

If you build a web version, could use:
- Module federation
- Independent deployments
- Team ownership of modules

### 10.3 Module-Level Feature Flags

```typescript
// modules/gamification/config.ts
export const GAMIFICATION_CONFIG = {
  enabled: true,
  features: {
    badges: true,
    achievements: true,
    hiddenAchievements: false, // Not ready yet
  }
};
```

### 10.4 Plugin Architecture

Allow modules to be optional:

```typescript
// app/_layout.tsx
const modules = [
  RelationshipsModule,
  InteractionsModule,
  IntelligenceModule,
  GamificationModule, // Could be disabled
  // ReflectionModule, // Could be disabled
];

<ModuleProvider modules={modules}>
  {children}
</ModuleProvider>
```

---

## 11. Appendix

### 11.1 TypeScript Path Aliases

Update `tsconfig.json`:

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

### 11.2 ESLint Rules for Modules

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // Enforce module boundaries
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['../modules/*'],
            message: 'Import from module index.ts only (e.g., @/modules/intelligence)',
          },
          {
            group: ['../../*'],
            message: 'Use absolute imports (@/) instead of relative imports',
          },
        ],
      },
    ],
  },
};
```

### 11.3 Module Template

```
modules/[module-name]/
  ├── README.md              # Module documentation
  ├── index.ts               # Public API (ONLY exports)
  ├── types.ts               # Module-specific types
  ├── constants.ts           # Module-specific constants
  ├── store.ts               # Zustand store (if needed)
  │
  ├── components/            # React components
  │   ├── ComponentA.tsx
  │   └── ComponentB.tsx
  │
  ├── hooks/                 # Custom React hooks
  │   ├── useModuleData.ts
  │   └── useModuleActions.ts
  │
  ├── services/              # Business logic (pure functions)
  │   ├── service-a.service.ts
  │   ├── service-b.service.ts
  │   └── __tests__/
  │       ├── service-a.test.ts
  │       └── service-b.test.ts
  │
  └── __tests__/             # Integration tests
      └── integration.test.ts
```

### 11.4 Migration Scripts

To automate repetitive refactoring tasks, create migration scripts using tools like `jscodeshift` or simple Node scripts.

**Example: Update Imports Script**

```javascript
// scripts/update-imports.js
const fs = require('fs');
const path = require('path');

const importMappings = {
  // Old import → New import
  "from '../lib/badge-tracker'": "from '@/modules/gamification'",
  "from '../lib/weave-engine'": "from '@/modules/intelligence'",
  "from '../lib/lifecycle-manager'": "from '@/modules/relationships'",
};

function updateImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  for (const [oldImport, newImport] of Object.entries(importMappings)) {
    if (content.includes(oldImport)) {
      content = content.replace(new RegExp(oldImport, 'g'), newImport);
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated: ${filePath}`);
  }
}

// Usage: node scripts/update-imports.js
```

**Example: Using jscodeshift**

```bash
# Install jscodeshift
npm install -g jscodeshift

# Create transform
cat > scripts/migrate-badge-imports.js << 'EOF'
module.exports = function(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  // Find all imports from old badge-tracker
  root.find(j.ImportDeclaration, {
    source: { value: '../lib/badge-tracker' }
  })
  .forEach(path => {
    // Replace with new module import
    path.node.source.value = '@/modules/gamification';
  });

  return root.toSource();
};
EOF

# Run transform
jscodeshift -t scripts/migrate-badge-imports.js src/
```

**Useful Migration Tasks:**

1. **Update imports** - Change `../lib/foo` to `@/modules/bar`
2. **Move files** - Automate file relocation to new module structure
3. **Rename exports** - Update function/type names to match new API
4. **Add DTOs** - Generate DTO types from existing models
5. **Extract event subscriptions** - Find weave-engine calls and convert to events

**Example: Batch File Move Script**

```javascript
// scripts/move-gamification-files.js
const fs = require('fs-extra');

const filesToMove = [
  { from: 'src/lib/badge-tracker.ts', to: 'src/modules/gamification/services/badge.service.ts' },
  { from: 'src/lib/badge-definitions.ts', to: 'src/modules/gamification/constants/badges.ts' },
  { from: 'src/lib/achievement-tracker.ts', to: 'src/modules/gamification/services/achievement.service.ts' },
];

filesToMove.forEach(({ from, to }) => {
  if (fs.existsSync(from)) {
    fs.ensureDirSync(path.dirname(to));
    fs.moveSync(from, to);
    console.log(`Moved: ${from} → ${to}`);
  }
});
```

**Verification Script:**

```javascript
// scripts/verify-no-lib-imports.js
const glob = require('glob');
const fs = require('fs');

const files = glob.sync('src/**/*.{ts,tsx}', { ignore: 'src/lib/**' });
const badImports = [];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes("from '../lib/") || content.includes("from '../../lib/")) {
    badImports.push(file);
  }
});

if (badImports.length > 0) {
  console.error('❌ Found imports from lib/ in:');
  badImports.forEach(f => console.error(`   ${f}`));
  process.exit(1);
} else {
  console.log('✅ No lib/ imports found!');
}
```

---

## 12. Getting Started

### 12.1 Immediate Next Steps

1. **Review this spec** - Team discussion, feedback, adjustments
2. **Approve plan** - Get buy-in from stakeholders
3. **Create branch** - `feat/modular-architecture-refactor`
4. **Start Phase 1** - Foundation setup (Week 1)

### 12.2 Questions to Answer Before Starting

1. Do we have test coverage for critical flows? (If not, write tests first!)
2. Are there any planned features that should wait until after refactor?
3. Do we have time to dedicate 8-10 weeks to this?
4. Who will review PRs for each phase?
5. Should we time-box phases? (e.g., max 2 weeks per phase)

---

## Conclusion

This refactor will transform Weave from a monolithic structure to a **maintainable, scalable, modular architecture**. By organizing code by business domains instead of technical layers, we'll achieve:

- **Faster feature development** (clear boundaries, less cognitive load)
- **Easier testing** (isolated modules, clear dependencies)
- **Better scalability** (add new modules without touching existing ones)
- **Improved developer experience** (find code faster, change code confidently)

The phased approach ensures we can **migrate safely** without breaking the app, and the **strangler fig pattern** lets us keep shipping features during the refactor.

**Let's build a more modular Weave!** 🧵✨

---

**Document Version:** 2.0
**Last Updated:** 2025-11-16
**Changes in v2.0:**
- Added Phase 0.5 for database model cleanup
- Updated timeline to 12-16 weeks (more realistic)
- Added event-driven architecture as primary cross-module communication pattern
- Updated Intelligence module to use DTOs (Data Transfer Objects) for true independence
- Updated dependency matrix to prevent circular dependencies
- Added comprehensive testability patterns (pure functions + repository pattern)
- Added migration scripts section
- Clarified Store vs Service responsibilities

**Next Review:** After Phase 0.5 completion
