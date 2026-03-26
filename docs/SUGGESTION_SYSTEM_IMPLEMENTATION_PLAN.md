# Suggestion / Focus Intelligence Implementation Plan

## Document Metadata

| Property | Value |
|---|---|
| Owner | Product + Engineering |
| Status | Proposed for Execution |
| Last Updated | March 23, 2026 |
| Primary Input | `docs/SUGGESTION_SYSTEM_OVERHAUL.md` |
| Goal | Turn the overhaul into a staged, low-risk delivery plan that can ship incrementally |

---

## 1. Review Summary

The overhaul is ready enough to move from design into implementation planning.

The strongest parts of the proposal are:
- a single Focus Selector replacing the current fragmented decision stack
- intentions as a first-class ranking signal
- silence as a valid outcome instead of guaranteed filler
- a lean opportunity pool with a context hash instead of immediately storing heavy JSON blobs

The main execution adjustments needed are:
- preserve the current `Suggestion` contract during rollout with an adapter layer
- make Focus and notifications consume the same surfaced result, not parallel logic
- move unrelated maintenance side effects out of `fetchSuggestions()` so suggestion failures are isolated
- migrate timing/frequency ownership in stages so `UserProfile` and `NotificationPreferences` do not fight each other

---

## 2. Delivery Principles

1. No flag day. The current suggestion UI contract stays alive until the new selector is proven.
2. One selector, many surfaces. In-app Focus and smart notifications must read from the same decision output.
3. Pure logic before persistence. We prove suppressors, scoring, and invalidation in memory first.
4. Side effects off the hot path. Suggestion generation should not fail because memory cleanup or unrelated maintenance failed.
5. Surface fewer things, but track them better. Analytics should move from "fetched list items" to "actually surfaced opportunities".

---

## 3. Current Integration Map

| Current Seam | Current Role | Planned Change | Phase |
|---|---|---|---|
| `src/modules/interactions/services/suggestion-provider.service.ts` | Monolithic fetch/generate/filter/diversify/fallback pipeline | Keep as facade initially; route to new opportunity pipeline behind a flag; remove maintenance side effects | 0-4 |
| `src/modules/interactions/hooks/useSuggestions.ts` | Fetches 10 suggestions, tracks all fetched items as shown | Switch to surfaced primary/secondary tracking and selector-backed fetches | 4 |
| `src/modules/intelligence/services/focus-generator.ts` | Pulls suggestions directly from `fetchSuggestions()` | Read selector result via shared Focus service instead of raw list fetch | 4 |
| `src/modules/home/components/widgets/widgets/TodaysFocusWidgetV2.tsx` | Treats suggestions as one section inside wider Focus widget | Redesign suggestion section only; preserve plans, intentions, dates, and reflection | 4 |
| `src/modules/home/components/FocusDetailSheet.tsx` | Full-screen detail for current list-based Focus data | Add primary/secondary opportunity presentation plus feedback actions | 4 |
| `src/modules/notifications/services/channels/smart-suggestions.ts` | Independent notification gating and suggestion generation | Replace with selector-backed notification surfacing | 5 |
| `src/modules/notifications/services/notification-store.ts` | Owns frequency and `maxDailySuggestions` in AsyncStorage | Migrate opportunity timing/frequency ownership to `UserProfile`; keep transport-only settings here | 5 |
| `src/modules/auth/components/settings/NotificationSettings.tsx` | Reads and writes old notification preference model | Add window/frequency controls backed by `UserProfile`; keep digest/quiet hours separate | 5 |
| `src/shared/components/DataInitializer.tsx` | App foreground maintenance, analytics app-open tracking | Add `last_app_open` write and selector refresh trigger here | 5 |
| `src/modules/interactions/services/plan.service.ts` and interaction actions | Create many of the state changes that should invalidate opportunities | Add explicit invalidation hooks and pool refresh triggers | 3-5 |

---

## 4. Recommended Module Layout

Create a new bounded area instead of continuing to grow `suggestion-provider.service.ts`.

```text
src/modules/interactions/services/opportunity-system/
  types.ts
  OpportunityAdapter.ts
  OpportunitySynthesisService.ts
  FocusSelectorService.ts
  OpportunityPoolService.ts
  OpportunityRefreshService.ts
  SurfacingLogService.ts
  WeeklyContextService.ts
  CalendarContextService.ts
  IntentionContextService.ts
  scoring/
    suppressors.ts
    score-opportunity.ts
    score-types.ts
```

Keep the existing generators, but adapt them in place so they can emit `Opportunity` objects before any UI rewrite.

---

## 5. Recommended Flags

Use feature flags so we can validate behavior without a risky cutover.

