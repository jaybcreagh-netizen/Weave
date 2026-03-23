# AI Feature Separation Implementation Checklist

Companion document to `docs/AI_FEATURE_SEPARATION_AUDIT.md`.

This checklist turns the audit into concrete implementation work by file, with suggested phase boundaries, acceptance criteria, and testing targets.

## Goal

Ship a version of Weave where:

- core journaling, focus, and relationship workflows are fully usable with AI off
- local intelligence remains available to all users
- Oracle and remote enrichment become explicit optional capabilities
- the app no longer treats "provider registered" as equivalent to "feature allowed"

## Delivery Strategy

Do this in thin vertical slices, not one big rewrite.

Recommended PR sequence:

1. capability service + settings wiring
2. journal pipeline split
3. Today / Focus local-first
4. Oracle entry-point gating
5. weekly reflection helpers + narrative helpers
6. proactive insights separation
7. cleanup and legacy removal

## Phase 0: Decide the Product Matrix

Before code changes, align on the intended product behavior.

### Decisions to lock

- Is local rule-based journal signal extraction available to everyone?
- Are archetypes and social season framing always on, even with AI off?
- Is Oracle chat paid-only, opt-in-only, or both?
- Do free users get any remote enrichment at all?
- Should proactive insights still exist as local-template nudges when remote AI is off?

### Deliverable

- a small written product matrix in the audit doc or product brief

### Acceptance criteria

- team agrees on what "AI Off", "Free", and "Paid + Opted In" mean in practice
- engineering no longer needs to infer product behavior from current code

## Phase 1: Build a Real Capability Layer

### Why first

Everything else depends on a single source of truth.

### Files to add

- `src/modules/intelligence/services/intelligence-capabilities.service.ts`

### Files to update

- `src/modules/auth/hooks/useUserProfile.ts`
- `src/modules/auth/components/settings-modal.tsx`
- `src/modules/auth/components/settings/AISettings.tsx`
- `app/oracle-settings.tsx`
- optionally add `app/ai-settings.tsx` if you want a dedicated route

### Checklist

- [ ] Create a capability service that computes:
  - `localIntelligenceEnabled`
  - `remoteEnrichmentEnabled`
  - `oracleChatEnabled`
  - `guidedReflectionEnabled`
  - `backgroundAIEnabled`
  - `showOracleEntryPoints`
- [ ] Make capability evaluation depend on:
  - profile AI toggles
  - disclosure acknowledgement
  - entitlement / tier
  - network reachability
  - surface criticality if needed
- [ ] Stop using `llmService.isAvailable()` as a product permission check
- [ ] Wire `AISettings.tsx` into the settings flow or route structure
- [ ] Add a visible entry from `settings-modal.tsx` to AI / Oracle settings
- [ ] Decide whether Oracle settings should be merged into AI settings or remain separate

### Acceptance criteria

- all new work can ask one service whether a feature is allowed
- AI settings are reachable in the app
- Oracle settings are reachable in the app
- no UI needs to inspect raw profile flags directly unless it is literally editing them

### Testing

Add unit tests for the capability service covering:

- AI off + offline
- AI off + online
- free tier + online
- paid tier + online
- paid tier + offline
- disclosure missing

## Phase 2: Split the Journal Intelligence Pipeline

### Why next

This is the highest-risk blocker area because journal save flows still await AI-related work.

### Files to update

- `src/modules/journal/services/journal-intelligence.service.ts`
- `src/modules/oracle/services/action-extraction.service.ts`
- `src/modules/journal/services/signal-extractor.ts`
- `src/modules/journal/services/thread-extractor.ts`
- `src/modules/journal/components/QuickCaptureSheet.tsx`
- `src/modules/journal/components/JournalEntryModal.tsx`
- `src/modules/journal/components/GuidedReflection/GuidedReflectionSheet.tsx`
- `src/modules/journal/components/GuidedReflection/PromptedReflectionFlow.tsx`

### Checklist

- [ ] Split `journalIntelligenceService.processEntry()` into explicit local and remote passes
  - suggested shape:
    - `processEntryLocal()`
    - `processEntryRemote()`
    - `processEntry()` orchestrator
- [ ] Move rule-based signal extraction into the local pass
- [ ] Make thread extraction remote-only
- [ ] Make smart action extraction remote-only
- [ ] Add capability checks before remote journal work starts
- [ ] Remove duplicate action extraction in:
  - `JournalEntryModal.tsx`
  - `GuidedReflectionSheet.tsx`
- [ ] Decide whether `queueEntry()` remains at all once `processEntryRemote()` exists
- [ ] Ensure save receipts do not await remote enrichment
- [ ] Add a neutral receipt/loading state if you still want to show "insights loading" after save
- [ ] Make sure journal AI disabled means:
  - no thread extraction
  - no smart action extraction
  - no LLM title generation
