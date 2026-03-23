# AI Feature Separation Audit

Last updated: 2026-03-20

Companion implementation plan:

- `docs/AI_FEATURE_SEPARATION_IMPLEMENTATION_CHECKLIST.md`

## Purpose

This document maps the current AI/LLM surface area in Weave so we can separate:

1. core offline product behavior
2. local deterministic "intelligence"
3. optional symbolic/esoteric interpretation
4. remote generative AI features

The goal is to make sure the app still feels intelligent, relational, and emotionally rich when AI is disabled, unavailable, or not included in a user's tier.

## Product Principles

### 1. User intent always wins

No AI feature should ever block:

- saving a journal entry
- viewing Today / Focus
- opening journal history
- reflecting on an interaction
- planning or logging a weave

If a feature needs the network or a model, it must sit behind the user's successful completion of the primary action.

### 2. Archetypes are lenses, not rules

Archetypes should remain part of the product even when remote AI is off. They are an interpretive layer, not a dependency. They should shape copy, framing, and suggestions, but not determine whether the app can function.

This is already supported by local content in `src/shared/constants/archetype-content.ts`.

### 3. The esoteric layer should survive without the model

Social seasons, archetypal framing, reflective prompts, and symbolic language should continue to exist without remote generation. The "magic" should be in the product language and interaction model, not only in live LLM calls.

### 4. Local intelligence and remote intelligence are different products

We should stop thinking in terms of a single `AI on/off` switch and instead separate:

- local signal extraction
- local relationship heuristics
- remote enrichment
- Oracle chat / consultation
- background generative synthesis

## Executive Summary

The app already has the beginnings of an AI control plane:

- `src/db/models/UserProfile.ts` defines `aiFeaturesEnabled`, `aiJournalAnalysisEnabled`, and `aiOracleEnabled`
- `src/modules/auth/components/settings/AISettings.tsx` exists as a UI for those toggles

However, enforcement is inconsistent and in several important cases absent:

- `isOracleEnabled` is defined but not used anywhere in app logic
- `AISettings.tsx` does not appear to be mounted from any route or settings screen
- multiple Oracle features are callable with no profile-level gate
- some journal-related AI calls still happen even when journal AI should be disabled
- some saved-entry flows await AI work before the user-facing receipt can resolve

There are also partial controls for proactive insights:

- `proactiveInsightsEnabled`, `suppressedInsightRules`, `insightFrequency`, and `oracleTonePreference`

But only part of that settings model is enforced today:

- `insightFrequency` is used
- `oracleTonePreference` is used
- `proactiveInsightsEnabled` does not appear to be checked by generation logic
- `suppressedInsightRules` does not appear to be checked by generation logic

The biggest architectural issue is that the codebase does not currently distinguish between:

- "LLM provider is registered"
- "user has opted in"
- "user is on a tier that should have this feature"
- "network is reachable"
- "this surface is allowed to block"

As a result, `llmService.isAvailable()` is often used like a capability check even though it only means a provider was registered at startup.

## Current Control Plane

### Profile-level flags

Defined in `src/db/models/UserProfile.ts`:

- `aiFeaturesEnabled`
- `aiJournalAnalysisEnabled`
- `aiOracleEnabled`
- `aiDisclosureAcknowledgedAt`
- `proactiveInsightsEnabled`
- `suppressedInsightRules`
- `oracleTonePreference`
- `insightFrequency`

Derived getters:

- `isAIEnabled`
- `isJournalAnalysisEnabled`
- `isOracleEnabled`

### Existing settings UIs

- `src/modules/auth/components/settings/AISettings.tsx`
  - master AI toggle
  - journal analysis toggle
  - Social Oracle toggle
  - disclosure flow
- `src/modules/oracle/components/OracleInsightSettings.tsx`
  - proactive insight master toggle
  - per-rule suppression UI
  - insight cadence
  - Oracle tone

### Important gaps

