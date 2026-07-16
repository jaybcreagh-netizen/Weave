# Release A: Trustworthy Core — Engineering Plan

**Status:** Proposed
**Owner:** Product + Engineering
**Scope:** First of three production releases (A: Trustworthy Core → B: Reflection Loop → C: Safe Continuity)

---

## 0. The Core Promise

> Weave helps you notice which relationships matter now, take one meaningful action, and remember what you learn.

One loop: **Notice → Understand → Act → Reflect → Learn**

| Surface | Role in loop | Answers |
|---------|-------------|---------|
| **Today** | Notice + Act | "Is there anything that needs me right now?" |
| **Circle** | Notice + Understand | "How is my social world looking?" |
| **Journal** | Reflect + Learn | "What have I learned and what do I want to remember?" |
| **Oracle** | Understand (contextual, not a destination) | "Help me make sense of this relationship" |

**Release A gate:** every feature shipped in this release must name its place in the loop. Anything that can't gets flagged off, moved to a secondary surface, or deferred.

### Decision rules for this release

1. No new feature unless it strengthens the core loop.
2. No recommendation without a human-readable reason.
3. No urgency manufactured to fill empty space — silence is a valid output.
4. No score behavior change without golden tests.
5. No production release that cannot be rolled back safely.

---

## 1. Workstream Overview & Sequencing

```
WS1 Canonical Pipeline ──┐
WS2 Scoring Correctness ─┼──► WS3 Qualitative States ──► WS4 Today Surface ──► WS7 Copy Pass
                         │                          └──► WS5 Explanations
WS6 Dismissals ──────────┘         (WS5/WS6 start once WS1 API is stable)
WS8 De-emphasis (flags) ── parallel, independent
WS9 Migration Safety ───── parallel, independent, starts immediately
```

WS1 and WS2 are the foundation — everything else builds on a single pipeline with correct math. WS8 and WS9 have no dependencies and can start on day one.

---

## WS1 — Consolidate to One Canonical Suggestion Pipeline

**The single highest-leverage task in this release.** Explainability, dismissal learning, and "one best action" are all impossible to build reliably on top of competing generators.

### Current state (the problem)

`src/modules/interactions/services/` contains four overlapping suggestion generations, all orchestrated by `suggestion-provider.service.ts` (~70 imports deep):

| System | Location | Status |
|--------|----------|--------|
| Legacy generators | `suggestion-engine/` (TriageGenerator, SignalDrivenGenerator, WeeklyReflectionGenerator, drift/portfolio/proactive shared builders) | Active default path |
| Candidate/diversifier layer | `suggestion-system/` (SuggestionCandidateService, SuggestionDataLoader, SuggestionDiversifier) | Active, feeds legacy path |
| Opportunity/selector system | `opportunity-system/` (OpportunitySynthesisService, FocusSelectorService, OpportunityPoolService, SuggestionPacingService, LegacySuggestionShadowService, SelectorExperimentService, SelectorTuningService, …) | Behind env flags (`EXPO_PUBLIC_FOCUS_SELECTOR_ENABLED`, `EXPO_PUBLIC_OPPORTUNITY_POOL_ENABLED`, shadow mode) |
| Guaranteed suggestions | `guaranteed-suggestions.service.ts` | Active — generates suggestions "even when the network is healthy" |

`SuggestionFacade.ts` exists but is a pass-through to the legacy provider.

### Target state

One pipeline, matching this contract:

```
Stored relationship state (WatermelonDB)
        ↓
Time-based decay                     (WS2: one decay path)
        ↓
Current qualitative state            (WS3: canonical states)
        ↓
Candidate opportunities              (one generator set)
        ↓
Energy + calendar filters            (social battery, season, time-aware filter)
        ↓
One best action — or silence         (WS4: pacing produces a real quiet state)
```

### Decision required before work starts

**Which system wins?** Recommendation: **the opportunity-system selector becomes the canonical pipeline** — it already has the right shape (scoring breakdown, pacing, quiet reasons, primary/secondary slots) and the legacy path was already being shadow-evaluated against it (`LegacySuggestionShadowService`). The legacy `suggestion-engine` generators are *ported into* it as candidate sources where still valuable, then retired.

### Tasks

