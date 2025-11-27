# Dynamic Tier Intelligence - Design Document

**Status:** Draft
**Created:** 2025-11-27
**Owner:** Design & Engineering
**Epic:** Dunbar Tier System Enhancement

---

## Executive Summary

This document proposes a comprehensive enhancement to Weave's Dunbar tier system to make it **dynamic, intelligent, and stress-reducing**. The core insight: tiers should reflect *actual* relationship patterns, not just aspirational ones. When users mark friends as "Inner Circle" but only connect monthly, those friends constantly go red, causing unnecessary stress.

The solution introduces **Tier Intelligence** - a system that:
- Observes actual interaction patterns
- Adapts decay rates to match personal rhythms while respecting tier intent
- Surfaces tier-pattern mismatches with helpful suggestions
- Empowers users to rebalance their network organically

---

## Problem Statement

### Current Issues

1. **Manual tier assignment is aspirational, not realistic**
   - Users assign tiers based on emotional closeness
   - Reality: interaction frequency doesn't always match tier expectations
   - Result: Important friends constantly showing as "needs attention"

2. **Fixed decay rates cause stress**
   - Inner Circle: 2.5 pts/day (expects ~weekly contact)
   - Close Friends: 1.5 pts/day (expects ~bi-weekly contact)
   - A friend marked Inner Circle but contacted monthly will always be red

3. **No feedback loop**
   - Users don't understand why certain friends keep going red
   - No visibility into whether tiers match actual behavior
   - No guidance on tier reassignment

4. **Dunbar's model is static, but relationships aren't**
   - Real relationships ebb and flow
   - Busy seasons, life changes, distance - all affect frequency
   - Current system doesn't account for relationship "seasons"

### User Impact

- **Stress and guilt** from constantly red friends
- **Notification fatigue** about friends who don't actually need attention
- **Abandonment** of the app when tier expectations feel unrealistic
- **Misaligned effort** - spending energy on wrong connections

---

## Goals & Non-Goals

### Goals

1. **Reduce stress** - Make scores reflect realistic relationship maintenance
2. **Increase honesty** - Help users see their *actual* network, not idealized version
3. **Provide intelligence** - Surface insights about tier-pattern mismatches
4. **Enable organic rebalancing** - Make tier adjustments feel natural and helpful
5. **Respect agency** - Always suggest, never force tier changes

### Non-Goals

1. ❌ Fully automate tier assignment (users should always have final say)
2. ❌ Remove the tier system (Dunbar layers are valuable framework)
3. ❌ Make all friends the same (tiers represent real capacity differences)
4. ❌ Eliminate all "red" friends (some pressure is healthy)

---

## Current System Analysis

### Existing Data (Already Captured!)

The app already tracks critical data that enables tier intelligence:

```typescript
// Friend model (src/db/models/Friend.ts)
@field('dunbar_tier') dunbarTier!: string  // User-assigned tier
@field('weave_score') weaveScore!: number  // Current health
@date('last_updated') lastUpdated!: Date   // Last interaction

// Learned patterns (v21 schema)
@field('typical_interval_days') typicalIntervalDays?: number
@field('tolerance_window_days') toleranceWindowDays?: number

// Decay system
@field('resilience') resilience!: number
```

### Existing Services

- **DecayService** (`src/modules/intelligence/services/decay.service.ts`)
  - Already uses `toleranceWindowDays` for adaptive decay
  - Applies tier-specific base rates

- **Pattern Detection** (`src/modules/insights/services/pattern-detection.service.ts`)
  - Detects interaction patterns, archetype affinities
  - Could be extended for tier-pattern analysis

- **Prediction Service** (`src/modules/insights/services/prediction.service.ts`)
  - `predictFriendDrift()` - forecasts when friends need attention
  - `generateProactiveSuggestions()` - creates contextual suggestions

### Gap Analysis

What's missing:
1. ❌ No comparison of actual vs expected tier patterns
2. ❌ No tier fit scoring/indicators
3. ❌ No proactive tier suggestions
4. ❌ No UI for tier balance visibility
5. ❌ Decay formula doesn't fully adapt to personal rhythms

---

## Proposed Solution

