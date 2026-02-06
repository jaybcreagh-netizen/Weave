# Journal + Oracle + Memory Phased Implementation Plan

## Document Metadata

| Property | Value |
|---|---|
| Owner | Product + Engineering |
| Status | Proposed for Execution |
| Last Updated | February 5, 2026 |
| Inputs | `docs/ORACLE_MEMORY_QA_CHECKLIST.md` (completed), journal/oracle code audit |
| Scope | Journal feature wiring, Oracle context quality, memory integration coherence, UX expansion |

---

## 1) Plan Intent

This plan assumes Oracle Memory core flows are working and QA checked.  
The goal now is to:

1. Eliminate journal/oracle contract bugs and dead wiring.
2. Increase Oracle grounding quality from journal and memory context.
3. Unify journal UX paths and improve data freshness.
4. Add high-value expansion items only after core reliability is stable.

Non-goal for this cycle: large new data model redesigns beyond already-shipped memory tables.

---

## 2) Timeline and Phases

| Phase | Window | Outcome |
|---|---|---|
| Phase 0 | Feb 9-10, 2026 | Baseline lock and ship gate instrumentation |
| Phase 1 | Feb 11-14, 2026 | P0 wiring and routing contract fixes |
| Phase 2 | Feb 17-21, 2026 | Context correctness and intelligence integrity |
| Phase 3 | Feb 24-28, 2026 | UX coherence and refresh behavior |
| Phase 4 (Optional) | Mar 3-7, 2026 | Expansion features behind flags |

---

## 3) Ticket Board

### Phase 0 - Baseline Lock

| ID | Title | Priority | Estimate | Owner | Depends On |
|---|---|---|---|---|---|
| JOM-000 | Baseline test lock + required checks | P0 | 0.5d | Platform | None |
| JOM-001 | Journal/Oracle release gate checklist | P1 | 0.5d | QA + Product | None |

#### JOM-000 - Baseline test lock + required checks
- Scope
  - Add required CI checks for memory + journal/oracle regressions.
  - Ensure this cycle cannot merge without passing baseline suites.
- Files
  - CI workflow files, test scripts.
- Acceptance Criteria
  - Typecheck and baseline tests must pass before merge.
  - Failing journal/memory tests block merge.

#### JOM-001 - Journal/Oracle release gate checklist
- Scope
  - Create a concise runbook for manual end-to-end checks across journal, oracle, memory routes.
- Files
  - `docs/JOURNAL_ORACLE_RELEASE_QA_CHECKLIST.md` (new).
- Acceptance Criteria
  - Checklist covers: deep links, prefills, arc flow, add_memory actions, stale refresh cases.

---

### Phase 1 - P0 Wiring and Contract Fixes

| ID | Title | Priority | Estimate | Owner | Depends On |
|---|---|---|---|---|---|
| JOM-101 | Fix journal feed pagination offset | P0 | 0.5d | Journal FE | JOM-000 |
| JOM-102 | Fix Memory Moment "Write now" guided prefill | P0 | 0.5d | Journal FE | JOM-000 |
| JOM-103 | Align Expand Mode deep-link contract | P0 | 0.5d | Oracle FE | JOM-000 |
| JOM-104 | Wire GuidedReflection friend picker modal | P1 | 0.5d | Journal FE | JOM-000 |
| JOM-105 | Complete JournalEntryDetail onReflect plumbing | P1 | 1d | Journal + Oracle FE | JOM-000 |

#### JOM-101 - Fix journal feed pagination offset
- Problem
  - Feed uses merged item count (entries + reflections) as DB offset, causing skipped journal entries.
- Files
  - `src/modules/journal/components/Journal/JournalFeed.tsx`
  - `src/modules/journal/hooks/useJournalFeed.ts`
- Acceptance Criteria
  - Infinite scroll returns all journal entries without gaps.
  - Reflections remain visible only on first page behavior as designed.

#### JOM-102 - Fix Memory Moment "Write now" guided prefill
- Problem
  - Prefill params are pushed without guided mode, so journal does not consume them.
- Files
  - `src/shared/components/GlobalModals.tsx`
  - `app/journal.tsx`
- Acceptance Criteria
  - Tapping "Write now" opens guided writing with memory text and friend pre-tag applied.

#### JOM-103 - Align Expand Mode deep-link contract
- Problem
  - Expand mode uses unsupported `/journal` params (`autoCreate`, `content`).
- Files
  - `src/modules/oracle/components/modes/ExpandModeView.tsx`
  - `app/journal.tsx`
- Acceptance Criteria
  - "Save to Journal" and "Edit Manually" from Expand mode land in a supported and prefilled journal flow.

#### JOM-104 - Wire GuidedReflection friend picker modal
- Problem
  - Friend picker state and modal exist, but modal is never rendered.
- Files
  - `src/modules/journal/components/GuidedReflection/PromptedReflectionFlow.tsx`
- Acceptance Criteria
  - "Tag friend/Add another" opens picker.
  - Selecting/deselecting friend updates tag chips immediately.