1. **Promote the selector path to default.** Remove the env-flag gating in `opportunity-system/flags.ts` for core behavior (keep a single kill-switch flag for rollback). `SuggestionFacade` becomes the only entry point; `fetchLegacySuggestionSurface` is deleted from the public path.
2. **Port surviving generators as candidate sources.** Audit each generator in `suggestion-engine/generators/` — keep the signal (e.g., life events, memory anniversaries from `memory-life-event.shared.ts`), drop duplicates, port into `OpportunitySynthesisService` candidate production.
3. **Delete the shadow/experiment scaffolding.** `LegacySuggestionShadowService`, `SelectorExperimentService`, `SelectorTuningService`, `SelectorInspectionService` were migration tooling. Once the selector is canonical, they go.
4. **Delete or repurpose `guaranteed-suggestions.service.ts`.** Its "always-on suggestions even when healthy" premise directly violates decision rule 3. The Daily Reflect prompts may move to Journal (Release B); the "gentle nudge to a healthy friend" and "wildcard" generators are removed from Today.
5. **Retire `suggestion-provider.service.ts`** once the facade routes to the canonical pipeline. Its 70-import orchestration is the symptom being cured.
6. **Golden tests for the pipeline.** A fixture set of friends (per tier × archetype × recency) with product-approved expected outputs: which candidate wins, and when the answer is silence. Lives beside `opportunity-system/__tests__/`.

**Definition of done:** one code path from DB state to surfaced action; `suggestion-engine/`, `suggestion-system/`, and `guaranteed-suggestions.service.ts` deleted or absorbed; golden tests green; single rollback flag documented.

---

## WS2 — Scoring Correctness & Versioning

### Current state

- `intelligence/services/decay.service.ts` carries deprecated parameters (`flexibilityMode`, `useFlexibleDecay`) "kept for signature compatibility" but ignored.
- `flexible-decay.service.ts` still exists alongside it with its own tier intervals and multiplier tables — two decay vocabularies for one concept.
- `orchestrator.service.ts#calculateCurrentScore` is called from at least four modules (relationships, interactions, insights, oracle), sometimes with a season argument and sometimes without — the same friend can score differently depending on the call site.
- Callers fall back to raw `weaveScore` when calculation throws (see `guaranteed-suggestions.service.ts#getSuggestionScore`), silently masking scoring bugs.

### Tasks

1. **One decay function.** Fold whatever of `flexible-decay.service.ts` is actually live into `decay.service.ts`; delete the deprecated parameters and the dead file. Every caller updated.
2. **One scoring entry point with mandatory context.** `calculateCurrentScore(friend, context)` where context (season, now-timestamp) is explicit — no optional arguments that change results. Remove silent raw-score fallbacks; a scoring failure should be loud in dev and logged in prod, not masked.
3. **Version the modifier set.** A single `SCORING_VERSION` constant alongside `intelligence/constants.ts`. Any change to decay rates, archetype configs (`ArchetypeDecayConfigs`), grace periods, or tier thresholds bumps it, with a changelog entry.
4. **Golden numerical tests.** Product-approved worked examples per tier × archetype: "Inner Circle Hermit, last seen 20 days ago, score was 80 → today's score is X, state is Y." These become the regression wall for all future tuning. Extend `intelligence/services/__tests__/`.

**Definition of done:** one decay path, one scoring signature, versioned constants, golden tests that a product owner has signed off on the numbers of.

---

## WS3 — Canonical Qualitative Relationship States

Scores become plumbing; states become the product surface.

### Current state

`relationships/services/friend-priority.service.ts` defines `TierAwareHealthStatus` (`thriving | stable | attention | drifting`) with tier-banded thresholds — a good start, but it lives in the wrong module (state derivation is intelligence, not relationships), uses judgment-adjacent vocabulary, and competes with other status concepts (`intelligent-status-line.ts`, `predictive-health.service.ts`, Oracle insight rules each have their own).

### Target

One state enum, derived in one place, used everywhere:

| State | Meaning | Replaces |
|-------|---------|----------|
| **Connected** | Rhythm is healthy | thriving / stable |
| **Quiet** | Longer gap than usual, no alarm | attention |
| **Drifting** | Sustained gap beyond tier expectations | drifting / "neglected" |
| **Resting** | Intentional pause (user-declared via dismissal or battery state) | — (new) |

### Tasks