### Three-Pillar Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   TIER INTELLIGENCE                      │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  1. FLEXIBLE DECAY         2. PATTERN ANALYSIS          │
│     (Smart scoring)            (Mismatch detection)     │
│           │                           │                 │
│           └───────────┬───────────────┘                 │
│                       │                                  │
│                       ▼                                  │
│              3. INTELLIGENT UX                          │
│                 (Suggestions & insights)                │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Component 1: Flexible Decay System

### Problem
Fixed tier decay rates don't account for personal relationship rhythms.

### Solution
**Adaptive decay rate per friend** that balances tier expectations with actual patterns.

### Algorithm

```typescript
/**
 * Calculate personalized decay rate for a friend
 * Balances tier expectations with learned patterns
 */
function calculateFlexibleDecay(friend: Friend): number {
  const baseTierDecay = TierDecayRates[friend.dunbarTier];

  const tierExpectedInterval = {
    InnerCircle: 7,    // Weekly
    CloseFriends: 14,  // Bi-weekly
    Community: 28      // Monthly
  }[friend.dunbarTier];

  const actualInterval = friend.typicalIntervalDays || tierExpectedInterval;

  // Calculate rhythm adjustment factor
  // If actual interval is longer, decay should be slower
  const rhythmRatio = actualInterval / tierExpectedInterval;

  // Cap adjustment to prevent over-relaxation
  // Never reduce decay by more than 50% (min 0.5x)
  // Never increase decay by more than 50% (max 1.5x)
  const cappedRatio = Math.min(Math.max(rhythmRatio, 0.5), 1.5);

  // Apply adjustment
  let adjustedDecay = baseTierDecay / cappedRatio;

  // Enforce tier floors - maintain hierarchy
  const tierMinimumDecay = {
    InnerCircle: 1.25,  // Never slower than 50% of base (2.5 * 0.5)
    CloseFriends: 0.75, // Never slower than 50% of base (1.5 * 0.5)
    Community: 0.25     // Never slower than 50% of base (0.5 * 0.5)
  }[friend.dunbarTier];

  adjustedDecay = Math.max(adjustedDecay, tierMinimumDecay);

  // Also enforce that Inner > Close > Community
  // (Inner should always decay faster than Close, etc.)

  return adjustedDecay;
}
```

### Examples

**Example 1: Sarah - Inner Circle with monthly rhythm**
```
Base decay: 2.5/day (expects weekly)
Actual interval: 28 days
Rhythm ratio: 28/7 = 4.0, capped at 1.5
Adjusted decay: 2.5 / 1.5 = 1.67/day
Result: Still faster than Close Friends (1.5), but 33% more forgiving
```

**Example 2: Mike - Close Friends with weekly rhythm**
```
Base decay: 1.5/day (expects bi-weekly)
Actual interval: 7 days
Rhythm ratio: 7/14 = 0.5
Adjusted decay: 1.5 / 0.5 = 3.0/day
Floor check: max(3.0, 0.75) = 3.0/day
Result: Faster decay because contact is more frequent (might suggest promoting)
```

### User-Facing Flexibility Setting

Add a **global flexibility preference** that adjusts how much adaptation occurs:

```typescript
enum FlexibilityMode {
  Strict = 'strict',      // No adjustment (original behavior)
  Balanced = 'balanced',  // Default: moderate adjustment
  Flexible = 'flexible'   // Maximum adjustment
}

// Multipliers for cap limits
const flexibilityMultipliers = {
  strict: { min: 1.0, max: 1.0 },    // No change
  balanced: { min: 0.5, max: 1.5 },  // 50% adjustment
  flexible: { min: 0.3, max: 2.0 }   // 70% adjustment
};
```

### Implementation Location

- **Service:** `src/modules/intelligence/services/flexible-decay.service.ts` (new)
- **Integration:** Update `DecayService.applyDecay()` to call flexible decay
- **Settings:** `src/modules/auth/stores/useSettingsStore.ts` - add `tierFlexibility` field

---

## Component 2: Tier Pattern Analysis

### Problem
No system to detect tier-pattern mismatches.

### Solution
**Tier Fit Analyzer** that compares actual behavior with tier expectations.

### Data Structure

```typescript
// New type
export interface TierFitAnalysis {
  friendId: string;
  friendName: string;
  currentTier: Tier;

  // Pattern data
  actualIntervalDays: number;
  expectedIntervalDays: number;
  interactionCount: number; // Sample size

  // Fit scoring
  fitScore: number; // 0-1, where 1 = perfect fit
  fitCategory: 'great' | 'good' | 'mismatch' | 'insufficient_data';

  // Recommendations
  suggestedTier?: Tier;
  confidence: number; // 0-1
  reason: string;
}
```

