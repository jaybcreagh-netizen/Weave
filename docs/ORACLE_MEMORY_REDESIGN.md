# Oracle Memory Redesign

## Document Metadata

| Property | Value |
|---|---|
| Owner | Product + Engineering |
| Status | Proposed (Revised) |
| Scope | Friend memory model, Journal-to-memory bridge, Oracle context, Suggestion integration |
| Last Updated | February 5, 2026 |

---

## 1) Why This Exists

Today, `friend.notes` is mostly hidden and weakly connected to user-facing value:

- It can be saved on friend edit/create.
- It is exported/imported in backup flows.
- It is not a strong input to Oracle context or suggestion generation.

Meanwhile, the app already extracts rich per-friend intelligence that remains invisible to users:

- **Signal extraction** produces themes, sentiment, and relationship dynamics per journal entry.
- **Thread extraction** tracks ongoing per-friend conversation topics with sentiment.
- **Smart actions extraction** detects actionable items from journal content (saved to `JournalEntry.smartActionsRaw` and shown in journal detail, but not surfaced in friend profile memory flows).
- **Friend model fields** like `detectedThemesRaw`, `topicClusters`, `preferredWeaveTypes`, `bestTimeOfDay`, and `lastJournalSentiment` exist, but current write paths are partial and largely not displayed on the profile.

Result: users do not see the intelligence the app is already generating, notes feel disconnected from outcomes, and Oracle actions like "Note: ..." have nowhere meaningful to land.

This redesign turns notes into a visible, structured **Friend Memory System** that:

1. Surfaces existing intelligence on the friend profile
2. Bridges journal extraction output into durable, per-friend memory
3. Gives Oracle and suggestions structured context to reference
4. Provides a clear destination for Oracle "add memory" actions

---

## 2) Product Goals

1. Make friend memory visible, readable, and easy to maintain.
2. Bridge existing journal intelligence into durable, per-friend memory (not a new parallel pipeline).
3. Let Oracle and suggestions use memory in reliable, explainable ways.
4. Preserve calm UX: helpful intelligence without naggy automation.

### Non-Goals

- Full autonomous profile rewriting without user confirmation.
- Complex cross-friend semantic graph reasoning.
- Mandatory structured fields for all memories.
- Auto-saving AI-derived memories without user review (deferred to post-beta).

---

## 3) Existing Infrastructure (Build On, Don't Rebuild)

Before designing new systems, the following existing services should be leveraged:

| System | Location | What It Produces | Current Gap |
|---|---|---|---|
| Signal Extractor | `journal/services/signal-extractor.ts` | Themes, sentiment, dynamics per entry | Output stored but not displayed on profile |
| Thread Extractor | `journal/services/thread-extractor.ts` | Per-friend conversation topics with sentiment | Not visible on profile or in Oracle context |
| Smart Actions | `oracle/services/action-extraction.service.ts` | Actionable items from journal entries | Saved to `smartActionsRaw`, partially surfaced in journal actions, but not integrated into friend memory flows |
| Friend Intelligence Fields | `db/models/Friend.ts` | `detectedThemesRaw`, `topicClusters`, `preferredWeaveTypes`, `bestTimeOfDay`, `lastJournalSentiment` | Fields exist; current pipelines reliably populate `detectedThemesRaw` while others are partial, and none are clearly surfaced on profile |
| Oracle Context Builder | `oracle/services/context-builder.ts` | Friend themes, dynamics, life events, past activities, health warnings | Does not include structured memories |
| Oracle Action Executor | `oracle/hooks/useActionExecutor.ts` | `schedule_event`, `create_intention`, `update_profile`, `reach_out` | No `add_memory` action type |

**Design principle:** The journal-to-memory pipeline should transform existing extraction output into `friend_memories` records, not re-process journal content through a new LLM pass.

---

## 4) UX Vision

### New Friend Profile Section: **Memory**

Each friend profile gets a first-class "Memory" section (not hidden in edit form):

- Quick chips by type (Interests, Upcoming, Wins, Preferences, Context)
- Readable cards with source attribution and recency
- Add / edit / archive actions
- "Suggested from Journal" review queue for AI-derived candidates

### Oracle Behavior

- Oracle can reference saved memories directly in context-aware responses.
- Oracle action "Add memory" saves into this section (or opens prefilled editor).
- Replaces generic "Update profile" actions with memory-specific wording (e.g., "Save memory: vegan preference").

### Suggestions Behavior

- Suggestion language and activity recommendations reference memory types (interests, proven good activities, upcoming dates).

---

## 5) Data Model

Create a new table/model: `friend_memories`.

### Phase 1 Schema (Minimal)