1. **Create `intelligence/services/relationship-state.service.ts`.** Pure function: `(score, tier, archetype, userSignals) → RelationshipState + explanation inputs`. Thresholds versioned under `SCORING_VERSION` (WS2). `Resting` is driven by user signals (WS6 dismissal reasons, social battery), not score.
2. **Golden tests from day one.** States carry emotional weight — a friend flapping between Connected and Quiet is worse than a wobbling number. Tests must cover threshold boundaries and hysteresis (a state change requires crossing the boundary by a margin, not touching it).
3. **Migrate consumers.** `friend-priority.service.ts` (Circle ordering), `FriendDetailSheet`, `TimelineItem`, `intelligent-status-line.ts`, Oracle `insight-rules.ts` all consume the canonical state. `TierAwareHealthStatus` is deleted.
4. **Circle ordering becomes stable and explainable.** Order by state severity, then by tier, then by days-since — deterministic, no score jitter reordering the list between visits. Exact scores move to a secondary detail view (friend profile), never the list headline.

**Prerequisite:** WS2 complete — deriving states from inconsistent scores would launder the inconsistency into emotionally-loaded labels.

**Definition of done:** one state service, hysteresis-tested, all surfaces consuming it, scores demoted to secondary detail.

---

## WS4 — Today: One Best Action or Silence

### Current state

- `app/dashboard.tsx` is a 501-line route file (violates the thin-routes rule) hosting home + friends screens, badge modals, account-incentive modals, calendar nudges, tutorial alerts, and battery sheets.
- `fetchSuggestionSurface(limit = 3)` returns a list; the pacing/quiet machinery (`SuggestionPacingService`, `quietReason`) exists but quiet is treated as a degenerate case rather than a designed state.

### Tasks

1. **Extract `src/modules/home/screens/TodayScreen.tsx`.** `app/dashboard.tsx` becomes a thin wrapper per the architecture rules. (Do this as part of the rework, not as a separate refactor.)
2. **Single-action surface.** Today renders, in order: current social energy, upcoming plans/important dates, and *at most one* recommendation from the canonical pipeline (WS1 primary slot). No suggestion list, no manual "pull for more" on Today.
3. **Design the "All good" state.** When the pipeline returns silence, Today shows a genuine, warm resting state ("Nothing needs your attention — rest is part of your rhythm"), not an empty list or a spinner. `quietReason` from `SuggestionPacingService` informs the copy.
4. **One recommendation, four verbs.** The card offers exactly: **Message / Plan / Log / Dismiss** — wired to existing flows (`weave-logger`, plan service, WS6 dismissal sheet).
5. **Keep the machinery for lists off Today, not deleted.** `SuggestionDiversifier`-style multi-suggestion surfaces remain available behind a flag for other contexts (and as a rollback), consistent with treating single-action as a beta-validated hypothesis.

**Definition of done:** Today shows ≤1 recommendation with a reason, a designed all-good state, and `dashboard.tsx` is a thin route.

---

## WS5 — The Explanation Contract ("Why now")

Every recommendation and every state must answer: what happened, why it matters now, what was assumed, what to do, how to correct it.

### Tasks

1. **Extend the `Suggestion` type** (`src/shared/types/common.ts`) with a structured `explanation` field:

```ts
interface SuggestionExplanation {
  observation: string;   // "You usually see Alex every 10–14 days. It's been 24."
  reasoning: string;     // "That's a longer gap than your normal rhythm."
  assumptions: string[]; // ["Based on your last 6 months of logged weaves"]
  softeners?: string;    // "You marked your energy as low, so this is a gentle one."
  corrections: SuggestionDismissalReason[]; // what dismissal options apply
}
```

2. **Populate it in the pipeline, not the UI.** `OpportunityCopyEnricher` builds the explanation from pipeline metadata (`scoreBreakdown`, days-since, personal timing from `personal-timing.ts`, battery state). The UI renders it verbatim — no client-side score-to-copy translation.
3. **Ban raw scores in recommendation copy.** Lint-level convention: numbers like "42 points" or "38%" never appear in Today/Circle copy. Scores are visible only in the friend profile detail area.
4. **States get explanations too.** `relationship-state.service.ts` (WS3) returns the same explanation inputs so Circle can answer "why is Alex marked Quiet?" on tap.

**Definition of done:** every surfaced recommendation and state can render a plain-language "why," generated from pipeline data.

---

## WS6 — Dismissals That Teach (Honest Version)

**Scope discipline:** Release A ships *dumb-but-honest suppression*. Learned cadence adjustment (dismissals reshaping decay curves) is Release B — half-implemented learning breaks the trust contract this release exists to build.

### Current state