### Algorithm

```typescript
/**
 * Analyze tier fit for a friend
 */
function analyzeTierFit(friend: Friend): TierFitAnalysis {
  const expectedInterval = {
    InnerCircle: 7,
    CloseFriends: 14,
    Community: 28
  }[friend.dunbarTier];

  const actualInterval = friend.typicalIntervalDays;

  // Need sufficient data (5+ interactions)
  if (!actualInterval || friend.ratedWeavesCount < 5) {
    return {
      friendId: friend.id,
      friendName: friend.name,
      currentTier: friend.dunbarTier,
      actualIntervalDays: 0,
      expectedIntervalDays: expectedInterval,
      interactionCount: friend.ratedWeavesCount,
      fitScore: 0,
      fitCategory: 'insufficient_data',
      confidence: 0,
      reason: 'Not enough interaction history yet'
    };
  }

  // Calculate deviation ratio
  const deviationRatio = actualInterval / expectedInterval;

  // Score fit (inverse of deviation, clamped)
  let fitScore: number;
  if (deviationRatio >= 0.7 && deviationRatio <= 1.3) {
    fitScore = 1.0; // Great fit (within 30%)
  } else if (deviationRatio >= 0.5 && deviationRatio <= 2.0) {
    fitScore = 0.7; // Good fit (within 2x)
  } else {
    fitScore = Math.max(0, 1 - Math.abs(Math.log2(deviationRatio)) / 2);
  }

  // Categorize
  let fitCategory: TierFitAnalysis['fitCategory'];
  if (fitScore >= 0.9) fitCategory = 'great';
  else if (fitScore >= 0.6) fitCategory = 'good';
  else fitCategory = 'mismatch';

  // Generate suggestion if mismatch
  let suggestedTier: Tier | undefined;
  let reason = '';

  if (fitCategory === 'mismatch') {
    if (deviationRatio > 2.0) {
      // Too infrequent for current tier - suggest move down
      if (friend.dunbarTier === 'InnerCircle') {
        suggestedTier = 'CloseFriends';
        reason = `You connect every ${actualInterval} days, but Inner Circle expects weekly contact. Close Friends (bi-weekly) is a better fit.`;
      } else if (friend.dunbarTier === 'CloseFriends') {
        suggestedTier = 'Community';
        reason = `You connect every ${actualInterval} days, but Close Friends expects bi-weekly contact. Community (monthly) is a better fit.`;
      }
    } else if (deviationRatio < 0.5) {
      // Too frequent for current tier - suggest move up
      if (friend.dunbarTier === 'Community') {
        suggestedTier = 'CloseFriends';
        reason = `You're connecting every ${actualInterval} days—more than Community expects! Consider Close Friends tier.`;
      } else if (friend.dunbarTier === 'CloseFriends') {
        suggestedTier = 'InnerCircle';
        reason = `You're connecting weekly or more—this is Inner Circle frequency! Consider promoting.`;
      }
    }
  }

  // Confidence based on sample size and consistency
  const confidence = Math.min(
    0.95,
    0.5 + (friend.ratedWeavesCount / 20) * 0.45
  );

  return {
    friendId: friend.id,
    friendName: friend.name,
    currentTier: friend.dunbarTier,
    actualIntervalDays: actualInterval,
    expectedIntervalDays: expectedInterval,
    interactionCount: friend.ratedWeavesCount,
    fitScore,
    fitCategory,
    suggestedTier,
    confidence,
    reason: reason || `Good fit - your rhythm matches ${friend.dunbarTier} expectations`
  };
}
```

### Network-Level Analysis

```typescript
/**
 * Analyze tier health across the entire network
 */