- `AISettings.tsx` appears to be orphaned. Search only finds the component definition, not any mounted route or settings entry.
- `OracleInsightSettings.tsx` is routable via `app/oracle-settings.tsx`, but the route does not appear to be linked from the main settings flow.
- `UserProfile.isOracleEnabled` is not used in Oracle entry points.
- `proactiveInsightsEnabled` and `suppressedInsightRules` are not enforced in `src/modules/oracle/services/insight-generator.ts` or `src/modules/oracle/services/oracle-service.ts`.

## LLM Infrastructure Notes

### What `llmService.isAvailable()` currently means

In `src/shared/services/llm/llm-service.ts`, `isAvailable()` returns `this.providers.size > 0`.

That means:

- it does not check user preference
- it does not check entitlement
- it does not check network availability
- it does not check whether remote AI should be allowed in the current surface

### Why this matters

`src/shared/services/llm/config.ts` registers the `supabase-proxy` provider by default, and `src/shared/components/DataInitializer.tsx` initializes LLM providers on app startup.

So after startup, the app can treat AI as "available" even if:

- the user has turned AI off
- the user is offline
- the user is on a free tier that should not get Oracle features

## Direct AI Feature Inventory

This section covers direct model calls or services whose primary purpose is LLM-backed behavior.

---

## 1. Journal Intelligence Pipeline

### Main entry point

`src/modules/journal/services/journal-intelligence.service.ts`

`processEntry(entry, aiEnabled?)` currently orchestrates:

1. signal extraction
2. saving `journal_signals`
3. friend intelligence updates
4. thread extraction
5. memory bridge ingestion
6. smart action extraction
7. style analysis trigger

### 1.1 Signal extraction

File:

- `src/modules/journal/services/signal-extractor.ts`

Behavior:

- if `aiEnabled && llmService.isAvailable()`, uses LLM
- otherwise falls back to rule-based extraction

Writes:

- `journal_signals`
- optional LLM-generated title back to `journal_entries`

Current separation status:

- good foundation
- this is the best existing pattern for "remote enrichment with local fallback"

Recommended future state:

- keep rule-based signal extraction in the local intelligence layer
- treat LLM extraction as an enrichment pass only

### 1.2 Thread extraction

File:

- `src/modules/journal/services/thread-extractor.ts`

Behavior:

- LLM only
- no rule-based fallback
- returns `[]` on failure

Writes:

- `conversation_threads`

Current separation status:

- optional by behavior
- but downstream features rely on thread presence when available

Recommended future state:

- keep thread extraction remote-only
- treat all consumers as tolerant of "no threads"
- never let thread extraction block a save or receipt

### 1.3 Smart action extraction

File:

- `src/modules/oracle/services/action-extraction.service.ts`

Behavior:

- LLM only
- analyzes journal content and writes `smart_actions` back to `journal_entries`
- also feeds `memoryBridgeService`

Writes:

- `journal_entries.smartActions`
- memory candidate side effects

Critical finding:

- this service is not gated by `aiEnabled`
- `journalIntelligenceService.processEntry()` always calls `actionExtractionService.extractActions(entry.id)` even when journal AI should be disabled

That means the journal pipeline currently has a preference leak:

- signals may honor `isJournalAnalysisEnabled`
- actions do not

Recommended future state:

- split action extraction out of `processEntry()` or gate it separately
- make it part of `remoteEnrichmentEnabled`, not `localSignalsEnabled`

### 1.4 Journal save flows that trigger intelligence

#### Quick capture

File:

- `src/modules/journal/components/QuickCaptureSheet.tsx`

Current behavior:

- saves entry locally
- then `await journalIntelligenceService.processEntry(savedEntry)`
- receipt waits on AI-related processing

Risk:

- post-save UX is still coupled to intelligence completion

#### Full journal editor

File:

- `src/modules/journal/components/JournalEntryModal.tsx`

Current behavior:

- calls `actionExtractionService.queueEntry(targetId)`
- then `await journalIntelligenceService.processEntry(savedEntry)`

Critical finding:

