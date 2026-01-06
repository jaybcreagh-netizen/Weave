# Oracle Insights Redesign Plan

## Overview

This document outlines a holistic redesign of the Oracle Insights system to address three core issues:
1. **Too heavy in UI** - Elaborate cards with gradients, blurs, and animations
2. **Repetitive & not insightful** - Template-based generation, no cross-signal synthesis
3. **Too frequent** - Daily generation creates fatigue

**New Philosophy:** Insights should feel like a **thoughtful biweekly letter** from a friend who knows your social patterns deeply, not a notification feed.

---

## Current State

### Generation
- **Trigger**: Daily on app foreground (5s delay) + after each weave logged
- **Processing**: Only 1 insight generated per cycle
- **Types**: 8 template-based signal types (drifting, deepening, one_sided, etc.)
- **Expiry**: 48 hours

### UI
- Heavy cards with LinearGradient, BlurView, shadows, animations
- "ORACLE INSIGHT" badge feels corporate/notification-like
- Carousel of up to 3 cards takes significant screen space

### Settings
- Master toggle for all insights
- Individual rule toggles
- Tone preference (grounded, warm, playful, poetic)
- No frequency control

---

## Proposed Changes

### 1. Lighter UI (Option B)

**From:** Elaborate gradient cards with badges
**To:** Simple, inline observations that feel like thoughtful notes

```
CURRENT:
┌─────────────────────────────────────┐
│ ✨ ORACLE INSIGHT              [X] │
│ ─────────────────────────────────── │
│ Your hangout Habit                  │
│ Your 'hangout' routine, at 7 times  │
│ this month, provides a consistent   │
│ social connection.                  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Plan again                   →  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

PROPOSED:
┌─────────────────────────────────────┐
│ Something I noticed...              │
│                                     │
│ Your coffee catch-ups with Sarah    │
│ have become a weekly rhythm (7 this │
│ month). These 1:1 moments seem to   │
│ energize you both.                  │
│                                     │
│ [Dismiss]  [Reflect with Oracle]    │
└─────────────────────────────────────┘
```

**UI Changes:**
- Remove LinearGradient, BlurView, shadows
- Simple card with subtle border
- Remove "ORACLE INSIGHT" badge - use conversational opener instead
- Smaller, inline action buttons (text links vs pill buttons)
- Single insight at a time (no carousel)

**File Changes:**
- `src/modules/oracle/components/OracleInsightCard.tsx` - Simplify completely
- `src/modules/oracle/components/InsightsCarousel.tsx` - Replace with single insight display

---

### 2. Smarter Cross-Signal Synthesis (Option C)

**From:** 8 separate template-based signals
**To:** LLM synthesizes multiple signals into one cohesive narrative

**Current Signal Types:**
```typescript
// Each generates a separate insight
'drifting'        → "Drifting from Sarah"
'deepening'       → "Deepening with Mike"
'one_sided'       → "One-sided with Lisa"
'activity_habit'  → "Your coffee routine"
'location_pattern'→ "Your Central Park spot"
'vibe_trend'      → "High energy lately"
```

**New Approach:**
```typescript
// Collect ALL signals, pass to LLM for synthesis
{
  signals: [
    { type: 'deepening', friend: 'Sarah', data: {...} },
    { type: 'activity_habit', activity: 'coffee', count: 7 },
    { type: 'vibe_trend', trend: 'high_energy' }
  ],
  recentContext: {
    journalMentions: ['work stress', 'vacation planning'],
    socialBattery: { average: 3.2, trend: 'rising' }
  }
}

// LLM synthesizes into ONE insight:
"Your friendship with Sarah has found its rhythm. Those 7 coffee
catch-ups this month aren't just habit - they've coincided with
your rising energy levels. As you've navigated work stress, these
moments of connection seem to be recharging you."
```

**New Generation Flow:**
```
1. Collect ALL signals (don't filter to top 1)
2. Group by theme:
   - Relationship momentum (drifting, deepening, one_sided)
   - Social patterns (activity, location, vibe)
   - Life context (journal signals, battery trends)
3. Pass grouped signals to LLM with full context
4. LLM generates 1-2 synthesized insights
5. Store with grounding data for transparency
```

**File Changes:**
- `src/modules/oracle/services/insight-generator.ts` - Collect signals without filtering
- `src/modules/oracle/services/oracle-service.ts` - New `synthesizeInsights()` method
- `src/shared/services/llm/prompt-registry.ts` - New synthesis prompt

**New Prompt Strategy:**
```typescript
const SYNTHESIS_PROMPT = `
You are analyzing patterns in someone's social life. Given the following signals,
write a single, insightful observation that:
1. Connects multiple data points into one narrative
2. Focuses on the "why" or "what it means" rather than just the "what"
3. Is specific to this person's unique patterns
4. Feels like a thoughtful friend's observation, not a dashboard metric
5. Is 2-3 sentences maximum

Signals: {signals}
Recent journal context: {journalContext}
Social battery trend: {batteryTrend}
User's preferred tone: {tone}

Write one synthesized insight:
`
```

---

### 3. User-Controlled Cadence (Option D)

**Add frequency setting to OracleInsightSettings:**

