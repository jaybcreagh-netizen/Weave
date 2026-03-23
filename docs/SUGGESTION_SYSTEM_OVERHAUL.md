# Focus Intelligence Overhaul: From Suggestion Lists to Trusted Opportunities

## Document Metadata

| Property | Value |
|---|---|
| **Purpose** | Redesign the suggestion/notification pipeline into a unified opportunity system: friend-first candidate generation → context-first scoring → one trusted "best next move" |
| **Status** | Draft - Design Discussion |
| **Last Updated** | March 23, 2026 |
| **Owner** | Product + Engineering |
| **References** | `docs/weave-notification-roadmap.md`, `docs/PERFORMANCE_AUDIT_SUGGESTIONS.md`, `docs/RELATIONSHIP_INTELLIGENCE_DESIGN.md` |
| **Scope** | Opportunity generation, scoring/selection, notification integration, copy generation (free + premium tiers) |

---

## Table of Contents

- [Part 1: Vision & Problem Statement](#part-1-vision--problem-statement)
- [Part 2: Design Principles](#part-2-design-principles)
- [Part 3: Current State Assessment](#part-3-current-state-assessment)
- [Part 4: Architecture Overview — Signals, Opportunities, Selection](#part-4-architecture-overview--signals-opportunities-selection)
- [Part 5: The Signals Layer](#part-5-the-signals-layer)
- [Part 6: Opportunity Synthesis](#part-6-opportunity-synthesis)
- [Part 7: The Focus Selector (Hard Suppressors + Weighted Scoring)](#part-7-the-focus-selector)
- [Part 8: Personal Timing System](#part-8-personal-timing-system)
- [Part 9: Calendar & Schedule Integration](#part-9-calendar--schedule-integration)
- [Part 10: Copy Generation (Two-Tier)](#part-10-copy-generation-two-tier)
- [Part 11: UI & Notification Integration](#part-11-ui--notification-integration)
- [Part 12: Schema & Data Changes](#part-12-schema--data-changes)
- [Part 13: Phased Implementation Roadmap](#part-13-phased-implementation-roadmap)
- [Part 14: Success Metrics](#part-14-success-metrics)
- [Part 15: Risks & Mitigations](#part-15-risks--mitigations)
- [Part 16: Open Questions](#part-16-open-questions)

---

## Part 1: Vision & Problem Statement

### The Core Problem

Weave's suggestion engine is individually smart but collectively blind. It knows everything about each friend in isolation — decay rates, archetype preferences, reciprocity imbalances, interaction quality — but it never steps back and asks: "Given everything happening in this user's life right now, what is the ONE thing that actually matters today?"

The result is a system that always has something to show. Five suggestions, sorted by urgency, refreshed daily. Users quickly learn that "5 suggestions" means "0 suggestions" — the same way 50 unread emails from marketing lists means 0 emails. The signal drowns in its own noise.

### What Users Actually Want

Users don't want a list to manage. They want a quiet system that speaks up when it matters:

- **"Don't forget — Isaac's birthday is Thursday."** (Life event, time-sensitive, no ambiguity)
- **"You saw Sarah and Marcus this week but haven't heard from Anna in 3 weeks. Your Saturday looks open."** (Cross-friend awareness, calendar context, specific timing)
- **"Last time you went cycling with Anna you had a great time — want to do it again?"** (Activity recall, emotional context, specific suggestion)
- **Nothing today. Your relationships are in good shape.** (Silence as a feature)

This requires three fundamental shifts:

| From | To |
|------|-----|
| Friend-first generation ("run each friend through the waterfall") | Friend-first generation → context-first selection ("generate candidates per-friend, then choose the best one for right now") |
| Always show N suggestions | Show 1 primary opportunity (+ optional secondary) when conditions align, 0 when they don't |
| Generic templated copy | Specific, personal copy that references real history, with an explanation of "why now" |

### What This Document Covers

A redesign of the suggestion pipeline into a unified opportunity system with four layers:

1. **Signals** — The raw inputs: relationship health, calendar, plans, intentions, battery/season, recent activity, journal threads
2. **Opportunity Synthesis** — The waterfall generators produce normalized candidate opportunities with urgency, effort, confidence, and explanation fields
3. **Focus Selector** — Hard suppressors remove invalid candidates, then weighted scoring ranks the rest to pick the best next move
4. **Presentation** — One primary opportunity (+ optional secondary), with the same surfaced result reused for in-app display and notifications

---

## Part 2: Design Principles

Ordered by priority. When principles conflict, higher-ranked ones win.

### P1: Optimize for Trust, Not Intelligence

The system should feel like it consistently knows when to stay quiet, when to speak up, and why. Users trust a system that's right 80% of the time and silent the rest, over one that's always talking and occasionally insightful. Every surfaced opportunity must have a clear "why now" — if the system can't articulate it, it shouldn't surface it.

### P2: Silence is a Feature

If no opportunity scores above the surfacing threshold, the opportunity section shows "all good" — and that's a positive signal, not an empty state. The Focus tab may still show plans, upcoming dates, intentions, and other non-opportunity content. The system must never manufacture urgency to fill space. The current system is structurally biased against silence via guaranteed suggestions and emergency fallbacks — that bias is what this redesign removes.

### P3: One Best Next Move

One perfectly-timed, well-explained opportunity builds more trust than five ranked items. The system should aim for 1 primary opportunity (+ optional secondary) per day. A single "best next move" is easier to trust and act on than a list that creates decision paralysis.

### P4: Respect the User's Rhythm

Opportunities surface during the user's natural engagement windows, not on a fixed schedule. The system learns when users are receptive and holds opportunities until those moments. An opportunity that arrives during a meeting is worse than no opportunity at all.

### P5: User Intentions Bend the System

If a user explicitly set an intention to reconnect with someone, the system should bend toward that friend — even if inferred intelligence would rank someone else higher. Intentions are the clearest signal of user intent we have. They should be a significant score boost, not just one generator among twelve.

### P6: Specificity Builds Trust

"Plan a hangout with Anna" teaches users to ignore the system. "You and Anna haven't been cycling since that great ride 3 weeks ago" makes users feel understood. Every opportunity should reference something real — a past activity, a time frame, a life event, a pattern — and carry an explanation of why it was surfaced.

### P7: Graceful Degradation

The system has three tiers of intelligence: full context (calendar + LLM + cross-friend), partial context (templates + existing data), and minimal (current system). If calendar permissions are denied, schedule-fit scoring degrades gracefully. If LLM calls fail, template copy shows. The user always gets value.

### P8: Premium Enhances, Never Gates

Free users get the full opportunity intelligence — synthesis, scoring, personal timing, enriched template copy. Premium adds LLM-generated bespoke copy and richer contextual narratives. The decision of "who to surface and when" is never paywalled.

---

## Part 3: Current State Assessment

### What Works Well (Keep)

| Component | Strength |
|-----------|----------|
| **12-generator waterfall** | Comprehensive per-friend reasoning: drift, life events, momentum, reciprocity, maintenance, etc. |
| **Candidate selection quotas** | 20 drifting / 15 active / 15 stale ensures balanced network coverage |
| **Dismissal learning** | 30-day sliding window, friend-level suppression, type-level downgrade |
| **Smart category selection** | Time-of-day + archetype + historical pattern weighting |
| **Social season modulation** | Resting/Balanced/Blooming adjusts suggestion volume and effort level |
| **Suggestion event tracking** | Shown/acted/dismissed/expired events with timing data |
| **Diversification** | Round-robin category buckets prevent echo chamber |

### What's Limited or Missing (Fix)

| Gap | Impact | Current State |
|-----|--------|---------------|
| **No calendar awareness in suggestions** | Can't say "your weekend is free" or avoid suggesting when booked | Event scanner exists (`event-scanner.ts`) but is disconnected from the suggestion pipeline — it only feeds reflection and the `EventSuggestionModal` |
| **Limited cross-friend coordination** | Can't holistically reason about "you saw 3 Inner Circle friends, shift to Community" | Portfolio analysis (`portfolio.service.ts`) and `SignalDrivenGenerator` provide some network-level reasoning, but the main waterfall processes each friend in isolation without access to this week's weave distribution |
| **No social load balancing** | Could suggest 5 hangouts when user has 3 plans already | No awareness of existing plan density beyond the per-friend 7-day plan check |
| **Inconsistent specificity in copy** | Some generators use contextual hints, most don't | `DriftGenerator` already uses contextual action text and learned-pattern hints (`contextual-utils.ts`), but this is the exception — most generators use generic templates. Concrete interaction facts (last activity, location, vibe) are never used in copy |
| **Always-on suggestions (default: 10)** | 10 suggestions = 0 suggestions (learned helplessness) | `useSuggestions()` requests `prefs.maxDailySuggestions` which defaults to **10** (`notification-store.ts`). Guaranteed suggestions (`suggestion-provider.service.ts:772`) and emergency fallbacks (`:812`) ensure the list is never empty |
| **Smart notifications disabled** | The only proactive channel is off due to guilt-inducing volume | `enabled: false` in config |
| **Timing decisions are fragmented** | Three separate systems make independent timing/filtering decisions with no coordination | Coarse global time buckets (`time-aware-filter.ts`), time-sensitive category defaults (`smart-defaults.service.ts`), and notification-level gating (`smart-suggestions.ts`) all filter independently. The Focus Selector must become the single source of truth and retire or demote these |
| **No "all good" state** | Empty Focus tab feels broken, not peaceful | No design for zero-suggestion state. Today's Focus tab also shows plans, intentions, dates, link requests, and reflection prompts — "all good" should be scoped to the suggestion section, not the entire tab |
| **Friend timing fields unused** | `best_time_of_day`, `best_day_of_week` tracked but ignored by suggestion engine | Data collected, never consumed |
| **Activity detail not in copy** | "Last time you went cycling" is possible but never generated | Interaction model has activity, vibe, location — data exists, systematic use doesn't |

### Key Files (Current System)

| File | Role |
|------|------|
| `src/modules/interactions/services/suggestion-provider.service.ts` | Main orchestrator — generates suggestion list |
| `src/modules/interactions/services/suggestion-engine/index.ts` | Waterfall generator registration |
| `src/modules/interactions/services/suggestion-engine/generators/*.ts` | 12 individual generators |
| `src/modules/interactions/services/suggestion-system/SuggestionDiversifier.ts` | Round-robin diversification |
| `src/modules/interactions/services/suggestion-system/SuggestionCandidateService.ts` | Candidate selection (50 friends) |
| `src/modules/interactions/services/suggestion-system/SuggestionDataLoader.ts` | Batch data loading per candidate |
| `src/modules/interactions/services/smart-defaults.service.ts` | Time/archetype/history category weighting |
| `src/modules/interactions/services/event-scanner.ts` | Calendar scanning (disconnected) |
| `src/modules/interactions/services/suggestion-storage.service.ts` | Dismissal cooldowns (AsyncStorage) |
| `src/modules/interactions/services/suggestion-tracker.service.ts` | Event logging — already tracks shown/acted/dismissed/expired with time-to-action |
| `src/modules/notifications/services/channels/smart-suggestions.ts` | Notification scheduling (disabled) |
| `src/modules/home/components/widgets/widgets/TodaysFocusWidgetV2.tsx` | Focus tab display (includes plans, intentions, dates, suggestions, reflection, rest-day state) |
| `src/modules/home/components/FocusDetailSheet.tsx` | Full focus detail sheet |
| `src/modules/intelligence/services/focus-generator.ts` | Focus data aggregation |
| `src/shared/utils/time-aware-filter.ts` | Coarse global time-bucket filtering (to be replaced by Focus Selector) |
| `src/modules/insights/services/portfolio.service.ts` | Network-level portfolio analysis (existing cross-friend reasoning) |
| `src/modules/interactions/services/suggestion-engine/generators/SignalDrivenGenerator.ts` | Journal-signal-driven suggestions (existing cross-context reasoning) |

---

## Part 4: Architecture Overview — Signals, Opportunities, Selection

### Current Flow (Friend-First, Single-Pass)

```
Pick 50 candidate friends
    → Run each through 12-generator waterfall
    → Collect all suggestions
    → Filter dismissals
    → Diversify (round-robin categories)
    → Add guaranteed/emergency fallbacks (never empty)
    → Sort by urgency
    → Display top N (default: 10)
```

### New Flow (Signals → Opportunities → Selection)

```
┌─────────────────────────────────────────────────────────┐
│                   1. SIGNALS LAYER                       │
│                                                          │
│  Relationship health  ─  Per-friend scores, decay,      │
│                          momentum, reciprocity           │
│  Plans & calendar     ─  Weave plans + device calendar   │
│                          free/busy windows               │
│  Active intentions    ─  User-set goals for friends      │
│  Battery & season     ─  Social energy + social phase    │
│  Recent activity      ─  This week's weaves, tier dist.  │
│  Journal threads      ─  Signals, sentiment, themes      │
│  Life events          ─  Birthdays, anniversaries        │
│                                                          │
│  These are inputs, not decisions. All queryable,         │
│  all cached with known staleness windows.                │
│                                                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│              2. OPPORTUNITY SYNTHESIS                     │
│                                                          │
│  The existing waterfall generators run per-friend,       │
│  but now produce Opportunity objects instead of          │
│  display-ready suggestions.                              │
│                                                          │
│  Each Opportunity carries:                               │
│  - Urgency + confidence + effort level                   │
│  - Explanation: why_now, why_this_friend, why_this_action│
│  - Time relevance (best window, deadline)                │
│  - Copy context (last activity, vibe, location)          │
│  - Active intention reference (if applicable)            │
│                                                          │
│  Produces 10-30 candidates in a local pool.              │
│  Decoupled from display — pool refreshes async.          │
│                                                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                3. FOCUS SELECTOR                          │
│                                                          │
│  Step A: Hard suppressors (binary — remove invalid)      │
│  - Already planned (Weave plan or calendar match)        │
│  - Just interacted (< 3 days unless critical)            │
│  - Dismissed / snoozed (in cooldown)                     │
│  - Expired (past TTL or deadline)                        │
│  - Quiet hours active                                    │
│                                                          │
│  Step B: Weighted scoring (continuous — rank remaining)   │
│  - Urgency signal         (0-30 pts)                     │
│  - Schedule fit           (0-20 pts)                     │
│  - Battery/season fit     (0-15 pts)                     │
│  - Intention alignment    (0-15 pts)                     │
│  - "Why now" strength     (0-10 pts)                     │
│  - Novelty/diversity      (0-5 pts)                      │
│  - Confidence             (0-5 pts)                      │
│                                                          │
│  Step C: Selection                                       │
│  - Primary: highest scoring opportunity                  │
│  - Secondary (optional): different tier/category,        │
│    score ≥ 60% of primary, skip if none qualifies        │
│  - Below threshold: surface nothing ("all good")         │
│                                                          │
│  Output: 0-1-2 Opportunity objects with explanation      │
│                                                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                 4. PRESENTATION                           │
│                                                          │
│  COPY LAYER:                                             │
│  - Free: Enriched templates using explanation fields     │
│  - Premium: LLM-generated via Oracle using full context  │
│  - Template always present as fallback                   │
│                                                          │
│  IN-APP: Focus tab opportunity section                   │
│  - 1 primary (hero card) + optional secondary (compact)  │
│  - "All good" state when nothing surfaces                │
│  - Same result shown regardless of entry point           │
│                                                          │
│  NOTIFICATION: Reuses exact same surfaced result         │
│  - No separate notification logic — if the selector      │
│    surfaced it and it's within a timing window,          │
│    the notification fires with the same copy             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Key Architectural Shifts

| Aspect | Current | New |
|--------|---------|-----|
| **Mental model** | "Suggestions" — a list of things you could do | "Opportunities" — the best next move for your relationships right now |
| **Selection method** | Binary gates + urgency sort + round-robin diversification | Hard suppressors + continuous weighted scoring |
| **Output** | Always N items (default: 10) with guaranteed fallbacks | 1 primary + optional secondary, 0 is valid |
| **Intention awareness** | IntentionGenerator is one of twelve generators | Intentions are a first-class score boost across all opportunities |
| **Explanation** | None — user doesn't know why a suggestion appeared | Every opportunity carries `why_now`, `why_this_friend`, `why_this_action` |
| **Notification logic** | Separate gating in `smart-suggestions.ts` | Reuses selector output — single decision layer |
| **Cross-friend context** | Limited — portfolio analysis and signal-driven generator exist but aren't wired into main loop | `WeeklyContext` feeds the scoring model directly (schedule fit, tier diversity, social load) |
| **Calendar** | Disconnected event scanner | Calendar data feeds schedule-fit scoring + hard suppressor (calendar-matched friends) |
| **Timing decisions** | Fragmented across `time-aware-filter.ts`, `smart-defaults.service.ts`, `smart-suggestions.ts` | Unified in Focus Selector — single source of truth |
| **Feedback** | Passive dismiss with cooldown | Explicit: snooze ("remind me later"), "not now", "not this friend" |

---

## Part 5: The Signals Layer

### Purpose

The signals layer collects and caches all the raw inputs that the opportunity synthesis and scoring model need. These are **facts about the world**, not decisions. Each signal has a known staleness window and refresh trigger.

### Signal Sources

| Signal | Source | Cache TTL | Refresh Trigger |
|--------|--------|-----------|-----------------|
| **Relationship health** | `OrchestratorService.calculateCurrentScore()` per friend — decayed score, momentum, resilience | 4 hours | Weave logged/completed |
| **Plans (Weave)** | Interaction model, status = planned/pending_confirm | Realtime (observable) | Plan created/cancelled/completed |
| **Calendar (device)** | `EventScannerService` — free/busy windows, friend-matched events | 1 hour | App foreground, calendar change |
| **Active intentions** | Intention model — user-set goals for specific friends | Realtime (observable) | Intention created/completed/deleted |
| **Social battery** | Last battery check-in value, or inferred from season | Until next check-in | Battery check-in logged |
| **Social season** | `UserProfile.currentSocialSeason` | Until recalculation | Season service recalc |
| **Weekly activity** | `WeeklyContextService` — completed weaves, plan count, tier distribution, category distribution | 4 hours | Weave logged/completed, plan created |
| **Life events** | Friend model birthday/anniversary + LifeEvent table | Daily | Friend updated, life event created |
| **Journal signals** | Signal extraction results — concern, conflict, celebration, reconnection intent | Per journal entry | Journal entry saved |
| **Dismissal history** | `SuggestionStorageService` + `SuggestionTrackerService` | Realtime | Dismissal/snooze recorded |
| **Interaction detail** | Last 5 interactions per friend — activity, vibe, location, duration | 4 hours (via data loader) | Weave logged/completed |

### CalendarContext (New Service)

```typescript
interface CalendarContext {
  todayEvents: CalendarEvent[];
  tomorrowEvents: CalendarEvent[];
  weekendEvents: CalendarEvent[];
  freeWindows: TimeWindow[];              // Gaps between events, min 1 hour
  busyScore: number;                      // 0 (empty) to 1 (packed) — this week
  friendCalendarEvents: CalendarEvent[];  // Events matching known friends (suppressor input)
}
```

**Source**: `EventScannerService` (already exists, needs connection to pipeline). Merges device calendar events with Weave planned interactions for a unified timeline.

**Calendar permission fallback**: If not granted, `CalendarContext` returns empty device events but still includes Weave plan data. Schedule-fit scoring degrades gracefully — less signal, not no signal.

### WeeklyContext (New Service)

```typescript
interface WeeklyContext {
  completedWeaveThisWeek: { friendId: string; friendName: string; date: Date; category: string }[];
  plansThisWeek: { friendId: string; friendName: string; date: Date; category: string }[];
  tierDistribution: {
    innerCircle: { seen: number; total: number };
    closeFriends: { seen: number; total: number };
    community: { seen: number; total: number };
  };
  categoryDistribution: Record<string, number>;  // category → count this week
  weeklyEffort: number;                           // Sum of estimated durations
  socialMomentum: 'quiet' | 'moderate' | 'active';
}
```

### What Stays vs. What's New

Most signals already exist in the codebase — the signals layer is primarily about **collecting them into a coherent context object** rather than building new intelligence. The key new pieces are `CalendarContextService` (connecting the event scanner) and `WeeklyContextService` (cross-friend aggregation).

---

## Part 6: Opportunity Synthesis

### Purpose

The existing waterfall generators are individually excellent — they encode real domain knowledge about drift thresholds, momentum detection, reciprocity patterns, life events, and more. We keep them, but change what they produce: **Opportunity objects** instead of display-ready suggestions.

### The Opportunity Schema

This is the core data contract of the redesign.

```typescript
interface Opportunity {
  id: string;
  friendId: string;
  friendName: string;
  friendTier: 'innerCircle' | 'closeFriends' | 'community';

  // Generator output
  generatorSource: string;            // Which waterfall generator produced this
  category: SuggestionCategory;       // From canonical enum (see Phase 0 taxonomy)

  // Scoring inputs (set by generator, consumed by selector)
  urgency: number;                    // 0-100, continuous (not enum)
  confidence: number;                 // 0-1, how certain the generator is
  effortLevel: 'minimal' | 'low' | 'medium' | 'high';
  estimatedDuration: number;          // Minutes

  // Time relevance
  timeRelevance: {
    bestWindow: 'morning' | 'midday' | 'afternoon' | 'evening' | 'any';
    deadline?: Date;                  // Hard deadline (birthday, event date)
    optimalDays?: number[];           // 0-6, from friend's best_day_of_week
  };

  // Intention alignment
  intentionId?: string;               // If this opportunity fulfills an active intention
  intentionBoost: number;             // 0 if no intention, significant bonus if aligned

  // Explanation (drives copy, analytics, and future "why am I seeing this?" UI)
  explanation: {
    why_now: string;                  // "Score dropped below 30 (critical drift threshold)"
    why_this_friend: string;          // "Inner circle, 21 days since last interaction"
    why_this_action: string;          // "Cycling is your most effective activity together (35% above avg)"
  };

  // Copy context (for template enrichment + LLM prompts)
  copyContext: {
    daysSinceLastInteraction: number;
    lastActivity?: string;
    lastVibe?: string;
    lastLocation?: string;
    topCategory: string;
    categoryEffectiveness?: number;
    upcomingEvent?: { type: string; date: Date; name: string };
    recentWeavesWith: string[];       // Cross-friend: names seen this week
    weekPlanCount: number;
  };

  // Copy (generated async, not at synthesis time)
  templateCopy?: {
    title: string;
    subtitle: string;
    actionLabel: string;
  };
  bespokeCopy?: {
    title: string;
    subtitle: string;
    actionLabel: string;
    narrative?: string;
    generatedAt: Date;
  };

  // Lifecycle
  createdAt: Date;
  expiresAt: Date;
  contextHash: string;                // Hash of key inputs — detects staleness
  surfacedAt?: Date;
  surfaceCount: number;
}
```

### Key Design Decisions in the Schema

**Urgency is continuous (0-100), not an enum.** The old system used `'critical' | 'high' | 'medium' | 'low'` which forced binary bucket decisions. With continuous urgency, a medium-urgency opportunity with perfect timing can outscore a high-urgency one with poor fit. The selector uses the raw number; the UI can bucket it for display.

**Confidence is separate from urgency.** A drift alert has high urgency but high confidence (the score is objectively low). A journal-signal suggestion ("it sounds like Anna might need support") has medium urgency but lower confidence (sentiment analysis isn't certain). The selector can weight accordingly.

**Explanation is first-class.** Every opportunity must carry `why_now`, `why_this_friend`, and `why_this_action`. These serve three purposes:
1. **Copy generation** — templates and LLM prompts use these to write specific, trustworthy text
2. **Analytics** — we can track which "why" categories drive the highest action rates
3. **Future transparency** — a "Why am I seeing this?" affordance becomes trivial to build

**Intention alignment is a dedicated field, not buried in a generator.** If the user set an intention to reconnect with Anna, every generator that produces an Anna opportunity gets an `intentionBoost`. This means intentions bend the entire system, not just the IntentionGenerator.

### How Generators Change

Generators keep their existing logic but adapt their output:

```typescript
// Before (DriftGenerator example — simplified)
return {
  type: 'reconnect',
  friendId: friend.id,
  title: 'Reconnect with Anna',
  subtitle: 'It's been a while',
  urgency: 'high',
  category: 'drift',
};

// After
return {
  friendId: friend.id,
  generatorSource: 'drift',
  category: 'drift',
  urgency: 75,                        // Continuous: 75/100
  confidence: 0.9,                    // High — score data is reliable
  effortLevel: getSmartEffort(friend),
  estimatedDuration: getSmartDuration(friend),
  timeRelevance: {
    bestWindow: friend.bestTimeOfDay || 'any',
    optimalDays: friend.bestDayOfWeek ? [friend.bestDayOfWeek] : undefined,
  },
  intentionId: matchingIntention?.id,
  intentionBoost: matchingIntention ? 15 : 0,
  explanation: {
    why_now: `Score is ${currentScore} (below ${tierThreshold} threshold for ${friend.tier})`,
    why_this_friend: `${friend.tier}, ${daysSince} days since last interaction`,
    why_this_action: topCategory
      ? `${topCategory} is ${effectivenessPercent}% more effective than average`
      : `Based on ${friend.archetype} archetype preferences`,
  },
  copyContext: { daysSince, lastActivity, lastVibe, lastLocation, ... },
  expiresAt: addHours(now, 48),
};
```

### Opportunity Pool

Opportunities are stored in a **lean local pool** (see Part 12 schema). The pool decouples "what could we surface?" from "what should we surface right now?"

**When it refreshes:**
- On app launch (if stale — more than 4 hours since last refresh)
- After a weave is logged or completed (context changed)
- After a plan is created or cancelled (schedule changed)
- After battery check-in (capacity changed)
- Daily background refresh (if background fetch available)

**TTLs by type:**
- Life event opportunities: TTL = event date (expire after the event)
- Drift opportunities: TTL = 48 hours (re-evaluated frequently)
- Maintenance opportunities: TTL = 7 days
- Momentum/deepen: TTL = 24 hours
- Signal-driven (journal): TTL = 72 hours

**Staleness detection:** Each opportunity carries a `contextHash` — a hash of the key inputs that produced it (friendScore, daysSince, planCount, weekly tier distribution). If the hash changes on next evaluation, the opportunity is stale and re-synthesized.

---

## Part 7: The Focus Selector

### Purpose

The Focus Selector is the **single decision layer** that chooses what to surface. It replaces the current fragmented stack: `SuggestionDiversifier` (round-robin), `time-aware-filter.ts` (coarse time buckets), `smart-defaults.service.ts` (time-of-day gating), and `smart-suggestions.ts` (notification-level gating). One system, one set of rules, one output — reused for both in-app display and notifications.

### Step A: Hard Suppressors

Binary checks that remove opportunities from consideration entirely. These are non-negotiable — no amount of scoring can override them.

| Suppressor | Logic | Source |
|------------|-------|--------|
| **Already planned** | Friend has a Weave plan in next 7 days OR matched on device calendar | Plans query + `CalendarContext.friendCalendarEvents` |
| **Just interacted** | Friend seen in last 3 days, UNLESS urgency > 85 (critical) | `WeeklyContext.completedWeaveThisWeek` |
| **Dismissed / snoozed** | In active cooldown from user action | `SuggestionStorageService` |
| **Expired** | Past TTL or past deadline | `opportunity.expiresAt` |
| **Quiet hours** | Current time is in user's quiet hours | UserProfile or NotificationPreferences |
| **Suppressed friend** | Friend dismissed 3+ times in 30 days (unless urgency > 85) | Dismissal learning profile |

### Step B: Weighted Scoring

Each surviving opportunity gets a composite score from weighted dimensions. The weights are tunable — initial values below, refined via analytics.

```typescript
interface ScoringWeights {
  urgency:            30,   // Relationship health signal (generator's urgency score)
  scheduleFit:        20,   // Does the user have time? Does the window match?
  batterySeasonFit:   15,   // Energy level + social season alignment
  intentionAlignment: 15,   // Does this fulfill a user-set intention?
  whyNowStrength:     10,   // How compelling is the timing? (deadline proximity, etc.)
  noveltyDiversity:    5,   // Different from recent surfaces (tier, category, friend)
  confidence:          5,   // Generator's certainty in this opportunity
}
// Total possible: 100 points
```

#### Dimension Scoring Details

**Urgency (0-30 pts)**
Direct mapping from the generator's continuous urgency score (0-100) to 0-30 range.
```
urgencyPoints = (opportunity.urgency / 100) * 30
```

**Schedule Fit (0-20 pts)**
```
IF no calendar permission:
  base = 10  (neutral — don't penalize for missing data)
ELSE:
  busyPenalty = CalendarContext.busyScore * 10           // 0-10 penalty
  windowMatch = bestWindow matches current/next window ? 5 : 0
  effortFit = freeWindow >= estimatedDuration ? 5 : 0
  base = 20 - busyPenalty + windowMatch + effortFit

IF WeeklyContext.plansThisWeek.length >= 5:
  effortLevel === 'minimal' ? base : base * 0.5          // Heavily penalize non-minimal when loaded

scheduleFitPoints = clamp(base, 0, 20)
```

**Battery/Season Fit (0-15 pts)**
```
IF battery >= 60:
  batteryPoints = 15                                      // Full energy — anything goes
ELSE IF battery >= 30:
  effortLevel === 'high' ? 5 : 15                        // Penalize high-effort
ELSE:
  effortLevel === 'minimal' ? 10 : 2                     // Low battery: only minimal gets decent score

IF season === 'resting' AND category not in ['life-event', 'critical-drift']:
  batteryPoints *= 0.3                                    // Severe penalty in resting season

batterySeasonPoints = clamp(batteryPoints, 0, 15)
```

**Intention Alignment (0-15 pts)**
```
IF opportunity.intentionId exists:
  intentionPoints = 15                                    // Full boost — user explicitly wants this
ELSE IF friend has ANY active intention:
  intentionPoints = 10                                    // Friend has an intention, this opportunity is related
ELSE:
  intentionPoints = 0                                     // No intention signal — neutral, not penalized
```

This is the key change: intentions are a significant score boost that bends the system toward user-expressed goals. A medium-urgency opportunity for a friend the user explicitly wants to reconnect with will often outscore a high-urgency drift alert for someone they haven't set an intention for.

**"Why Now" Strength (0-10 pts)**
```
IF deadline exists AND deadline <= 3 days:
  whyNowPoints = 10                                       // Birthday Thursday = strong why-now
ELSE IF deadline exists AND deadline <= 7 days:
  whyNowPoints = 7
ELSE IF bestWindow matches current window:
  whyNowPoints = 5                                        // Right time of day
ELSE IF momentum score > 15 (hot streak):
  whyNowPoints = 4                                        // Momentum is time-sensitive
ELSE:
  whyNowPoints = 1                                        // Generic — always slightly valid
```

**Novelty/Diversity (0-5 pts)**
```
recentSurfaced = surfaced opportunities in last 48 hours
IF opportunity.friendTier !== any recentSurfaced tier:
  noveltyPoints += 2                                      // Different tier = fresh
IF opportunity.category !== any recentSurfaced category:
  noveltyPoints += 2                                      // Different category = fresh
IF opportunity.friendId not in recentSurfaced:
  noveltyPoints += 1                                      // Different friend

noveltyDiversityPoints = clamp(noveltyPoints, 0, 5)
```

**Confidence (0-5 pts)**
```
confidencePoints = opportunity.confidence * 5             // Direct mapping from 0-1 to 0-5
```

### Step C: Selection

```typescript
function selectOpportunities(
  scored: ScoredOpportunity[],
  config: { minThreshold: number; secondaryRatio: number }
): SelectionResult {
  // Sort descending by total score
  const ranked = scored.sort((a, b) => b.totalScore - a.totalScore);

  // Nothing above threshold → silence
  if (ranked.length === 0 || ranked[0].totalScore < config.minThreshold) {
    return { primary: null, secondary: null, reason: 'below_threshold' };
  }

  const primary = ranked[0];

  // Find secondary: different tier OR category, score >= secondaryRatio of primary
  const secondary = ranked.slice(1).find(opp =>
    (opp.friendTier !== primary.friendTier || opp.category !== primary.category)
    && opp.totalScore >= primary.totalScore * config.secondaryRatio
  ) || null;

  return { primary, secondary, reason: 'selected' };
}
```

**Default config:**
- `minThreshold`: 35 (out of 100) — below this, nothing surfaces
- `secondaryRatio`: 0.6 — secondary must score at least 60% of primary

**Tuning**: These thresholds are the primary lever for controlling how "quiet" vs. "active" the system feels. Start conservative (threshold = 40) and lower based on "All Good" frequency metrics.

### Why This Is Better Than Three Binary Gates

The old gate model had a structural problem: a medium-urgency opportunity with perfect timing (birthday is Thursday, user is free, battery is high) would fail Gate 2 the same way as a low-urgency opportunity with terrible timing. Both would either pass or fail the busy-score check identically.

With weighted scoring:

| Opportunity | Urgency (30) | Schedule (20) | Battery (15) | Intention (15) | Why Now (10) | Novelty (5) | Confidence (5) | **Total** |
|-------------|-------------|---------------|-------------|----------------|-------------|-------------|----------------|-----------|
| Anna cycling, Saturday free, user set intention | 18 (60/100) | 18 (free, window match) | 15 (battery 70) | 15 (active intention) | 5 (window match) | 4 (new tier+category) | 4.5 (0.9) | **79.5** |
| Marcus drifting hard, user packed week | 24 (80/100) | 5 (busy, no window) | 8 (battery 40) | 0 (no intention) | 1 (generic) | 2 (same tier as recent) | 4.5 (0.9) | **44.5** |
| Isaac birthday Thursday | 27 (90/100) | 18 (free, minimal effort) | 15 (any battery) | 0 (no intention) | 10 (deadline 3 days) | 3 (different category) | 5 (1.0) | **78** |

Anna wins as primary (79.5), Isaac is a strong secondary (78) — and Marcus, despite high urgency, scores poorly because the timing is wrong and there's no intention signal. The old gate model would have surfaced Marcus first (highest urgency) and possibly suppressed Isaac entirely if Gate 2 failed.

### Cross-Friend Coordination (Absorbed)

Cross-friend reasoning is now built into the scoring model rather than being a separate post-selection step:

- **Tier rebalancing** → Novelty/Diversity dimension penalizes same-tier repetition
- **Social load cap** → Schedule Fit dimension penalizes when `plansThisWeek >= 5`
- **Recency suppression** → Hard suppressor removes friends seen in last 3 days
- **Variety nudge** → Novelty/Diversity dimension boosts different categories
- **Quiet week detection** → When `socialMomentum === 'quiet'`, the `minThreshold` drops slightly (e.g., 35 → 30) to let medium-urgency opportunities through

### Feedback Actions

The selector's output includes actionable feedback options that teach the system faster than passive dismissal:

| Action | Signal | System Response |
|--------|--------|----------------|
| **Act** (tap CTA) | Strong positive | Record acted event, boost friend/category in future scoring |
| **Snooze** ("remind me later") | Timing was wrong, content was right | Re-queue with snoozed-until timestamp ("later today", "tomorrow", "this weekend") |
| **Not now** | Mild negative | Standard cooldown (type-based, existing system) |
| **Not this friend** | Strong negative for this friend | 30-day suppression for this friend (existing dismissal learning) |

"Less like this" and "too much effort today" are deferred — start with these four and see if implicit scoring adjustment is sufficient before adding more affordances.

---

## Part 8: Personal Timing System

### The Problem

Currently, opportunities surface whenever the user opens the Focus tab. Notifications (when enabled) fire on a fixed schedule. Neither adapts to the user's personal rhythm.

### Hybrid Approach: Set + Learn

#### Phase 1: User-Set Windows (Immediate)

During onboarding (or in settings), users pick their preferred suggestion windows:

```
"When would you like to hear from Weave?"

☐ Morning       (7am - 10am)     "Start your day with connection"
☐ Midday        (11am - 2pm)     "Lunchtime nudges"
☐ Afternoon     (2pm - 6pm)      "Afternoon check-in"
☐ Evening       (6pm - 9pm)      "Wind down with intention"

Default: Morning + Evening (most users' natural app usage)
```

This immediately:
- Gates when notifications can fire
- Influences which suggestions surface (morning = quick/easy, evening = reflective/planning)
- Sets quiet hours outside selected windows for notification purposes

#### Phase 2: Learned Timing (Adaptive, Background)

Track engagement signals and build a personal timing profile:

```typescript
interface PersonalTimingProfile {
  // Learned from behavior (rolling 30-day window)
  appOpenTimes: { hour: number; dayOfWeek: number; count: number }[];
  suggestionActedTimes: { hour: number; dayOfWeek: number; count: number }[];
  suggestionIgnoredTimes: { hour: number; dayOfWeek: number; count: number }[];

  // Computed
  peakEngagementWindows: TimeWindow[];    // Hours with highest act/shown ratio
  deadZones: TimeWindow[];               // Hours with high ignore rate
  weekdayPattern: TimeWindow[];          // Typical weekday windows
  weekendPattern: TimeWindow[];          // Typical weekend windows (often different)
}
```

**Data collection**: Minimal — timestamp when user opens app, timestamp when user acts on or dismisses a suggestion. Suggestion act/dismiss timestamps are already tracked in `suggestion_events` (`suggestion-tracker.service.ts`), but **app-open timing is not currently instrumented** and must be added. This is a prerequisite for learned timing and also for notification criterion 4 (suppress notification if user opened app recently).

**Profile computation**: Weekly recalculation, lightweight — group timestamps by hour/day, compute act/ignore ratio per window.

#### Phase 3: Hybrid Merge

After 2-4 weeks of data:

```
effectiveWindows = userSetWindows ∩ learnedPeakWindows
```

If learned windows diverge significantly from user-set windows, surface a gentle prompt:

> "I've noticed you tend to act on suggestions in the evening rather than morning. Want me to adjust your timing?"

User can accept (auto-update windows) or dismiss (keep manual settings).

### Window-Aware Suggestion Ranking

Different windows get different suggestion flavors:

| Window | Preferred Effort | Preferred Categories | Rationale |
|--------|-----------------|---------------------|-----------|
| Morning | Minimal, Low | text-call, voice-note, birthday wish | Quick actions before the day gets busy |
| Midday | Low, Medium | meal-drink, coffee, quick hangout | Lunch window, social but time-boxed |
| Afternoon | Medium | activity-hobby, hangout, favour-support | More time available, active suggestions |
| Evening | Medium, Reflective | deep-talk, planning, reflection | Wind-down energy, forward-looking |
| Weekend | Any | activity-hobby, event-party, hangout, meal-drink | Highest availability, biggest variety |

This means the same friend could surface differently depending on the window:
- Morning: "Send Anna a quick text — you haven't chatted in 2 weeks"
- Evening: "Your Saturday looks free. Last time you went cycling with Anna you had a great time — want to plan another ride?"

---

## Part 9: Calendar & Schedule Integration

### Connecting the Event Scanner

The event scanner (`src/modules/interactions/services/event-scanner.ts`) already:
- Reads device calendar events
- Classifies event types
- Fuzzy-matches friend names
- Has a learning/feedback system

What it needs:

1. **Feed free/busy data into CalendarContext** (Part 5 Signals Layer) — Extract gaps between events as `freeWindows`, compute `busyScore`
2. **Feed friend-matched events into the hard suppressor** (Part 7 Focus Selector) — If the scanner detects "Lunch with Anna" on the calendar, the "already planned" suppressor removes Anna
3. **Feed upcoming events into copy context** — "You have dinner with Marcus on Thursday" can inform opportunity copy for other friends

### CalendarContextService Implementation

The `CalendarContextService` (defined in Part 5) merges device calendar events with Weave planned interactions:

```typescript
class CalendarContextService {
  async buildContext(): Promise<CalendarContext> {
    const deviceEvents = await EventScannerService.scanRange(thisWeek);
    const weavePlans = await InteractionService.getPlannedThisWeek();

    const allEvents = mergeAndDeduplicate(deviceEvents, weavePlans);
    const freeWindows = computeFreeWindows(allEvents);
    const busyScore = computeBusyScore(allEvents);
    const friendCalendarEvents = deviceEvents
      .filter(e => e.matchedFriendIds.length > 0);

    return { todayEvents, tomorrowEvents, weekendEvents, freeWindows, busyScore, friendCalendarEvents };
  }
}
```

### Free Time Detection

```typescript
function computeFreeWindows(events: TimelineEvent[]): TimeWindow[] {
  // Sort events by start time
  // Find gaps between consecutive events
  // Filter gaps >= 1 hour
  // Label each gap: morning/afternoon/evening/weekend
  // Return sorted by duration (longest first)
}
```

### Calendar Permission UX

Calendar access is optional but valuable. The app should explain the value clearly:

> "Weave can check your calendar to avoid suggesting hangouts when you're busy, and spot free time for the friends who matter most. We never modify your calendar."

If denied: Schedule-fit scoring degrades gracefully — uses Weave-internal plan data only. Less signal, not no signal.

---

## Part 10: Copy Generation (Two-Tier)

### Tier 1: Enriched Templates (Free)

Enhanced templates that use existing data fields. No LLM needed — pure string interpolation with conditional logic.

#### Template Structure

```typescript
interface CopyTemplate {
  id: string;
  generatorSource: string;       // Which generator this template serves
  conditions: CopyCondition[];   // When to use this variant
  title: string;                 // Supports {variables}
  subtitle: string;              // Supports {variables} + conditionals
  actionLabel: string;
}
```

#### Example Templates by Generator

**Drift Generator:**
```
// Basic (current)
title: "Reconnect with {friendName}"
subtitle: "It's been a while since your last interaction"

// Enhanced (new)
title: "{friendName} could use some love"
subtitle: "It's been {daysSince} days. {lastActivityClause}{effectivenessHint}"
// → "It's been 18 days. Last time you grabbed coffee together it went really well. Coffee tends to work great with her."

// Conditional clauses:
lastActivityClause = lastActivity
  ? `Last time you ${activityVerb(lastActivity)} together${vibeClause}. `
  : '';
vibeClause = lastVibe && lastVibe >= 4
  ? ' it went really well'
  : '';
effectivenessHint = categoryEffectiveness > 1.2
  ? `${topCategory} tends to work great with ${pronoun(friend)}.`
  : '';
```

**Life Event Generator:**
```
// Birthday — imminent
title: "Don't forget — {friendName}'s birthday is {dateClause}"
subtitle: "{personalHint}"
// → "Don't forget — Isaac's birthday is Thursday. A quick message would mean a lot."

// Birthday — today
title: "It's {friendName}'s birthday!"
subtitle: "Drop them a message to brighten their day"
```

**Maintenance Generator:**
```
// With free time context
title: "Your {window} looks free"
subtitle: "{suggestedAction} with {friendName}? {recencyClause}"
// → "Your Saturday afternoon looks free. Grab a coffee with Sam? You haven't caught up in 3 weeks."

// Without calendar
title: "Check in with {friendName}"
subtitle: "It's been {daysSince} days — {suggestedAction}?"
// → "Check in with Sam. It's been 21 days — a quick text would go a long way."
```

**Momentum Generator:**
```
title: "Keep the momentum going with {friendName}"
subtitle: "You've been connecting regularly — {nextSuggestion}"
// → "Keep the momentum going with Anna. You've been connecting regularly — how about another cycle this weekend?"
```

#### Variable Registry

All variables available for template interpolation:

| Variable | Source | Example |
|----------|--------|---------|
| `{friendName}` | Friend model | "Anna" |
| `{daysSince}` | Computed | "18" |
| `{lastActivity}` | Last interaction.activity | "cycling" |
| `{lastVibe}` | Last interaction.vibe | "great" |
| `{lastLocation}` | Last interaction.location | "Richmond Park" |
| `{topCategory}` | Smart defaults | "coffee" |
| `{categoryEffectiveness}` | Friend.category_effectiveness | "1.35" |
| `{dateClause}` | Life event date formatting | "Thursday", "today", "in 3 days" |
| `{window}` | Calendar free window | "Saturday afternoon" |
| `{weekPlanCount}` | Weekly context | "3" |
| `{recentFriends}` | Weekly context | "Sarah and Marcus" |
| `{tierBalance}` | Weekly context | "inner circle well-nurtured" |
| `{pronoun}` | Friend.gender or neutral | "her", "him", "them" |
| `{relationshipNoun}` | Friend.relationship_type | "mum", "colleague", "friend" |

### Tier 2: LLM-Generated Bespoke Copy (Premium)

For premium users, each pooled suggestion gets asynchronously enriched with LLM-generated copy via the Oracle service.

#### Prompt Framework

```typescript
const SUGGESTION_COPY_SYSTEM_PROMPT = `
You are a thoughtful, warm relationship coach writing brief, specific
suggestions for someone who cares about their friendships but is busy.

Your tone is:
- Warm but not saccharine
- Specific, never generic
- Casual and human — like a thoughtful friend, not an app
- Brief — 1-2 sentences max for title+subtitle

Rules:
- ALWAYS reference something specific (a past activity, a date, a pattern)
- NEVER use generic phrases like "reach out to" or "plan a hangout"
- Match suggestion effort to the context (quick text vs. planned outing)
- If you mention a time window, be specific ("Saturday afternoon" not "this weekend")
- Do not use excessive exclamation marks
- Do not be preachy about relationships
`;

const SUGGESTION_COPY_USER_PROMPT = `
Write a suggestion for {userName} about {friendName}.

RELATIONSHIP:
- Archetype: {archetype} — {archetypeOneLineDescription}
- Tier: {tier} ({tierDescription})
- Relationship type: {relationshipType}
- Days since last interaction: {daysSince}

LAST INTERACTION:
- Activity: {lastActivity}
- Vibe: {lastVibe}/5
- Location: {lastLocation}
- Date: {lastDate}
- Note snippet: {lastNoteSnippet}

PATTERNS:
- Most effective category: {topCategory} ({effectivenessPercent}% above average)
- Typical frequency: every {typicalIntervalDays} days
- Best time: {bestTimeOfDay} on {bestDayOfWeek}
- Interaction count: {interactionCount} total

CURRENT CONTEXT:
- Social battery: {batteryLevel}
- Social season: {season}
- This week: {weekPlanCount} plans, seen {recentFriendsList}
- Free time: {freeWindowDescription}
- Reason for suggestion: {generatorReason}
{upcomingEventClause}

Respond with JSON:
{
  "title": "short, specific title (max 60 chars)",
  "subtitle": "1-2 sentence specific suggestion",
  "actionLabel": "verb phrase for the CTA button (max 20 chars)"
}
`;
```

#### LLM Enrichment Service

```typescript
class SuggestionCopyEnricher {
  /**
   * Enriches pooled suggestions with LLM-generated copy.
   * Called async during pool refresh, not at display time.
   * Fails gracefully — template copy is always the fallback.
   */
  async enrichPool(suggestions: PooledSuggestion[], userContext: UserContext): Promise<void> {
    if (!userContext.isPremium) return;

    // Batch: enrich top 5 by urgency (rate limit protection)
    const toEnrich = suggestions
      .filter(s => !s.bespokeCopy || s.bespokeCopy.generatedAt < s.pooledAt)
      .sort(byUrgency)
      .slice(0, 5);

    for (const suggestion of toEnrich) {
      try {
        const prompt = buildPrompt(suggestion, userContext);
        const response = await OracleService.generateJSON(prompt, {
          timeout: 8000,
          model: 'fast',  // Use faster model for copy generation
        });

        suggestion.bespokeCopy = {
          ...response,
          generatedAt: new Date(),
        };
      } catch (error) {
        // Silent fail — template copy remains
        console.warn('Bespoke copy generation failed:', error.message);
      }
    }
  }
}
```

#### Cost & Rate Limiting

- **Max 5 LLM calls per pool refresh** (pool refreshes max 4x/day = 20 calls/day max)
- **Use fast/cheap model** — copy generation doesn't need the full Oracle model
- **Cache aggressively** — bespoke copy is valid as long as the suggestion's context hasn't changed
- **Batch where possible** — could potentially batch multiple suggestions into one LLM call with structured output

---

## Part 11: UI & Notification Integration

### Focus Tab Redesign (TodaysFocusWidgetV2)

**Important context**: Today's Focus tab is not just an opportunity list. It already includes multiple sections: pending actions (link requests, shared weaves), upcoming plans (today/tomorrow), intentions, upcoming dates (birthdays, anniversaries), reflection prompts, and a rest-day state. The redesign targets the **opportunity section** within this existing layout — the other sections remain as-is.

The opportunity section shifts from "suggestion list" to **"your best next move."**

#### Opportunity Section States

**State 1: Primary Opportunity (+ Optional Secondary)**

```
┌─────────────────────────────────────────┐
│  ★ YOUR BEST NEXT MOVE                  │
│                                         │
│  Isaac's birthday is Thursday           │
│  A quick message would mean a lot       │
│                                         │
│  [Send a text →]      [Snooze] [Not now]│
└─────────────────────────────────────────┘
┌─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
   Anna — Saturday looks free
   You haven't cycled in 3 weeks
                          [Plan something →]
└─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

- **Primary** is a hero card — visually prominent, full explanation, clear CTA
- **Secondary** is compact — single line, smaller, only appears if it scored >= 60% of primary and is a different tier/category
- Each card has: CTA, Snooze ("remind me later"), Not now
- Optional "Why am I seeing this?" affordance (tapping reveals `explanation.why_now`)
- No urgency color coding — trust comes from relevance, not visual urgency signals

**State 2: All Good (nothing above threshold)**

```
┌─────────────────────────────────────────┐
│                                         │
│  Your relationships are in good shape   │
│  Nothing needs attention right now      │
│                                         │
└─────────────────────────────────────────┘
```

- This is the **opportunity section's** zero state, not the entire tab's zero state
- The Focus tab may still show plans, upcoming dates, intentions, etc. — those are independent
- If the entire tab is empty (no plans, no dates, no opportunities), that's a separate "fully quiet" state handled by the existing rest-day/reflection flow in `TodaysFocusWidgetV2`
- Positive framing — this is a win, not an empty state
- Optional "Browse all" link for power users who want to explore the pool

**State 3: Low Battery Override**

```
┌─────────────────────────────────────────┐
│                                         │
│  Your energy is low today               │
│  Focus on yourself — Weave will         │
│  keep watching for anything urgent      │
│                                         │
└─────────────────────────────────────────┘
```

- Replaces the opportunity section when battery < 20 and no opportunity scored above threshold
- Reassures the user that the system is still working
- Only very high urgency items (birthday today, severe drift with urgency > 85) break through
- Other Focus tab sections (plans, dates) still show normally

### Feedback Affordances

Each surfaced opportunity carries three feedback actions (see Part 7 Feedback Actions):

| Affordance | UI | Signal |
|------------|-----|--------|
| **CTA** ("Send a text", "Plan something") | Primary button | Strong positive — record acted, boost future scoring |
| **Snooze** | Secondary action | "Later today" / "Tomorrow" / "This weekend" — re-queues with timestamp |
| **Not now** | Dismiss action | Standard cooldown (type-based) |
| **Not this friend** | Long-press or overflow menu | 30-day suppression for this friend |

### Notification Redesign

Re-enable smart notifications with strict qualification. **The notification reuses the exact same selector output** — no separate notification logic.

**Qualification criteria** (ALL must be true):
1. Focus Selector surfaced a primary opportunity
2. Primary opportunity score >= 60 (high confidence)
3. Current time is within user's preferred window
4. No notification sent in last 6 hours
5. User has not opened the app in last 2 hours — **requires new app-open telemetry** (not currently tracked; see Phase 4 engagement tracking)

**Max frequency**: 1 notification per day (can be 0 on many days)

**Notification copy**: Matches the opportunity copy exactly (template or bespoke, depending on tier). No separate notification templates. The `explanation.why_now` can optionally be included as a second line.

**Tap behaviour**: Opens app → Focus tab with that opportunity pre-surfaced as the primary card.

### Evening Digest Integration

The existing evening digest continues as-is but gains awareness of the new system:

- Digest content includes the day's surfaced opportunity (if any was shown)
- If an opportunity was surfaced but not acted on, the digest can gently re-surface it: "Earlier today I suggested checking in with Anna — still want to?"
- If no opportunity surfaced all day, digest confirms: "All quiet today. Your relationships are in good shape."

---

## Part 12: Schema & Data Changes

### New WatermelonDB Table: `opportunity_pool`

**Lean pool approach** (Phase 1): Store minimal indexed fields + a context hash. Copy, explanation, and rich context are computed on demand from the hash rather than denormalized into JSON blobs. If the hash changes, the opportunity is stale and re-synthesized.

**Full pool approach** (Phase 5+, when LLM copy caching justifies it): Add JSON blob columns for cached copy.

```typescript
// Phase 1: Lean opportunity pool schema
tableSchema({
  name: 'opportunity_pool',
  columns: [
    { name: 'opportunity_id', type: 'string' },
    { name: 'friend_id', type: 'string', isIndexed: true },
    { name: 'category', type: 'string' },               // From SuggestionCategory enum (Phase 0 taxonomy)
    { name: 'generator_source', type: 'string' },
    { name: 'urgency', type: 'number' },                 // Continuous 0-100 (not enum)
    { name: 'confidence', type: 'number' },              // 0-1
    { name: 'effort_level', type: 'string' },
    { name: 'estimated_duration', type: 'number' },
    { name: 'intention_id', type: 'string', isOptional: true },  // Active intention reference
    { name: 'intention_boost', type: 'number' },         // 0 or significant bonus
    { name: 'context_hash', type: 'string' },            // Hash of key inputs — detects staleness
    { name: 'explanation_json', type: 'string' },        // JSON: { why_now, why_this_friend, why_this_action }
    { name: 'time_relevance_json', type: 'string' },     // JSON (small, rarely changes)
    { name: 'created_at', type: 'number' },
    { name: 'expires_at', type: 'number', isIndexed: true },
    { name: 'surfaced_at', type: 'number', isOptional: true },
    { name: 'surface_count', type: 'number' },
    { name: 'last_score', type: 'number', isOptional: true },  // Last composite score from selector
    { name: 'is_active', type: 'boolean', isIndexed: true },
    // Phase 5+ additions for LLM copy caching:
    // { name: 'template_copy_json', type: 'string' },
    // { name: 'bespoke_copy_json', type: 'string', isOptional: true },
    // { name: 'copy_context_json', type: 'string' },
  ],
})
```

### New UserProfile Fields

```typescript
// Add to UserProfile model / schema
preferred_suggestion_windows_json: string;   // JSON: ['morning', 'evening']
timing_profile_json: string;                 // JSON: PersonalTimingProfile (learned)
suggestion_frequency: string;                // 'quiet' | 'balanced' | 'proactive'
last_pool_refresh: number;                   // Timestamp
calendar_permission_granted: boolean;
last_app_open: number;                       // Timestamp — for notification criterion 4
```

### Settings Ownership: Single Source of Truth

**Problem**: Timing and frequency settings currently live in two places:
- `NotificationPreferences` in `notification-store.ts` (AsyncStorage) — owns `frequency`, `quietHoursStart/End`, `maxDailySuggestions`, `digestTime`, `respectBattery`
- `UserProfile` in WatermelonDB — would own the new `preferred_suggestion_windows_json`, `timing_profile_json`, `suggestion_frequency`

If both systems independently define "how often" and "when" to surface opportunities, we create a split-brain config problem — the exact fragmentation this redesign is trying to fix.

**Decision**: **UserProfile owns all opportunity timing/frequency settings.** NotificationPreferences retains only notification-transport concerns (quiet hours for system notifications, digest time, push permission state).

| Setting | Owner | Rationale |
|---------|-------|-----------|
| `suggestion_frequency` ('quiet'/'balanced'/'proactive') | **UserProfile** | Replaces `NotificationPreferences.frequency` for opportunity volume. Single source for Focus Selector. |
| `preferred_suggestion_windows_json` | **UserProfile** | New. Defines when opportunities surface (in-app and notifications). |
| `timing_profile_json` | **UserProfile** | New. Learned engagement profile. |
| `quietHoursStart/End` | **NotificationPreferences** | Stays. Controls system notification delivery timing only. Focus Selector uses UserProfile windows instead. |
| `maxDailySuggestions` | **Deprecated** | Removed. The Focus Selector's 0-1-2 output replaces this blunt cap. |
| `digestEnabled`, `digestTime` | **NotificationPreferences** | Stays. Digest is a separate notification channel, not an opportunity setting. |
| `respectBattery` | **NotificationPreferences** | Stays but becomes advisory. Battery/Season Fit scoring in the Focus Selector handles this directly. |

**Migration**: Phase 1 adds the UserProfile fields. Phase 2 (Focus Selector) stops reading `maxDailySuggestions` and `frequency` from NotificationPreferences. Phase 3 (personal timing) makes UserProfile windows the authoritative timing source. A one-time migration copies any user-customized notification frequency to the new `suggestion_frequency` field.

### New Table: `surfacing_log`

For analytics and timing profile learning:

```typescript
tableSchema({
  name: 'surfacing_log',
  columns: [
    { name: 'opportunity_pool_id', type: 'string' },
    { name: 'event_type', type: 'string' },  // 'surfaced' | 'acted' | 'snoozed' | 'dismissed' | 'expired'
    { name: 'timestamp', type: 'number' },
    { name: 'window', type: 'string' },       // Which timing window was active
    { name: 'composite_score', type: 'number' },  // Total score at surfacing time
    { name: 'score_breakdown_json', type: 'string' }, // Per-dimension scores for analytics
    { name: 'feedback_type', type: 'string', isOptional: true }, // 'snooze' | 'not_now' | 'not_this_friend'
  ],
})
```

### Migration Plan

- New schema version (v77 or next available)
- `opportunity_pool` table is additive — no migration of existing data needed
- `surfacing_log` replaces parts of existing `suggestion_events` but both can coexist during transition
- UserProfile fields have defaults (empty windows = use defaults, null timing profile = cold start mode)

---

## Part 13: Phased Implementation Roadmap

### Phase 0: Data Contracts & Score Model (Estimated: 1-2 weeks)

**Goal**: Define the Opportunity schema, prove the Focus Selector in memory, define the score model, and establish the invalidation strategy — before committing to persistent storage.

The biggest risk in this redesign is premature persistence. Phase 0 proves the architecture in memory first.

| Task | Description |
|------|-------------|
| **Opportunity schema** | Define the `Opportunity` interface (Part 6) as the central TypeScript contract. This is the API boundary between synthesis, selector, and UI. All fields: urgency (continuous 0-100), confidence, effort, explanation, intention alignment, copy context. |
| **Score model** | Implement the 7-dimension weighted scoring function (Part 7) as a pure function: `(opportunity: Opportunity, signals: SignalContext) → ScoredOpportunity`. Tune initial weights. Validate with worked examples (Part 7 table). |
| **Hard suppressors** | Implement the 6 binary suppressors (Part 7 Step A) as a pure filter function. Test against known edge cases. |
| **`WeeklyContextService`** | Build cross-friend weekly context (completed weaves, plans, tier + category distribution). Pure query service, no persistence — computes on demand with 4-hour in-memory cache. |
| **`CalendarContextService`** | Connect event scanner output to a structured `CalendarContext`. Pure query service with 1-hour in-memory cache. |
| **Category taxonomy** | Define a canonical `SuggestionCategory` enum. Currently scattered: `drift`, `critical-drift`, `high-drift`, `community-checkin` (TriageGenerator), `life-event` (provider), `signal-followup`, `signal-repair`, `signal-values`, `signal-reconnect` (SignalDrivenGenerator), `insight`, `portfolio` (provider), `daily-reflect`, `wildcard` (provider), plus interaction categories used as suggestion categories. |
| **Invalidation strategy** | Define when pool data goes stale: which user actions (weave logged, plan created, battery checked in, intention created) trigger which invalidations. Document as a matrix before coding. |
| **Retire/demote audit** | Audit `src/shared/utils/time-aware-filter.ts`, `smart-defaults.service.ts` timing logic, `smart-suggestions.ts` gating, and `SuggestionDiversifier`. Document which the Focus Selector replaces vs. which remain as lower-level concerns. |

**No UI changes. No schema changes. No persistence. Pure contracts and logic. The selector runs in memory alongside the existing system for validation.**

### Phase 1: Opportunity Synthesis (Estimated: 2-3 weeks)

**Goal**: Generators produce Opportunity objects into a persistent pool. Decouple generation from display.

**Persistence approach**: Start with a **lean pool** — store minimal rows (friendId, generatorSource, urgency, confidence, effortLevel, intentionId, expiresAt, contextHash, explanation) plus a context hash to detect staleness. Compute `copyContext` and `templateCopy` on demand. If the hash changes, the opportunity is stale and re-synthesized.

| Task | Description |
|------|-------------|
| Schema migration | Add lean `opportunity_pool` table + `surfacing_log` table + new UserProfile fields |
| Generator refactor | Each generator produces `Opportunity` objects with continuous urgency, confidence, explanation fields, and intention alignment |
| Intention threading | Cross-cut: when generating any opportunity for a friend with an active intention, set `intentionId` + `intentionBoost` |
| Context hash computation | Hash key inputs (friendScore, daysSince, planCount, weekly snapshot) to detect staleness |
| Enrich copy context | Pass `WeeklyContext` + `CalendarContext` + past interaction detail into each opportunity's `copyContext` |
| Template copy enrichment | Implement enriched templates using `copyContext` + `explanation` fields |
| Pool refresh triggers | App launch (if stale), weave completion, plan change, battery check-in, intention change, background refresh |
| TTL management | Automatic expiry of stale opportunities |

**UI still reads from pool (via adapter showing all opportunities sorted by urgency). Generation is decoupled, templates are richer, and opportunities carry explanations. No scoring/selection yet — all pooled items shown (like today, but with better copy).**

### Phase 2: The Focus Selector (Estimated: 2-3 weeks)

**Goal**: Hard suppressors + weighted scoring replaces the current diversify-and-display pipeline. Opportunities go from "always show 10" to "1 primary + optional secondary."

| Task | Description |
|------|-------------|
| Focus Selector service | Integrate Phase 0 suppressors + score model with the pool. Wire up as the single decision layer. |
| Retire old stack | Remove/bypass `SuggestionDiversifier`, `time-aware-filter.ts`, guaranteed suggestions, emergency fallbacks |
| Focus tab redesign | Three states: primary+secondary opportunity, all good, low battery override |
| "Best Next Move" UX | Hero card for primary, compact card for secondary, "Why am I seeing this?" affordance |
| Feedback actions | Implement: Act, Snooze (later today/tomorrow/weekend), Not now, Not this friend |
| Surfacing log | Track surfacing events with composite score + score breakdown for analytics + timing learning |
| Notification integration | Smart notifications reuse selector output — no separate logic. Re-enable with score threshold + window qualification. |

**This is the big behavioral shift. Users see one trusted "best next move" instead of a list.**

### Phase 3: Personal Timing (Estimated: 1-2 weeks)

**Goal**: Opportunities surface during the user's personal rhythm, not on a fixed schedule.

| Task | Description |
|------|-------------|
| Window preference UI | Settings screen to pick preferred windows (morning/midday/afternoon/evening) |
| Onboarding integration | Add window selection to onboarding flow |
| Window-aware scoring | Schedule Fit dimension weights current/next window match. "Why Now" dimension boosts window-aligned opportunities. |
| Window-aware ranking | Morning = quick/easy opportunities score higher, evening = reflective/planning |
| Settings migration | Move timing authority from NotificationPreferences to UserProfile. Deprecate `maxDailySuggestions`. |

**Notifications are rare (max 1/day), high-signal, and personally timed.**

### Phase 4: Learned Timing & Telemetry (Estimated: 1-2 weeks)

**Goal**: The system learns from user behavior and auto-tunes timing.

| Task | Description |
|------|-------------|
| App-open telemetry | **New instrumentation** — record `last_app_open` timestamp on UserProfile. Required for notification criterion (suppress if opened recently). |
| Engagement tracking | Record app opens, opportunity actions, snoozes, and dismissals with timestamps |
| Timing profile computation | Weekly recalc of `PersonalTimingProfile` from engagement data |
| Hybrid merge | Intersect learned windows with user-set windows |
| Timing adjustment prompt | "I've noticed you prefer evenings — want me to adjust?" |

**This phase can ship independently. The system gets smarter over time.**

### Phase 5: Premium Copy (Estimated: 1-2 weeks)

**Goal**: LLM-generated bespoke copy for premium users.

| Task | Description |
|------|-------------|
| `OpportunityCopyEnricher` service | Async LLM enrichment via Oracle for pooled opportunities |
| Prompt framework | System + user prompts with full context injection, using `explanation` fields for specificity |
| Full pool denormalization | Add `template_copy_json`, `bespoke_copy_json`, `copy_context_json` columns to `opportunity_pool` for caching |
| Rate limiting & caching | Max 5 LLM calls per refresh, cache on opportunity, fallback to template |
| Premium gate | Check subscription status before enrichment |
| A/B testing hooks | Track template vs. bespoke action rates |

**This is a clean premium value-add. The intelligence is free; the voice is premium.**

### Phase 6: Polish & Optimization (Ongoing)

| Task | Description |
|------|-------------|
| Score weight tuning | Analyze surfacing_log score breakdowns to identify which dimensions most predict action |
| Feedback loop | Feed snooze/dismiss patterns back into generator urgency calibration |
| Template A/B testing | Test different template variants for action rates |
| "Why am I seeing this?" UI | Surface `explanation` fields in a tappable affordance |
| Weekly summary integration | Weekly reflection incorporates opportunity performance: "You acted on 2 of 3 opportunities this week" |
| Weekend intelligence | Special weekend scoring: activity-focused opportunities score higher, schedule-fit is more generous |
| Seasonal awareness | Holiday periods, school breaks, vacation detection |

---

## Part 14: Success Metrics

### Existing Analytics Infrastructure

The current system already tracks suggestion events via `SuggestionTrackerService` (`suggestion-tracker.service.ts`): shown, acted, dismissed, and expired events with `time_to_action_minutes`. This data is valuable but measures **fetch-time list impressions** (everything returned by the provider), not true surfaced impressions with gate context.

The key improvement from `surfacing_log` is not "tracking exists now" but "we track what the user actually saw, the composite score and per-dimension breakdown, and which feedback action they took." This enables score weight tuning and learning loops that flat event tracking can't support.

### Primary Metrics

| Metric | Current (Estimated) | Target | How to Measure |
|--------|-------------------|--------|----------------|
| **Opportunity action rate** | ~5-10% (against 10 shown — denominator is inflated) | 30-45% (against 1-2 shown) | `acted / surfaced` from surfacing_log |
| **Opportunities surfaced per day** | Up to 10 (default `maxDailySuggestions` = 10) | 0.5-1.5 (fewer, better) | Average surfaced_count from surfacing_log |
| **Time to action** | Partially tracked (suggestion_events.time_to_action_minutes) | < 2 hours | surfacing_log timestamp delta (with score context) |
| **Notification tap rate** | N/A (disabled) | > 40% | notification_tapped / notification_delivered |
| **"All Good" frequency** | Never (guaranteed suggestions + emergency fallbacks) | 30-50% of days | Days with 0 surfaced suggestions |

### Secondary Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Dismissal rate** | < 15% (down from ~40%) | Better targeting = fewer dismissals |
| **Weekly active suggestion users** | +20% | Fewer but better suggestions should increase engagement, not decrease it |
| **Premium copy conversion** | 15-20% higher action rate vs. template | Validates premium value |
| **Calendar permission grant rate** | > 60% | Value proposition is clear |
| **User-reported satisfaction** | Positive sentiment in feedback | Qualitative signal |

### Anti-Metrics (Things That Should NOT Increase)

| Anti-Metric | Threshold | Action |
|-------------|-----------|--------|
| Notification disable rate | > 10% of enabled users | Reduce notification frequency |
| "All Good" frustration | Users repeatedly opening Focus tab on "All Good" days | Consider adding a "browse pool" option |
| LLM copy weirdness reports | > 5% of premium users flag odd copy | Tighten prompt constraints |
| Pool staleness | > 30% of pool expired without evaluation | Increase refresh frequency |

---

## Part 15: Risks & Mitigations

### R1: "All Good" Feels Empty

**Risk**: Users who are used to always seeing suggestions may feel the app is broken when they see nothing.

**Mitigation**:
- "All Good" state is explicitly designed to feel positive and intentional
- Copy communicates that the system is actively watching: "Nothing needs attention today — Weave is keeping an eye on things"
- Optional "Browse suggestions" link for power users who want to explore the pool
- Gradual rollout: start with max 3 suggestions, reduce to max 2 over time

### R2: Calendar Permission Anxiety

**Risk**: Users may be uncomfortable granting calendar access to a relationship app.

**Mitigation**:
- Calendar is fully optional — Gate 2 gracefully degrades to Weave-internal plan data
- Clear permission prompt explaining exactly what we read (events) and don't do (never write)
- Calendar data never leaves the device (local-only processing)

### R3: LLM Copy Quality

**Risk**: AI-generated copy could be weird, inaccurate, or tone-deaf.

**Mitigation**:
- Template copy is always the fallback — LLM enrichment is additive
- Strict prompt constraints (no exclamation marks, no generic phrases, no preachiness)
- Copy is generated at pool time, not display time — could add a quality filter before caching
- Users can report bad copy, which feeds back into prompt refinement
- Hard constraints: character limits, JSON schema validation

### R4: Over-Suppression

**Risk**: Hard suppressors + high score threshold could suppress everything, making the system feel dead.

**Mitigation**:
- High-urgency opportunities (> 85) bypass the "just interacted" suppressor — birthday today always surfaces
- The `minThreshold` is the primary tuning lever — start at 35, adjust based on "All Good" frequency
- Quiet week detection: when `socialMomentum === 'quiet'`, threshold drops from 35 → 30 to let medium-urgency through
- If no opportunity surfaces for 3+ consecutive days, temporarily lower threshold by 10
- Monitor "All Good" frequency — if > 70%, threshold is too high

### R5: Cold Start

**Risk**: New users or users without much data get a degraded experience.

**Mitigation**:
- Pool generation works from day one with the existing waterfall (doesn't require calendar or learned timing)
- Default timing windows (morning + evening) work immediately
- Template copy works with minimal data (friend name + days since + top category)
- Learned timing kicks in after 2-4 weeks — explicit cold start mode until then

### R6: Performance

**Risk**: Pool generation with calendar + cross-friend context could be slow.

**Mitigation**:
- Pool refreshes are async and non-blocking (background, not on app open)
- CalendarContext is cached for 1 hour (calendar doesn't change that fast)
- WeeklyContext is cached for 4 hours
- Focus Selector evaluation is lightweight (reads from pool + cached context)
- LLM calls are batched and async — never in the critical path

### R7: Current Pipeline Fragility

**Risk**: The existing suggestion pipeline is fragile — auxiliary services can cause cascading failures. For example, `suggestion-wiring.test.ts` currently fails because the provider's global catch returns `[]` when `archiveExpiredFriendMemories()` throws on the `friend_memories` table.

**Mitigation**: The synthesis/selection split directly addresses this. Opportunity synthesis can fail without affecting selection — stale-but-valid pool entries still score and surface correctly. Auxiliary operations (memory archival, analytics logging) run in the synthesis phase and are isolated from the Focus Selector's critical path. This is a structural improvement over the current single-pass design where any failure produces zero suggestions.

---

## Part 16: Open Questions

### OQ1: Pool Visibility

Should users be able to browse the full suggestion pool, or only see surfaced suggestions? A "browse all" option gives power users control but undermines the "fewer, better" philosophy.

**Leaning**: Hidden by default. Available via "See more" link in Focus detail sheet for users who want it.

### OQ2: Snooze vs. Dismiss

~~Current system treats "dismiss" as a cooldown. Should we add an explicit "remind me later" (snooze)?~~

**Resolved**: Yes — implemented as part of the feedback action system (Part 7). Snooze options: "later today", "tomorrow", "this weekend". Distinct from "not now" (cooldown) and "not this friend" (30-day suppression).

### OQ3: Group Suggestions

Current system is entirely 1:1. Should the new system suggest group activities? "You haven't seen the college crew in a while — plan a group dinner?"

**Leaning**: Phase 6+. Requires group graph intelligence that doesn't exist yet. Note for future.

### OQ4: Suggestion Feedback Loop

Should we ask users "Was this helpful?" after they act on a suggestion? This could feed quality metrics but adds friction.

**Leaning**: Not explicit feedback. Instead, measure implicitly: did they log a weave? What was the vibe? Did they come back to the app more frequently? Implicit signals > explicit surveys.

### OQ5: Notification Content Depth

Should the notification show the full enriched copy, or a teaser that pulls them into the app?

**Leaning**: Full copy. The notification itself should be the value — users shouldn't need to open the app to understand why they're being nudged. But the tap action should make it dead-simple to act.

### OQ6: Weekly Summary Integration

Should the weekly reflection flow incorporate suggestion performance? "This week you acted on 2 of 3 suggestions. Your weave with Anna was especially meaningful."

**Leaning**: Yes — Phase 6. Natural extension that closes the feedback loop.

### OQ7: Friend-Level Suggestion Preferences

Should users be able to say "never suggest X for this friend" or "always suggest X at this time"?

**Leaning**: Later phase. Current dismissal learning handles the "never suggest X" case implicitly. Explicit preferences add settings complexity.

---

## Appendix A: Migration from Current System

### What Gets Replaced

| Current Component | New Replacement | Migration Notes |
|-------------------|----------------|-----------------|
| `SuggestionProvider.fetchSuggestions()` | Opportunity Synthesis → opportunity pool | Provider becomes opportunity pool writer; guaranteed suggestions (`:772`) and emergency fallbacks (`:812`) are removed |
| `useSuggestions()` hook | `useFocusOpportunities()` hook | New hook reads from Focus Selector output, not raw generation |
| `TodaysFocusWidgetV2` suggestion section | "Best Next Move" hero card + optional secondary + "All Good" state | Opportunity section refactored; other Focus tab sections (plans, dates, intentions) unchanged |
| `SuggestionDiversifier` | Focus Selector (weighted scoring + novelty dimension) | Round-robin replaced by continuous score with novelty/diversity weighting |
| `src/shared/utils/time-aware-filter.ts` | Focus Selector Schedule Fit dimension + personal timing | **Retired** — coarse global time buckets replaced by window-aware scoring |
| `smart-defaults.service.ts` (timing logic) | Personal timing system + window-aware scoring | **Demoted** — category selection logic stays, but time-of-day gating moves to Focus Selector |
| `smart-suggestions.ts` (notification gating) | Focus Selector output + notification qualification | **Retired** — separate notification logic replaced by reusing selector output |
| Template copy (inline in generators) | `CopyTemplateService` + `OpportunityCopyEnricher` | Templates extracted to separate service, driven by `explanation` fields |
| Suggestion urgency enum ('critical'/'high'/'medium'/'low') | Continuous urgency (0-100) + composite score | Enum preserved for UI display buckets, but selection uses continuous values |

### What Stays

| Component | Reason |
|-----------|--------|
| 12-generator waterfall | Core per-friend reasoning is solid — it produces opportunities instead of suggestions, but the logic stays |
| `SuggestionCandidateService` | Candidate selection quotas are well-balanced |
| `SuggestionDataLoader` | Batch data loading is efficient |
| `SmartDefaultsService` | Category selection logic is mature (timing aspects demoted) |
| `SuggestionStorageService` | Dismissal/snooze tracking continues (extended with new feedback types) |
| `SuggestionTrackerService` | Event logging continues (supplemented by `surfacing_log` with score breakdowns) |
| `EventScannerService` | Gets connected to CalendarContext, not replaced |
| Evening Digest channel | Gains awareness of new system, not replaced |

### Transition Strategy

Phase 0 runs the Focus Selector **in memory alongside** the existing system — both produce results, only the old system displays.

Phase 1 generates opportunities into a persistent pool. The UI reads from an adapter that presents opportunities in the old format.

Phase 2 switches the UI to read from the Focus Selector output. The old `fetchSuggestions()` → display path is deprecated. Guaranteed suggestions and emergency fallbacks are removed.

Phase 3+ iterates on the new system exclusively.

---

## Appendix B: Effort Mapping

How `effortLevel` is determined per suggestion:

| Category | Effort | Estimated Duration | Rationale |
|----------|--------|-------------------|-----------|
| text-call | minimal | 5 min | Can do it right now, anywhere |
| voice-note | minimal | 5 min | Quick but personal |
| birthday wish | minimal | 2 min | Single message |
| deep-talk | medium | 30-60 min | Needs focus and time |
| meal-drink (coffee) | medium | 45-90 min | Needs scheduling + travel |
| meal-drink (dinner) | high | 2-3 hours | Significant time commitment |
| hangout | medium | 1-2 hours | Needs scheduling |
| activity-hobby | high | 2-4 hours | Needs scheduling + preparation |
| event-party | high | 3-5 hours | Evening commitment |
| favour-support | low-medium | Varies | Depends on the favour |

---

## Appendix C: Template Variable Examples

Full worked examples showing how enriched templates render with real data:

**Example 1: Drift + Calendar + Activity History**
```
Input:
  friend: Anna, archetype: The Fool, tier: Close Friends
  daysSince: 21, lastActivity: cycling, lastVibe: 5/5
  lastLocation: Richmond Park, topCategory: activity-hobby
  freeWindow: Saturday 2pm-6pm

Template: "Your {window} looks free. You and {friendName} haven't
  {activityVerb} since {lastActivityDate} — {vibeCallback}"

Output: "Your Saturday afternoon looks free. You and Anna haven't
  been cycling since 3 weeks ago — that last ride was a blast."
```

**Example 2: Life Event + Minimal Effort**
```
Input:
  friend: Isaac, tier: Close Friends
  upcomingEvent: birthday, March 27
  daysSince: 8

Template: "Don't forget — {friendName}'s birthday is {dateClause}.
  {effortHint}"

Output: "Don't forget — Isaac's birthday is Thursday.
  A quick message would mean a lot."
```

**Example 3: Cross-Friend Context + Maintenance**
```
Input:
  friend: Sam, tier: Community
  daysSince: 28, topCategory: meal-drink
  recentFriends: [Sarah, Marcus, Anna] (all Inner Circle)
  tierDistribution: innerCircle 3/5 seen, community 0/12 seen

Template: "You've nurtured your inner circle this week.
  {friendName} would love a {topCategoryNoun} — it's been {daysSince} days."

Output: "You've nurtured your inner circle this week.
  Sam would love a coffee catch-up — it's been 28 days."
```

**Example 4: Low Battery + Critical Only**
```
Input:
  friend: Mum, tier: Inner Circle
  battery: 15, urgency: critical (drift)
  daysSince: 14, topCategory: text-call

Template: "Even a quick text to {relationshipNoun} would go a long way.
  It's been {daysSince} days."

Output: "Even a quick text to Mum would go a long way.
  It's been 14 days."
```
