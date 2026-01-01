# Journal & Social Oracle: Implementation Plan

## Document Overview

| Property | Value |
|----------|-------|
| **Purpose** | Consolidated implementation roadmap synthesizing all Oracle specs |
| **Supersedes** | Combines decisions from `journal-oracle-design-spec.md`, `oracle-spec-addendum.md` (v1), and `oracle-spec-addendum-v2.md` |
| **Last Updated** | January 2026 |
| **Status** | Ready for Implementation |

---

## Part 1: Vision Summary

### Core Thesis

> The journal is the **sensory organ** that feeds the intelligence engine. Every entry makes the app smarter about your relationships.

### What We're Building

| We ARE Building | We ARE NOT Building |
|-----------------|---------------------|
| A wise counselor you consult intentionally | A chatbot you banter with |
| Insights grounded in YOUR data | Generic relationship advice |
| Bounded, purposeful exchanges | Open-ended conversation |
| Reflection that improves the app's intelligence | A standalone journaling app |

### North-Star Features

1. **Solving Reflection Fatigue** — AI asks follow-up questions grounded in relationship history
2. **Data Entry → Emotional Reward** — Journal entries produce insights users couldn't see themselves
3. **Automated Maintenance Triage** — Surface exactly which 3 friends need attention today

---

## Part 2: Confirmed Design Decisions

These decisions were made during design review and supersede any conflicting content in the original specs.

### 2.1 Oracle Interaction Modes: Merged

**Decision:** Single organic interaction model, not three separate modes.

| Original Spec | Updated Design |
|---------------|----------------|
| Mode 1: Proactive Insights (read-only) | ✅ Keep as-is |
| Mode 2: Single-turn Consultation | ✅ Keep — this is the default |
| Mode 3: Guided Dialogue (3-5 turns) | ❌ Merge into consultation |

**New Behavior:**
- Every consultation starts as single-turn
- Oracle response can **optionally** include a follow-up question
- If user responds, it becomes turn 2
- Hard cap at 5 turns, but most interactions end at 1-2
- Turn counter only appears **after turn 2** ("Turn 3 of 5")

**Rationale:** Removes decision friction. Users don't need to "choose a mode."

---

### 2.2 Signal Extraction: Async

**Decision:** Signal extraction runs asynchronously after journal save.

- Entry saves instantly (no blocking)
- Extraction runs in background
- Eventual consistency is acceptable for intelligence fields
- No "Processing insights..." indicator for MVP (keep it invisible)

**Exception:** If we later add a "Save & See Insights" flow, that could be synchronous. But that's a different feature.

---

### 2.3 Conversation Threads: LLM-Only

**Decision:** No manual thread tagging for MVP.

- LLM extracts topics in background
- Low confidence → don't surface
- High confidence → show in follow-up prompts ("Last time, Marcus was worried about X...")
- No explicit thread management UI

**V2 Enhancement (if users ask):**
- "Pin" a thread to keep it active
- "Resolve" a thread to mark it complete
- View all active threads per friend

---

### 2.4 Triage Notifications: Dashboard First

**Decision:** Pull-based (dashboard widget), not push notifications for MVP.

**Phase 1 (MVP):**
- "Today's 3" card on home screen
- User opens app, sees triage
- No push notifications

**Phase 2 (After validation):**
- Opt-in single daily notification
- User chooses time ("Morning briefing" or "Evening wind-down")
- Must be explicitly enabled in settings
- Easy to turn off

---

### 2.5 Intelligence Visibility: Mostly Invisible

**Decision:** Subtle acknowledgment, not gamification.

| Visible | Invisible |
|---------|-----------|
| "✨ Entry saved" (always) | Score changes |
| "This reflection strengthened your bond record" (1-in-5 times) | Theme detection process |
| Friend profile: "Detected themes: support, vulnerability" | Resilience calculations |
| Friend profile: "Last journal sentiment: warm" | Negative signal processing |

**Rule:** Never show negative signals. Don't tell users "Your entry flagged tension with Marcus." Use internally for triage/Oracle grounding only.

---

### 2.6 Privacy: Explicit Opt-In

**Decision:** AI features require explicit user consent.

**MVP Requirements:**
- Settings toggle: "Enable AI Features"
- Clear explanation: "Journal content is processed by Google's Gemini AI to generate insights. Google does not use this data for training."
- Easy opt-out that falls back to rule-based features

