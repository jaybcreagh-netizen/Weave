# Prediction & Suggestion System Improvements Plan

This document outlines planned improvements to the Weave prediction and suggestion systems.

## Completed Improvements

### 1. CompositeHealthSignal Integration
**Status:** Completed

The `CompositeHealthSignal` interface is now fully wired up:
- `buildCompositeHealthSignal()` - Aggregates multiple health signals from friend data
- `getComprehensiveHealthPrediction()` - Combines composite scoring with drift prediction
- Signals include: decay, pattern, reciprocity, battery alignment, momentum, quality

**Files Modified:**
- `src/modules/insights/services/prediction.service.ts`

### 2. Reciprocity Analysis in Suggestions
**Status:** Completed

New `reciprocity-imbalance` suggestion type:
- Detects when user is over-initiating (>70% of interactions)
- Detects when friend is over-initiating (<30% of interactions)
- Uses existing `analyzeReciprocity()` service
- Includes metadata with `initiationRatio`

**Files Modified:**
- `src/modules/insights/types.ts` - Added new suggestion type
- `src/modules/insights/services/prediction.service.ts` - Added `generateReciprocitySuggestion()`

### 3. Smart Scheduling (Battery-Aware)
**Status:** Completed

New `best-day-scheduling` suggestion type:
- Uses day-of-week patterns from battery history
- Considers current battery level for contextual messaging
- Only suggests when friend needs attention (approaching tolerance window)
- Recommends best days within the next 3 days

**Files Modified:**
- `src/modules/insights/services/pattern-detection.service.ts` - Added `getBestConnectionDaysData()`, `getCurrentBatteryLevel()`
- `src/modules/insights/services/prediction.service.ts` - Added `generateSmartSchedulingSuggestion()`
- `src/modules/insights/hooks/useTrendsAndPredictions.ts` - Integrated smart scheduling data

---

## Planned Improvements

### 4. Consolidate Suggestion Systems
**Priority:** Medium
**Effort:** High
**Impact:** Medium-High

**Current State:**
Multiple suggestion systems operate independently:
- `prediction.service.ts` - Proactive suggestions (drift, timing, momentum)
- `suggestion-engine.service.ts` - Portfolio-based suggestions
- `tier-suggestion-engine.service.ts` - Tier-specific recommendations

**Problem:**
- Duplicate logic across systems
- Inconsistent suggestion formats
- No unified priority/ranking system
- Difficult to add new suggestion types consistently

**Proposed Solution:**
1. Create a unified `SuggestionEngine` class with plugin architecture
2. Each suggestion type becomes a "suggester" plugin
3. Central scoring and deduplication
4. Consistent output format

**Implementation Steps:**
1. Define `Suggester` interface with `canSuggest()`, `suggest()`, `priority`
2. Create `UnifiedSuggestionEngine` with plugin registration
3. Migrate existing suggesters one at a time
4. Add cross-suggester deduplication (same friend, similar message)
5. Implement priority-based ranking across all suggestion types

**Files to Modify:**
- New: `src/modules/insights/services/unified-suggestion-engine.service.ts`
- New: `src/modules/insights/suggesters/*.ts` (individual suggesters)
- Deprecate: Parts of `suggestion-engine.service.ts`

---

### 5. Group Interaction Intelligence
**Priority:** Medium
**Effort:** Medium
**Impact:** Medium

**Current State:**
- `primaryOnly` filter differentiates group vs 1:1 interactions
- Pattern analysis can filter to small-group interactions (<=3 friends)

**Problem:**
- Group interactions not separately analyzed
- No insights about group dynamics
- Group events might dilute personal connection patterns

**Proposed Solution:**
1. Track group vs 1:1 separately in pattern analysis
2. Add group-specific insights (e.g., "You thrive in group settings with X")
3. Surface group gathering suggestions
4. Consider group context in tier recommendations