`SuggestionDismissalReason` = `wrong-friend | not-relevant | already-done | bad-timing`. Events are recorded to `suggestion_events` via `suggestion-tracker.service.ts`, and `SuggestionPacingService` exists, but dismissal reasons don't visibly change behavior.

### Tasks

1. **Expand the taxonomy** in `src/shared/types/common.ts`:
   - `not-relevant` (keep)
   - `already-connected` (replaces `already-done` — "we caught up elsewhere") → **prompts an optional quick log**, feeding the Act step
   - `naturally-low-frequency` ("we're fine at this rhythm")
   - `need-space` ("I need a break from this one")
   - `remind-later` (replaces `bad-timing`)
2. **Wire honest, immediate effects** (no ML, just rules):
   | Reason | Effect |
   |--------|--------|
   | `remind-later` | Snooze this friend's candidates N days (pacing service) |
   | `not-relevant` | Suppress this trigger type for this friend for a longer window |
   | `naturally-low-frequency` | Set friend to **Resting** state consideration; widen expected interval for this friend (a stored per-friend field, not a learned model) |
   | `need-space` | Friend enters **Resting**; no candidates until user re-engages with that friend |
   | `already-connected` | Offer one-tap log; if logged, score updates normally |
3. **Make the effect visible.** After dismissal, a one-line confirmation states what will change: "Got it — we'll treat a slower rhythm as normal for Sam." Control must be *felt* to build trust.
4. **Persist per-friend signals** on the `Friend` model (new columns: `expected_interval_override`, `resting_until` — schema migration per WS9 rules).

**Definition of done:** five dismissal reasons, each with a deterministic documented effect, visible confirmation copy, covered by tests in `interactions/services/__tests__/`.

---

## WS7 — Guilt-Free Copy Pass

Runs last against stabilized surfaces (WS3–WS6), because vocabulary is baked into service types, not just UI strings.

### Current state

"Neglected / overdue / drifting"-family language appears in 30+ files across scoring, priority, Oracle rules (`insight-rules.ts`), reflection (`MissedConnectionsList.tsx`, `narrative-generator.service.ts`, `contextual-prompts.service.ts`), and the LLM prompt registry (`src/shared/services/llm/prompt-registry.ts`).

### Tasks

1. **The test for every string:** *does this help the user act with care, or does it make them feel judged?*
2. **Banned → preferred map** (applied to code identifiers where feasible, all user-facing strings always):
   | Banned | Preferred |
   |--------|-----------|
   | "Neglected" | "It's been quiet" |
   | "Overdue" | "A gentle moment to reconnect" |
   | "Relationship health: 38%" | qualitative state + reason |
   | Red alarm states for ordinary quiet | neutral/soft visual treatment |
   | Streak-loss framing for friendships | "You've both had a different rhythm lately" |
3. **Rename `MissedConnectionsList`** and its weekly-reflection framing — "missed" is guilt language for what is often just life.
4. **Sweep the LLM prompt registry.** Oracle/AI-generated copy must inherit the same vocabulary rules — prompts that instruct the model to describe friends as "neglected" produce guilt at generation time.
5. **Centralize state → copy mapping** in one file per surface area so future copy changes don't require a 30-file grep.

**Definition of done:** grep for banned terms returns only historical migrations/docs; emotional QA (§ Testing) confirms no guilt reports.

---

## WS8 — De-emphasize Non-Core Surfaces (Flags, Not Deletion)

Independent workstream; can start immediately.

| Surface | Current | Release A treatment |
|---------|---------|--------------------|
| Gamification (`BadgeUnlockModal` on dashboard, streaks) | Interrupts core loop | Behind a feature flag, default off for new users; badge history preserved |
| `AccountIncentiveModal` / account prompts | Pressures local-first users | Show once, then only at genuine value moments (backup intent). Local use is never nagged. |
| Oracle as destination (`OracleFAB`, `oracle-settings`) | Separate world | FAB removed from Today; Oracle launches contextually from a friend profile or journal entry. Full contextual integration is Release B; Release A just stops promoting it as a destination. |
| `OpportunityPremiumCopyService` / subscription touchpoints | Interrupt risk | Flagged off in the core loop for this release |
| Predictive insights (`predictive-health.service.ts`, large insights surfaces) | Complexity | Secondary surface only; not feeding Today |

Use the existing `src/shared/config/feature-flags.ts` pattern; every flag documented with its owner and intended revisit date.