**V2 Enhancement:**
- On-device processing for signal extraction (Gemini Nano when available)

---

### 2.7 Content Safety: Deferred

**Decision:** Rely on LLM built-in safety for beta. Research better approach before public launch.

**Rationale:**
- Gemini/Claude have post-training for harmful content
- Small initial user pool limits risk
- Naive regex approach is fragile; better solution needed

**Pre-Launch Requirement:**
- Ensure Oracle system prompts instruct compassionate response with crisis resources when appropriate

---

## Part 3: Technical Architecture

### 3.1 LLM Abstraction Layer

```
src/shared/services/llm/
├── types.ts              # LLMProvider, LLMPrompt, LLMResponse interfaces
├── errors.ts             # LLMErrorType enum, classifyError()
├── retry.ts              # withRetry() with exponential backoff
├── llm-service.ts        # LLMService orchestration class
├── prompt-registry.ts    # Versioned prompt definitions
├── cost-tracker.ts       # Usage monitoring (V2)
└── providers/
    └── gemini-flash.ts   # Gemini 2.0 Flash implementation
```

**Key Interfaces:**

```typescript
interface LLMProvider {
  name: string;
  model: string;
  complete(prompt: LLMPrompt, options?: LLMOptions): Promise<LLMResponse>;
  completeStructured<T>(prompt: LLMPrompt, schema: JSONSchema, options?: LLMOptions): Promise<T>;
}

interface LLMPrompt {
  system: string;
  user: string;
  context?: Record<string, unknown>;
}
```

---

### 3.2 Error Handling

**Error Taxonomy:**

| Error Type | Retryable | User Message | Behavior |
|------------|-----------|--------------|----------|
| `RATE_LIMITED` | ✅ | "Taking a moment to think..." | Auto-retry after delay |
| `CONTEXT_TOO_LONG` | ✅ | (Silent) | Truncate and retry |
| `TIMEOUT` | ✅ | "Still thinking..." | Extended spinner, retry |
| `AUTH_FAILED` | ❌ | "Connection issue. Please restart the app." | Log, show banner |
| `CONTENT_FILTERED` | ❌ | "I can't help with that specific question." | Offer alternatives |
| `NETWORK_ERROR` | ❌ | "No internet connection" | Offline indicator |

---

### 3.3 Context Architecture

**Tiered Context System:**

| Tier | Tokens | Use Case | TTL |
|------|--------|----------|-----|
| **Essential** | ~400 | Proactive insights | 30 min |
| **Pattern** | ~1,000 | Consultations | 15 min |
| **Rich** | ~2,000 | Deep dialogue | 5 min |

**Essential Context (Always Include):**
- Friend archetypes, Dunbar tiers, weave scores
- Days since last interaction per friend
- Social season, battery level
- Weekly weave count

**Pattern Context (Add for Consultations):**
- Recent interaction vibes (last 5-10)
- Story chip frequency
- Initiation ratio, category effectiveness

**Rich Context (Add for Deep Dialogue):**
- Journal entry content (summarized)
- Life events
- Detected themes per friend

---

### 3.4 Cache Strategy

**Granular Invalidation:**

| Event | Invalidation Scope |
|-------|-------------------|
| Interaction logged | `{ type: 'interaction', friendId }` |
| Journal entry saved | `{ type: 'friend', friendId }` |
| Friend score updated | `{ type: 'friend', friendId }` |
| Social battery changed | `{ type: 'user_state' }` |
| Weekly reflection | `{ type: 'all' }` |

**Stale-While-Revalidate:** Serve stale cache for 2x TTL while rebuilding in background.

---

### 3.5 Rate Limiting

- **5 consultations per day** (resets at 4 AM local time)
- Visual: 5 dots indicator, countdown when exhausted
- Exhausted state: "The Oracle rests. Return tomorrow."
- Alternative offered: "Browse past consultations" or "Try guided reflection"

---

### 3.6 Offline Behavior

| Feature | Online | Offline |
|---------|--------|---------|
| Journal save | ✅ Full (async extraction) | ✅ Save locally, queue extraction |
| Smart prompts | ✅ LLM-generated | ⚠️ Rule-based fallback |
| Oracle consultation | ✅ Full | ❌ Disabled with message |
| Oracle insights | ✅ Fresh | ⚠️ Show cached if available |

