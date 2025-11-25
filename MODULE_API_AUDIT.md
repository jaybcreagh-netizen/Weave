# Module Public API Audit

This document audits each module's `index.ts` file to identify what's currently exported vs. what's needed based on the import violations.

**Generated:** 2025-11-25
**Purpose:** Identify missing exports before fixing import violations

---

## Summary

| Module | Status | Missing Exports | Notes |
|--------|--------|----------------|-------|
| **relationships** | ⚠️ Incomplete | 2 hooks | Missing hook exports |
| **auth** | ✅ Complete | 0 | All needed APIs exported |
| **interactions** | ⚠️ Incomplete | 3 items | Missing hook + constants |
| **intelligence** | ✅ Complete | 0 | All needed APIs exported |
| **insights** | ✅ Complete | 0 | All needed APIs exported |
| **reflection** | ✅ Complete | 0 | All needed APIs exported |
| **notifications** | ✅ Complete | 0 | All needed APIs exported |
| **gamification** | ✅ Complete | 0 | Not violated |

---

## 📦 Module: relationships

**File:** `src/modules/relationships/index.ts`

### ✅ Currently Exported:

**Hooks:**
- ✅ `useFriends` (from hooks/useFriends)
- ✅ `useFriendActions` (from hooks/useFriendActions)
- ✅ `useRelationshipsStore` (from store)

**Services:**
- ✅ `createFriend`, `updateFriend`, `deleteFriend`, `batchAddFriends` (from services/friend.service)
- ✅ `checkAndApplyDormancy`, `reactivateFriend` (from services/lifecycle.service)
- ✅ `uploadFriendPhoto`, `deleteFriendPhoto` (from services/image.service)
- ✅ All from services/life-event-detection
- ✅ All from services/life-event.service

**Components:**
- ✅ `FriendForm` (from components/FriendForm)
- ✅ `FriendListRow` (from components/FriendListRow)
- ✅ `FriendDetailSheet` (from components/FriendDetailSheet)

**Utilities & Types:**
- ✅ All from utils/image.utils
- ✅ All from types

### ❌ Missing Exports:

**Hooks:**
```typescript
❌ useFriendProfileData (needed by: app/friend-profile.tsx:31)
❌ useFriendTimeline (needed by: app/friend-profile.tsx:32)
```

### 🔧 Required Changes:

Add to `src/modules/relationships/index.ts`:
```typescript
// Hooks
export { useFriends } from './hooks/useFriends';
export { useFriendActions } from './hooks/useFriendActions';
export { useFriendProfileData } from './hooks/useFriendProfileData';  // ADD THIS
export { useFriendTimeline } from './hooks/useFriendTimeline';        // ADD THIS
export { useRelationshipsStore } from './store';
```

---

## 📦 Module: auth

**File:** `src/modules/auth/index.ts`

### ✅ Currently Exported:

**Hooks:**
- ✅ All from hooks/useFeatureGate

**Stores:**
- ✅ All from store/auth.store
- ✅ All from store/user-profile.store (`useUserProfileStore`)
- ✅ All from store/sync.store (`useBackgroundSyncStore`)

**Services:**
- ✅ All from services/supabase.service (`supabase`)
- ✅ All from services/sync-engine
- ✅ All from services/background-event-sync (`BackgroundEventSync`)
- ✅ All from services/data-export (`DataExportService`)
- ✅ All from services/data-import (`DataImportService`)
- ✅ All from services/subscription-tiers

### ✅ Status: Complete

All needed APIs are already exported. No changes required.

**Used by:**
- `src/components/settings-modal.tsx` (6 imports - all available ✅)
- `src/components/home/widgets/TodaysFocusWidget.tsx` (useUserProfileStore ✅)
- `src/components/home/widgets/SocialSeasonWidget.tsx` (useUserProfileStore ✅)
- `src/modules/auth/services/background-event-sync.ts` (internal use)
- `src/modules/reflection/services/oracle/oracle-service.ts` (supabase ✅)

---

## 📦 Module: interactions

**File:** `src/modules/interactions/index.ts`

### ✅ Currently Exported:

**Components:**
- ✅ `QuickWeaveOverlay` (from components/QuickWeaveOverlay)
- ✅ `PlanWizard` (from components/PlanWizard)

**Hooks:**
- ✅ `useInteractions` (from hooks/useInteractions)
- ✅ `usePlans` (from hooks/usePlans)
- ✅ `usePlanSuggestion` (from hooks/usePlanSuggestion)
- ✅ `useSuggestions` (from hooks/useSuggestions)