- action extraction can run twice for the same entry
- once via queued background path
- once via inline `processEntry()`

Risk:

- duplicate LLM work
- inconsistent writes
- unnecessary network usage

#### Prompted reflection flow

File:

- `src/modules/journal/components/GuidedReflection/PromptedReflectionFlow.tsx`

Current behavior:

- uses local prompt generation
- saves entry
- calls `journalIntelligenceService.processEntry(savedEntry, profile?.isJournalAnalysisEnabled ?? false)` in fire-and-forget mode

Separation status:

- this is closer to the desired model
- the user action succeeds first
- intelligence happens after

#### Oracle-guided reflection receipt

File:

- `src/modules/journal/components/GuidedReflection/GuidedReflectionSheet.tsx`

Current behavior:

- after Oracle flow saves, receipt does:
  - `actionExtractionService.queueEntry(entryId)`
  - `await journalIntelligenceService.processEntry(entry)`

Critical findings:

- same duplicate action-extraction issue as the full editor
- receipt remains coupled to intelligence processing

### Recommended split for journal intelligence

#### Keep for all users, local-only

- local save
- local title heuristics
- rule-based signal extraction
- friend mention counting
- non-LLM downstream features that can work from local data

#### Remote optional enrichment

- LLM signal refinement
- emergent themes
- LLM title generation
- thread extraction
- smart action extraction
- style analysis

#### Strict rule

Journal save flows should never await remote enrichment before the user sees success.

---

## 2. Oracle Chat and Oracle Modes

### Main chat consultation

Files:

- `src/modules/oracle/hooks/useOracle.ts`
- `src/modules/oracle/services/oracle-service.ts`
- `src/modules/oracle/components/OracleChat.tsx`

Primary entry points:

- `src/modules/home/components/OracleFAB.tsx`
- `app/_home.tsx`
- `src/modules/journal/components/JournalHome.tsx`
- `app/friend-profile.tsx`
- `src/modules/journal/components/JournalEntryDetailSheet.tsx`
- suggestions from `TodaysFocusWidgetV2.tsx`

Current behavior:

- `useOracle.askQuestion()` calls `oracleService.ask()`
- `oracleService.ask()` builds context and calls the LLM directly

Current gating:

- none based on `UserProfile.isOracleEnabled`
- no visible entitlement boundary

Recommended future state:

- make Oracle consultation a remote, opt-in capability
- likely paid or explicitly enabled
- unavailable state should route users toward local journaling / prompt flows instead of simply failing

### Starter prompt personalization

Files:

- `src/modules/oracle/hooks/useStarterPrompts.ts`
- `src/modules/oracle/services/oracle-service.ts`

Behavior:

- Oracle empty state fetches `getPersonalizedStarterPrompts()`
- falls back to `_getStaticStarterPrompts()` on error

Separation status:

- good candidate for remote optional enrichment
- static fallback already exists

Recommended future state:

- keep static starter prompts for all users
- only personalize via LLM when remote enrichment is enabled

### Insight Mode

Files:

- `src/modules/oracle/components/modes/InsightModeView.tsx`
- `src/modules/oracle/services/oracle-service.ts`

Behavior:

- calls `oracleService.analyzeInsightIntent()`
- falls back to a generic result on failure

Recommended future state:

- remote Oracle feature
- should not be part of free/offline baseline

### Plan Mode

Files:

- `src/modules/oracle/components/modes/PlanModeView.tsx`
- `src/modules/oracle/services/oracle-service.ts`

Behavior:

- user enters free text
- app calls `oracleService.detectActions()`
- LLM returns structured `SmartAction[]`

Recommended future state:

- remote Oracle feature
- local alternative can be a simple "create intention" / "plan weave" sheet without extraction

### Expand Entry mode

Files:

- `src/modules/oracle/components/modes/ExpandModeView.tsx`
- `src/modules/oracle/services/oracle-service.ts`

Behavior:

- `assessDraft()`
- `expandJournalEntry()`

Notes:

- `assessDraft()` has local pre-checks for very short and very long drafts
- otherwise still depends on LLM

Recommended future state:

- remote-only assistive feature
- not part of core journaling

---

## 3. Oracle-Guided Reflection

Files:

- `src/modules/journal/hooks/useGuidedReflection.ts`
- `src/modules/oracle/services/oracle-service.ts`
- `src/modules/journal/components/GuidedReflection/GuidedReflectionSheet.tsx`

LLM-backed functions:

- `startGuidedReflection()`
- `continueReflection()`
- `composeEntry()`
- `startDeepening()`
- `continueDeepening()`
- `composeDeepenedEntry()`
- `generateFreeformDraft()`
- `completeReflection()` is the completion wrapper for composed content

Current behavior:

- the entire Oracle-guided reflection experience is model-dependent
- save happens only after LLM-generated composition

Recommended future state:

- treat Oracle-guided reflection as a premium remote experience
- keep prompted reflection as the local-first baseline path

This is an important product split:

- `PromptedReflectionFlow` can be the no-AI / free-tier journaling path
- Oracle-guided reflection can remain a richer, conversational paid path

---

## 4. Today / Focus Surfaces

### Daily reflection in Today widget

Files:

- `src/modules/home/components/widgets/widgets/TodaysFocusWidgetV2.tsx`
- `src/modules/home/components/FocusDetailSheet.tsx`

Behavior:

- when there are no calendar events, the widget fetches Oracle daily reflection
- detail sheet also tries Oracle reflection first, then falls back to rule-based weekly prompting

Current risk:

- empty-state focus copy still depends on Oracle in some paths
- this is exactly the kind of surface that should be safe offline and AI-free

Recommended future state:

- default to local reflection copy first
- optionally replace or enrich asynchronously if remote enrichment is enabled
- never make Today feel "stuck waiting for AI"

### Suggestion-driven Oracle entry

File:

- `src/modules/home/components/widgets/widgets/TodaysFocusWidgetV2.tsx`

Behavior:

- Oracle-type suggestions open Oracle sheet directly

Recommended future state:

- if Oracle is disabled, these suggestions should either:
  - not appear, or
  - degrade to local journaling / local prompt alternatives

---

## 5. Weekly Reflection Surfaces

### Weekly narrative

Files:

- `src/modules/reflection/components/WeeklyReflection/WeeklyReflectionModal.tsx`
- `src/modules/oracle/services/oracle-service.ts`

Behavior:

- `generateWeeklyNarrative(summary, season)` is called non-blocking
- UI already tolerates failure with fallback copy

Separation status:

- healthy pattern

Recommended future state:

- keep as remote optional enhancement

### Weekly observations

Files:

- `src/modules/reflection/components/WeeklyReflection/WeeklyReflectionModal.tsx`
- `src/modules/reflection/services/ReflectionSynthesizerService.ts`

Behavior:

- `generateWeeklyObservations()` uses LLM
- called non-blocking
- has fallback and empty-error behavior

Recommended future state:

- remote optional enhancement

### "Help me write" in weekly reflection

Files:

- `src/modules/reflection/components/WeeklyReflection/ReflectionPromptStepComponent.tsx`
- `src/modules/journal/services/reflection-assistant.service.ts`

Behavior:

- button calls `ReflectionAssistant.generateDraft()`
- `ReflectionAssistant` checks only `llmService.isAvailable()`
- no user AI preference gate

Critical finding:

- this feature ignores `aiFeaturesEnabled` / `aiJournalAnalysisEnabled`

Recommended future state:

- gate behind remote enrichment capability
- keep the underlying prompt engine local

### Edit reflection auto-draft

Files:

- `src/modules/reflection/components/EditReflectionModal.tsx`
- `src/modules/journal/services/reflection-assistant.service.ts`

Behavior:

- same issue as above
- optional button, but ungated

---

## 6. Proactive Insights

### Generators

Files:

- `src/modules/oracle/services/insight-generator.ts`
- `src/modules/oracle/services/oracle-service.ts`