---

## Part 4: Data Models

### 4.1 New Tables

```typescript
// oracle_context_cache
tableSchema({
  name: 'oracle_context_cache',
  columns: [
    { name: 'context_type', type: 'string' },
    { name: 'friend_id', type: 'string', isOptional: true, isIndexed: true },
    { name: 'payload_json', type: 'string' },
    { name: 'tokens_estimate', type: 'number' },
    { name: 'valid_until', type: 'number', isIndexed: true },
    { name: 'created_at', type: 'number' },
  ]
}),

// journal_signals
tableSchema({
  name: 'journal_signals',
  columns: [
    { name: 'journal_entry_id', type: 'string', isIndexed: true },
    { name: 'sentiment', type: 'number' },
    { name: 'sentiment_label', type: 'string' },
    { name: 'core_themes_json', type: 'string' },
    { name: 'emergent_themes_json', type: 'string' },
    { name: 'dynamics_json', type: 'string' },
    { name: 'confidence', type: 'number' },
    { name: 'extracted_at', type: 'number' },
    { name: 'extractor_version', type: 'string' },
  ]
}),

// oracle_consultations
tableSchema({
  name: 'oracle_consultations',
  columns: [
    { name: 'question', type: 'string' },
    { name: 'response', type: 'string' },
    { name: 'grounding_data_json', type: 'string' },
    { name: 'context_tier_used', type: 'string' },
    { name: 'tokens_used', type: 'number' },
    { name: 'turn_count', type: 'number' },
    { name: 'saved_to_journal', type: 'boolean' },
    { name: 'journal_entry_id', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number', isIndexed: true },
  ]
}),

// conversation_threads
tableSchema({
  name: 'conversation_threads',
  columns: [
    { name: 'friend_id', type: 'string', isIndexed: true },
    { name: 'topic', type: 'string' },
    { name: 'first_mentioned', type: 'number' },
    { name: 'last_mentioned', type: 'number', isIndexed: true },
    { name: 'mention_count', type: 'number' },
    { name: 'status', type: 'string' },
    { name: 'sentiment', type: 'string' },
    { name: 'source_entry_ids_raw', type: 'string' },
  ]
}),

// llm_quality_log
tableSchema({
  name: 'llm_quality_log',
  columns: [
    { name: 'prompt_id', type: 'string', isIndexed: true },
    { name: 'prompt_version', type: 'string' },
    { name: 'input_hash', type: 'string' },
    { name: 'output_hash', type: 'string' },
    { name: 'latency_ms', type: 'number' },
    { name: 'tokens_used', type: 'number' },
    { name: 'error_type', type: 'string', isOptional: true },
    { name: 'user_feedback', type: 'string', isOptional: true },
    { name: 'created_at', type: 'number', isIndexed: true },
  ]
}),
```

### 4.2 Friend Model Additions

```typescript
// Intelligence feedback from journal
{ name: 'detected_themes_raw', type: 'string', isOptional: true },
{ name: 'last_journal_sentiment', type: 'number', isOptional: true },
{ name: 'journal_mention_count', type: 'number', isOptional: true },
{ name: 'reflection_activity_score', type: 'number', isOptional: true },
{ name: 'needs_attention', type: 'boolean', isOptional: true },

// Communication patterns (for triage)
{ name: 'avg_weave_duration_minutes', type: 'number', isOptional: true },
{ name: 'preferred_weave_types_raw', type: 'string', isOptional: true },
{ name: 'best_time_of_day', type: 'string', isOptional: true },
{ name: 'best_day_of_week', type: 'number', isOptional: true },

// Topic evolution
{ name: 'topic_clusters_raw', type: 'string', isOptional: true },
{ name: 'topic_trend', type: 'string', isOptional: true },

// Reconnection tracking
{ name: 'reconnection_attempts', type: 'number', isOptional: true },
{ name: 'successful_reconnections', type: 'number', isOptional: true },
{ name: 'last_reconnection_date', type: 'number', isOptional: true },
```

---

## Part 5: Phased Roadmap

### Phase 1: Schema & Foundation (Week 1-2)

> **Goal:** Build data infrastructure that captures context from day 1.