| Flag | Purpose |
|---|---|
| `opportunity_system_shadow_mode` | Run the new selector in parallel and log results without changing UI |
| `opportunity_pool_enabled` | Persist synthesized opportunities instead of in-memory only |
| `focus_selector_enabled` | Make Focus read from the selector-backed surface service |
| `focus_opportunity_ui_enabled` | Enable primary/secondary opportunity UI in Focus |
| `opportunity_notifications_enabled` | Make smart notifications reuse selector output |
| `premium_opportunity_copy_enabled` | Turn on LLM enrichment for premium users |

---

## 6. Phase Plan

### Phase 0: Baseline Lock and Hot-Path Isolation

**Goal:** Make the current system safer to iterate on and prepare shadow-mode validation.

**Key tasks**
- Add a baseline test lock for existing suggestion, Focus, and notification behavior.
- Move `archiveExpiredFriendMemories()` out of `fetchSuggestions()` and keep it in startup/foreground maintenance only.
- Extract a `SuggestionFacade` boundary so the old UI can switch sources without changing consumers.
- Add shadow-mode logging that compares old list output with new selector output.

**Acceptance criteria**
- Suggestion fetch no longer depends on unrelated maintenance work.
- Existing suggestion tests are green or documented with known failures.
- We can run the new selector without changing user-visible behavior.

### Phase 1: Contracts, Taxonomy, and Score Model

**Goal:** Define the domain model and prove the selector logic in memory.

**Key tasks**
- Define `Opportunity`, `ScoredOpportunity`, `SelectionResult`, `TimingWindow`, `EffortLevel`, and `SuggestionCategory`.
- Normalize current category strings into a canonical taxonomy.
- Implement hard suppressors as pure functions.
- Implement weighted scoring as a pure function with fixture coverage.
- Build `WeeklyContextService`, `CalendarContextService`, and `IntentionContextService` as read-only services.
- Write the invalidation matrix before persistence work starts.

**Acceptance criteria**
- The selector can score and select opportunities in memory from typed fixtures.
- Category names are no longer scattered ad hoc across generators.
- The score model is testable without UI, storage, or notifications.

### Phase 2: Opportunity Synthesis and Legacy Adapter

**Goal:** Reuse the existing generator investment while changing the output contract.

**Key tasks**
- Refactor generator output from display-ready `Suggestion` objects to domain-level `Opportunity` objects.
- Add `OpportunityAdapter` to map opportunities back into legacy `Suggestion` shape.
- Thread active intentions through generation so opportunities can carry `intentionId` and explanation fields.
- Add enriched template copy driven by `explanation` and `copyContext`.
- Keep `fetchSuggestions()` alive, but let it read from the adapter when the new pipeline is enabled.

**Acceptance criteria**
- Existing UI can render adapter-backed results without knowing opportunities exist.
- Opportunities now carry urgency, confidence, effort, timing, explanation, and intention context.
- No Focus UI changes are required yet.

### Phase 3: Persistence, Refresh, and Invalidation

**Goal:** Add the lean pool only after the in-memory model is stable.

**Key tasks**
- Add `opportunity_pool` and `surfacing_log` tables.
- Add new `UserProfile` fields for windows, learned timing, frequency, pool refresh state, calendar permission state, and last app open.
- Create `OpportunityPoolService` and `OpportunityRefreshService`.
- Implement context-hash staleness detection.
- Wire refresh triggers from plans, intentions, battery check-ins, calendar sync, life event changes, and journal/thread changes.
- Add TTL expiry and stale-row cleanup.

**Acceptance criteria**
- Pool rows are refreshed by explicit invalidation events, not only app launch.
- Stale opportunities can be detected without recomputing the whole world every time.
- Pool writes are additive and do not break existing suggestion reads.

### Phase 4: Selector Cutover and Focus Integration

**Goal:** Replace the current diversify-and-display behavior with one trusted best move.

**Key tasks**
- Add `FocusSelectorService` that reads from the pool or in-memory opportunities.
- Switch `useSuggestions()` and `FocusGenerator` to selector-backed results.
- Redesign only the suggestion section in `TodaysFocusWidgetV2`.
- Add primary and optional secondary opportunity presentation.
- Add feedback actions: Act, Snooze, Not now, Not this friend.
- Log surfaced opportunities only when actually displayed.
- Remove or bypass `SuggestionDiversifier`, `time-aware-filter.ts`, guaranteed suggestions, and emergency fallback when the new selector is enabled.

**Acceptance criteria**
- Focus can show `primary`, `secondary`, or a true "all good" suggestion state.
- Surfacing telemetry reflects what the user actually saw.
- The old list pipeline is no longer the source of truth when the flag is enabled.

### Phase 5: Settings Ownership and Notification Unification

**Goal:** Make timing and frequency coherent across Focus and notifications.