| Column | Type | Notes |
|---|---|---|
| `id` | string | Primary key |
| `friend_id` | string | Indexed, foreign key to friends |
| `type` | string | `interest` \| `preference` \| `upcoming` \| `milestone` \| `activity_win` \| `avoid` \| `context` \| `general` |
| `title` | string | Short display title |
| `content` | string | Detail text |
| `source` | string | `manual` \| `journal_ai` \| `oracle_action` \| `imported` |
| `source_entry_id` | string? | Journal entry ID (when source is `journal_ai`) |
| `is_archived` | boolean | Soft delete / hide |
| `created_at` | number | Timestamp |
| `updated_at` | number | Timestamp |

### Phase 2 Schema Extensions (Add When Needed)

These columns should be added via migration when the journal pipeline and expiration logic are implemented:

| Column | Type | Purpose |
|---|---|---|
| `confidence` | number (0-1) | AI-derived confidence score for filtering and sort order |
| `tags_json` | string | Stringified array for flexible categorization |
| `effective_date` | number? | For time-sensitive memories (upcoming events) |
| `expires_at` | number? | Auto-archive trigger |

### Legacy Compatibility

- Keep `friend.notes` as-is. No deprecation labels in UI.
- Migrate existing `friend.notes` content into one `general` memory item per friend (where notes are non-empty).
- Do not remove `friend.notes` until memory section adoption is validated through usage data.

---

## 6) Journal-to-Memory Bridge

Rather than building a new extraction pipeline, bridge existing extraction output into `friend_memories`:

### Mapping Existing Signals to Memory Types

| Existing Output | Source Service | Maps To Memory Type |
|---|---|---|
| Positive threads with specific topics | Thread Extractor | `interest`, `activity_win` |
| `update_profile` smart actions | Action Extraction | `context`, `preference` |
| High-frequency themes across entries | Signal Extractor | `interest` |
| Detected tension or life transitions | Signal Extractor | `context` |
| Upcoming commitments mentioned | Thread Extractor | `upcoming` |

### Processing Flow

1. After journal processing completes (signals + threads + actions already extracted):
2. Bridge service maps extraction output to candidate `friend_memories` records.
3. Dedupe against existing memories for the same friend (match on type + similar title/content).
4. **All AI-derived candidates route to review queue** (no auto-save for beta).
5. User approves, edits, or dismisses from the "Suggested from Journal" section on the friend profile.

### Guardrails

- Never overwrite an existing manual memory silently.
- Track provenance (`source`, `source_entry_id`, timestamps).
- All AI-derived memories require explicit user confirmation during beta.
- No additional LLM calls beyond what the existing extraction pipeline already performs.

---

## 7) Oracle Integration

Update Oracle context builder to include friend memories:

```typescript
friendMemories: { type, title, content, source, recency }[]
```

### Prompting Updates

- Instruct model to prioritize recent, non-archived memories.
- Instruct model to avoid presenting AI-derived memory as established fact.
- Encourage citation style: "Based on your note that Alex prefers low-key plans..."

### Action Updates

- Add structured Oracle action type: `add_memory`.
- Route action to memory editor with prefilled fields (type, title, content).
- Replace generic `update_profile` action wording with memory-specific language when appropriate.

---

## 8) Suggestion System Integration

Memory-aware suggestion boosts:

- `interest` + `activity_win` increase relevance score for matching activity suggestions.
- `upcoming` + `milestone` increase urgency and timing relevance.
- `avoid` lowers score for mismatched suggestions.

### Life-Event Bridge

- For `upcoming` or `milestone` memories with date-like content, suggest creating a `life_event`.
- Require user confirmation before creating life events.

---

## 9) UI/IA Changes

### Friend Profile

- Add `MemorySection` component on the friend profile (above or near existing timeline/actions).
- Group memories by type with filter chips.
- Provide "Add memory" CTA.
- Show "Suggested from Journal" badge when pending review items exist.

### Friend Edit Form

- Keep current notes field unchanged. No deprecation labels or helper text.
- Notes field continues to function as before; memory section is additive.

### Oracle Surface

- Replace generic "Update profile" action text with memory-specific wording when the action targets a specific fact.
- Example: "Save memory: vegan preference" instead of "Update Alex's profile".

---

## 10) Implementation Plan

### Phase 1a: Schema + Manual Memory CRUD

1. Add DB schema, migration, and `FriendMemory` model.
2. Add `MemorySection` UI on friend profile (list, add, edit, archive).
3. Add `add_memory` Oracle action type to action executor.

### Phase 1b: Oracle Context + Notes Migration

1. Inject memories into Oracle context builder (low effort, high visibility).
2. Migrate existing non-empty `friend.notes` to `general` memory items.
3. Surface existing `detectedThemesRaw` as read-only display on profile first, then show `preferredWeaveTypes`/`topicClusters` when present (quick win while memory section ramps up).

### Phase 2: Journal-to-Memory Bridge

1. Build bridge service mapping existing extraction output to candidate memories.
2. Add review queue UI on friend profile for AI-derived suggestions.
3. Add dedupe logic (type + content similarity matching).
4. Add acceptance/rejection analytics.

### Phase 3: Suggestion Integration + Schema Extensions