- [ ] Keep the save path successful even if remote processing fails

### Acceptance criteria

- saving a journal entry succeeds with AI off
- saving a journal entry succeeds offline
- `aiJournalAnalysisEnabled = false` produces no remote journal calls
- action extraction happens at most once per saved entry
- no receipt or completion UI is blocked on remote analysis

### Testing

Extend or add tests for:

- `signal-extractor.test.ts`
- a new `journal-intelligence.service.test.ts`
- a new `action-extraction.service.test.ts`

Add cases for:

- AI disabled: no LLM calls
- remote enabled: remote calls happen once
- remote error: local save still succeeds
- thread extraction omitted: downstream result remains valid

## Phase 3: Make Today / Focus Local-First

### Why now

This is one of the user-reported blocker surfaces.

### Files to update

- `src/modules/home/components/widgets/widgets/TodaysFocusWidgetV2.tsx`
- `src/modules/home/components/FocusDetailSheet.tsx`
- optionally create a new local copy generator, for example:
  - `src/modules/home/services/focus-reflection.service.ts`
  - or extend an existing non-LLM narrative service

### Checklist

- [ ] Replace Oracle-first empty-state reflection with local baseline copy
- [ ] Only request remote daily reflection when `remoteEnrichmentEnabled` is true
- [ ] Make remote daily reflection async and non-blocking
- [ ] Keep existing fallback string behavior
- [ ] Audit Oracle-type suggestions opened from Today
- [ ] If Oracle is unavailable, degrade those suggestions to:
  - local journaling
  - local reflection prompts
  - local follow-up actions

### Acceptance criteria

- Today renders meaningful content with AI off
- Today renders meaningful content offline
- no empty-state blocking spinner depends on Oracle
- user can still complete Today / Focus tasks without Oracle

### Testing

Add component or service tests for:

- AI disabled path
- remote enabled path
- remote failure path
- no-calendar-events path

## Phase 4: Gate Oracle Entry Points and Oracle Product Surfaces

### Why here

After capabilities exist and core surfaces are safe, gate the explicitly remote parts.

### Files to update

- `src/modules/home/components/OracleFAB.tsx`
- `app/_home.tsx`
- `app/friend-profile.tsx`
- `src/modules/relationships/screens/FriendsDashboardScreen.tsx`
- `src/modules/journal/components/JournalHome.tsx`
- `src/modules/journal/components/JournalEntryDetailSheet.tsx`
- `src/modules/oracle/hooks/useOracleSheet.ts`
- `src/modules/oracle/components/OracleSheet.tsx`
- `src/modules/oracle/components/OracleModeSheet.tsx`
- `src/modules/oracle/hooks/useOracle.ts`
- `src/modules/oracle/hooks/useStarterPrompts.ts`
- `src/modules/oracle/components/OracleChat.tsx`

### Checklist

- [ ] Hide Oracle FAB when `showOracleEntryPoints` is false
- [ ] Gate the journal header Oracle button
- [ ] Gate "Ask Oracle" in journal entry detail
- [ ] Gate any Today / Focus suggestion that opens Oracle directly
- [ ] Add a fallback UX when a disabled entry point is reached anyway
  - for example:
    - open prompted reflection instead
    - open journal
    - show upgrade / enable AI sheet
- [ ] Make `useOracle.askQuestion()` or `oracleService.ask()` fail fast with a capability check
- [ ] Make Oracle starter prompts use static prompts when remote enrichment is unavailable

### Acceptance criteria

- users with AI off cannot accidentally enter Oracle chat
- users on free/offline tiers see a coherent local alternative
- Oracle surfaces no longer depend on hidden profile assumptions

### Testing

Add tests for:

- entry-point visibility
- fallback behavior when Oracle is disabled
- Oracle hook rejection when capability is false

## Phase 5: Gate Weekly Reflection Helpers and Narrative Helpers

### Why this is separate

These features are optional polish and should not regress the core weekly reflection flow.

### Files to update

- `src/modules/reflection/components/WeeklyReflection/ReflectionPromptStepComponent.tsx`
- `src/modules/reflection/components/EditReflectionModal.tsx`
- `src/modules/journal/services/reflection-assistant.service.ts`
- `src/modules/reflection/components/WeeklyReflection/WeeklyReflectionModal.tsx`
- `src/modules/reflection/services/ReflectionSynthesizerService.ts`
- `src/modules/intelligence/services/NarrativeService.ts`
- `src/modules/relationships/components/FriendshipStoryView.tsx`
- `src/modules/journal/components/FriendshipArcView.tsx`

### Checklist

- [ ] Gate weekly reflection "Help me write"
- [ ] Gate interaction reflection auto-draft
- [ ] Make `ReflectionAssistant` capability-aware
- [ ] Keep weekly narrative and weekly observations non-blocking
- [ ] Only show narrative-generation buttons when allowed, or degrade them to static copy
- [ ] Decide whether friendship story generation is:
  - premium only, or
  - remote optional for everyone

