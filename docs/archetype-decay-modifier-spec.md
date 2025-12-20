# Archetype-Aligned Decay Modifier Specification

## Overview

This document specifies two new features:

1. **Archetype-modified decay rates** - Decay rates reflect how different friendship archetypes actually work. Some friendships tolerate long gaps, others need regular contact.

2. **Decay zones** - Decay slows as scores get lower. Friendships "settle" into dormancy rather than dying completely. This prevents the demoralising experience of watching scores tick toward zero.

**Design principles:**
- Modifiers can only *reduce* decay, never increase it beyond 1.0x
- The app should reward attunement to different friendship styles, not punish users
- Friendships don't die, they go dormant - there's always something to rekindle

---

## Data Structure

Add the following configuration to the scoring constants file (likely `scoringConstants.ts` or similar):

```typescript
export interface ArchetypeDecayConfig {
  /** Multiplier on base tier decay rate (0.5 - 1.0, never above 1.0) */
  modifier: number;
  /** Days after last interaction before decay begins */
  graceDays: number;
}

export const ArchetypeDecayConfigs: Record<Archetype, ArchetypeDecayConfig> = {
  Hermit:        { modifier: 0.5, graceDays: 21 },
  HighPriestess: { modifier: 0.7, graceDays: 14 },
  Magician:      { modifier: 0.8, graceDays: 10 },
  Fool:          { modifier: 0.8, graceDays: 14 },
  Empress:       { modifier: 0.9, graceDays: 7 },
  Emperor:       { modifier: 1.0, graceDays: 5 },
  Lovers:        { modifier: 1.0, graceDays: 5 },
  Sun:           { modifier: 1.0, graceDays: 5 },
  Unknown:       { modifier: 1.0, graceDays: 7 },
};
```

### Decay Zones

Decay zones slow decay as scores get lower. This prevents scores from racing to zero and matches the emotional reality - a low-score friendship isn't actively dying, it's resting.

```typescript
export interface DecayZone {
  /** Score must be >= this threshold to be in this zone */
  threshold: number;
  /** Multiplier applied to decay rate in this zone */
  modifier: number;
}

export const DecayZones: DecayZone[] = [
  { threshold: 50, modifier: 1.0 },   // 50+: Full decay (coasting territory)
  { threshold: 30, modifier: 0.7 },   // 30-49: 70% decay (slowing down)
  { threshold: 15, modifier: 0.4 },   // 15-29: 40% decay (crawling)
  { threshold: 0,  modifier: 0.15 },  // 0-14: 15% decay (nearly stopped, dormant)
];

/**
 * Get the decay zone modifier for a given score.
 * Zones are checked in order - first matching zone wins.
 */
export function getDecayZoneModifier(currentScore: number): number {
  for (const zone of DecayZones) {
    if (currentScore >= zone.threshold) {
      return zone.modifier;
    }
  }
  return 0.15; // Fallback to minimum decay
}
```

**Zone behaviour:**

| Score Range | Zone Modifier | Meaning |
|-------------|---------------|---------|
| 50+ | 1.0x (full) | Healthy territory - normal decay pressure |
| 30-49 | 0.7x | Drifting - decay slows, gentle nudge to reconnect |
| 15-29 | 0.4x | Low - decay crawls, friendship is cooling |
| 0-14 | 0.15x | Dormant - almost no decay, friendship is resting |

---

## Decay Calculation Logic

### Current Logic (Before)

```typescript
// Current: flat decay based on tier only
const dailyDecay = TierDecayRates[friend.tier];
const decayAmount = dailyDecay * daysSinceLastDecayCalculation;
newScore = currentScore - decayAmount;
```

### New Logic (After)

The new decay calculation applies three modifiers in sequence:

1. **Archetype modifier** - Based on friend's archetype (0.5x - 1.0x)
2. **Grace period** - No decay if within archetype's grace window
3. **Zone modifier** - Based on current score (0.15x - 1.0x)

```typescript
function calculateDecay(
  friend: Friend,
  currentScore: number,
  daysSinceLastInteraction: number,
  daysSinceLastDecayCalculation: number
): number {
  const baseDecayRate = TierDecayRates[friend.tier];
  const archetypeConfig = ArchetypeDecayConfigs[friend.archetype] ?? ArchetypeDecayConfigs.Unknown;
  
  // 1. Grace period check: no decay if within grace window
  if (daysSinceLastInteraction < archetypeConfig.graceDays) {
    return 0;
  }
  
  // 2. Apply archetype modifier (capped at 1.0 - never increases decay)
  const archetypeModifier = Math.min(archetypeConfig.modifier, 1.0);
  
  // 3. Apply decay zone modifier based on current score
  const zoneModifier = getDecayZoneModifier(currentScore);
  
  // 4. Calculate final decay rate
  const effectiveDecayRate = baseDecayRate * archetypeModifier * zoneModifier;
  
  // 5. Return decay amount (never negative, never below 0)
  const decayAmount = effectiveDecayRate * daysSinceLastDecayCalculation;
  return Math.max(0, Math.min(decayAmount, currentScore)); // Can't decay below 0
}

/**
 * Apply decay to a friend's score.
 * Returns the new score after decay.
 */
function applyDecay(
  friend: Friend,
  currentScore: number,
  daysSinceLastInteraction: number,
  daysSinceLastDecayCalculation: number
): number {
  const decayAmount = calculateDecay(
    friend,
    currentScore,
    daysSinceLastInteraction,
    daysSinceLastDecayCalculation
  );
  return Math.max(0, currentScore - decayAmount);
}
```