**Implementation Steps:**
1. Add `groupPattern` property to `FriendshipPattern`
2. Create `analyzeGroupPatterns()` function
3. Add `group-gathering` suggestion type
4. Update tier fit analysis to consider group context

**Files to Modify:**
- `src/modules/insights/services/pattern.service.ts`
- `src/modules/insights/services/prediction.service.ts`
- `src/modules/insights/types.ts`

---

### 6. Seasonal & Long-Term Patterns
**Priority:** Low
**Effort:** High
**Impact:** Medium

**Current State:**
- Social season tracking exists (Resting, Balanced, Blooming)
- Day-of-week patterns detected
- No monthly or seasonal trends

**Problem:**
- Miss patterns like "always reconnect with X in summer"
- Holiday patterns not captured
- Life event correlations not tracked

**Proposed Solution:**
1. Month-of-year pattern detection
2. Holiday proximity scoring
3. Life event impact analysis
4. Long-term friendship trajectory tracking

**Implementation Steps:**
1. Add `monthlyPatterns` to pattern detection
2. Create `holiday-aware-scheduling` suggestion type
3. Track 6-month and 12-month trends
4. Add seasonal insights to portfolio analysis

**Files to Modify:**
- `src/modules/insights/services/pattern-detection.service.ts`
- New: `src/modules/insights/services/seasonal-patterns.service.ts`
- `src/modules/insights/services/trend.service.ts`

---

### 7. Suggestion Fatigue Prevention
**Priority:** High
**Effort:** Medium
**Impact:** High

**Current State:**
- No tracking of suggestion history
- Same suggestions can repeat frequently
- No user feedback loop

**Problem:**
- Users may get fatigued by repetitive suggestions
- No way to mark suggestions as "not now" or "ignore"
- High-frequency suggestions for the same friend

**Proposed Solution:**
1. Track suggestion display history
2. Implement cooldown periods per suggestion type
3. Add user dismissal tracking
4. Exponential backoff for dismissed suggestions

**Implementation Steps:**
1. Create `SuggestionHistory` model in database
2. Add `lastShownAt`, `dismissCount` tracking
3. Implement cooldown logic (e.g., 7 days after dismiss)
4. Add "snooze" and "don't show again" options
5. Reduce frequency for repeatedly dismissed suggestions

**Files to Modify:**
- New: `src/db/models/SuggestionHistory.ts`
- New: `src/modules/insights/services/suggestion-fatigue.service.ts`
- `src/modules/insights/services/prediction.service.ts`
- UI components that display suggestions

---

### 8. Enhanced Prediction Confidence
**Priority:** Low
**Effort:** Medium
**Impact:** Medium

**Current State:**
- Static confidence values in predictions
- Pattern-based confidence adjustment exists but limited

**Problem:**
- Confidence doesn't reflect actual prediction accuracy
- No historical validation of predictions
- Users can't gauge reliability

**Proposed Solution:**
1. Track prediction outcomes (was the prediction correct?)
2. Adjust confidence based on historical accuracy
3. Show confidence indicators in UI
4. Learn from user behavior

**Implementation Steps:**
1. Store predictions with timestamps
2. Retroactively check prediction accuracy
3. Build per-friend accuracy scores
4. Display confidence levels (high/medium/low) in UI
5. Use Bayesian updating for confidence

**Files to Modify:**
- New: `src/db/models/PredictionHistory.ts`
- `src/modules/insights/services/prediction.service.ts`
- UI components showing predictions

---

## Implementation Priority Order

1. **Suggestion Fatigue Prevention** - Highest impact on user experience
2. **Group Interaction Intelligence** - Natural extension of existing work
3. **Consolidate Suggestion Systems** - Technical debt reduction
4. **Enhanced Prediction Confidence** - Quality improvement
5. **Seasonal & Long-Term Patterns** - Future enhancement

---

## Notes

- All improvements should maintain backward compatibility
- Consider A/B testing for major changes
- Monitor suggestion engagement metrics after each change
- Keep suggestion text conversational and non-intrusive