**Definition of done:** core loop is reachable end-to-end with zero interruptions from gamification, account prompts, or upsells.

---

## WS9 — Sync & Migration Safety

Release A scope is **correctness of what exists**, not new sync features (that's Release C).

### Current state

Schema at **v83** with **75 migration steps** (`src/db/migrations.ts`), plus `repair-schema.ts` and `data-migration.ts` — evidence of past migration pain. Sync services exist (`sync/services/sync-orchestrator.ts`, `action-queue.service.ts`, `data-replication.service.ts`).

### Tasks

1. **Migration test harness.** Fixture DBs at representative old versions (oldest supported, v70s, v82) run through the full migration chain in CI; assert row counts, non-null invariants, and score recomputability afterward.
2. **Pre-migration safety snapshot.** Before applying migrations on app upgrade, write a local backup of the DB file; surface a recovery path if migration fails, instead of `repair-schema.ts` heroics after the fact.
3. **Sync invariant audit.** For each synced table: verify create/update/delete round-trips and conflict behavior in `sync-operations.ts`; document (or add) the queue-drain behavior on migration-version mismatch between devices.
4. **New columns from WS6** (`expected_interval_override`, `resting_until`) land through this hardened path as the harness's first live test.
5. **Offline reliability check.** Logging and planning must work fully offline (success signal from the product brief); add explicit tests around `action-queue.service.ts` for offline-created weaves.

**Definition of done:** CI-run migration chain tests, pre-migration snapshot in place, sync invariants documented per table.

---

## 2. Existing-User Transition & Rollback

Release A materially changes what existing beta users see. Rollback safety (decision rule 5) applies to the UX, not just the code.

1. **Transition note in-app** on first launch after update: what changed (states instead of scores, one suggestion, badges resting) and why — written in the product's own guilt-free voice.
2. **Data is never destroyed by de-emphasis.** Badges, streaks, and suggestion history are retained under flags; scores continue computing (they power the states).
3. **Rollback levers:** single flag to restore the multi-suggestion surface (WS4.5); `SCORING_VERSION` pinning to restore prior thresholds; gamification flag re-enable. Each documented in the flag registry.
4. **Staged rollout:** internal → 10–20 person beta cohort → general, gated on the success signals below.

---

## 3. Testing the Emotional Experience

Traditional QA is insufficient. Run short sessions with the 10–20 person beta cohort against specific questions:

- Did any part make you feel guilty?
- Did you understand why this friend was suggested?
- When would you ignore this recommendation?
- Does the relationship state feel accurate?
- Does "all good" feel reassuring or empty?
- What do you believe leaves your device?
- Would you be upset if this state changed unexpectedly?

**The single-action Today surface is explicitly a hypothesis** this cohort validates. If users consistently want a browsable list, the flagged multi-suggestion surface is the fallback — that's why it's flagged, not deleted.

### Measurement without betraying privacy

The success signals require measurement; the product promises privacy. Resolution:

- **Local-first metrics:** dismissal counts/reasons, quiet-state frequency, and suggestion-acted rates are already persisted locally in `suggestion_events` — build a local debug/insight view over them.
- **Beta cohort telemetry is opt-in and disclosed,** limited to event counts (no friend names, no journal content), consistent with the data-map principle (Release C makes that map user-facing).
- No new analytics surface ships to general users in Release A.

---

## 4. Success Signals (Exit Criteria for Release A)

| Signal | How measured |
|--------|--------------|
| Users understand recommendations | Beta interviews: ≥8/10 can restate "why this friend, why now" |
| Dismissal rate decreases over cohort period | Local `suggestion_events` (opt-in cohort) |
| No guilt reports | Emotional QA sessions |
| Logging and planning reliable offline | WS9 automated tests + cohort usage |
| Score/state behavior deterministic | Golden tests green; zero state-flapping bug reports |
| Migration safety | CI chain tests green; zero data-loss reports in beta |

---

## 5. Explicitly Out of Scope (Deferred)

- Learned cadence from dismissals (Release B)
- Unified journal/reflection flows, memories on profiles, contextual Oracle integration (Release B)
- Production cross-device sync, backup/restore, export/delete, sharing boundaries, subscription layer (Release C)
- User-facing privacy data map (Release C, alongside accounts)
- StyleSheet→NativeWind migration beyond files already being touched (existing roadmap, orthogonal)
- Any new intelligence signals (location/weather, referral, realtime) — parked per decision rule 1