### Decay Modifier Stack Example

For a **Hermit** friend in **Close Friends** tier with a current score of **25**:

```
Base decay rate:     1.5 pts/day (Close Friends tier)
× Archetype mod:     0.5 (Hermit)
× Zone mod:          0.4 (score 25 is in 15-29 zone)
= Effective rate:    0.3 pts/day
```

That friend loses 0.3 points per day instead of 1.5. They'll settle into dormancy around 10-15 points and just... wait. Which is exactly what a Hermit would do.
```

### Edge Cases

1. **New friend (no interactions yet):** Use `Unknown` config until first interaction logged
2. **Archetype changed:** Apply new archetype's config immediately from next decay calculation
3. **Grace period resets:** Every logged interaction resets the grace period timer
4. **Multiple interactions in grace period:** Grace period resets to full duration on each interaction

---

## Integration Points

### 1. Decay Service / Scheduled Job

Wherever daily decay is calculated, update to use the new `calculateDecay` function. This likely lives in a background job or service that runs periodically.

**Required data per friend:**
- `friend.tier` (existing)
- `friend.archetype` (existing)
- `daysSinceLastInteraction` (may need to compute from last interaction timestamp)

### 2. Friend Model

Ensure the friend model exposes:
- `archetype: Archetype`
- `lastInteractionDate: Date` (or ability to derive this from interactions)

### 3. Score Display (Optional Enhancement)

Consider showing users why certain friends decay slower. On the friend profile, could add subtle copy like:

> "Hermit friendships are patient - they don't need constant contact to stay strong."

This is optional for v1 but reinforces the archetype system.

---

## Example Scenarios

### Scenario A: Hermit in Close Friends Tier (High Score)

- **Current score:** 70
- **Base decay:** 1.5 pts/day (Close Friends tier)
- **Archetype config:** `{ modifier: 0.5, graceDays: 21 }`
- **Last interaction:** 25 days ago

**Calculation:**
1. Days since interaction (25) > grace period (21) → decay applies
2. Archetype modifier: 0.5
3. Zone modifier: 1.0 (score 70 is in 50+ zone)
4. Effective decay rate: 1.5 × 0.5 × 1.0 = **0.75 pts/day**
5. After 4 days of active decay: 0.75 × 4 = **3 pts lost**

Without modifiers: 1.5 × 4 = 6 pts lost

---

### Scenario B: Hermit in Close Friends Tier (Low Score)

- **Current score:** 25
- **Base decay:** 1.5 pts/day (Close Friends tier)
- **Archetype config:** `{ modifier: 0.5, graceDays: 21 }`
- **Last interaction:** 60 days ago

**Calculation:**
1. Days since interaction (60) > grace period (21) → decay applies
2. Archetype modifier: 0.5
3. Zone modifier: 0.4 (score 25 is in 15-29 zone)
4. Effective decay rate: 1.5 × 0.5 × 0.4 = **0.3 pts/day**
5. Per day decay: **0.3 pts**

Without modifiers: 1.5 pts/day (5x higher!)

This friend will slowly drift toward ~10 points and essentially stop there.

---

### Scenario C: Emperor in Inner Circle Tier (High Score)

- **Current score:** 80
- **Base decay:** 2.5 pts/day (Inner Circle tier)
- **Archetype config:** `{ modifier: 1.0, graceDays: 5 }`
- **Last interaction:** 14 days ago

**Calculation:**
1. Days since interaction (14) > grace period (5) → decay applies
2. Archetype modifier: 1.0
3. Zone modifier: 1.0 (score 80 is in 50+ zone)
4. Effective decay rate: 2.5 × 1.0 × 1.0 = **2.5 pts/day**
5. After 9 days of active decay: 2.5 × 9 = **22.5 pts lost**

Emperor friends at high scores decay at full speed - they expect regular contact.

---

### Scenario D: Emperor in Inner Circle Tier (Low Score)

- **Current score:** 20
- **Base decay:** 2.5 pts/day (Inner Circle tier)
- **Archetype config:** `{ modifier: 1.0, graceDays: 5 }`
- **Last interaction:** 30 days ago

**Calculation:**
1. Days since interaction (30) > grace period (5) → decay applies
2. Archetype modifier: 1.0
3. Zone modifier: 0.4 (score 20 is in 15-29 zone)
4. Effective decay rate: 2.5 × 1.0 × 0.4 = **1.0 pts/day**

Even Emperor friends slow down as they approach dormancy. The zone modifier provides mercy.

---

### Scenario E: High Priestess in Community Tier (Within Grace)

- **Current score:** 45
- **Base decay:** 0.3 pts/day (Community tier)
- **Archetype config:** `{ modifier: 0.7, graceDays: 14 }`
- **Last interaction:** 10 days ago

**Calculation:**
1. Days since interaction (10) < grace period (14) → **no decay**
2. Total decay: **0 pts**

---

### Scenario F: Long-Term Dormant Friend

- **Current score:** 8
- **Base decay:** 1.5 pts/day (Close Friends tier)
- **Archetype:** Sun `{ modifier: 1.0, graceDays: 5 }`
- **Last interaction:** 90 days ago

**Calculation:**
1. Days since interaction (90) > grace period (5) → decay applies
2. Archetype modifier: 1.0
3. Zone modifier: 0.15 (score 8 is in 0-14 zone)
4. Effective decay rate: 1.5 × 1.0 × 0.15 = **0.225 pts/day**

Even a Sun friend (no archetype discount) barely decays at this level. At 0.225 pts/day, it would take ~35 more days to lose those last 8 points. The friendship is dormant, not dead.

---

## Summary Table

| Archetype | Grace Period | Decay Modifier | Philosophy |
|-----------|--------------|----------------|------------|
| Hermit | 21 days | 0.5x | "We're good. Reach out when you're ready." |
| High Priestess | 14 days | 0.7x | "I'm here when you need depth." |
| Magician | 10 days | 0.8x | "Let's make something when the time is right." |
| Fool | 14 days | 0.8x | "Time is fake anyway, let's do something fun." |
| Empress | 7 days | 0.9x | "I love having you around, but I'm not counting." |
| Emperor | 5 days | 1.0x | "I value consistency. Let's stay in rhythm." |
| Lovers | 5 days | 1.0x | "I notice when we're connected. Stay close." |
| Sun | 5 days | 1.0x | "Let's keep the energy going." |
| Unknown | 7 days | 1.0x | Default baseline |

---

## Testing Checklist

### Archetype Modifiers
- [ ] Hermit friends decay at 50% rate after 21-day grace period
- [ ] Emperor friends decay at full rate after 5-day grace period
- [ ] No friend ever decays faster than base tier rate (modifier capped at 1.0)
- [ ] Grace period resets when new interaction is logged
- [ ] Unknown archetype uses default config
- [ ] Archetype change applies new config on next decay calculation
- [ ] Friends within grace period show 0 decay

### Decay Zones
- [ ] Score 50+ decays at 100% of calculated rate
- [ ] Score 30-49 decays at 70% of calculated rate
- [ ] Score 15-29 decays at 40% of calculated rate
- [ ] Score 0-14 decays at 15% of calculated rate
- [ ] Score never goes below 0
- [ ] Zone modifier stacks correctly with archetype modifier

### Combined Scenarios
- [ ] Hermit at score 20: effective rate = base × 0.5 × 0.4 = 0.2x
- [ ] Emperor at score 20: effective rate = base × 1.0 × 0.4 = 0.4x
- [ ] Any friend at score 5: decays at max 15% regardless of archetype
- [ ] Grace period still applies even at low scores (no decay during grace)

---

## Files Likely Affected

1. `scoringConstants.ts` - Add `ArchetypeDecayConfigs`, `DecayZones`, and `getDecayZoneModifier()`
2. `decayService.ts` (or equivalent) - Update decay calculation logic to use new function
3. `friend.ts` (model) - Ensure `lastInteractionDate` is accessible
4. Tests - Add unit tests for new decay scenarios

---

## Summary: The Full Decay Stack

```
Final Decay = Base Tier Rate × Archetype Modifier × Zone Modifier

Where:
- Base Tier Rate: 2.5 (Inner Circle), 1.5 (Close Friends), 0.3 (Community)
- Archetype Modifier: 0.5 - 1.0 (based on friend's archetype)
- Zone Modifier: 0.15 - 1.0 (based on current score)
- Grace Period: If days since interaction < archetype grace days, decay = 0
```

**Result:** High-scoring, high-maintenance friendships decay quickly. Low-scoring friendships from patient archetypes barely decay at all. Friendships settle into dormancy rather than dying.