#### 1.1 Database Schema
- [ ] Create migration for `oracle_context_cache` table
- [ ] Create migration for `journal_signals` table  
- [ ] Create migration for `oracle_consultations` table
- [ ] Create migration for `conversation_threads` table
- [ ] Create migration for `llm_quality_log` table
- [ ] Add intelligence fields to `friends` table
- [ ] Create WatermelonDB models for all new tables

#### 1.2 LLM Abstraction Layer
- [ ] Create `src/shared/services/llm/types.ts` — interfaces
- [ ] Create `src/shared/services/llm/errors.ts` — error taxonomy
- [ ] Create `src/shared/services/llm/retry.ts` — retry logic
- [ ] Create `src/shared/services/llm/prompt-registry.ts` — versioned prompts
- [ ] Create `src/shared/services/llm/llm-service.ts` — orchestration
- [ ] Create `src/shared/services/llm/providers/gemini-flash.ts` — Gemini implementation

#### 1.3 API Key Architecture
- [ ] Decide: Bundled key (beta only) vs server proxy
- [ ] If proxy: Create Cloudflare Worker or Supabase Edge Function
- [ ] Implement `ProxiedGeminiProvider` if using proxy

#### 1.4 Privacy Settings
- [ ] Add `enableAIFeatures` toggle to user settings
- [ ] Create AI features disclosure text
- [ ] Implement settings UI toggle
- [ ] Wire toggle to gate all LLM features

**Acceptance Criteria:**
- [ ] All tables exist and migrations run successfully
- [ ] `LLMService.complete()` returns responses from Gemini
- [ ] Retry logic handles rate limits and timeouts
- [ ] API key is not bundled in production builds (if using proxy)
- [ ] AI toggle appears in settings and gates features

---

### Phase 2: Smart Prompts (Week 3)

> **Goal:** Replace rule-based prompts with LLM-generated, contextual prompts.

#### 2.1 Context Builder
- [ ] Create `src/modules/journal/services/prompt-context-builder.ts`
- [ ] Implement friend context aggregation (archetype, tier, weave count)
- [ ] Implement recent weave context (type, vibe, duration)
- [ ] Implement pattern context (themes, recurring activities)
- [ ] Implement user state context (battery, season, streak)

#### 2.2 Prompt Generator
- [ ] Create `src/modules/journal/services/prompt-generator.ts`
- [ ] Add `journal_prompt` to prompt registry with system prompt
- [ ] Implement LLM prompt generation
- [ ] Implement rule-based fallback
- [ ] Add quality logging (prompt acceptance tracking)

#### 2.3 Integration
- [ ] Update `GuidedReflectionModal` to use `PromptGenerator`
- [ ] Ensure fallback works when offline or LLM fails
- [ ] Add subtle "✨ AI-generated" indicator (or not, based on preference)

**Acceptance Criteria:**
- [ ] `GuidedReflectionModal` shows LLM-generated prompts
- [ ] Prompts reference specific context (friend name, recent weave, patterns)
- [ ] Prompts are concise (≤30 words, 2 sentences max)
- [ ] Falls back to rule-based when LLM unavailable
- [ ] Prompt acceptance/rejection is logged

---

### Phase 3: Rule-Based Triage (Week 4)

> **Goal:** Ship "Today's 3" without LLM dependency.

#### 3.1 Triage Service
- [ ] Create `src/modules/intelligence/services/triage-service.ts`
- [ ] Implement friend scoring for triage priority
- [ ] Implement `TriageReason` detection (decay, reciprocity, life events, pending threads)
- [ ] Implement energy-based filtering
- [ ] Implement confidence calculation

#### 3.2 Triage UI
- [ ] Create `src/modules/home/components/TodaysThreeWidget.tsx`
- [ ] Design card layout (friend name, reason, suggested action)
- [ ] Implement action buttons (text, call, plan)
- [ ] Add to dashboard home screen

#### 3.3 Analytics
- [ ] Track triage shown events
- [ ] Track triage acted-on events
- [ ] Track triage dismissed events

**Acceptance Criteria:**
- [ ] Dashboard shows "Today's 3" widget
- [ ] Recommendations are personalized based on decay, reciprocity, life events
- [ ] Low energy (1-2) shows only high-urgency friends
- [ ] Tapping recommendation opens appropriate action (text, call, plan weave)
- [ ] Works fully offline (no LLM required)