1. Add `confidence`, `tags_json`, `effective_date`, `expires_at` columns via migration.
2. Apply memory-aware scoring boosts in suggestion generators.
3. Add memory-to-life-event suggestion flow with user confirmation.

### Phase 4: Expiration + Hardening

1. Add expiration policy for stale contextual memories.
2. Add batch archive/cleanup for expired items.
3. Validate and document final data flow.

---

## 11) Technical Touchpoints

### New Files

- `src/db/models/FriendMemory.ts`
- `src/modules/relationships/components/profile/MemorySection.tsx`
- `src/modules/relationships/components/profile/MemoryCard.tsx`
- `src/modules/relationships/components/profile/MemoryEditor.tsx`
- `src/modules/journal/services/memory-bridge.service.ts`

### Modified Files

- `src/db/schema.ts` (add `friend_memories` table)
- `src/db/migrations.ts` (add migration)
- `src/modules/oracle/services/context-builder.ts` (inject memories)
- `src/modules/oracle/hooks/useActionExecutor.ts` (add `add_memory` action)
- `src/shared/services/llm/prompt-registry.ts` (update prompts)
- `src/modules/interactions/services/suggestion-provider.service.ts` (memory-aware scoring)

### Existing Files to Reference (Not Modify in Phase 1)

- `src/modules/journal/services/signal-extractor.ts` (source of themes/sentiment)
- `src/modules/journal/services/thread-extractor.ts` (source of per-friend topics)
- `src/modules/oracle/services/action-extraction.service.ts` (source of smart actions)

---

## 12) Acceptance Criteria

1. Users can view, add, edit, and archive friend memories directly from the profile.
2. Oracle responses in friend context reference saved memories when relevant.
3. Oracle "add memory" action creates a memory record (or opens prefilled editor).
4. Existing `friend.notes` data is preserved via migration to `general` memory type.
5. Memory changes are auditable by source and timestamp.
6. AI-derived memory candidates require user confirmation before saving.
7. At least one suggestion path uses memory-aware relevance (Phase 3).

---

## 13) Risks and Mitigations

| Risk | Mitigation |
|---|---|
| AI creates noisy or incorrect memory | All AI-derived memories route through review queue. No auto-save during beta. |
| Duplicate or conflicting memories | Dedupe rules match on type + content similarity before creating candidates. |
| Over-automation feels invasive | User confirmation required for all non-manual memories. Calm, non-urgent presentation. |
| New LLM costs for extraction | Bridge existing pipeline output instead of running additional LLM passes. |
| Schema bloat from unused fields | Phase 1 schema is minimal. Extension columns added via migration only when needed. |

---

## 14) Design Decisions (Resolved)

These questions from the original draft have been resolved:

| Question | Decision | Rationale |
|---|---|---|
| Should low-confidence memory auto-save? | No. Always review queue during beta. | Users are building trust with the intelligence layer. Auto-save can come post-beta with usage data. |
| Timeline order or pinned summary for general? | Pinned summary with recent-first ordering underneath. | General notes are reference material, not a feed. |
| Expiration defaults by type? | `upcoming`: 7 days after `effective_date`. `context`: 90 days. All others: no expiration (manual archive). | Keeps memory low-maintenance while preventing stale time-sensitive items. |
| Expose confidence to users? | No. Internal only. | Use confidence for sort order silently. Showing scores turns a calm tool into a science experiment. |

---

## 15) Recommended Timing

This feature is best positioned as a **post-beta V1.1 milestone**. The friend profile can be enriched immediately by surfacing confirmed intelligence fields (starting with `detectedThemesRaw`, then `preferredWeaveTypes`/`topicClusters` where present) as read-only display, which requires no schema changes and provides interim value while the memory system is built.

---

## 16) Implementation Status (February 5, 2026)

### Completed

- `friend_memories` + `friend_memory_candidates` schema/models/migrations are in place.
- Oracle context includes structured friend memories.
- Oracle actions include `add_memory` routing into friend profile memory editor.
- Journal bridge creates memory candidates from existing signals/threads/smart actions.
- Candidate review flow supports approve, edit, and dismiss.
- Candidate review queue auto-advances while reviewing pending suggestions.
- Bulk "dismiss all suggestions" flow is available from Friend Details.
- Memory-aware suggestion boosts are wired (interest/preference/avoid/upcoming effects).
- Expiration metadata (`effective_date`, `expires_at`) is active for memory records.
- Expired memory archival runs in active suggestion/context/profile/journal paths and app lifecycle maintenance.
- Reviewed candidate cleanup (retention-based) runs on app maintenance and profile load.
- Integration tests cover candidate -> approved memory -> suggestion scoring, plus temporal metadata and cleanup logic.

### QA + Launch Readiness

- End-to-end QA checklist added: `docs/ORACLE_MEMORY_QA_CHECKLIST.md`.
- Automated verification is passing (`tsc` + memory test suite).
- Remaining for release: complete device-level checklist run and product sign-off.