async function analyzeNetworkTierHealth(): Promise<NetworkTierHealth> {
  const friends = await database.get<Friend>('friends')
    .query(Q.where('is_dormant', false))
    .fetch();

  const analyses = friends.map(analyzeTierFit);

  const tierHealth = {
    InnerCircle: { total: 0, great: 0, good: 0, mismatch: 0 },
    CloseFriends: { total: 0, great: 0, good: 0, mismatch: 0 },
    Community: { total: 0, great: 0, good: 0, mismatch: 0 }
  };

  analyses.forEach(analysis => {
    if (analysis.fitCategory === 'insufficient_data') return;

    const tier = analysis.currentTier;
    tierHealth[tier].total++;

    if (analysis.fitCategory === 'great') tierHealth[tier].great++;
    else if (analysis.fitCategory === 'good') tierHealth[tier].good++;
    else tierHealth[tier].mismatch++;
  });

  // Calculate overall health score (0-10)
  const totalFriends = analyses.filter(a => a.fitCategory !== 'insufficient_data').length;
  const totalMismatches = Object.values(tierHealth).reduce((sum, t) => sum + t.mismatch, 0);
  const healthScore = totalFriends > 0
    ? Math.round(((totalFriends - totalMismatches) / totalFriends) * 10)
    : 10;

  return {
    healthScore,
    tierHealth,
    mismatches: analyses.filter(a => a.fitCategory === 'mismatch'),
    suggestions: analyses.filter(a => a.suggestedTier).slice(0, 5) // Top 5
  };
}
```

### Implementation Location

- **Service:** `src/modules/insights/services/tier-fit.service.ts` (new)
- **Types:** `src/modules/insights/types.ts` - add `TierFitAnalysis`, `NetworkTierHealth`
- **Hook:** `src/modules/insights/hooks/useTierFit.ts` (new)

---

## Component 3: Intelligent UX

### 3.1 Friend Profile - Tier Fit Indicator

**Location:** Friend profile screen (`app/friend-profile.tsx`)

**Component:** `TierFitCard` (new)

```tsx
// src/modules/insights/components/TierFitCard.tsx
interface TierFitCardProps {
  friend: Friend;
  analysis: TierFitAnalysis;
  onTierChange: (newTier: Tier) => void;
}

// Visual states:
// - Great fit: Green subtle indicator, no action needed
// - Good fit: Neutral, show data but no warning
// - Mismatch: Yellow/orange warning with suggestion CTA
```

**Visual Mockup:**

```
When mismatch detected:
┌──────────────────────────────────────────┐
│ 💡 Tier Insights                         │
├──────────────────────────────────────────┤
│ Your rhythm: Every 21 days               │
│ Tier expects: Every 7 days               │
│                                           │
│ ⚠️ This mismatch may cause stress        │
│                                           │
│ [Review Tier Fit] →                      │
└──────────────────────────────────────────┘

When great fit:
┌──────────────────────────────────────────┐
│ ✓ Tier match                             │
│ Your rhythm fits Inner Circle well       │
└──────────────────────────────────────────┘
```

**Implementation:**
- Show below tier selector in friend profile
- Only render if `analysis.fitCategory !== 'insufficient_data'`
- Tapping opens `TierFitBottomSheet`

---

### 3.2 Tier Fit Bottom Sheet

**Component:** `TierFitBottomSheet` (new)

Shows detailed analysis and options when user taps tier fit card.

```tsx
// src/modules/insights/components/TierFitBottomSheet.tsx
interface TierFitBottomSheetProps {
  friend: Friend;
  analysis: TierFitAnalysis;
  onSelectOption: (option: TierFitOption) => void;
  onDismiss: () => void;
}