---

### Phase 4: Signal Extraction (Week 5)

> **Goal:** Journal entries feed back into relationship intelligence.

#### 4.1 Extraction Service
- [ ] Create `src/modules/journal/services/signal-extractor.ts`
- [ ] Add `signal_extraction` to prompt registry
- [ ] Implement LLM-based extraction with structured output
- [ ] Implement rule-based fallback (keyword matching)
- [ ] Implement hybrid validation (LLM + rules agreement)
- [ ] Implement confidence gating

#### 4.2 Intelligence Integration
- [ ] Create `src/modules/journal/services/journal-intelligence-service.ts`
- [ ] Update `Friend.resilience` based on positive sentiment
- [ ] Update `Friend.detectedThemesRaw` with merged themes
- [ ] Implement `needsAttention` flag logic (requires pattern, not single entry)
- [ ] Connect to journal save flow (async, non-blocking)

#### 4.3 Offline Queue
- [ ] Create `src/shared/services/offline/offline-queue.ts`
- [ ] Queue signal extraction when offline
- [ ] Process queue on network restore

**Acceptance Criteria:**
- [ ] Journal save is instant (no blocking)
- [ ] Signals are extracted within 5 seconds of save
- [ ] Friend profiles show "Detected themes" after multiple entries
- [ ] `needsAttention` only flags after 2+ negative entries
- [ ] Extraction works offline (queued and processed later)

---

### Phase 5: Oracle MVP (Week 6-7)

> **Goal:** Users can ask questions, get grounded answers.

#### 5.1 Oracle Context Builder
- [ ] Create `src/modules/journal/services/oracle/context-builder.ts`
- [ ] Implement tiered context building (essential, pattern, rich)
- [ ] Implement context caching with TTL
- [ ] Implement granular cache invalidation

#### 5.2 Oracle Service
- [ ] Create `src/modules/journal/services/oracle/oracle-service.ts`
- [ ] Add `oracle_consultation` to prompt registry
- [ ] Implement single-turn consultation
- [ ] Implement organic multi-turn (follow-up questions)
- [ ] Implement 5-turn hard cap
- [ ] Implement grounding citation generation

#### 5.3 Rate Limiting
- [ ] Create `src/modules/journal/services/oracle/rate-limiter.ts`
- [ ] Implement 5/day limit with 4 AM reset
- [ ] Create `RateLimitIndicator` component

#### 5.4 Oracle UI
- [ ] Create `src/modules/journal/components/Oracle/OracleTab.tsx`
- [ ] Create consultation input with "Ask" button
- [ ] Create response display with grounding citations
- [ ] Create turn counter (visible after turn 2)
- [ ] Create exhausted state ("The Oracle rests...")
- [ ] Add "Save to Journal" flow

#### 5.5 Integration
- [ ] Add Oracle tab to Journal navigation
- [ ] Store consultations in `oracle_consultations` table
- [ ] Show consultation history

**Acceptance Criteria:**
- [ ] Oracle tab appears in Journal
- [ ] Users can ask questions and receive grounded responses
- [ ] Responses cite specific data ("You've seen Sarah 3 times this month...")
- [ ] Rate limiting enforces 5/day
- [ ] Multi-turn works organically (Oracle offers follow-up)
- [ ] Turn counter appears after turn 2
- [ ] Consultations can be saved to journal

---

### Phase 6: Follow-Up Prompts (Week 8)

> **Goal:** Smart prompts reference previous conversations ("Last time, Marcus was worried about X...").

#### 6.1 Thread Extraction
- [ ] Add thread extraction to signal extraction pipeline
- [ ] Populate `conversation_threads` table
- [ ] Implement topic deduplication/merging
- [ ] Implement thread status transitions (active → dormant → resolved)

#### 6.2 Follow-Up Generation
- [ ] Create `src/modules/journal/services/followup-generator.ts`
- [ ] Query active threads for tagged friends
- [ ] Generate follow-up prompts grounded in threads
- [ ] Integrate into `PromptGenerator`

**Acceptance Criteria:**
- [ ] Guided reflection occasionally shows follow-up prompts ("Last time...")
- [ ] Follow-ups reference real topics from past entries
- [ ] Only high-confidence threads are surfaced

---