Triggers:

- app foreground in `src/shared/components/DataInitializer.tsx`
- weave logging in `src/modules/interactions/services/weave-logging.service.ts`
- on-demand from `src/modules/oracle/components/OracleChat.tsx`

Behavior:

- `InsightGenerator` collects local rule-based `InsightSignal[]`
- `oracleService.synthesizeInsights(signals)` uses LLM to polish and store `proactive_insights`

This is already a promising architectural split:

- signal generation is local
- polish/synthesis is remote

But current controls are incomplete:

- `insightFrequency` is respected
- `proactiveInsightsEnabled` is not checked
- `suppressedInsightRules` is not checked

Recommended future state:

- local signal generation can remain for all users
- remote synthesis / polished insight copy should be optional
- if remote AI is off, the app can still show local, template-based nudges from raw signals

### Consumers

Files:

- `src/modules/oracle/components/InsightsCarousel.tsx`
- `src/modules/oracle/components/InsightsChip.tsx`
- `src/modules/oracle/components/OracleChat.tsx`
- `src/modules/oracle/services/oracle-service.ts` (`invalidateInsightsForFriends`)

Separation note:

Consumers already read from stored insight records. This makes proactive insights a good candidate for a two-stage pipeline:

1. local rule engine builds raw nudges
2. remote AI optionally polishes the language

---

## 7. Friendship Narrative

Files:

- `src/modules/intelligence/services/NarrativeService.ts`
- `src/modules/oracle/services/oracle-service.ts`
- `src/modules/relationships/components/FriendshipStoryView.tsx`
- `src/modules/journal/components/FriendshipArcView.tsx`

Behavior:

- explicit user-triggered generation / refresh
- calls `generateFriendshipNarrative()`
- saves generated narrative to DB

Separation status:

- assistive and optional
- not core workflow blocking

Recommended future state:

- remote optional enrichment
- can remain a premium flourish

---

## 8. Additional AI-Ready or Legacy Surfaces

### Smart prompt generator

Files:

- `src/modules/journal/services/smart-prompt-generator.ts`
- `src/modules/journal/services/useSmartPrompt.ts`

Behavior:

- has proper local fallback design
- currently appears unused

Recommendation:

- this is a useful reference implementation for separation
- if revived, route through the central capability service

### Entry lens analysis

File:

- `src/modules/oracle/services/oracle-service.ts`

Method:

- `analyzeEntryContext()`

Status:

- appears unused

### Legacy reflection Oracle edge wrapper

File:

- `src/modules/reflection/services/oracle/oracle-service.ts`

Status:

- appears unused in current product flows
- likely legacy / parallel implementation

### Generic LLM mutation hooks

File:

- `src/shared/api/mutations/llm-mutations.ts`

Status:

- no clear production usage found

## AI-Derived Data and Downstream Consumers

Separating AI features is not just about model calls. We also need to understand which features consume AI-generated outputs.

### `journal_signals`

Produced by:

- `src/modules/journal/services/journal-intelligence.service.ts`

Consumed by:

- `src/modules/journal/components/JournalEntryDetailSheet.tsx`
- `src/modules/journal/hooks/useEnrichedFeed.ts`
- `src/modules/oracle/services/context-builder.ts`
- `src/modules/interactions/services/suggestion-engine/generators/SignalDrivenGenerator.ts`
- `src/modules/intelligence/services/value-alignment.service.ts`
- `src/modules/oracle/services/insight-generator.ts`

Separation implication:

- if remote journal enrichment is disabled, these consumers must work with:
  - rule-based signals, or
  - missing signals

### `conversation_threads`

Produced by:

- `src/modules/journal/services/thread-extractor.ts`

Consumed by:

- `src/modules/journal/services/followup-generator.ts`
- `src/modules/interactions/services/suggestion-engine/generators/SignalDrivenGenerator.ts`
- `src/modules/intelligence/services/focus-generator.ts`
- `src/modules/oracle/services/context-builder.ts`
- guided reflection context loading