enum TierFitOption {
  ChangeTier = 'change_tier',
  StayInTier = 'stay_in_tier',
  SeasonalAdjustment = 'seasonal_adjustment',
  Dismiss = 'dismiss'
}
```

**Content sections:**
1. **Analysis summary** - actual vs expected intervals
2. **Impact explanation** - why this matters (stress, accuracy)
3. **Options with clear outcomes**
   - Change tier → Better fit, less stress
   - Stay in tier → Keep higher/lower expectations
   - Seasonal adjustment → Temporary relief (Phase 2 feature)

---

### 3.3 Dashboard Widget - Network Balance

**Component:** `NetworkBalanceWidget` (new)

**Location:** Dashboard home screen (`app/(tabs)/index.tsx`)

```tsx
// src/components/home/widgets/NetworkBalanceWidget.tsx
interface NetworkBalanceWidgetProps {
  networkHealth: NetworkTierHealth;
  onPress: () => void;
}
```

**Visual:**

```
┌──────────────────────────────────────────┐
│ Network Balance               [View All] │
├──────────────────────────────────────────┤
│ ●●●●●●●○○○ 7/10                          │
│                                           │
│ 🟢 8 friends match their tier            │
│ 🟡 3 might need adjustment                │
│                                           │
│ Top suggestions:                          │
│ • Sarah: Inner → Close                    │
│ • Mike: Close → Community                 │
│                                           │
│ [Review Balance] →                        │
└──────────────────────────────────────────┘
```

**Behavior:**
- Shows if ≥3 mismatches detected
- Tapping navigates to Tier Balance screen
- Dismissible (don't show again for 7 days)

---

### 3.4 Tier Balance Screen

**New screen:** `app/tier-balance.tsx`

Full-screen view of network tier health with drill-down per tier.

**Structure:**

```
┌─────────────────────────────────────────────┐
│ ← Tier Balance                              │
├─────────────────────────────────────────────┤
│ Overall Health: 7/10 ●●●●●●●○○○            │
│                                              │
│ Your tiers mostly match your actual         │
│ patterns. 3 friends could use adjustment.   │
│                                              │
├─ INNER CIRCLE ──────────────────────────────┤
│ 4 of 5 thriving                             │
│                                              │
│ ⚠️ Sarah Johnson                            │
│ │  Every 21 days (expects 7)                │
│ │  Suggestion: Move to Close Friends        │
│ └─ [Review] [Dismiss]                       │
│                                              │
│ ✓ Mom, Alex, Jordan, Pat                    │
│                                              │
├─ CLOSE FRIENDS ─────────────────────────────┤
│ 12 of 15 stable                             │
│                                              │
│ ⚠️ Mike Chen                                │
│ │  Every 42 days (expects 14)               │
│ │  Suggestion: Move to Community            │
│ └─ [Review] [Dismiss]                       │
│                                              │
│ ⬆️ Lisa Park                                │
│ │  Every 7 days (expects 14)                │
│ │  Suggestion: Promote to Inner Circle      │
│ └─ [Review] [Dismiss]                       │
│                                              │
│ [Show all Close Friends]                    │
│                                              │
├─ COMMUNITY ─────────────────────────────────┤
│ 28 of 30 stable                             │
│ [Show Community]                            │
│                                              │
├─────────────────────────────────────────────┤
│ [Apply All Suggestions]  [Done]             │
└─────────────────────────────────────────────┘
```

**Actions:**
- **Review** individual suggestion → Opens TierFitBottomSheet
- **Dismiss** → Remove suggestion for this friend (store in local state)
- **Apply All** → Batch move all suggested friends (with confirmation)

---

### 3.5 Contextual Nudges

**Trigger points for showing tier suggestions:**

1. **After logging interaction** (if pattern now shows mismatch)
2. **When friend goes red repeatedly** (3+ times in 30 days)
3. **Weekly reflection prompt** (if network health < 6/10)

**Implementation:**
- New service: `TierSuggestionEngine`
- Checks conditions after interaction logs
- Shows inline alert with "Review tier fit" CTA

---

### 3.6 Settings - Tier Intelligence Controls

**Location:** Settings screen

**New section:**

```
╭──────────────────────────────────────────╮
│ Tier Intelligence                        │
├──────────────────────────────────────────┤
│ ☑ Show tier fit indicators               │
│ ☑ Suggest tier adjustments               │
│ ☐ Quiet mode (reduce nudges)             │
│                                           │
│ Decay Flexibility:                        │
│ Strict ●━━━━━○━━━ Flexible              │
│        ↑                                  │
│   (Balanced)                              │
│                                           │
│ • Strict: Tiers enforce expectations     │
│ • Balanced: Adapt to your rhythms        │
│ • Flexible: Maximum adaptation           │
│                                           │
│ [Learn more about tier intelligence]     │
╰──────────────────────────────────────────╯
```

---

## Data Model Changes

### Schema Additions

```typescript
// src/db/schema.ts

// Add to friends table
{ name: 'tier_fit_score', type: 'number', isOptional: true },
{ name: 'tier_fit_last_calculated', type: 'number', isOptional: true },
{ name: 'suggested_tier', type: 'string', isOptional: true },
{ name: 'tier_suggestion_dismissed_at', type: 'number', isOptional: true },