### Phase 7: Proactive Insights (Week 9-10)

> **Goal:** Oracle surfaces insights without being asked.

#### 7.1 Insight Generation
- [ ] Create `src/modules/journal/services/oracle/insight-generator.ts`
- [ ] Implement weekly insight generation
- [ ] Implement friend-specific insight generation
- [ ] Implement pattern insight generation

#### 7.2 Insight UI
- [ ] Create `OracleInsightCard` component
- [ ] Add insight to Oracle tab header
- [ ] Implement "Reflect on this →" action
- [ ] Implement dismiss/swipe away

#### 7.3 Quality Tracking
- [ ] Track insight shown events
- [ ] Track insight acted-on events
- [ ] Track insight dismissed events
- [ ] Calculate insight resonance rate

**Acceptance Criteria:**
- [ ] Weekly insight appears on Oracle tab
- [ ] Insights are grounded in user data
- [ ] "Reflect on this" opens guided reflection with context
- [ ] Resonance rate is tracked

---

### Phase 8: Enhanced Triage (Week 11+)

> **Goal:** Add LLM context to rule-based triage.

#### 8.1 Context Snippets
- [ ] Add `generateContextSnippet()` to `TriageService`
- [ ] Generate brief, actionable context for each recommendation
- [ ] Integrate pending thread topics

#### 8.2 Push Notifications (Opt-In)
- [ ] Add notification time preference to settings
- [ ] Create morning/evening notification content
- [ ] Implement opt-in flow with clear explanation
- [ ] Track notification → action conversion

**Acceptance Criteria:**
- [ ] Triage cards show LLM-generated context ("She mentioned job stress...")
- [ ] Context references pending threads when relevant
- [ ] (If push enabled) Daily notification at user's chosen time
- [ ] Push can be easily disabled

---

## Part 6: Success Metrics

### Phase 1-2 (Foundation + Smart Prompts)

| Metric | Target |
|--------|--------|
| Schema migration success | 100% |
| LLM fallback rate | <10% |
| Prompt acceptance rate | >50% |

### Phase 3 (Triage)

| Metric | Target |
|--------|--------|
| Triage shown → acted on | >30% |
| Weaves logged after triage | +20% |

### Phase 4 (Signal Extraction)

| Metric | Target |
|--------|--------|
| Signal extraction accuracy | >80% (manual review of sample) |
| Friends with detected themes | >70% of friends with 2+ entries |

### Phase 5 (Oracle)

| Metric | Target |
|--------|--------|
| Consultations per user/week | 2-3 |
| Saved to journal rate | >40% |
| "Helpful" feedback rate | >70% |

### Phase 6-8 (Follow-ups, Insights, Enhanced Triage)

| Metric | Target |
|--------|--------|
| Follow-up prompt selection | >60% |
| Insight resonance rate | >50% acted on |
| Journal entries per user/week | +30% from baseline |

---

## Part 7: Risk Checkpoints

### 6-Month Checkpoint

**If after 6 months:**
- Oracle engagement is <20% of active users
- Prompt acceptance rate is similar to rule-based
- Users report insights feel "generic" or "wrong"

**Then:** Reconsider Social Brain thesis. AI becomes supporting feature, not core. Redirect effort to non-AI differentiation.

### What Success Looks Like

- Users say "Weave *knows* me"
- Power users can't imagine switching (would lose relationship intelligence)
- Journal entries get longer and more frequent
- Triage recommendations drive real-world actions
- Oracle consultations lead to relationship breakthroughs

---

## Part 8: Open Items & Future Considerations

### Deferred to Pre-Launch
- [ ] Content safety pre-screening (research better approach than naive regex)
- [ ] Crisis resource injection in Oracle system prompts

### V2 Enhancements
- [ ] On-device signal extraction (Gemini Nano)
- [ ] Manual thread tagging for power users
- [ ] Server-side LLM deployment option
- [ ] Multi-provider failover (Gemini → Claude → OpenAI)

### Not Pursuing
- Semantic drift detection (expensive, approximate with story chips)
- Stress index inference (creepy when wrong)
- Message scraping (privacy nightmare)
- Self-hosted LLM (operational complexity)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | January 2026 | Initial consolidated implementation plan |

---

*This document supersedes conflicting content in the original specs. Refer to source specs for detailed technical implementations.*