### Acceptance criteria

- weekly reflection baseline works with AI off
- optional helper buttons disappear or degrade cleanly
- friendship story generation is clearly optional and never blocks related screens

### Testing

Extend:

- `src/modules/reflection/services/__tests__/ReflectionSynthesizerService.test.ts`

Add:

- reflection assistant gating tests
- weekly helper visibility tests

## Phase 6: Separate Proactive Insights into Local Signals and Remote Polish

### Why later

This is less blocking than journaling and Today, but it affects multiple background triggers.

### Files to update

- `src/modules/oracle/services/insight-generator.ts`
- `src/modules/oracle/services/oracle-service.ts`
- `src/modules/oracle/components/OracleInsightSettings.tsx`
- `src/modules/oracle/components/InsightsCarousel.tsx`
- `src/modules/oracle/components/InsightsChip.tsx`
- `src/modules/interactions/services/weave-logging.service.ts`
- `src/shared/components/DataInitializer.tsx`

### Checklist

- [ ] Enforce `proactiveInsightsEnabled`
- [ ] Enforce suppressed rules if you want per-rule control to be real
- [ ] Keep local `InsightSignal` generation independent of remote polish
- [ ] Decide whether local users still get template-based nudges
- [ ] Gate background synthesis behind `backgroundAIEnabled`
- [ ] Prevent foreground / weave-logging triggers from firing remote work when disabled
- [ ] Make on-demand insight requests degrade gracefully when remote AI is unavailable

### Acceptance criteria

- proactive insight settings actually control behavior
- background Oracle synthesis does not run for AI-off users
- local signals can still exist without polished LLM copy if desired

### Testing

Add tests around:

- `InsightGenerator.generateDailyInsights()`
- `oracleService.synthesizeInsights()`
- setting combinations:
  - proactive insights off
  - frequency on-demand
  - suppressed rules present

## Phase 7: Cleanup and Legacy Reduction

### Why last

Do cleanup after the separation model is stable.

### Files to review

- `src/modules/auth/components/settings/AISettings.tsx`
- `src/modules/journal/services/smart-prompt-generator.ts`
- `src/modules/journal/services/useSmartPrompt.ts`
- `src/modules/oracle/services/oracle-service.ts` (`analyzeEntryContext`)
- `src/modules/reflection/services/oracle/oracle-service.ts`
- `src/shared/api/mutations/llm-mutations.ts`

### Checklist

- [ ] Remove or archive unused legacy Oracle wrappers
- [ ] Remove dead routes or wire them properly
- [ ] Decide whether the smart prompt generator should be adopted or retired
- [ ] Add comments or docs marking intentionally dormant AI utilities

### Acceptance criteria

- there is one clear way to do feature gating
- there is one clear journal-intelligence pipeline
- legacy AI files no longer create ambiguity for future contributors

## Suggested PR Breakdown

### PR 1: Capability service and settings plumbing

Files:

- capability service
- AI settings route / modal wiring
- Oracle settings wiring

Definition of done:

- feature checks are centralized
- settings are reachable

### PR 2: Journal pipeline split

Files:

- journal intelligence service
- action extraction service
- quick capture
- journal entry modal
- guided reflection receipt

Definition of done:

- journal saves never await remote enrichment
- no duplicate action extraction

### PR 3: Today / Focus local-first

Files:

- Today widget
- Focus detail sheet
- any new local copy helper

Definition of done:

- Today is safe offline and AI-off

### PR 4: Oracle gating

Files:

- Oracle FAB
- journal entry points
- Oracle hooks and sheet

Definition of done:

- remote Oracle is clearly optional

### PR 5: Weekly reflection and narrative helpers

Files:

- reflection assistant
- weekly reflection helper UI
- friendship story generation

Definition of done:

- helper features are optional polish only

### PR 6: Proactive insights separation

Files:

- insight generator
- synthesis path
- settings enforcement

Definition of done:

- local signals and remote polish are distinct layers

### PR 7: Cleanup

Files:

- legacy / unused AI surfaces

Definition of done:

- the codebase reflects the new capability model cleanly

## Minimum Test Plan

At a minimum, add or update tests for:

- `signal-extractor`
- `journal-intelligence.service`
- `action-extraction.service`
- capability service
- Today / Focus local-first behavior
- Oracle gating behavior
- proactive insight settings enforcement

## Recommended "Stop the Bleeding" First Fixes

If you want the fastest high-value first pass before the full refactor, do these first:

1. wire AI settings into the app
2. add capability checks around Oracle entry points
3. stop awaiting journal remote enrichment in receipts
4. remove duplicate action extraction
5. make Today / Focus local-first

That gives the product a much safer baseline even before the deeper cleanup lands.