Separation implication:

- this dataset is inherently optional
- consumers should degrade to "no thread context" without UX breakage

### `smartActions`

Produced by:

- `src/modules/oracle/services/action-extraction.service.ts`

Consumed by:

- `src/modules/journal/components/JournalEntryDetailSheet.tsx`
- `src/modules/oracle/components/modes/QuickActionsView.tsx`

Separation implication:

- Quick Actions should not be considered part of baseline journaling

### `proactive_insights`

Produced by:

- `src/modules/oracle/services/oracle-service.ts`

Consumed by:

- `src/modules/oracle/components/InsightsCarousel.tsx`
- `src/modules/oracle/components/InsightsChip.tsx`
- `src/modules/oracle/components/OracleChat.tsx`

Separation implication:

- insights can be local-template or remote-polished

### `oracle_conversations`

Produced by:

- `src/modules/oracle/services/oracle-service.ts`

Consumed by:

- `src/modules/oracle/hooks/useOracle.ts`
- Oracle history features

Separation implication:

- fully remote-Oracular feature set

## Key Findings and Separation Blockers

### High priority

1. `AISettings` exists but does not appear wired into the app.
2. `isOracleEnabled` exists but is not enforced in Oracle entry points.
3. `journalIntelligenceService.processEntry()` always runs smart action extraction, bypassing journal AI preference.
4. `JournalEntryModal` and `GuidedReflectionSheet` trigger smart action extraction twice for the same entry.
5. several saved-entry flows still await intelligence work before finishing the user-facing receipt.
6. Today / Focus still reaches for Oracle in a core offline surface.

### Medium priority

1. weekly reflection helper features (`Help me write`, interaction auto-draft) ignore user AI preference
2. proactive insights settings are only partially enforced
3. `llmService.isAvailable()` is regularly used as if it were a full capability check

### Low priority / cleanup

1. multiple AI-ready or legacy files are currently unused
2. orphaned settings and legacy wrappers make the boundary harder to reason about

## Recommended Separation Model

### Layer A: Core Offline Product

Always available.

Includes:

- all CRUD around friends, weaves, journal entries, reflections, intentions
- Today / Focus baseline content
- weekly reflection baseline
- prompt engine
- scoring, reciprocity, drift, cadence, battery, season logic
- archetype content and symbolic framing

No remote AI call is allowed on the critical path here.

### Layer B: Local Intelligence

Available to all users, including AI-off users.

Includes:

- rule-based journal signals
- deterministic prompt selection
- heuristic titles
- local suggestion generation
- local insight signal generation
- local relationship summaries
- local season and archetype framing

This is where "the app still feels smart" should live.

### Layer C: Remote Enrichment

Optional, async, never required for task completion.

Includes:

- LLM signal refinement
- emergent themes
- thread extraction
- smart action extraction
- daily reflection copy
- personalized starter prompts
- weekly narrative polish
- weekly observation synthesis
- friendship narrative generation
- polished proactive insights

### Layer D: Oracle Product

Explicitly remote, likely paid or opt-in.

Includes:

- consultation chat
- Insight Mode
- Plan Mode
- Expand Entry mode
- Oracle-guided reflection
- journal Ask Oracle entry points

### Proposed Capability Flags

Instead of one generic AI switch, introduce a central capability service that computes:

- `localIntelligenceEnabled`
- `remoteEnrichmentEnabled`
- `oracleChatEnabled`
- `guidedReflectionEnabled`
- `proactiveInsightPolishEnabled`
- `backgroundAIEnabled`
- `showOracleEntryPoints`

Inputs should include:

- profile preferences
- entitlement / free vs paid tier
- disclosure acknowledgement
- network reachability
- app mode or surface criticality

### Suggested Capability Matrix