**Services:**
- ✅ `WeaveLoggingService` (namespace export)
- ✅ `PlanService` (namespace export)
- ✅ `CalendarService` (namespace export)
- ✅ All from services/smart-defaults.service
- ✅ All from services/suggestion-engine.service (`generateSuggestion`)
- ✅ `suggestionEngine` (namespace export)
- ✅ All from services/event-suggestion-learning.service
- ✅ All from services/event-scanner (`scanCalendarEvents`)
- ✅ `SuggestionTrackerService` (namespace export)
- ✅ `SuggestionStorageService` (namespace export)

**Stores:**
- ✅ All from store
- ✅ All from store/event-suggestion.store

**Types:**
- ✅ All from types

### ❌ Missing Exports:

**Hooks:**
```typescript
❌ useQuickWeave (needed by: src/context/CardGestureContext.tsx:7)
```

**Services:**
```typescript
❌ getSuggestionCooldownDays (needed by: app/_friends.tsx:19)
   - Available in services/suggestion-engine.service.ts:860
   - Already exported via "export * from './services/suggestion-engine.service'"
   - BUT imported incorrectly in _friends.tsx
```

**Constants:**
```typescript
❌ itemPositions (needed by: src/context/CardGestureContext.tsx:8)
❌ HIGHLIGHT_THRESHOLD (needed by: src/context/CardGestureContext.tsx:8)
❌ SELECTION_THRESHOLD (needed by: src/context/CardGestureContext.tsx:8)
   - All available in constants.ts
```

### 🔧 Required Changes:

Add to `src/modules/interactions/index.ts`:
```typescript
// Hooks
export { useInteractions } from './hooks/useInteractions';
export { usePlans } from './hooks/usePlans';
export { usePlanSuggestion } from './hooks/usePlanSuggestion';
export { useSuggestions } from './hooks/useSuggestions';
export { useQuickWeave } from './hooks/useQuickWeave';  // ADD THIS

// Constants
export { itemPositions, HIGHLIGHT_THRESHOLD, SELECTION_THRESHOLD } from './constants';  // ADD THIS
```

**Note:** `getSuggestionCooldownDays` is already exported via the wildcard export from suggestion-engine.service.ts, so the issue is in how it's imported in `_friends.tsx`.

---

## 📦 Module: intelligence

**File:** `src/modules/intelligence/index.ts`

### ✅ Currently Exported:

**Services:**
- ✅ `processWeaveScoring`, `calculateCurrentScore`, `calculateWeightedNetworkHealth` (from services/orchestrator.service)
- ✅ `orchestrator` (namespace export)
- ✅ `calculateInteractionQuality` (from services/quality.service)
- ✅ All from services/deepening.service (`calculateDeepeningLevel`)
- ✅ All from services/season-aware-streak.service

**Social Season:**
- ✅ All from services/social-season/season-types
- ✅ All from services/social-season/season-calculator (`calculateSocialSeason`, `calculateSeasonContext`)
- ✅ All from services/social-season/season-content
- ✅ All from services/intelligent-status-line
- ✅ All from services/status-line-cache

**Types:**
- ✅ All from types

### ✅ Status: Complete

All needed APIs are already exported. No changes required.

**Used by:**
- `app/weave-logger.tsx` (calculateDeepeningLevel ✅)
- `src/modules/intelligence/services/scoring.service.ts` (internal use)

---

## 📦 Module: insights

**File:** `src/modules/insights/index.ts`

### ✅ Currently Exported:

**Services:**
- ✅ All from services/pattern.service (`analyzeInteractionPattern`)
- ✅ All from services/reciprocity.service
- ✅ All from services/trend.service
- ✅ All from services/portfolio.service
- ✅ All from services/prediction.service
- ✅ All from services/effectiveness.service (`getLearnedEffectiveness`)
- ✅ All from services/pattern-detection.service
- ✅ All from services/weaving-insights.service

**Hooks:**
- ✅ All from hooks/useEffectiveness
- ✅ All from hooks/usePortfolio
- ✅ All from hooks/useReciprocity
- ✅ All from hooks/useTrendsAndPredictions

**Types:**
- ✅ All from types

### ✅ Status: Complete

All needed APIs are already exported. No changes required.

**Used by:**
- `src/components/FriendBadgePopup.tsx` (analyzeInteractionPattern ✅)
- `src/modules/intelligence/services/scoring.service.ts` (getLearnedEffectiveness ✅)

---

## 📦 Module: reflection

**File:** `src/modules/reflection/index.ts`

### ✅ Currently Exported:

**Services:**
- ✅ All from services/archetype-actions.service
- ✅ All from services/contextual-prompts.service
- ✅ All from services/reflection-friends.service
- ✅ All from services/story-chip-aggregator.service
- ✅ All from services/weekly-reflection.service
- ✅ All from services/weekly-stats.service
- ✅ All from services/narrative-generator.service
- ✅ All from services/story-chips.service (`STORY_CHIPS`)
- ✅ All from services/adaptive-chips
- ✅ All from services/weekly-event-review
- ✅ All from services/year-in-moons-data
- ✅ All from services/keyword-dictionary (`classifyEvent`, `extractNamesFromTitle`, etc.)

**Oracle:**
- ✅ All from services/oracle/oracle-service
- ✅ All from services/oracle/context-builder
- ✅ All from services/oracle/types

**Utilities:**
- ✅ All from utils/text-analysis

### ✅ Status: Complete

All needed APIs are already exported. No changes required.

**Used by:**
- `src/modules/notifications/services/notification-manager-enhanced.ts` (STORY_CHIPS ✅)
- `src/modules/interactions/services/event-scanner.ts` (classifyEvent, extractNamesFromTitle, etc. ✅)

---

## 📦 Module: notifications

**File:** `src/modules/notifications/index.ts`

### ✅ Currently Exported:

**Services:**
- ✅ All from services/notification-manager-enhanced
- ✅ All from services/smart-notification-scheduler
- ✅ All from services/event-notifications
- ✅ All from services/notification-grace-periods
- ✅ All from services/notification-response-handler

### ✅ Status: Complete

All services are exported. No violations found importing from this module.

---

## 📦 Module: gamification

**File:** `src/modules/gamification/index.ts`

### ✅ Currently Exported:

**Hooks:**
- ✅ `useAchievements`

**Services:**
- ✅ `checkAndAwardFriendBadges`, `checkSpecialBadges`, etc. (from services/badge.service)
- ✅ All from services/badge-calculator.service
- ✅ All from services/achievement.service
- ✅ All from services/milestone-tracker.service

**Constants:**
- ✅ All from constants/badge-definitions
- ✅ All from constants/achievement-definitions

**Types:**
- ✅ All from types

### ✅ Status: Complete

No violations found. Module is well-encapsulated.

---

## 📊 Action Items Summary

### Priority 1: Add Missing Exports (3 changes required)

1. **relationships/index.ts** - Add 2 hook exports:
   ```typescript
   export { useFriendProfileData } from './hooks/useFriendProfileData';
   export { useFriendTimeline } from './hooks/useFriendTimeline';
   ```

2. **interactions/index.ts** - Add 1 hook + constants:
   ```typescript
   export { useQuickWeave } from './hooks/useQuickWeave';
   export { itemPositions, HIGHLIGHT_THRESHOLD, SELECTION_THRESHOLD } from './constants';
   ```

### Priority 2: Fix Import Violations (15 files to update)

After adding missing exports, update the 15 files with import violations to use module public APIs instead of deep imports.

### Priority 3: Create ESLint Rule

Add ESLint rule to prevent future violations:
```javascript
'no-restricted-imports': [
  'error',
  {
    patterns: [
      '@/modules/*/services/*',
      '@/modules/*/store/*',
      '@/modules/*/hooks/*',
      '@/modules/*/components/*',
      '@/modules/*/utils/*',
      '@/modules/*/constants'  // Should be exported via index
    ]
  }
]
```

---

## 🎯 Recommendations

### Best Practices for Module index.ts Files:

1. **Export all hooks** - If a hook exists, it should probably be public
2. **Export components** - Components meant for external use should be exported
3. **Export constants** - Constants used outside the module should be exported
4. **Use named exports** - Prefer named exports over namespace exports for clarity
5. **Group exports logically** - Organize by category (Hooks, Services, Components, etc.)
6. **Document public APIs** - Add JSDoc comments describing the module's purpose

### Modules with Good API Design:

- ✅ **auth** - Comprehensive, well-organized exports
- ✅ **insights** - Clean wildcard exports for all services
- ✅ **intelligence** - Well-documented, clear public API
- ✅ **gamification** - Excellent organization by category

### Modules Needing Improvement:

- ⚠️ **relationships** - Missing hook exports (incomplete API)
- ⚠️ **interactions** - Missing hook + constants (selective exports causing issues)

---

## 📝 Notes

- **Wildcard exports (`export *`)** are being used effectively in most modules
- **Namespace exports (`export * as`)** are used for services in interactions module
- Most modules follow the pattern of exporting everything from a service file
- The issues are primarily with **selective hook exports** and **missing constant exports**

---

**Status:** Ready for implementation
**Estimated Impact:** Low (only 3 lines to add across 2 files)
**Risk:** Very Low (additive changes only, no breaking changes)
