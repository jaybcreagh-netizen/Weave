# Performance Audit: useSuggestions Tracking Loop

## Issue Summary

**Location:** `src/modules/interactions/hooks/useSuggestions.ts` (lines 80-158)
**Severity:** Critical
**Impact:** UI frame drops ("chugging") during suggestion rendering

---

## 1. Problem Analysis

### What Happens

When suggestions are generated and rendered, a `useEffect` immediately fires to "track" that they were shown. For each suggestion, this effect:

1. Queries the `friends` table to find the friend
2. Recalculates `currentScore` using `calculateCurrentScore()`
3. Queries the `interaction_friends` join table
4. Queries the `interactions` table for **all** history
5. Sorts interactions in JavaScript
6. Writes a tracking event to `suggestion_events`

### Query Explosion

For 10 suggestions, this creates:
- ~10 friend lookups (`database.get('friends').find()`)
- ~10 `interaction_friends` queries
- ~10 `interactions` queries
- ~10 JavaScript sort operations
- ~10 database writes

**Total: ~30-40 async database operations** executing immediately after the UI tries to render.

### Why This Causes Frame Drops

React's reconciliation and WatermelonDB's SQLite bridge compete for the JS thread. When 30+ async operations queue up immediately after render, the frame budget (16ms) is blown repeatedly, causing visible stuttering.

---

## 2. Root Cause: Duplicate Computation

The irony is that **all this data is already computed during suggestion generation**.

In `suggestion-provider.service.ts` (lines 85-111), `fetchSuggestions()` already:
- Fetches friend models via `SuggestionDataLoader`
- Calculates `currentScore` (line 90)
- Calculates `daysSinceInteraction` (lines 98-100)
- Has all interaction history in `context.interactions`

The tracking effect simply **re-queries the same data** that was already loaded and computed.

### Data Flow (Current - Wasteful)

```
fetchSuggestions()
    ├─ Load friends ─────────────────┐
    ├─ Load interactions ────────────┤ FIRST TIME
    ├─ Calculate score ──────────────┤
    ├─ Calculate daysSince ──────────┘
    └─ Return suggestions (without context)

useEffect (on suggestions change)
    ├─ For each suggestion:
    │   ├─ Load friend ──────────────┐
    │   ├─ Load interaction_friends ─┤ SECOND TIME (duplicate!)
    │   ├─ Load interactions ────────┤
    │   ├─ Sort interactions ────────┤
    │   ├─ Calculate score ──────────┤
    │   └─ Calculate daysSince ──────┘
    └─ Write tracking events
```

---

## 3. Proposed Solutions

### Option A: Enrich Suggestions with Tracking Context (Recommended)

**Approach:** Add a `trackingContext` field to the `Suggestion` type and populate it during generation.

**Changes Required:**
1. Extend `Suggestion` type in `src/shared/types/common.ts`:
   ```typescript
   export interface Suggestion {
     // ... existing fields
     trackingContext?: {
       friendScore: number;
       daysSinceLastInteraction: number;
     };
   }
   ```

2. Populate context in `suggestion-provider.service.ts` during generation loop
3. Simplify `useSuggestions.ts` tracking effect to just read the pre-computed context

**Pros:**
- Eliminates 100% of duplicate queries
- Tracking becomes O(n) writes instead of O(n*3) queries + O(n) writes
- No architectural changes needed
- Data is already available; we're just passing it through

**Cons:**
- Slightly increases suggestion payload size (2 numbers per suggestion)
- Tracking context travels through React Query cache

**Estimated Impact:** ~30 fewer async operations per suggestion refresh

---

### Option B: Defer Tracking to Background

**Approach:** Use React Native's `InteractionManager.runAfterInteractions()` or `requestIdleCallback` to defer tracking until after the UI is stable.

**Changes Required:**
1. Wrap tracking logic in `InteractionManager.runAfterInteractions()`
2. Add a short delay to ensure frame rendering completes first

**Pros:**
- UI renders smoothly; tracking happens after
- Minimal code changes to existing logic

**Cons:**
- Still performs duplicate queries (just deferred)
- Tracking data may be slightly stale if user navigates away
- Doesn't address the fundamental inefficiency

---

### Option C: Batch Tracking with Pre-fetched Data

**Approach:** Track all suggestions in a single batched database write, using data from a pre-computation step.

**Changes Required:**
1. Create a `SuggestionTrackingService.trackBatch()` method
2. Compute all tracking contexts in one pass before calling

**Pros:**
- Single database write instead of N writes
- Can be combined with Option A for maximum efficiency

**Cons:**
- More complex implementation
- Still need context data from somewhere

---

## 4. Recommendation

**Implement Option A (Enrich Suggestions)** as the primary fix.

This is the most impactful change with the cleanest implementation. The data is already computed; we're just failing to pass it through.

**Optionally combine with Option B** for extra insurance - defer the (now-lightweight) tracking to after interactions complete.

---

## 5. Implementation Plan

### Phase 1: Extend Suggestion Type
- [ ] Add `trackingContext?: { friendScore: number; daysSinceLastInteraction: number }` to `Suggestion` interface

### Phase 2: Populate Context During Generation
- [ ] In `suggestion-provider.service.ts`, set `trackingContext` on each suggestion:
  ```typescript
  if (suggestion) {
    suggestion.trackingContext = {
      friendScore: currentScore,
      daysSinceLastInteraction: Math.round(daysSinceInteraction),
    };
    allSuggestions.push(suggestion);
  }
  ```

### Phase 3: Simplify Tracking Effect
- [ ] Rewrite the tracking `useEffect` in `useSuggestions.ts` to:
  ```typescript
  useEffect(() => {
    const trackSuggestions = async () => {
      const toTrack = suggestions.filter(s =>
        s.friendId &&
        s.trackingContext &&
        !trackedSuggestions.current.has(s.id)
      );

      await Promise.all(toTrack.map(async (suggestion) => {
        await SuggestionTrackerService.trackSuggestionShown(suggestion, suggestion.trackingContext!);
        trackedSuggestions.current.add(suggestion.id);
      }));
    };

    trackSuggestions();
  }, [suggestions]);
  ```

### Phase 4: Optional Deferral
- [ ] Wrap tracking in `InteractionManager.runAfterInteractions()` for extra safety

---

## 6. Success Metrics

- **Before:** ~30+ async DB operations after suggestion render
- **After:** ~10 async DB writes (tracking events only), deferred
- **Expected improvement:** Eliminates frame drops during suggestion display

---

## 7. Related Files

| File | Role |
|------|------|
| `src/modules/interactions/hooks/useSuggestions.ts` | Hook with problematic effect |
| `src/modules/interactions/services/suggestion-provider.service.ts` | Suggestion generation (has the data) |
| `src/modules/interactions/services/suggestion-tracker.service.ts` | Tracking service |
| `src/modules/interactions/services/suggestion-system/SuggestionDataLoader.ts` | Already loads context efficiently |
| `src/shared/types/common.ts` | Suggestion type definition |

---

*Audit created: 2025-12-23*