```typescript
const FREQUENCY_OPTIONS = [
  { id: 'weekly', label: 'Weekly', description: 'One insight each week' },
  { id: 'biweekly', label: 'Biweekly', description: 'One insight every two weeks (recommended)' },
  { id: 'monthly', label: 'Monthly', description: 'One insight per month' },
  { id: 'on_demand', label: 'Only when I ask', description: 'No proactive insights' },
]
```

**File Changes:**
- `src/modules/oracle/components/OracleInsightSettings.tsx` - Add frequency picker
- `src/db/models/UserProfile.ts` - Add `insightFrequency` field
- `src/db/schema.ts` - Add column to user_profile table
- `src/modules/oracle/services/insight-generator.ts` - Respect frequency setting

**Schema Change:**
```typescript
// user_profile table
insight_frequency: { type: 'string', isOptional: true } // 'weekly' | 'biweekly' | 'monthly' | 'on_demand'
```

---

### 4. Biweekly Generation with Multiple Signals

**Current:**
- Generate daily on every app open
- Process only 1 signal
- 48-hour expiry creates churn

**Proposed:**
- Generate on configurable cadence (default: biweekly)
- Synthesize ALL relevant signals into 1-2 insights
- 14-day expiry (matches cadence)
- No generation on every app open - use scheduled approach

**Generation Logic:**
```typescript
async function shouldGenerateInsights(userProfile: UserProfile): Promise<boolean> {
  const frequency = userProfile.insightFrequency || 'biweekly'
  if (frequency === 'on_demand') return false

  const lastGenerated = await getLastInsightGeneratedAt()
  if (!lastGenerated) return true

  const daysSince = getDaysSince(lastGenerated)

  switch (frequency) {
    case 'weekly': return daysSince >= 7
    case 'biweekly': return daysSince >= 14
    case 'monthly': return daysSince >= 30
    default: return false
  }
}
```

**File Changes:**
- `src/shared/components/DataInitializer.tsx` - Change trigger logic
- `src/modules/oracle/services/insight-generator.ts` - Add cadence check

---

## Implementation Plan

### Phase 1: Frequency Control & Cadence (Low risk)
1. Add `insight_frequency` to UserProfile schema
2. Add frequency picker to OracleInsightSettings
3. Change generation trigger from "daily" to "cadence-based"
4. Default to biweekly

### Phase 2: Lighter UI (Medium risk)
1. Create new simplified `OracleInsightCardV2` component
2. Replace gradient/blur with simple card style
3. Change "ORACLE INSIGHT" badge to conversational opener
4. Replace carousel with single insight display
5. A/B test or feature flag for rollback

### Phase 3: Cross-Signal Synthesis (Higher complexity)
1. Modify `generateDailyInsights()` to collect all signals
2. Create new `synthesizeInsights()` method in oracle-service
3. Add synthesis prompt to prompt-registry
4. Update insight storage to include grounding data
5. Test extensively for quality

### Phase 4: Polish & Iterate
1. Tune synthesis prompts based on user feedback
2. Add "This insight was generated from: X, Y, Z" transparency
3. Consider adding "snooze this type" functionality
4. Monitor engagement metrics

---

## Database Changes

```typescript
// New column in user_profile
{
  name: 'insight_frequency',
  type: 'string',
  isOptional: true,
  // Values: 'weekly' | 'biweekly' | 'monthly' | 'on_demand'
  // Default: 'biweekly'
}

// New column in proactive_insights (optional - for synthesis tracking)
{
  name: 'source_signals_json',
  type: 'string',
  isOptional: true,
  // Stores the raw signals that were synthesized into this insight
}
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Insights dismissed without action | ~60%? | <30% |
| "Not helpful" feedback rate | Unknown | <10% |
| Insights acted upon | Unknown | >40% |
| User complaints about frequency | Common | Rare |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Synthesis produces lower quality | Keep template fallback, monitor quality |
| Users miss daily insights | Communicate change, offer weekly option |
| LLM costs increase | Synthesis is less frequent, may offset |
| Breaking existing insights | Feature flag for gradual rollout |

---

## Files to Modify

### Core Logic
- [ ] `src/modules/oracle/services/insight-generator.ts` - Cadence + synthesis
- [ ] `src/modules/oracle/services/oracle-service.ts` - New synthesis method
- [ ] `src/shared/services/llm/prompt-registry.ts` - Synthesis prompt

### UI Components
- [ ] `src/modules/oracle/components/OracleInsightCard.tsx` - Simplify
- [ ] `src/modules/oracle/components/InsightsCarousel.tsx` - Single insight
- [ ] `src/modules/oracle/components/OracleInsightSettings.tsx` - Frequency picker

### Data Layer
- [ ] `src/db/models/UserProfile.ts` - Add field
- [ ] `src/db/schema.ts` - Add column
- [ ] `src/db/migrations.ts` - Migration for new column

### Triggers
- [ ] `src/shared/components/DataInitializer.tsx` - Change trigger logic

---

## Open Questions

1. Should we show "last generated X days ago" in settings?
2. Should synthesis include friend names or keep them abstract?
3. Do we need "Why am I seeing this?" transparency button?
4. Should the conversational opener vary ("I noticed...", "Something interesting...", etc.)?