#### JOM-105 - Complete JournalEntryDetail onReflect plumbing
- Problem
  - `onReflect` prop path exists but is not used; direct oracle open bypasses lens context.
- Files
  - `src/modules/journal/components/JournalEntryDetailSheet.tsx`
  - `app/journal.tsx`
- Acceptance Criteria
  - Reflect action follows one path and can include suggestion/lens context.
  - Unused imports and dead handlers are removed.

---

### Phase 2 - Context Correctness and Intelligence Integrity

| ID | Title | Priority | Estimate | Owner | Depends On |
|---|---|---|---|---|---|
| JOM-201 | Make friend-arc reflections truly friend-scoped | P1 | 0.5d | Journal Data | JOM-101 |
| JOM-202 | Upgrade Oracle journal grounding with signals | P1 | 1.5d | Oracle Data | JOM-105 |
| JOM-203 | Complete friend sentiment + mention counters | P1 | 1d | Journal Intelligence | JOM-201 |
| JOM-204 | Smart action schema parity + tests (`add_memory`) | P1 | 1d | Oracle + Journal | JOM-202 |

#### JOM-201 - Make friend-arc reflections truly friend-scoped
- Problem
  - Arc includes unrelated reflections due to broad fallback query.
- Files
  - `src/modules/journal/services/journal-context-engine.ts`
- Acceptance Criteria
  - Arc reflections shown for a friend are linked or inferred with explicit matching rules only.
  - No unrelated weekly reflections appear in manual QA.

#### JOM-202 - Upgrade Oracle journal grounding with signals
- Problem
  - Recent journaling in Oracle context is currently title + length heuristic.
- Files
  - `src/modules/oracle/services/context-builder.ts`
- Acceptance Criteria
  - Context includes signal-derived sentiment/theme summaries and friend-linked relevance.
  - Oracle responses in journal context are materially more specific in QA prompts.

#### JOM-203 - Complete friend sentiment + mention counters
- Problem
  - Friend model fields exist but write logic is incomplete.
- Files
  - `src/modules/journal/services/journal-intelligence.service.ts`
  - `src/db/models/Friend.ts` (if helper updates needed only).
- Acceptance Criteria
  - `lastJournalSentiment` and `journalMentionCount` update on processed entries.
  - Values change correctly on multi-entry scenarios in tests.

#### JOM-204 - Smart action schema parity + tests (`add_memory`)
- Problem
  - Drift risk across prompt/schema/types/action execution layers.
- Files
  - `src/shared/services/llm/prompt-registry.ts`
  - `src/modules/oracle/services/oracle-schemas.ts`
  - `src/modules/oracle/services/types.ts`
  - `src/modules/oracle/services/action-extraction.service.ts`
- Acceptance Criteria
  - `add_memory` appears consistently in schema, types, extraction, and UI execution.
  - Contract tests fail if schema and types diverge.

---

### Phase 3 - UX Coherence and Data Freshness

| ID | Title | Priority | Estimate | Owner | Depends On |
|---|---|---|---|---|---|
| JOM-301 | Unify guided reflection entry path | P1 | 4d | Journal UX | JOM-104, JOM-105 |
| JOM-302 | Make friend/calendar tabs reactive | P1 | 1d | Journal FE | JOM-101 |
| JOM-303 | Add Journal search/filter surface | P2 | 1d | Journal FE | JOM-302 |
| JOM-304 | Finish placeholder actions in detail sheet | P2 | 1d | Journal + Oracle FE | JOM-105 |

#### JOM-301 - Unify guided reflection entry path
- Problem
  - Two distinct guided flows (prompt-led modal vs Oracle-guided sheet) create duplicated UX and unclear entry points.
- Files
  - `app/journal.tsx`
  - `src/modules/journal/components/GuidedReflection/GuidedReflectionSheet.tsx`
  - `src/modules/journal/components/GuidedReflection/PromptedReflectionFlow.tsx`
- Acceptance Criteria
  - Single container UX: GuidedReflectionSheet owns the experience.
  - First step offers two explicit modes: "Prompted write" (prompt picker) and "Oracle coach" (Q/A).
  - Prompt selection + inspiration chips from the legacy modal are ported into the sheet flow.
  - Optional friend context panel parity is added or consciously removed with product sign-off.
  - All entry points (journal home, quick capture, post-weave, oracle) route to the unified sheet.
  - Legacy GuidedReflection modal is removed or disabled behind a feature flag.

#### JOM-301 Subtasks (proposed)
- JOM-301a (0.5d): UX decision + copy for mode selector (Prompted write vs Oracle coach). Confirm prefill behavior and whether friend context panel is in-scope.
- JOM-301b (0.5-1d): Add mode selector step to GuidedReflectionSheet and state routing (defaulting to Oracle coach when a ReflectionContext is pre-specified).
- JOM-301c (1.5-2d): Port prompt-driven flow into GuidedReflectionSheet (context/prompt/write + inspiration chips + friend tagging).
- JOM-301d (0.5-1d): Route all entry points to unified sheet and remove/disable legacy GuidedReflection modal.
- JOM-301e (0.5d): QA + regression pass across journal, quick capture, weave reflect, and oracle entry points.