| Capability | AI Off | Free Tier | Paid + Opted In |
| --- | --- | --- | --- |
| Core offline app | Yes | Yes | Yes |
| Archetypes / seasons / symbolic copy | Yes | Yes | Yes |
| Local prompt engine | Yes | Yes | Yes |
| Rule-based journal signals | Yes | Yes | Yes |
| Remote signal refinement | No | Optional if desired, but recommend No | Yes |
| Thread extraction | No | No | Yes |
| Smart action extraction | No | No | Yes |
| Today daily reflection generation | No | No or cached/template only | Yes |
| Weekly narrative / observation polish | No | Optional | Yes |
| Friendship story generation | No | Optional | Yes |
| Proactive insight polish | No | Optional local-template only | Yes |
| Oracle chat / modes | No | No | Yes |
| Oracle guided reflection | No | No | Yes |

## Recommended Refactor Order

### Phase 1: Create a real capability service

Introduce a single source of truth, for example:

- `src/modules/intelligence/services/intelligence-capabilities.service.ts`

Everything should ask this service, not `llmService.isAvailable()` or raw profile fields.

### Phase 2: Decouple journal save UX from enrichment

Targets:

- `QuickCaptureSheet.tsx`
- `JournalEntryModal.tsx`
- `GuidedReflectionSheet.tsx`

Actions:

- stop awaiting remote enrichment for receipts
- split local post-save work from remote enrichment work
- remove duplicated action extraction

### Phase 3: Split `processEntry()` into local and remote passes

Suggested shape:

- `processEntryLocal()`
- `processEntryRemote()`
- `processEntry()` orchestrator that checks capabilities

### Phase 4: Make Today local-first

Targets:

- `TodaysFocusWidgetV2.tsx`
- `FocusDetailSheet.tsx`

Actions:

- render local copy first
- async enrich only when allowed

### Phase 5: Gate Oracle surfaces

Targets:

- `OracleFAB.tsx`
- `JournalHome.tsx`
- `JournalEntryDetailSheet.tsx`
- Oracle mode entry points throughout home and friend flows

Actions:

- hide, replace, or downgrade Oracle entry points when unavailable

### Phase 6: Enforce proactive insight settings

Targets:

- `insight-generator.ts`
- `oracle-service.ts`

Actions:

- check `proactiveInsightsEnabled`
- check suppressed rules
- separate local raw-signal generation from remote polish

### Phase 7: Clean up orphaned or legacy AI code

Candidates:

- `AISettings.tsx` mounting / wiring
- unused smart prompt hooks
- legacy reflection Oracle wrapper
- unused generic LLM hooks if not needed

## Proposed File-Level Worklist

### Immediate audit/fix candidates

- `src/modules/journal/services/journal-intelligence.service.ts`
- `src/modules/oracle/services/action-extraction.service.ts`
- `src/modules/journal/components/QuickCaptureSheet.tsx`
- `src/modules/journal/components/JournalEntryModal.tsx`
- `src/modules/journal/components/GuidedReflection/GuidedReflectionSheet.tsx`
- `src/modules/home/components/widgets/widgets/TodaysFocusWidgetV2.tsx`
- `src/modules/home/components/FocusDetailSheet.tsx`
- `src/modules/oracle/hooks/useOracle.ts`
- `src/modules/oracle/components/OracleChat.tsx`
- `src/modules/oracle/services/insight-generator.ts`
- `src/modules/oracle/services/oracle-service.ts`

### Good local-first building blocks to preserve

- `src/modules/journal/services/signal-extractor.ts`
- `src/modules/journal/services/smart-prompt-generator.ts`
- `src/modules/reflection/services/prompt-engine.ts`
- `src/shared/constants/archetype-content.ts`
- social season services in `src/modules/intelligence/services/`

## Closing Recommendation

The cleanest long-term split is:

- keep the relational philosophy, archetypes, seasons, and local heuristics for everyone
- move all model-backed synthesis into explicit remote capability buckets
- ensure every remote feature is either:
  - async enrichment, or
  - an explicitly invoked Oracle product surface

The simplest rule to enforce across the team is:

**AI may deepen the user's experience, but it may never be required to complete the user's intent.**