**Key tasks**
- Move opportunity timing/frequency ownership to `UserProfile`.
- Keep `NotificationPreferences` for delivery concerns only: quiet hours, digest, push permissions.
- Update `NotificationSettings.tsx` to read/write the new ownership model.
- Write `last_app_open` from app foreground logic in `DataInitializer.tsx`.
- Make `smart-suggestions.ts` call the selector instead of generating its own set of suggestions.
- Re-enable smart suggestion notifications only after selector thresholds are validated.

**Acceptance criteria**
- Focus and notifications agree on what the best opportunity is.
- `maxDailySuggestions` is no longer used by the main suggestion path.
- Timing settings have one source of truth.

### Phase 6: Learned Timing, Tuning, and Premium Copy

**Goal:** Improve relevance after the core system is stable.

**Key tasks**
- Compute learned timing windows from surfacing and action telemetry.
- Tune scoring weights from real action outcomes.
- Add premium LLM enrichment with caching only after template quality is good enough.
- Add experiments for copy variants and threshold tuning.

**Acceptance criteria**
- Learned timing can be turned on independently of the core selector.
- Premium copy is an enhancement layer, not a dependency for core system quality.

---

## 7. Invalidation Matrix

| Trigger | What Changes | Action |
|---|---|---|
| Weave completed, edited, or cancelled | Relationship urgency, weekly load, recency suppressors | Recompute affected friend opportunities and rerun selector |
| Intention created, updated, dismissed, converted | Intention alignment score and eligible actions | Recompute linked friend opportunities |
| Battery check-in | Battery/season fit and timing suitability | Rescore selector immediately; regenerate only if effort/copy context depends on battery |
| Calendar sync change | Busy windows, free time, planned-friend suppressors | Refresh `CalendarContext`, rerun selector, regenerate event-derived opportunities if needed |
| Life event created or updated | Deadline-driven opportunities | Recompute affected friend opportunities |
| Journal signal or thread change | Signal-driven opportunities and confidence | Recompute signal opportunities for linked friends |
| App foreground / day boundary | Window match, quiet state, expiry, stale pool rows | Rerun selector and expire stale opportunities |
| Notification or window preference change | Surfacing thresholds and valid windows | Rerun selector; no full generation unless taxonomy or copy rules changed |

---

## 8. Testing and Validation

### Unit Tests
- suppressor logic
- scoring weights and score breakdowns
- selection threshold behavior
- category normalization
- adapter mapping from `Opportunity` to `Suggestion`

### Integration Tests
- `fetchSuggestions()` facade with old and new backends
- `useSuggestions()` tracking only surfaced items
- Focus widget state transitions: primary, primary+secondary, all good
- notification channel consuming selector output
- migration tests for `opportunity_pool`, `surfacing_log`, and `UserProfile` additions

### Manual QA
- quiet week / no opportunities
- high urgency life event
- active intention beating a higher urgency but poorly timed drift item
- low battery / resting season suppression
- snooze and "not this friend" feedback loops
- app foreground refresh and notification suppression after recent app open

### Shadow-Mode Metrics
- old top suggestion vs new primary overlap
- percentage of sessions with no surfaced opportunity
- action rate on surfaced primary
- dismissal rate by category
- notification send-to-open and send-to-act rate

---

## 9. Key Risks and Mitigations

| Risk | Why It Matters | Mitigation |
|---|---|---|
| Over-coupling the rollout to new persistence | Could stall the whole redesign behind migration work | Keep Phase 1-2 working fully in memory |
| Split-brain settings | Focus and notifications could behave inconsistently | Migrate timing/frequency ownership explicitly and keep a temporary compatibility mirror |
| Fragile hot path | Current provider can fail due to unrelated maintenance | Remove cleanup side effects from suggestion fetches first |
| UI cutover too early | Can make the new system feel worse before scoring is tuned | Keep legacy adapter and shadow metrics until selector confidence is high |
| Taxonomy drift | Rules and analytics become brittle if categories stay informal | Lock a canonical enum in Phase 1 |

---

## 10. Suggested First Ticket Set

If we start this week, I would sequence the first tickets like this:

1. `SUG-000` Baseline test lock + shadow-mode scaffolding
2. `SUG-001` Remove maintenance side effects from `fetchSuggestions()`
3. `SUG-002` Define `Opportunity` contracts and category taxonomy
4. `SUG-003` Implement pure suppressors and weighted scoring with fixtures
5. `SUG-004` Build `WeeklyContextService`, `CalendarContextService`, and intention loader
6. `SUG-005` Add `OpportunityAdapter` so the existing UI can read new outputs safely

That gives you a real execution starting point without forcing the UI, persistence, and notification migrations to land all at once.
