# Weave Core Design Audit and Implementation Plan

## Document Metadata

| Property | Value |
|---|---|
| Owner | Product + Engineering |
| Scope | Core proposition, Circle dashboard UX, suggestion loop, scoring/decay model, energy adaptation |
| Status | Proposed |
| Last Updated | February 4, 2026 |

---

## 1) Executive Summary

Weave already has a strong foundation for the proposition: "help people allocate attention across relationships while respecting their energy." The current architecture contains most required primitives (tiered relationship model, score decay, intelligent suggestions, social battery, social season).

The main issue is not missing features. It is **loop coherence**:

1. **Trust gap:** score semantics are not fully consistent across calculation paths and UI surfaces.  
2. **Priority gap:** Circle ranking is not consistently tier-aware and can feel inconsistent between views.  
3. **Agency gap:** suggestion dismiss/snooze behavior is not consistently persistent in key flows.  
4. **Adaptation gap:** energy check-ins do not always propagate quickly to season/suggestion behavior.

If we fix those four gaps (while preserving the app's calm, non-naggy tone), Weave can feel like one coherent "relationship operating system" rather than separate screens.

---

## 2) Product Intent (North Star)

### Weave should function as one closed-loop system

1. **Sense:** Observe relationship signals (interactions, time-since-contact, tier expectations, context).  
2. **Prioritize:** Decide who needs care now and why.  
3. **Act:** Make action frictionless (log, plan, reflect, reach out).  
4. **Learn:** Update trustable score + next best suggestions.  
5. **Adapt:** Modulate recommendations by current social energy and season.

### Tone guardrail (product philosophy)

- Do not introduce naggy "attention debt" surfaces.
- Let users infer priority through sorting, suggestions, and usage patterns.
- Keep Circle focused on practical action, not heavy explanation UI.

When this loop is healthy, users should feel:
- "I know who needs me now."
- "I understand why."
- "I can act in one tap."
- "The app adapts to my real capacity."

---

## 3) Current-State Audit

### 3.1 What is already working well

- **Strong proposition primitives:** Dunbar tiers, tier-specific decay, archetype modifiers, momentum, quality-weighted scoring.
- **Action surfaces exist:** quick log/plan/add in Circle; suggestion and reflection flows in Insights.
- **Good modularization:** scoring, decay, suggestions, season, and UI widgets are already separated into maintainable services/components.
- **Scalable suggestion foundation:** candidate-selection + diversification pipeline is in place.

### 3.2 Critical findings and impact

#### A) Decay/backfill trust risk
- Evidence: `src/modules/intelligence/services/decay.service.ts`, `src/modules/intelligence/services/orchestrator.service.ts`
- Issue: `calculateDecayAmount(friend, days)` uses `daysSince(friend.lastUpdated)` for grace check instead of the passed `days` argument, and gap-decay calls in scoring do not always pass `season`.
- Impact: score outcomes for backfilled/older interactions can be wrong or inconsistent with user expectations.

#### B) Ranking inconsistency across Circle views
- Evidence: `src/modules/relationships/components/FriendTierList.tsx`, `src/modules/relationships/components/FriendSearchResults.tsx`
- Issue: tier view sorts by stored raw `weaveScore`; search/sort view uses decayed current score.
- Impact: "who needs attention" changes by view, reducing user trust.

#### C) Stale friend health rendering edge case
- Evidence: `src/modules/relationships/components/FriendListRow.tsx`
- Issue: memoized score calculation omits archetype/tier dependencies though decay logic depends on both.
- Impact: card color/health state can lag after certain profile updates.

#### D) Suggestion action loop integrity gaps
- Evidence: `src/modules/home/components/widgets/widgets/TodaysFocusWidgetV2.tsx`, `src/modules/interactions/hooks/useSuggestions.ts`
- Issues:
  - Dismiss in action sheet currently closes UI but does not persist dismissal.
  - Plan flow uses `suggestion.category` (often meta category) instead of interaction category.
  - Suggestion stats sync effect depends on `suggestions.length`, not composition/urgency changes.
- Impact: reduced agency and occasional mismatch between recommendation and action destination.

#### E) Energy responsiveness lag
- Evidence: `app/dashboard.tsx`, `src/modules/auth/store/user-profile.store.ts`, `src/modules/home/components/widgets/widgets/YourPulseWidget.tsx`, `src/modules/auth/hooks/useSocialBatteryStats.ts`
- Issue: battery check-ins update data, but season/suggestion adaptation can lag due to stale caches and dependency gating.
- Impact: users do not immediately feel that "my energy changed, so recommendations changed."

#### F) Candidate selection blind spots at scale
- Evidence: `src/modules/interactions/services/suggestion-system/SuggestionCandidateService.ts`
- Issue: candidate preselection and drift thresholds rely heavily on raw stored score and fixed hard cap.
- Impact: decayed at-risk relationships can be missed in larger networks.

---

## 4) Target Experience Design

### 4.1 Core UX model

**Circle = operational triage and action.**  
**Insights = explanation, pattern context, and reflection.**

Circle should answer in under 3 seconds, without a new explicit "Why now?" surface:
1. Who needs attention right now?
2. What should I do next?

### 4.2 Circle information architecture (target)

1. **Tier Browser** (Inner / Close / Community remains primary)  
2. **Quick Actions** (log, plan, add; same as today)  
3. **Search/Filters** (preserved; semantics unified)

### 4.3 Tier-aware sorting contract (default behavior)

When a user is viewing a specific tier, ordering should be evaluated against that tier's expectations.

Default sort in a tier view:
1. Tier-aware health state severity (worst first, computed against that tier).  
2. `S_current` ascending.  
3. `lastUpdated` ascending.

Example:
- User is in **Inner Circle** view.
- Four friends are green, one is yellow.
- Yellow appears at the top (even if absolute score might look acceptable in a lower tier).

---

## 5) Target System Design

### 5.1 Canonical score semantics

Define two explicit score types:

- **Stored Score (`S_stored`)**: value persisted in `friend.weaveScore`.
- **Current Score (`S_current`)**: `S_stored` after decay at read-time using current date and active season.

Policy: all user-facing priority/ranking logic must use `S_current`.

#### Canonical ranking function

For tier-based lists:
1. Compute `S_current`.
2. Compute tier-aware health band using the friend's tier threshold (for example: Inner Circle < 50 drifts sooner than Community).  
3. Sort by:
   - tier-aware health severity (worst first),
   - then `S_current` ascending,
   - then `lastUpdated` ascending.

For cross-tier search/sort:
- Keep one deterministic order but preserve tier-aware state logic so users do not see contradictory prioritization between views.

### 5.2 Decay and backfill correctness

Design rule:
- `calculateDecayAmount(friend, days, ..., season)` must use the passed `days` for grace/decay math.
- All scoring paths that simulate gaps/backfill must pass `season` consistently.

This guarantees deterministic behavior for:
- future-dated interaction guardrails,
- historical/backfilled logs,
- seasonal decay adjustments.

### 5.3 Suggestion action contract

Separate fields conceptually:
- `suggestion.category` = reasoning bucket (e.g., `high-drift`, `insight`, `maintain`)
- `suggestion.action.prefilledCategory` = interaction category for logger/planner (e.g., `text-call`, `deep-talk`)

UI action routing must use `action.prefilledCategory` first, with safe fallback mapping only when missing.

### 5.4 Energy adaptation contract

After a social battery check-in:
1. Persist check-in.
2. Invalidate battery stats and season cache.
3. Recompute season context quickly.
4. Invalidate suggestions query.
5. Render updated recommendations in current session.

Target: visible recommendation adaptation within the same app session, without requiring manual refresh.

---

## 6) Implementation Plan (Workstreams)

### Workstream A: Score Trust and Semantic Unification

### Files to update
- `src/modules/intelligence/services/decay.service.ts`
- `src/modules/intelligence/services/orchestrator.service.ts`
- `src/modules/relationships/components/FriendTierList.tsx`
- `src/modules/relationships/components/FriendSearchResults.tsx`
- `src/modules/relationships/components/FriendListRow.tsx`
- `src/modules/intelligence/__tests__/decay.service.test.ts`

### Changes
1. Fix grace/gap logic in `calculateDecayAmount` to use function inputs deterministically.
2. Pass `season` in all gap decay/penalty calls in orchestrator scoring.
3. Make tier view ranking use `calculateCurrentScore` and tier-aware health severity.
4. Expand `FriendListRow` score memo dependencies to include fields that influence decay (tier/archetype).
5. Add tests for:
   - grace boundary,
   - backfill penalty correctness,
   - season-aware gap scoring,
   - tier-aware ordering behavior (including "yellow above green in active tier"),
   - ranking parity between tier and search views.

### Acceptance criteria
- Same friend ordering logic across Circle tier view and search default sort.
- Tier view always prioritizes the most at-risk relationship for that tier first.
- Backfilled interaction score outcomes match deterministic expected values.
- No stale health state after tier/archetype update.

---

### Workstream B: De-scoped (Preserve Weave Tone)

No new "Why now?" section/tab is planned for this phase.

Rationale:
1. It risks a naggy product tone.
2. Priority can be inferred from tier-aware sorting + existing suggestion surfaces.
3. This phase should focus on trust and loop integrity, not major IA shifts.

Status:
- Moved to backlog as an optional future experiment only.

---

### Workstream C: Suggestion Loop Integrity

### Files to update
- `src/modules/home/components/widgets/widgets/TodaysFocusWidgetV2.tsx`
- `src/modules/interactions/hooks/useSuggestions.ts`
- `src/modules/interactions/services/suggestion-storage.service.ts` (reuse existing API)
- (new) `src/modules/interactions/utils/suggestion-action-mapper.ts`

### Changes
1. Wire dismiss action in Today Focus to `dismissSuggestion` from hook with cooldown policy.
2. Use `suggestion.action.prefilledCategory` for plan/log flows.
3. Add fallback mapping utility from meta suggestion categories to valid interaction categories when needed.
4. Change suggestion stats sync dependency from `length` only to a stable fingerprint including urgency composition.

### Acceptance criteria
- Dismiss persists across session reloads and suggestion refreshes.
- Plan flow always opens with valid interaction category.
- Badge/critical state reflects urgency changes even when list size is unchanged.

---

### Workstream D: Energy Responsiveness and Season Propagation

### Files to update
- `app/dashboard.tsx`
- `src/modules/auth/store/user-profile.store.ts`
- `src/modules/auth/hooks/useSocialBatteryStats.ts`
- `src/modules/home/components/widgets/widgets/YourPulseWidget.tsx`
- `src/shared/stores/dashboardCacheStore.ts`

### Changes
1. On battery submit, invalidate season cache and battery stats query immediately.
2. Ensure season recalculation can trigger on relevant battery changes (not only friend/interaction count changes).
3. Invalidate suggestions after battery/season updates to refresh recommendation mix.
4. Add lightweight guard to prevent thrashing (debounce + dedupe by timestamp).

### Acceptance criteria
- Battery check-in causes visible season/suggestion update in-session.
- No infinite recalculation loops or excessive invalidations.

---

### Workstream E: Candidate Coverage and Scale Behavior

### Files to update
- `src/modules/interactions/services/suggestion-system/SuggestionCandidateService.ts`
- `src/modules/interactions/services/suggestion-provider.service.ts`
- `src/modules/interactions/services/suggestion-system/__tests__/...`

### Changes
1. Reduce raw-score bias by incorporating decayed score checks in candidate qualification.
2. Make candidate cap adaptive by network size (bounded).
3. Preserve fairness quotas (drift/active/stale) while avoiding starvation of quiet relationships.

### Acceptance criteria
- At-risk but decayed friends appear reliably in candidate pool for larger networks.
- Suggestion generation latency remains within acceptable budget.

Status:
- Deferred unless scale pain is observed (large network users, suggestion quality drop, or generation latency regressions).

---

## 7) Telemetry and Success Metrics

### Product KPIs
- **Action Conversion:** % of shown suggestions acted on within 24h.
- **Triage Clarity:** median time from Circle open to first action.
- **Trust Consistency:** mismatch rate between tier view priority and search default priority.
- **Energy Adaptation Latency:** time from battery check-in to updated suggestion set.

### Suggested events
- `suggestion_dismissed`
- `suggestion_snoozed`
- `battery_checkin_submitted`
- `season_recomputed`

---

## 8) QA and Testing Strategy

### Unit
- Decay/backfill deterministic math.
- Suggestion action mapping and fallback behavior.

### Integration
- Circle ranking parity across tier and search views.
- Tier-aware in-list ordering behavior by active tier.
- Today Focus dismiss persistence and refresh behavior.
- Battery check-in -> season update -> suggestion refresh chain.

### Manual scenario checks
1. Backfill old interaction for an Inner Circle friend near grace threshold.
2. Change archetype and verify immediate row state update.
3. Dismiss high-urgency suggestion; confirm it stays dismissed for cooldown.
4. Submit low-energy battery check-in; verify low-energy suggestion bias appears.

---

## 9) Delivery Phasing (Recommended)

### Phase 1 (Week 1): Trust Foundation
- Workstream A

### Phase 2 (Week 2): Loop Integrity
- Workstream C

### Phase 3 (Week 3): Energy Adaptation
- Workstream D

### Phase 4 (Backlog, only if needed): Scale hardening
- Workstream E (conditional)

---

## 10) Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Score behavior changes feel abrupt to existing users | Medium | Release notes + stable thresholds + staged rollout |
| Over-invalidation hurts performance | Medium | debounce, query dedupe, cache guards |
| Category mapping mistakes in action routing | High | strict mapper tests + safe defaults |

---

## 11) Non-Goals (for this phase)

- Full redesign of all Insights widgets.
- New gamification systems.
- Large schema migrations not required for loop integrity.

---

## 12) Final Recommendation

Prioritize **A -> C -> D**.  
Keep Circle's current calm interaction model, and improve prioritization through **tier-aware default sorting** rather than introducing a new explanatory UI layer.