#### JOM-302 - Make friend/calendar tabs reactive
- Problem
  - Friend and calendar tabs load once and can go stale.
- Files
  - `src/modules/journal/components/Journal/JournalFriendList.tsx`
  - `src/modules/journal/components/Journal/JournalCalendar.tsx`
- Acceptance Criteria
  - Save/edit/delete from journal surfaces updates tabs without app restart.
  - Refresh behavior is deterministic in manual QA.

#### JOM-303 - Add Journal search/filter surface
- Problem
  - Search affordance exists in header but no functional surface.
- Files
  - `src/modules/journal/components/JournalHome.tsx`
  - supporting filter/search utilities.
- Acceptance Criteria
  - User can search entries by title/content and optionally friend.
  - Empty states and clear/reset are implemented.

#### JOM-304 - Finish placeholder actions in detail sheet
- Problem
  - Some smart actions use placeholders/reused handlers.
- Files
  - `src/modules/journal/components/JournalEntryDetailSheet.tsx`
- Acceptance Criteria
  - `schedule_event` and `create_intention` actions route to actual destinations.
  - No placeholder no-op action paths remain.

---

### Phase 4 (Optional) - Expansion Behind Flags

| ID | Title | Priority | Estimate | Owner | Depends On |
|---|---|---|---|---|---|
| JOM-401 | Oracle memory citation chips | P2 | 1d | Oracle UX | JOM-202 |
| JOM-402 | Arc memory timeline + quick review actions | P2 | 1.5d | Journal UX | JOM-201 |
| JOM-403 | Weekly journal+memory synthesis card | P2 | 1.5d | Insights + Journal | JOM-202, JOM-203 |

#### JOM-401 - Oracle memory citation chips
- Acceptance Criteria
  - Oracle responses can optionally show lightweight "based on memory" references.
  - Can be disabled via feature flag.

#### JOM-402 - Arc memory timeline + quick review actions
- Acceptance Criteria
  - Friendship Arc shows memory milestones inline.
  - Pending memory suggestions are reviewable from arc without leaving flow.

#### JOM-403 - Weekly journal+memory synthesis card
- Acceptance Criteria
  - Weekly synthesis highlights top themes, memory changes, and suggested next move.
  - Works even if no new memory candidates exist.

---

## 4) Test and QA Plan by Phase

### Automated checks (minimum)
- `npx tsc --noEmit`
- Memory lifecycle tests from `docs/ORACLE_MEMORY_QA_CHECKLIST.md`
- Journal context tests:
  - `src/modules/journal/services/__tests__/journal-context-engine.test.ts`
  - `src/modules/journal/services/__tests__/journal-prompts.test.ts`
  - `src/modules/journal/services/__tests__/prompt-context-builder.test.ts`
  - `src/modules/journal/services/__tests__/smart-prompt-generator.test.ts`
  - `src/modules/journal/services/__tests__/signal-extractor.test.ts`
- New tests added in this plan (pagination, deep-link contracts, context builder, schema parity).

### Manual checks (release gate)
- Execute `docs/ORACLE_MEMORY_QA_CHECKLIST.md`.
- Execute `docs/JOURNAL_ORACLE_RELEASE_QA_CHECKLIST.md` (from JOM-001).

---

## 5) Phase Exit Criteria

### Exit A (end of Phase 1)
- No known journal/oracle deep-link or prefill contract mismatches.
- Pagination and guided friend-tagging regressions closed.

### Exit B (end of Phase 2)
- Oracle context quality improved with signal-aware grounding.
- Friend sentiment/mention intelligence fields update correctly.

### Exit C (end of Phase 3)
- Guided flow is unified and discoverable.
- Journal tabs remain fresh without manual app restart.

### Exit D (Phase 4 optional)
- Expansion features are feature-flagged and stable in QA.

---

## 6) Tracking and Status Template

Use this for sprint updates:

| Ticket | Status | Owner | ETA | Notes |
|---|---|---|---|---|
| JOM-101 | Todo | TBD | TBD | |
| JOM-102 | Todo | TBD | TBD | |
| JOM-103 | Todo | TBD | TBD | |
| JOM-104 | Todo | TBD | TBD | |
| JOM-105 | Todo | TBD | TBD | |
| JOM-201 | Todo | TBD | TBD | |
| JOM-202 | Todo | TBD | TBD | |
| JOM-203 | Todo | TBD | TBD | |
| JOM-204 | Todo | TBD | TBD | |
| JOM-301 | Todo | TBD | TBD | |
| JOM-302 | Todo | TBD | TBD | |
| JOM-303 | Todo | TBD | TBD | |
| JOM-304 | Todo | TBD | TBD | |
| JOM-401 | Backlog | TBD | TBD | Optional |
| JOM-402 | Backlog | TBD | TBD | Optional |
| JOM-403 | Backlog | TBD | TBD | Optional |