// New: user_profile table additions for settings
{ name: 'tier_flexibility_mode', type: 'string', isOptional: true }, // 'strict' | 'balanced' | 'flexible'
{ name: 'tier_intelligence_enabled', type: 'boolean', isOptional: true },
```

### Migration

```typescript
// src/db/migrations.ts
{
  toVersion: 27, // Next version
  steps: [
    {
      type: 'add_columns',
      table: 'friends',
      columns: [
        { name: 'tier_fit_score', type: 'number', isOptional: true },
        { name: 'tier_fit_last_calculated', type: 'number', isOptional: true },
        { name: 'suggested_tier', type: 'string', isOptional: true },
        { name: 'tier_suggestion_dismissed_at', type: 'number', isOptional: true },
      ]
    },
    {
      type: 'add_columns',
      table: 'user_profile',
      columns: [
        { name: 'tier_flexibility_mode', type: 'string', isOptional: true },
        { name: 'tier_intelligence_enabled', type: 'boolean', isOptional: true },
      ]
    }
  ]
}
```

### Model Updates

```typescript
// src/db/models/Friend.ts
@field('tier_fit_score') tierFitScore?: number
@field('tier_fit_last_calculated') tierFitLastCalculated?: number
@text('suggested_tier') suggestedTier?: string
@field('tier_suggestion_dismissed_at') tierSuggestionDismissedAt?: number
```

---

## Implementation Plan

### Phase 1: Foundation (Week 1-2)
**Goal:** Core intelligence with minimal UI

#### Tasks:
1. **Data model** ✓
   - Add schema fields
   - Create migration
   - Update Friend model

2. **Flexible Decay Service** ⭐ Core
   - Create `flexible-decay.service.ts`
   - Implement `calculateFlexibleDecay()`
   - Add flexibility mode enum and constants
   - Unit tests

3. **Tier Fit Analysis Service** ⭐ Core
   - Create `tier-fit.service.ts`
   - Implement `analyzeTierFit()`
   - Implement `analyzeNetworkTierHealth()`
   - Unit tests

4. **Integration**
   - Update `DecayService.applyDecay()` to use flexible decay
   - Add background job to calculate tier fit scores periodically

5. **Basic UI - Friend Profile Indicator**
   - Create `TierFitCard` component
   - Show on friend profile when mismatch detected
   - Simple alert-style UI (polish in Phase 2)

**Deliverable:** Friends with mismatched tiers show a basic warning on their profile, and decay rates adapt to personal rhythms.

---

### Phase 2: Intelligence Layer (Week 3-4)
**Goal:** Suggestions, insights, and network visibility

#### Tasks:
1. **Tier Fit Bottom Sheet**
   - Create `TierFitBottomSheet` component
   - Handle tier change actions
   - Track dismissals

2. **Network Balance Widget**
   - Create `NetworkBalanceWidget`
   - Add to dashboard
   - Navigate to Tier Balance screen

3. **Tier Balance Screen**
   - Create `app/tier-balance.tsx`
   - Per-tier sections with expandable lists
   - Batch actions (apply all suggestions)

4. **Hooks**
   - `useTierFit(friendId)` - individual friend analysis
   - `useNetworkTierHealth()` - network-wide analysis
   - Reactive updates when interactions logged

5. **Settings Integration**
   - Add Tier Intelligence section
   - Flexibility slider
   - Toggle controls

**Deliverable:** Full visibility into tier health across the network with actionable suggestions.

---

### Phase 3: Proactive Intelligence (Week 5-6)
**Goal:** Contextual nudges and smart timing

#### Tasks:
1. **Contextual Suggestion Engine**
   - `TierSuggestionEngine` service
   - Trigger after interaction logs
   - Trigger when friends repeatedly go red
   - In-app notification system integration

2. **Post-Interaction Tier Prompt**
   - After logging weave, check tier fit
   - Show suggestion if newly mismatched

3. **Analytics Integration**
   - Track tier suggestion acceptance rate
   - Track which suggestions are dismissed
   - Add tier fit metrics to insights tab

4. **Weekly Reflection Integration**
   - Include tier health in weekly reflection
   - Prompt for rebalancing if health < 6/10

**Deliverable:** App proactively helps users rebalance tiers at the right moments.

---

### Phase 4: Polish & Advanced Features (Week 7-8)
**Goal:** Seasonal adjustments, onboarding, education

#### Tasks:
1. **Seasonal Tier Adjustments**
   - Add `seasonal_adjustment` boolean to Friend model
   - Temporarily reduce decay without changing tier label
   - Auto-prompt to make permanent after 3 months

2. **Improved Onboarding**
   - Update FriendForm to ask frequency first
   - Auto-suggest tier based on frequency
   - Educational tooltips

3. **Tier Intelligence Onboarding**
   - First-time user education
   - Explain what tier fit means
   - Show example before/after

4. **Polish & Edge Cases**
   - Handle new friends (no pattern yet)
   - Handle dormant friends
   - Smooth animations for tier changes
   - Haptic feedback

**Deliverable:** Complete, polished tier intelligence system with seasonal flexibility.

---

## Success Metrics

### Primary Metrics
1. **Reduced stress** - % of friends in "red" zone (target: -30%)
2. **Tier accuracy** - Average network health score (target: 8+/10)
3. **Engagement** - % of tier suggestions accepted (target: >40%)

### Secondary Metrics
4. **User satisfaction** - Feedback on tier suggestions
5. **Retention** - Reduced churn due to "always red" frustration
6. **Data quality** - More friends with sufficient interaction history

### Analytics Events
```typescript
// Track these events
'tier_intelligence_viewed'
'tier_suggestion_shown'
'tier_suggestion_accepted'
'tier_suggestion_dismissed'
'tier_changed_manually'
'network_balance_viewed'
'flexibility_mode_changed'
```

---

## Technical Considerations

### Performance
- **Tier fit calculations** should be cached (recalculate only when interactions logged)
- **Network analysis** is expensive - run in background, cache for 24 hours
- Use React Query for caching network health data

### Edge Cases
1. **New friends** - Don't show tier fit until 5+ interactions
2. **Dormant friends** - Exclude from network health calculations
3. **Rapid tier changes** - Prevent suggestion spam (max 1 suggestion per friend per 30 days)
4. **User overrides** - If user dismisses suggestion, don't show again for that friend for 90 days

### Backwards Compatibility
- Existing friends without `typicalIntervalDays` → Use tier defaults
- Users who disable tier intelligence → Fall back to fixed decay rates
- No breaking changes to existing decay system

### Testing Strategy
- **Unit tests:** Flexible decay calculations, tier fit scoring
- **Integration tests:** Decay + tier fit working together
- **E2E tests:** User accepts tier suggestion, sees updated decay
- **A/B test:** Gradual rollout to 50% of users first

---

## Open Questions

1. **Should tier changes trigger notifications?**
   - Pro: User knows something changed
   - Con: Could feel automated/loss of control
   - Proposal: Only show in-app, not push notification

2. **How aggressive should suggestions be?**
   - Current proposal: Show after 5+ interactions with clear mismatch
   - Alternative: Wait for 10+ interactions to be more confident
   - Decision: Start conservative (10+), tune based on acceptance rates

3. **Should we ever auto-change tiers?**
   - Current proposal: Always require user confirmation
   - Alternative: Experimental opt-in "auto-balance" mode
   - Decision: Phase 4 feature, opt-in only

4. **What happens to achievements/badges when tier changes?**
   - If user moves friend down, do they lose progress?
   - Proposal: Keep historical data, but base new expectations on new tier

---

## Appendix

### Visual Design System

**Colors:**
- Tier fit: Great = green-50, Good = neutral, Mismatch = amber-100
- Network health: 8-10 = green, 5-7 = yellow, 0-4 = red

**Icons:**
- Tier fit indicator: 💡 (insight), ⚠️ (warning), ✓ (good fit)
- Network balance: 🎯 (target), ⚖️ (balance)

### Terminology

- **Tier fit** - How well actual patterns match tier expectations
- **Network health** - Overall score of tier accuracy across all friends
- **Flexible decay** - Personalized decay rate per friend
- **Rhythm** - Average interaction frequency
- **Seasonal adjustment** - Temporary tier flexibility

---

## References

- Dunbar's Number: [Wikipedia](https://en.wikipedia.org/wiki/Dunbar%27s_number)
- Existing decay system: `src/modules/intelligence/services/decay.service.ts`
- Pattern detection: `src/modules/insights/services/pattern-detection.service.ts`
- Friend model: `src/db/models/Friend.ts`

---

**Document Status:** Ready for review and implementation
**Next Steps:** Review with team → Approve Phase 1 → Begin implementation
