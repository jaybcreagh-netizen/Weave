# Journal & Oracle UX Expansion: Closing the Intelligence Loop

## Document Metadata

| Property | Value |
|---|---|
| **Purpose** | Design spec and development roadmap for expanding journal/oracle UX to surface intelligence, reduce entry friction, and increase user value extraction |
| **Status** | Draft - Awaiting Review |
| **Last Updated** | February 6, 2026 |
| **Owner** | Product + Engineering |
| **Builds On** | `docs/JOURNAL_ORACLE_MEMORY_PHASED_IMPLEMENTATION_PLAN.md` (Phase 3 exit assumed) |
| **References** | `docs/journal-oracle-design-spec.md`, `docs/oracle-spec-addendum-v2.md`, `docs/ORACLE_LENS_REDESIGN.md` |
| **Scope** | Post-weave reflection flow, intelligence feedback loops, journal entry experience, feed enrichment |

---

## Table of Contents

- [Part 1: Vision & Problem Statement](#part-1-vision--problem-statement)
- [Part 2: Design Principles](#part-2-design-principles)
- [Part 3: Current State Assessment](#part-3-current-state-assessment)
- [Part 4: Feature Specifications](#part-4-feature-specifications)
  - [4.1 Insight Receipt (Post-Save Intelligence Feedback)](#41-insight-receipt-post-save-intelligence-feedback)
  - [4.2 Inline Post-Weave Reflection](#42-inline-post-weave-reflection)
  - [4.3 Generative Story Chips](#43-generative-story-chips)
  - [4.4 Thread Continuity Surface](#44-thread-continuity-surface)
  - [4.5 Immediate Action Surfacing](#45-immediate-action-surfacing)
  - [4.6 Adaptive Guided Reflection](#46-adaptive-guided-reflection)
  - [4.7 Enriched Journal Feed](#47-enriched-journal-feed)
- [Part 5: Technical Architecture](#part-5-technical-architecture)
- [Part 6: Schema Changes](#part-6-schema-changes)
- [Part 7: Phased Implementation Roadmap](#part-7-phased-implementation-roadmap)
- [Part 8: Success Metrics](#part-8-success-metrics)
- [Part 9: Risks & Mitigations](#part-9-risks--mitigations)
- [Part 10: Open Questions](#part-10-open-questions)

---

## Part 1: Vision & Problem Statement

### The Core Insight

Weave's journal intelligence pipeline is remarkably deep. Signal extraction, thread tracking, memory bridging, smart actions, and sentiment analysis form a comprehensive understanding of every relationship the user writes about. But from the user's perspective, **the journal is a one-way street**. They write into a text box and hit save. Nothing visibly comes back.

This creates a motivation gap: **why invest effort into writing if nothing visible comes from it?**

The journal should feel like writing to someone who *listens* - where the act of reflection is immediately rewarded with visible understanding, actionable connections, and narrative continuity. The intelligence pipeline already does the hard work. This expansion is about making that intelligence *felt*.

### Problem Statement

Three interconnected problems limit the journal's value today:

**1. Entry friction is high in the post-weave flow.**
The user completes a weave log (vibe, category, notes, friends, duration) and is then asked to navigate to a completely separate screen to write more. This context switch - from structured input to blank-page freeform - kills momentum. The system already has rich context but presents the user with an empty slate.

**2. Intelligence extraction is invisible.**
Signal extraction, thread tracking, memory candidates, and smart actions all run fire-and-forget after entry save. The user receives zero feedback that their words were processed, understood, or connected to anything. The pipeline generates 4-8 memory candidates per friend per entry, tracks conversation threads, extracts sentiment - but none of this is visible to the person who created it.

**3. Value surfaces too late and in the wrong place.**
Memory candidates appear on friend profiles. Smart actions surface in Oracle QuickActionsView. Thread continuity exists in the database but never in the UI. By the time these artifacts reach the user (if they ever do), the context and intent that created them has dissipated.

### What This Document Covers

Seven features designed to close the intelligence loop, organized by where they intervene in the user journey:

| Feature | Intervention Point | Primary Problem Addressed |
|---|---|---|
| Insight Receipt | After entry save | Invisible intelligence |
| Inline Post-Weave Reflection | Weave completion | Entry friction |
| Generative Story Chips | During writing | Entry friction |
| Thread Continuity Surface | Before/during writing | Late value delivery |
| Immediate Action Surfacing | After entry save | Late value delivery |
| Adaptive Guided Reflection | During guided writing | Entry friction |
| Enriched Journal Feed | Browsing entries | Invisible intelligence |

---

## Part 2: Design Principles

These principles govern all features in this expansion. They are ordered by priority - when principles conflict, higher-ranked ones win.

### P1: Reward the act of writing

Every journal entry should produce a visible, immediate response from the system. The response should feel like acknowledgment, not evaluation. Users should finish writing and think "the app understood what I said," not "the app graded my entry."

### P2: Never make the user repeat context

If the system already knows the friend, date, category, vibe, and notes from a weave log, the journal should arrive pre-populated with that context. The user should only ever add new information, never re-enter known information.

### P3: Surface value at the moment of highest intent

Memory candidates, smart actions, and thread connections are most compelling within 30 seconds of writing about them. Every hour of delay between creation and surfacing reduces the likelihood of user engagement. Design for immediate delivery.

### P4: Make intelligence legible, not decorative

When surfacing extracted signals, themes, or connections, show them in a way that communicates genuine understanding. "Themes: gratitude, growth" is decorative. "You've written about gratitude with Sarah three times this month - something is deepening here" is legible.

### P5: Minimize decision points

Every fork in the UX (Skip/Write/Help me write, Quick/Full/Guided) is a moment where a user can choose to disengage. Reduce forks. Default to the right thing. Let the user override, not choose.

### P6: Continuity over snapshots

Individual entries are less valuable than the narrative they form. The journal should actively surface connections between entries, highlight evolving threads, and make the arc of a relationship visible without requiring the user to hunt for it.

---

## Part 3: Current State Assessment

### What Exists Today

This assessment assumes completion of the existing `JOURNAL_ORACLE_MEMORY_PHASED_IMPLEMENTATION_PLAN.md` through Phase 3 (unified guided flow, reactive tabs, search, smart action routing).

**Entry Surfaces (5+):**

| Surface | Fields | Trigger | Module |
|---|---|---|---|
| WeaveLogger notes field | Notes, story chips | During weave log | `interactions` |
| WeaveReflectPrompt | 3 buttons: Skip/Write/Help | After meaningful weave | `journal` |
| MicroReflectionSheet | Vibe, notes, title | After quick weave | `reflection` |
| QuickCaptureSheet | Text, friends, date | Journal FAB | `journal` |
| JournalEntryModal | Title, date, content, friends, chips, patterns | Full editor | `journal` |
| GuidedReflectionSheet | Oracle Q&A or prompted flow | "Help me write" | `journal` |

**Intelligence Pipeline (runs silently after save):**

```
Entry Saved
  --> SignalExtractor: sentiment, themes, dynamics, confidence
  --> ThreadExtractor: conversation topics per friend
  --> MemoryBridge: 4-8 candidates per friend
  --> ActionExtraction: smart actions (schedule, reach_out, add_memory)
  --> InsightOrchestrator: relationship insights
  --> StyleAnalyzer: tone detection (every 5 entries)
  --> Friend model update: sentiment, mention count, themes
```

**Value Delivery Points (current):**

| Artifact | Where It Surfaces | Latency |
|---|---|---|
| Memory candidates | Friend profile > Memory tab | Minutes to never |
| Smart actions | Oracle > QuickActionsView | Next Oracle open |
| Conversation threads | Nowhere (DB only) | Never |
| Sentiment/themes | Oracle context (invisible) | Next Oracle query |
| Insight signals | Dashboard carousel | Hours (daily generation) |
| Thread follow-ups | Guided reflection prompts | Next guided session |

### Gap Analysis

| Gap | Severity | Evidence |
|---|---|---|
| No post-save feedback | Critical | Users have no confirmation intelligence was extracted |
| Post-weave context loss | High | WeaveReflectPrompt navigates to empty journal editor |
| Memory candidates orphaned from creation context | High | Surface on friend profile, not after writing |
| Smart actions surface late | Medium | Only in Oracle QuickActionsView |
| Thread tracking invisible | Medium | Stored in `conversation_threads` but no UI |
| Feed shows no patterns | Medium | Chronological list without connections |
| Story chips are passive metadata | Low | No writing guidance from chip selection |
| Guided reflection is rigid | Low | Fixed 3-question limit regardless of answer depth |

---

## Part 4: Feature Specifications

### 4.1 Insight Receipt (Post-Save Intelligence Feedback)

**Priority: P0 - Highest impact feature in this expansion**

#### Problem

After saving a journal entry, the intelligence pipeline runs silently. The user sees a toast ("Entry saved") and nothing else. Signal extraction, thread tracking, and memory bridging produce rich artifacts that the user never sees at the moment they'd care most.

#### Solution

After saving an entry, display a brief, animated **Insight Receipt** card that shows what the system understood. The receipt appears inline (not as a modal or navigation event) and auto-dismisses after 8 seconds, or the user can tap to expand.

#### UX Specification

**Trigger:** Fires after `journalIntelligenceService.processEntry()` completes. If processing takes >3 seconds, show a subtle shimmer placeholder ("Reflecting on what you wrote...") then resolve when ready.

**Receipt States:**

| State | Display |
|---|---|
| Processing | Shimmer card: "Reflecting on what you wrote..." |
| Signals extracted | Theme pills + sentiment indicator + optional thread connection |
| Signals + actions | Above + 1-2 action chips |
| Extraction failed | No receipt shown (fail silently) |

**Layout (compact card, ~120px height):**

```
+----------------------------------------------------------+
|  [sentiment dot]  "Themes: gratitude, vulnerability"      |
|                                                           |
|  "Connects to a thread with Sarah: her career change"    |
|                                                           |
|  [Remember her promotion]  [Plan coffee next week]        |
+----------------------------------------------------------+
```

**Content Rules:**
- Show 1-3 core themes as pills (from `JournalSignals.coreThemesJson`)
- Show sentiment as a colored dot with label only if non-neutral
- Show thread connection ONLY if an existing `ConversationThread` was matched or created (from `ThreadExtractor` output)
- Show max 2 smart actions (from `ActionExtractionService` output, filtered by `confidence > 0.6`)
- If only sentiment was extracted (no themes, no threads), show nothing - avoid empty-feeling receipts

**Interaction:**
- Tap theme pill: no action (decorative, establishes that extraction happened)
- Tap thread connection: navigates to `FriendshipArcView` filtered to that friend
- Tap smart action chip: executes via existing `useActionExecutor()` pattern
- Swipe up or 8s timeout: dismiss with fade animation
- Tap card body: expand to show full signal detail (emergent themes, dynamics)

#### Technical Approach

**New Component:** `src/modules/journal/components/InsightReceipt.tsx`

**Data Flow:**
1. Entry saves and `processEntry()` is called (existing flow)
2. `processEntry()` currently returns `void` - modify to return `ProcessingResult`:
   ```typescript
   interface ProcessingResult {
     signals: SignalExtractionResult | null;
     threads: ExtractedThread[];
     actions: SmartAction[];
     memoryCount: number;
   }
   ```
3. The calling component (QuickCaptureSheet, JournalEntryModal, or GuidedReflectionSheet) receives the result via a callback or promise
4. `InsightReceipt` renders from this result

**Key Decision:** `processEntry()` currently runs fire-and-forget. This feature requires making it awaitable from the UI layer. The processing itself should not block save (optimistic save stands), but the UI should listen for completion.

**Implementation Pattern:**
```typescript
// In save handler (e.g., QuickCaptureSheet)
const entry = await saveEntry(content, friends, date);
showToast('Entry saved');

// Listen for intelligence processing (non-blocking)
journalIntelligenceService.processEntry(entry, aiEnabled)
  .then(result => {
    if (result && hasVisibleSignals(result)) {
      setInsightReceipt(result);
    }
  });
```

**Files Modified:**
- `src/modules/journal/services/journal-intelligence.service.ts` - Return `ProcessingResult`
- `src/modules/journal/components/QuickCaptureSheet.tsx` - Render InsightReceipt
- `src/modules/journal/components/JournalEntryModal.tsx` - Render InsightReceipt
- `src/modules/journal/components/GuidedReflection/GuidedReflectionSheet.tsx` - Render InsightReceipt

**New Files:**
- `src/modules/journal/components/InsightReceipt.tsx` - Receipt component
- `src/modules/journal/components/InsightReceiptExpanded.tsx` - Expanded detail view

---

### 4.2 Inline Post-Weave Reflection

**Priority: P0 - Removes the biggest friction cliff**

#### Problem

The current post-weave flow requires navigating from `WeaveLoggerScreen` to `/journal` - a complete screen change that resets the user's mental context. The `WeaveReflectPrompt` presents three options (Skip, Write, Help me write), creating a decision fork at the moment users are most likely to disengage.

#### Solution

Replace the navigate-away pattern with an **inline expansion** of the weave logger itself. After saving a weave, the form gracefully transitions: the completed fields compact upward, and a reflection area expands below with the user's notes already present and a single contextual prompt.

#### UX Specification

**Trigger:** After a weave is saved successfully AND the weave meets the meaningfulness threshold (existing `checkMeaningfulness()` logic).

**Flow (replaces current WeaveReflectPrompt):**

```
WeaveLoggerScreen: User fills form and taps Save
  --> Toast: "Weave logged!"
  --> Form fields animate to compact summary:
      [Sarah] [deep-talk] [Jan 5] [FullMoon vibe]
  --> Reflection area slides in below summary:
      +-------------------------------------------------+
      |  "We talked about her dad's recovery and it     |
      |   felt really hopeful"                          |  <-- User's existing notes
      |                                                 |
      |  ________________________________________       |
      |  |  What else is staying with you?      |       |  <-- Contextual prompt
      |  |                                      |       |
      |  |______________________________________|       |
      |                                                 |
      |  [Done]                    [Go deeper with AI]  |
      +-------------------------------------------------+
```

**Key Behaviors:**
- User's weave notes are shown as read-only context above the input
- A single contextual prompt is selected from `JournalPrompts.generateWeavePrompts()` (existing)
- Typing anything creates a linked journal entry (setting `linkedWeaveId`)
- "Done" saves whatever was written (even empty = just close)
- "Go deeper with AI" opens GuidedReflectionSheet with full weave context pre-loaded
- If user writes nothing and taps Done, no journal entry is created
- The reflection area auto-focuses the text input with keyboard

**Prompt Selection:**
Reuse existing `JournalPrompts.generateWeavePrompts()` which already selects based on:
- Vibe level (high vibe: "What made it special?")
- Category (deep-talk: "What's still on your mind?")
- Duration (extended: "What's one thing you want to remember?")
- Notes presence (has notes: "Is there more?")

**What This Replaces:**
- `WeaveReflectPrompt` component (skip/write/help-me-write fork)
- Navigation to `/journal` from weave logger
- The context re-entry problem in journal editor

**What This Preserves:**
- MicroReflectionSheet for quick weaves (different flow, lighter context)
- QuickCaptureSheet for standalone journal entries (not post-weave)
- Full JournalEntryModal for editing existing entries

#### Technical Approach

**Modified Component:** `src/modules/interactions/screens/WeaveLoggerScreen.tsx`

**New State:**
```typescript
const [reflectionMode, setReflectionMode] = useState(false);
const [reflectionText, setReflectionText] = useState('');
const [savedInteraction, setSavedInteraction] = useState<Interaction | null>(null);
```

**Flow Change:**
1. `handleSave()` completes and stores the saved interaction
2. If `checkMeaningfulness()` returns true, set `reflectionMode = true`
3. Form animates to compact mode (Reanimated layout animation)
4. Reflection area renders with existing notes as context
5. On "Done": if text exists, create linked `JournalEntry` via `database.write()`:
   ```typescript
   const entry = await database.write(async () => {
     const entry = await database.get('journal_entries').create(record => {
       record.entryDate = savedInteraction.interactionDate;
       record.content = reflectionText;
       record.linkedWeaveId = savedInteraction.id;
     });
     // Create JournalEntryFriend joins for each friend
     for (const friendId of selectedFriendIds) {
       await database.get('journal_entry_friends').create(join => {
         join.journalEntryId = entry.id;
         join.friendId = friendId;
       });
     }
     return entry;
   });
   // Trigger intelligence processing
   journalIntelligenceService.processEntry(entry, aiEnabled);
   ```
6. Navigate back after save

**Compact Summary Sub-component:** `src/modules/interactions/components/WeaveCompactSummary.tsx`
- Renders friend pills, category icon, date, vibe moon in a single row
- ~48px height, horizontally scrollable if many friends

**Files Modified:**
- `src/modules/interactions/screens/WeaveLoggerScreen.tsx` - Add reflection mode
- `src/modules/journal/components/WeaveReflectPrompt.tsx` - Deprecate (keep for rollback)

**New Files:**
- `src/modules/interactions/components/WeaveCompactSummary.tsx`
- `src/modules/interactions/components/InlineReflection.tsx`

**Dependencies:**
- Imports from `journal` module: `journalIntelligenceService`, `JournalPrompts`
- These are already public exports from `src/modules/journal/index.ts`

---

### 4.3 Generative Story Chips

**Priority: P1 - Low effort, noticeable improvement**

#### Problem

Story chips (activities, settings, feelings, surprise, moments, dynamics, topics, people) are passive metadata toggles. Selecting a chip adds it to `storyChipsRaw` JSON but doesn't change the writing experience. Users toggle chips after writing as a categorization step, not as a creative aid.

#### Solution

When a user selects a story chip, inject a contextual prompt into or near the writing area that guides reflection on that dimension.

#### UX Specification

**Chip-to-Prompt Mapping:**

| Chip | Injected Prompt |
|---|---|
| feelings | "What emotions came up for you?" |
| surprise | "What caught you off guard?" |
| dynamics | "How did the energy feel between you?" |
| moments | "What's one moment you want to remember?" |
| activities | "What did you actually do together?" |
| settings | "Where were you? What was the vibe of the place?" |
| topics | "What did you talk about?" |
| people | "Who else was there? How did they affect the dynamic?" |

**Behavior:**
- When a chip is toggled ON, the associated prompt appears as placeholder text or a subtle inline hint below the text input
- If multiple chips are selected, show prompts in selection order as a scrollable list of gentle nudges
- Prompts disappear once the user has written >50 characters (they've found their flow)
- Chip prompts do NOT replace smart prompts or guided reflection - they layer on top for freeform writing

**Visual Treatment:**
- Prompts appear in `colors.textTertiary` italic below the input area
- Chip-linked prompts have a small pill indicator showing which chip triggered them
- Subtle fade-in animation on chip toggle (150ms)

#### Technical Approach

**Mapping Constant:** Add to existing `STORY_CHIPS` in `src/modules/reflection/`:
```typescript
export const CHIP_PROMPTS: Record<string, string> = {
  feelings: "What emotions came up for you?",
  surprise: "What caught you off guard?",
  dynamics: "How did the energy feel between you?",
  moments: "What's one moment you want to remember?",
  activities: "What did you actually do together?",
  settings: "Where were you? What was the vibe of the place?",
  topics: "What did you talk about?",
  people: "Who else was there? How did they affect the dynamic?",
};
```

**Files Modified:**
- `src/modules/reflection/constants/` or `services/` - Add `CHIP_PROMPTS` mapping
- `src/modules/journal/components/JournalEntryModal.tsx` - Render prompts based on `selectedChips`
- `src/modules/journal/components/QuickCaptureSheet.tsx` - If chips are added to quick capture in future

**New Files:**
- `src/modules/journal/components/ChipPromptHints.tsx` - Renders active chip prompts

---

### 4.4 Thread Continuity Surface

**Priority: P1 - Makes journaling feel continuous**

#### Problem

The `conversation_threads` table tracks ongoing topics per friend (e.g., "Marcus's career change", status: active, sentiment: concern). This data is used internally by `ThreadExtractor` and `FollowupGenerator` to inform guided reflection prompts. But users never see their own threads. When starting a new entry about a friend, there's no awareness of what conversations are ongoing.

#### Solution

When a user tags a friend in a journal entry (or starts a post-weave reflection about a friend), surface their active conversation threads as tappable context chips above the writing area.

#### UX Specification

**Trigger:** When `selectedFriendIds` changes in JournalEntryModal, QuickCaptureSheet, or InlineReflection.

**Display:**

```
Tagged: [Sarah] [Marcus]

Active threads with Sarah:
  [Her dad's recovery]  [Career change]  [Book club plans]

Active threads with Marcus:
  [Shared project deadline]

______________________________________________
|  Start writing...                          |
|____________________________________________|
```

**Behavior:**
- Query `conversation_threads` where `friend_id IN (selectedFriendIds)` AND `status = 'active'`
- Show max 4 threads per friend, sorted by `last_mentioned` descending
- Tapping a thread chip pre-fills a prompt: "Last time you mentioned [topic] with [friend]. Any update?"
- If no active threads exist for a friend, show nothing (no empty state)
- Threads update reactively if friends are added/removed
- Threads section collapses after user begins typing (auto-hide after 100+ characters)

**Thread Chip Visual:**
- Small pill with thread topic text, sentiment-colored left border
- `concern` = amber, `neutral` = gray, `positive` = green
- Tap animation: chip briefly highlights, prompt appears in input placeholder

#### Technical Approach

**New Hook:** `src/modules/journal/hooks/useActiveThreads.ts`
```typescript
export function useActiveThreads(friendIds: string[]) {
  // Query conversation_threads via WatermelonDB observable
  // Filter: status = 'active', friend_id in friendIds
  // Sort: last_mentioned DESC
  // Limit: 4 per friend
  return { threads, isLoading };
}
```

**New Component:** `src/modules/journal/components/ThreadContinuityBar.tsx`
- Renders thread chips grouped by friend
- Handles tap-to-prompt interaction
- Auto-collapses when writing begins

**Files Modified:**
- `src/modules/journal/components/JournalEntryModal.tsx` - Render ThreadContinuityBar above input
- `src/modules/journal/components/QuickCaptureSheet.tsx` - Render ThreadContinuityBar
- `src/modules/interactions/components/InlineReflection.tsx` - Render ThreadContinuityBar (new from 4.2)

**Database Query:**
```typescript
database.get<ConversationThread>('conversation_threads')
  .query(
    Q.where('friend_id', Q.oneOf(friendIds)),
    Q.where('status', 'active'),
    Q.sortBy('last_mentioned', Q.desc),
  )
  .observe();
```

---

### 4.5 Immediate Action Surfacing

**Priority: P1 - Captures intent at peak motivation**

#### Problem

Smart actions extracted from journal entries (schedule_event, create_intention, reach_out, add_memory) are stored in `JournalEntry.smartActionsRaw` and only surface in Oracle's QuickActionsView. By the time a user opens the Oracle and navigates to Quick Actions, the context and motivation that produced those actions has faded.

#### Solution

Surface extracted actions as part of the Insight Receipt (4.1). Actions appear as tappable chips at the bottom of the receipt card, executing via the existing `useActionExecutor()` pattern.

#### UX Specification

This feature is an extension of the Insight Receipt (4.1). See that spec for the full receipt layout.

**Action Chip Display Rules:**
- Show max 2 actions (highest confidence first)
- Minimum confidence threshold: 0.6 (matches existing QuickActionsView filter)
- Action labels come from `SmartAction.label` (e.g., "Remember Sarah's promotion", "Plan coffee next week")
- Each chip has an icon matching action type:
  - `schedule_event` / `mimic_plan`: Calendar icon
  - `create_intention`: Target icon
  - `reach_out`: MessageCircle icon
  - `add_memory`: Brain icon
  - `update_profile`: User icon

**Interaction:**
- Tapping an action chip calls `executeAction()` from `useActionExecutor()`
- This closes the receipt and routes to the appropriate screen with prefills
- Executed actions are marked (stored locally to prevent re-showing in QuickActionsView)

#### Technical Approach

Actions are already extracted by `ActionExtractionService` and stored in `JournalEntry.smartActionsRaw`. The Insight Receipt (4.1) includes these in its `ProcessingResult`.

**Integration with 4.1:**
```typescript
// In InsightReceipt.tsx
const { executeAction } = useActionExecutor();

// Render action chips from processingResult.actions
{actions.slice(0, 2).map(action => (
  <ActionChip
    key={action.id}
    label={action.label}
    icon={getActionIcon(action.type)}
    onPress={() => executeAction(action)}
  />
))}
```

**Files Modified:**
- `src/modules/journal/components/InsightReceipt.tsx` (new from 4.1)
- Imports `useActionExecutor` from `src/modules/oracle/hooks/useActionExecutor.ts`

**Existing Infrastructure Used:**
- `ActionExtractionService.queueEntry()` - already runs post-save
- `useActionExecutor()` - already handles all action types with modal coordination
- `SmartAction` type - already defines label, type, confidence, friendId, prefill

---

### 4.6 Adaptive Guided Reflection

**Priority: P2 - Refinement to working feature**

#### Problem

Guided reflection has a hard-coded 3-question limit (`oracle-service.ts`). After 3 user answers, the Oracle automatically composes a draft. This feels rigid - sometimes one rich answer is enough, sometimes users want to explore further. The mandatory draft review step also adds friction: users must read, potentially edit, then confirm the AI-composed text before saving.

#### Solution

Replace the fixed question count with an adaptive system that reads answer depth to decide when to compose, and offer a "save my answers directly" option alongside draft review.

#### UX Specification

**Adaptive Question Logic:**

| User Answer Length | Oracle Response |
|---|---|
| < 30 characters | Ask another question (user needs more prompting) |
| 30-150 characters | Ask one more question OR offer to compose |
| > 150 characters | Offer to compose ("That's rich - want me to weave it together?") |
| Any answer + user taps "I'm done" | Compose immediately regardless of count |

**Maximum questions:** 5 (hard ceiling to prevent fatigue, up from 3)
**Minimum questions:** 1 (if first answer is >150 chars, can compose immediately)

**New "I'm Done" Affordance:**
- After each answer, show a subtle "I'm done, compose this" link below the input
- This replaces the implicit 3-question gate with explicit user control
- The link becomes more prominent after question 2 (larger text, slight color emphasis)

**Save Options After Composition:**

```
+----------------------------------------------------------+
|  [Draft preview - AI composed entry]                      |
|                                                           |
|  [Save as written]     [Edit first]     [Save my answers] |
+----------------------------------------------------------+
```

- **Save as written**: Saves the AI-composed draft directly
- **Edit first**: Opens in JournalEntryModal for manual editing (existing behavior)
- **Save my answers**: Saves the raw Q&A turns as the journal entry content, formatted as a natural conversation transcript, no AI composition

**"Save my answers" Format:**
```
Reflecting on coffee with Sarah (Jan 5)

What's staying with you?
We talked about her dad's recovery and it felt really hopeful. She seemed lighter than she has in months.

What made this time feel different?
I think it was the first time she laughed about it. Like she could see a future where things are okay.
```

#### Technical Approach

**Modified Service:** `src/modules/oracle/services/oracle-service.ts`

Change the `continueReflection()` method:
```typescript
async continueReflection(answer: string): Promise<GuidedTurn> {
  this.turns.push({ role: 'user', content: answer });

  const answerLength = answer.trim().length;
  const turnCount = this.turns.filter(t => t.role === 'user').length;

  // Adaptive composition decision
  const shouldCompose =
    turnCount >= 5 ||                          // Hard ceiling
    (turnCount >= 2 && answerLength > 150) ||  // Rich answer after warmup
    (turnCount >= 3 && answerLength > 30);     // Moderate answers, enough context

  if (shouldCompose) {
    return { type: 'offer_compose', ... };
  }

  // Generate next question
  const question = await this.generateNextQuestion();
  return { type: 'question', content: question };
}
```

**New Method:** `formatAnswersAsEntry()` in oracle-service:
```typescript
formatAnswersAsEntry(context: ReflectionContext, turns: GuidedTurn[]): string {
  // Format Q&A pairs into readable journal entry
  // Include context header (friend, activity, date)
}
```

**Modified Component:** `src/modules/journal/components/GuidedReflection/GuidedReflectionSheet.tsx`
- Add "I'm done" link after each answer
- Add "Save my answers" option in draft review step
- Pass adaptive logic results from oracle service

**Files Modified:**
- `src/modules/oracle/services/oracle-service.ts` - Adaptive question logic
- `src/modules/journal/components/GuidedReflection/GuidedReflectionSheet.tsx` - UI changes
- `src/modules/oracle/services/types.ts` - Update `GuidedTurn` type if needed

---

### 4.7 Enriched Journal Feed

**Priority: P2 - Important but less urgent than entry-time improvements**

#### Problem

`JournalFeed` renders entries chronologically without surfacing patterns, sentiment trends, or thread connections. Each entry card shows title, date, friend tags, and a content preview. There's no indication of what intelligence was extracted or how entries connect to each other.

#### Solution

Enrich feed entry cards with subtle intelligence indicators and add periodic "arc summary" interstitials between entries.

#### UX Specification

**Entry Card Enrichments:**

```
+----------------------------------------------------------+
| Jan 5                                        [sentiment]  |
| Coffee with Sarah                                         |
| "We talked about her dad's recovery..."                   |
|                                                           |
| [gratitude] [vulnerability]     Continues: Dad's recovery |
+----------------------------------------------------------+
```

**New Elements on Entry Cards:**
- **Sentiment indicator**: Small colored dot (right-aligned with date). Colors: tense=red, concerned=amber, neutral=gray, positive=blue, grateful=green. Only shown if sentiment is non-neutral.
- **Theme pills**: 1-3 core theme pills at bottom-left (from `JournalSignals.coreThemesJson`). Small, muted styling - informational, not interactive.
- **Thread connection**: If the entry contributed to an active `ConversationThread`, show "Continues: [topic]" at bottom-right in `textTertiary`.

**Arc Summary Interstitials:**

Between entries, periodically insert a lightweight summary card when patterns are detected:

```
+----------------------------------------------------------+
|  ~ Over your last 3 entries about Sarah ~                 |
|  Sentiment shifted from concerned --> grateful            |
|  Thread "Dad's recovery" has 4 mentions this month        |
+----------------------------------------------------------+
```

**Interstitial Rules:**
- Show max 1 interstitial per 5 entries (prevent clutter)
- Only show when there's a detectable pattern (sentiment shift, thread milestone, or frequency change)
- Interstitials are not stored in DB - computed at render time from signals + threads
- Dismissible (tap X, remember preference per pattern type)

**Data Source:**
- Entry card enrichments: JOIN `journal_signals` on `journal_entry_id` + query `conversation_threads` for matching entries
- Arc summaries: Computed from JournalSignals across entries for same friend, using windowed aggregation

#### Technical Approach

**Modified Component:** `src/modules/journal/components/Journal/JournalFeed.tsx`

**New Hook:** `src/modules/journal/hooks/useEnrichedFeed.ts`
```typescript
// Extends existing useJournalFeed to include signals and thread data
export function useEnrichedFeed() {
  const { entries, loadMore, hasMore } = useJournalFeed();

  // Batch-fetch signals for visible entries
  // Match threads to entries
  // Compute arc summaries at insertion points

  return {
    enrichedItems: (EnrichedEntry | ArcSummary)[],
    loadMore,
    hasMore,
  };
}
```

**New Types:**
```typescript
interface EnrichedEntry {
  type: 'entry';
  entry: JournalEntry;
  signals: JournalSignals | null;
  threadConnections: ConversationThread[];
}

interface ArcSummary {
  type: 'arc_summary';
  friendId: string;
  friendName: string;
  sentimentShift: { from: SentimentLabel; to: SentimentLabel } | null;
  threadMilestone: { topic: string; mentionCount: number } | null;
  entryCount: number;
}
```

**New Components:**
- `src/modules/journal/components/Journal/EnrichedEntryCard.tsx` - Entry card with signals
- `src/modules/journal/components/Journal/ArcSummaryCard.tsx` - Interstitial summary

**Performance Consideration:**
Signals are fetched in batches matching the feed page size (existing pagination from `useJournalFeed`). Thread queries are batched by visible friend IDs. Arc summaries are computed only at page boundaries to avoid expensive windowed queries on scroll.

**Files Modified:**
- `src/modules/journal/hooks/useJournalFeed.ts` - Extend or wrap with enrichment
- `src/modules/journal/components/Journal/JournalFeed.tsx` - Use enriched items, render new card types

**New Files:**
- `src/modules/journal/hooks/useEnrichedFeed.ts`
- `src/modules/journal/components/Journal/EnrichedEntryCard.tsx`
- `src/modules/journal/components/Journal/ArcSummaryCard.tsx`

---

## Part 5: Technical Architecture

### Integration Map

```
                        ENTRY SURFACES
                            |
         +------------------+-------------------+
         |                  |                   |
  InlineReflection   QuickCapture    JournalEntryModal
  (post-weave)       (standalone)    (full editor)
         |                  |                   |
         +------ ThreadContinuityBar -----------+  <-- 4.4
         +------ ChipPromptHints ---------------+  <-- 4.3
         |                  |                   |
         +----------- SAVE ENTRY ---------------+
                            |
                   journalIntelligenceService
                    .processEntry(entry)
                            |
              +-------------+-------------+
              |             |             |
         SignalExtractor  ThreadExtractor  ActionExtraction
              |             |             |
              +--- ProcessingResult ------+
                            |
                     InsightReceipt         <-- 4.1 + 4.5
                     (shows signals,
                      threads, actions)
                            |
                     [User may tap action]
                            |
                     useActionExecutor()
                            |
                  (existing routing to
                   plans, memories, etc.)
```

### Module Boundary Considerations

The features in this expansion touch 4 modules. Respecting the modular architecture from CLAUDE.md:

| Feature | Primary Module | Cross-Module Imports |
|---|---|---|
| InsightReceipt | `journal` | `oracle` (useActionExecutor, SmartAction type) |
| InlineReflection | `interactions` | `journal` (journalIntelligenceService, JournalPrompts) |
| Generative Chips | `journal` + `reflection` | `reflection` (CHIP_PROMPTS constant) |
| Thread Continuity | `journal` | None (ConversationThread is in journal's domain) |
| Immediate Actions | `journal` | `oracle` (useActionExecutor) |
| Adaptive Reflection | `oracle` + `journal` | Existing cross-module imports |
| Enriched Feed | `journal` | None |

**All cross-module imports use public API exports from `index.ts` files** - no deep imports.

### Event Flow Changes

**New UIEventBus event (optional):**
```typescript
| { type: 'JOURNAL_ENTRY_PROCESSED'; entryId: string; result: ProcessingResult }
```

This allows the InsightReceipt to be triggered from any save surface without tight coupling. The entry surface emits the save, and subscribes to the processing result event.

### State Management

| New State | Location | Reason |
|---|---|---|
| `insightReceipt: ProcessingResult \| null` | Component local state | Short-lived, entry-surface specific |
| `reflectionMode: boolean` | WeaveLoggerScreen local state | Only relevant during that screen's lifecycle |
| `activeThreads: ConversationThread[]` | Custom hook (useActiveThreads) | Derived from WatermelonDB observable |
| `enrichedFeedItems` | Custom hook (useEnrichedFeed) | Derived from WatermelonDB queries |

No new Zustand store additions needed. All new state is either component-local or derived via hooks.

---

## Part 6: Schema Changes

### No New Tables Required

All features in this expansion work with existing tables:
- `journal_entries` (existing)
- `journal_signals` (existing, v53)
- `conversation_threads` (existing, v53)
- `friend_memory_candidates` (existing, v71)

### Schema Modifications

**Migration v75: Add insight receipt tracking**

```typescript
// Purpose: Track which entries have shown insight receipts
// and which actions users have engaged with
addColumns({
  table: 'journal_entries',
  columns: [
    { name: 'receipt_shown_at', type: 'number', isOptional: true },
    { name: 'receipt_actions_taken_json', type: 'string', isOptional: true },
  ],
})
```

**Rationale:**
- `receipt_shown_at`: Prevents re-showing receipts on re-open. Also useful for analytics (how often do users see receipts?).
- `receipt_actions_taken_json`: Tracks which smart actions the user executed from the receipt, so QuickActionsView can filter them out. JSON array of action IDs.

**Migration v76: Add thread tap tracking (optional, analytics-only)**

```typescript
addColumns({
  table: 'conversation_threads',
  columns: [
    { name: 'last_surfaced_at', type: 'number', isOptional: true },
    { name: 'surface_count', type: 'number', isOptional: true },
  ],
})
```

**Rationale:** Track how often threads are surfaced to users and when, to measure Thread Continuity Bar engagement without requiring analytics events.

### Model Updates

**JournalEntry model** (`src/db/models/JournalEntry.ts`):
```typescript
@field('receipt_shown_at') receiptShownAt?: number;
@field('receipt_actions_taken_json') receiptActionsTakenRaw?: string;

get receiptActionsTaken(): string[] {
  try { return JSON.parse(this.receiptActionsTakenRaw || '[]'); }
  catch { return []; }
}
```

**ConversationThread model** (`src/db/models/ConversationThread.ts`):
```typescript
@field('last_surfaced_at') lastSurfacedAt?: number;
@field('surface_count') surfaceCount?: number;
```

---

## Part 7: Phased Implementation Roadmap

### Prerequisites

This roadmap assumes completion of `JOURNAL_ORACLE_MEMORY_PHASED_IMPLEMENTATION_PLAN.md` Phase 3 (Exit C):
- Unified guided reflection flow (JOM-301)
- Reactive journal tabs (JOM-302)
- Search surface (JOM-303)
- Smart action routing complete (JOM-304)

### Timeline Overview

| Phase | Window | Focus | Outcome |
|---|---|---|---|
| Phase A | Week 1 | Foundation + Insight Receipt | Users see intelligence feedback after every entry |
| Phase B | Week 2 | Post-Weave Inline Reflection | Weave-to-journal friction eliminated |
| Phase C | Week 3 | Thread Continuity + Generative Chips | Writing experience feels connected and guided |
| Phase D | Week 4 | Adaptive Reflection + Feed Enrichment | Polish and pattern visibility |

### Phase A - Foundation + Insight Receipt (Week 1)

| ID | Title | Priority | Estimate | Depends On |
|---|---|---|---|---|
| JUX-A01 | Schema migration v75: receipt tracking fields | P0 | 0.5d | None |
| JUX-A02 | Modify processEntry() to return ProcessingResult | P0 | 1d | None |
| JUX-A03 | Build InsightReceipt component | P0 | 1.5d | JUX-A02 |
| JUX-A04 | Integrate InsightReceipt into QuickCaptureSheet | P0 | 0.5d | JUX-A03 |
| JUX-A05 | Integrate InsightReceipt into JournalEntryModal | P0 | 0.5d | JUX-A03 |
| JUX-A06 | Integrate InsightReceipt into GuidedReflectionSheet | P1 | 0.5d | JUX-A03 |

#### JUX-A01 - Schema migration v75
- **Scope**: Add `receipt_shown_at` and `receipt_actions_taken_json` to `journal_entries`.
- **Files**: `src/db/schema.ts`, `src/db/migrations.ts`, `src/db/models/JournalEntry.ts`
- **Acceptance Criteria**: Migration runs cleanly. Model exposes `receiptShownAt` and `receiptActionsTaken` getter.

#### JUX-A02 - Modify processEntry() to return ProcessingResult
- **Scope**: Change `journalIntelligenceService.processEntry()` from `Promise<void>` to `Promise<ProcessingResult>`. Aggregate results from signal extraction, thread extraction, and action extraction into a single return object.
- **Files**: `src/modules/journal/services/journal-intelligence.service.ts`
- **Risk**: Callers currently fire-and-forget. Ensure existing fire-and-forget callers still work (return value is optional to consume).
- **Acceptance Criteria**:
  - `processEntry()` returns `{ signals, threads, actions, memoryCount }`.
  - Existing callers (QuickCaptureSheet, JournalEntryModal) continue to work without changes.
  - New callers can `await` the result.

#### JUX-A03 - Build InsightReceipt component
- **Scope**: Create the receipt card component with shimmer loading state, theme pills, sentiment dot, thread connection line, and action chips.
- **Files**: New `src/modules/journal/components/InsightReceipt.tsx`, new `src/modules/journal/components/InsightReceiptExpanded.tsx`
- **Acceptance Criteria**:
  - Renders from `ProcessingResult` data.
  - Shows shimmer while processing, resolves to content.
  - Auto-dismisses after 8 seconds.
  - Tap to expand shows full signal detail.
  - Action chips call `useActionExecutor()`.
  - Fails silently if no meaningful signals extracted.

#### JUX-A04, A05, A06 - Integration into entry surfaces
- **Scope**: Wire InsightReceipt into each save flow. After `processEntry()` resolves, show receipt if `hasVisibleSignals(result)`.
- **Acceptance Criteria**: Receipt appears after save in each surface. Does not block save UX. Dismiss works.

### Phase A Exit Criteria
- Users see intelligence feedback (themes, sentiment, threads, actions) after saving entries.
- Receipt is non-blocking and fails gracefully.
- Schema migration v75 applied.

---

### Phase B - Post-Weave Inline Reflection (Week 2)

| ID | Title | Priority | Estimate | Depends On |
|---|---|---|---|---|
| JUX-B01 | Build WeaveCompactSummary component | P0 | 0.5d | None |
| JUX-B02 | Build InlineReflection component | P0 | 1d | JUX-B01 |
| JUX-B03 | Integrate inline reflection into WeaveLoggerScreen | P0 | 1.5d | JUX-B02 |
| JUX-B04 | Wire linked journal entry creation from inline reflection | P0 | 1d | JUX-B03, JUX-A02 |
| JUX-B05 | Deprecate WeaveReflectPrompt (feature flag) | P1 | 0.5d | JUX-B03 |

#### JUX-B01 - WeaveCompactSummary
- **Scope**: Compact single-row summary of a completed weave showing friend pills, category icon, date, vibe moon.
- **Files**: New `src/modules/interactions/components/WeaveCompactSummary.tsx`
- **Acceptance Criteria**: Renders in ~48px height. Horizontally scrollable for many friends.

#### JUX-B02 - InlineReflection component
- **Scope**: Reflection area with existing notes context, contextual prompt from `JournalPrompts.generateWeavePrompts()`, text input, "Done" and "Go deeper with AI" buttons.
- **Files**: New `src/modules/interactions/components/InlineReflection.tsx`
- **Acceptance Criteria**:
  - Shows user's weave notes as read-only context.
  - Displays contextual prompt based on weave characteristics.
  - Text input auto-focuses with keyboard.
  - "Done" returns text (or empty).
  - "Go deeper" opens GuidedReflectionSheet with full weave context.

#### JUX-B03 - WeaveLoggerScreen integration
- **Scope**: After save, if meaningful, transition form to compact mode + inline reflection. Animate using Reanimated layout animations.
- **Files**: `src/modules/interactions/screens/WeaveLoggerScreen.tsx`
- **Acceptance Criteria**:
  - Meaningful weaves show inline reflection instead of WeaveReflectPrompt.
  - Non-meaningful weaves navigate back as before.
  - Animation is smooth (no jank on form compaction).
  - Back gesture/button works correctly in reflection mode.

#### JUX-B04 - Linked journal entry creation
- **Scope**: When user writes text in InlineReflection and taps "Done", create a `JournalEntry` with `linkedWeaveId` set, friends pre-tagged, and trigger `processEntry()` with InsightReceipt.
- **Files**: `src/modules/interactions/components/InlineReflection.tsx`, imports from `journal` module
- **Acceptance Criteria**:
  - Journal entry created with correct `linkedWeaveId`, date, friends.
  - `processEntry()` fires, InsightReceipt shows if enabled.
  - Empty text + Done = no entry created, just navigate back.

#### JUX-B05 - Deprecate WeaveReflectPrompt
- **Scope**: Feature-flag the old `WeaveReflectPrompt` for rollback safety. Default to new inline flow.
- **Files**: `src/modules/journal/components/WeaveReflectPrompt.tsx`, `src/modules/interactions/screens/WeaveLoggerScreen.tsx`
- **Acceptance Criteria**: Old flow reachable via feature flag. New flow is default.

### Phase B Exit Criteria
- Post-weave reflection happens inline without screen navigation.
- Linked journal entries are created correctly with full intelligence processing.
- Old flow is feature-flagged for rollback.

---

### Phase C - Thread Continuity + Generative Chips (Week 3)

| ID | Title | Priority | Estimate | Depends On |
|---|---|---|---|---|
| JUX-C01 | Build useActiveThreads hook | P1 | 0.5d | None |
| JUX-C02 | Build ThreadContinuityBar component | P1 | 1d | JUX-C01 |
| JUX-C03 | Integrate ThreadContinuityBar into entry surfaces | P1 | 1d | JUX-C02 |
| JUX-C04 | Add CHIP_PROMPTS mapping constant | P1 | 0.25d | None |
| JUX-C05 | Build ChipPromptHints component | P1 | 0.5d | JUX-C04 |
| JUX-C06 | Integrate ChipPromptHints into JournalEntryModal | P1 | 0.5d | JUX-C05 |
| JUX-C07 | Schema migration v76: thread surfacing tracking (optional) | P2 | 0.25d | JUX-C01 |

#### JUX-C01 - useActiveThreads hook
- **Scope**: WatermelonDB observable hook that queries active conversation threads for given friend IDs.
- **Files**: New `src/modules/journal/hooks/useActiveThreads.ts`
- **Acceptance Criteria**: Returns threads grouped by friend, sorted by last_mentioned DESC, max 4 per friend. Reactive to friend selection changes.

#### JUX-C02 - ThreadContinuityBar
- **Scope**: Renders thread chips with sentiment-colored borders. Tap to insert prompt. Auto-collapses on typing.
- **Files**: New `src/modules/journal/components/ThreadContinuityBar.tsx`
- **Acceptance Criteria**:
  - Chips render correctly per friend with sentiment colors.
  - Tap inserts contextual prompt.
  - Bar collapses after 100+ characters typed.
  - Empty state: no threads = no bar rendered.

#### JUX-C03 - Integration into entry surfaces
- **Scope**: Add ThreadContinuityBar to JournalEntryModal, QuickCaptureSheet, and InlineReflection (from Phase B).
- **Files**: Modified files from 4.2, 4.4 specs
- **Acceptance Criteria**: Threads appear when friends are tagged. Bar is contextually appropriate (not shown when no friends selected).

#### JUX-C04, C05, C06 - Generative chip prompts
- **Scope**: Add chip-to-prompt mapping. Build hint component. Integrate into entry modal.
- **Acceptance Criteria**: Selecting a story chip shows a writing prompt. Prompts disappear after 50+ characters. Multiple chips = multiple prompts in order.

### Phase C Exit Criteria
- Thread continuity is visible during writing.
- Story chips actively guide writing.
- Thread and chip interactions tracked for analytics.

---

### Phase D - Adaptive Reflection + Feed Enrichment (Week 4)

| ID | Title | Priority | Estimate | Depends On |
|---|---|---|---|---|
| JUX-D01 | Implement adaptive question logic in oracle-service | P2 | 1d | None |
| JUX-D02 | Add "I'm done" affordance + "Save my answers" option | P2 | 1d | JUX-D01 |
| JUX-D03 | Build useEnrichedFeed hook | P2 | 1d | None |
| JUX-D04 | Build EnrichedEntryCard component | P2 | 1d | JUX-D03 |
| JUX-D05 | Build ArcSummaryCard interstitial | P2 | 1d | JUX-D03 |
| JUX-D06 | Integrate enriched feed into JournalFeed | P2 | 0.5d | JUX-D04, JUX-D05 |

#### JUX-D01 - Adaptive question logic
- **Scope**: Replace fixed 3-question limit with answer-depth-aware logic. Max 5, min 1.
- **Files**: `src/modules/oracle/services/oracle-service.ts`
- **Acceptance Criteria**: Short answers trigger more questions. Rich answers trigger compose offer. Hard ceiling at 5 questions.

#### JUX-D02 - UI changes for adaptive reflection
- **Scope**: Add "I'm done, compose this" link after each answer. Add "Save my answers" option in draft review.
- **Files**: `src/modules/journal/components/GuidedReflection/GuidedReflectionSheet.tsx`
- **Acceptance Criteria**: "I'm done" visible after each answer. "Save my answers" saves formatted Q&A directly.

#### JUX-D03 - useEnrichedFeed hook
- **Scope**: Extends `useJournalFeed` with batch signal fetching, thread matching, and arc summary computation.
- **Files**: New `src/modules/journal/hooks/useEnrichedFeed.ts`
- **Acceptance Criteria**: Returns enriched items with signals and thread connections. Arc summaries computed at page boundaries. Performance acceptable (no visible scroll jank).

#### JUX-D04 - EnrichedEntryCard
- **Scope**: Entry card with sentiment dot, theme pills, and thread connection text.
- **Files**: New `src/modules/journal/components/Journal/EnrichedEntryCard.tsx`
- **Acceptance Criteria**: Renders all enrichments without layout shifts. Falls back gracefully when no signals exist.

#### JUX-D05 - ArcSummaryCard
- **Scope**: Interstitial card showing sentiment shifts and thread milestones across entries for a friend.
- **Files**: New `src/modules/journal/components/Journal/ArcSummaryCard.tsx`
- **Acceptance Criteria**: Max 1 per 5 entries. Only shows when pattern detected. Dismissible.

#### JUX-D06 - Feed integration
- **Scope**: Replace standard feed rendering with enriched items. FlashList `renderItem` handles both entry cards and interstitials.
- **Files**: `src/modules/journal/components/Journal/JournalFeed.tsx`
- **Acceptance Criteria**: Feed renders mixed item types. Scroll performance maintained. `estimatedItemSize` updated for new card heights.

### Phase D Exit Criteria
- Guided reflection adapts to user answer depth.
- Journal feed surfaces patterns, sentiment, and connections.
- No scroll performance regression in feed.

---

## Part 8: Success Metrics

### Primary Metrics (measure 4 weeks post-launch)

| Metric | Baseline (estimate) | Target | Measurement |
|---|---|---|---|
| **Journal entries per weave** | ~0.15 (15% of weaves produce entries) | 0.30 (double) | Count linked entries / total weaves |
| **Avg entry word count** | ~40 words | 65+ words | Mean content length |
| **Insight Receipt engagement** | N/A (new) | 30%+ tap-through on action chips | Tap events / receipts shown |
| **Thread chip tap rate** | N/A (new) | 20%+ of shown threads tapped | Tap events / thread impressions |
| **Post-weave reflection completion** | ~25% (of prompted users) | 45%+ | Users who write >0 chars / users shown reflection |
| **Journal return rate** | TBD (current sessions/week) | +20% increase | Unique journal sessions per active user per week |

### Secondary Metrics

| Metric | Target | Rationale |
|---|---|---|
| Smart action execution rate | 15%+ from receipt | Actions are most compelling at creation time |
| Guided reflection avg turns | 2.5 (from current 3.0) | Adaptive flow should let rich answerers finish faster |
| Feed scroll depth | +15% increase | Enriched cards make browsing more engaging |
| "Save my answers" usage | 20%+ of guided sessions | Validates that users want the shortcut |

### Guardrail Metrics (should NOT regress)

| Metric | Threshold |
|---|---|
| Weave logging completion rate | Must not decrease |
| Time to log a weave (from open to save) | Must not increase >5% |
| App crash rate | Must not increase |
| Feed scroll FPS | Must stay >55fps |

---

## Part 9: Risks & Mitigations

### R1: processEntry() Latency Visible to Users

**Risk:** Making `processEntry()` awaitable means the UI now cares about its latency. If LLM-based signal extraction takes 5-10 seconds, the shimmer state may feel broken.

**Mitigation:**
- InsightReceipt shimmer is non-blocking - user can navigate away.
- Set a 6-second timeout on the receipt. If processing hasn't completed, dismiss shimmer silently.
- Rule-based fallback extraction (already exists in SignalExtractor) completes in <500ms. Show rule-based results immediately, upgrade to LLM results if they arrive.

### R2: Inline Reflection Increases Weave Logger Complexity

**Risk:** WeaveLoggerScreen is already ~700 lines. Adding reflection mode, animation state, and journal creation increases complexity.

**Mitigation:**
- InlineReflection is a separate component with its own state. WeaveLoggerScreen only manages the `reflectionMode` boolean and passes props.
- WeaveCompactSummary is extracted for reuse.
- Feature-flagged for easy rollback.

### R3: Thread Continuity Bar Noise

**Risk:** Showing threads for every tagged friend could create visual noise, especially for users who journal frequently about the same friends.

**Mitigation:**
- Max 4 threads per friend, sorted by recency.
- Auto-collapse after 100+ characters typed.
- Don't show threads older than 30 days.
- If a friend has >4 active threads, show top 3 + "[+N more]" collapsed.

### R4: Enriched Feed Performance

**Risk:** Joining signals and threads per entry in the feed could cause scroll jank, especially with 100+ entries.

**Mitigation:**
- Batch signal fetches per feed page (existing pagination).
- Use FlashList `estimatedItemSize` tuned for enriched cards.
- Arc summaries computed at page boundaries, not per-item.
- Profile with React DevTools before shipping. Target: >55fps.

### R5: Arc Summary Accuracy

**Risk:** Computed arc summaries could surface incorrect or misleading patterns (e.g., "sentiment shifted from concerned to grateful" when it was actually about two different topics).

**Mitigation:**
- Only show arc summaries when entries share the same thread (not just the same friend).
- Require minimum 3 entries in the window for pattern detection.
- Keep language tentative: "It seems like..." rather than assertive claims.
- Dismissible with "Not helpful" feedback option.

---

## Part 10: Open Questions

| # | Question | Impact | Decision Needed By |
|---|---|---|---|
| 1 | Should the Insight Receipt also show memory candidate count? ("3 memories suggested") | Low - could add later | Phase A start |
| 2 | Should InlineReflection support story chips, or keep it minimal (text only)? | Medium - affects scope of Phase B | Phase B start |
| 3 | Should thread continuity bar show resolved/dormant threads with a "reopen" action? | Low - could add later | Phase C start |
| 4 | Should "Save my answers" in adaptive reflection also run signal extraction? | Medium - affects intelligence pipeline | Phase D start |
| 5 | Should arc summaries be cacheable in a new DB table, or always computed on-the-fly? | Medium - performance vs. complexity | Phase D start |
| 6 | How should the Insight Receipt interact with the existing post-save toast? Replace it or show both? | Low - UX polish | Phase A build |

---

## Appendix: New File Inventory

| File | Module | Phase | Purpose |
|---|---|---|---|
| `src/modules/journal/components/InsightReceipt.tsx` | journal | A | Post-save intelligence feedback card |
| `src/modules/journal/components/InsightReceiptExpanded.tsx` | journal | A | Expanded signal detail view |
| `src/modules/interactions/components/WeaveCompactSummary.tsx` | interactions | B | Compact weave summary row |
| `src/modules/interactions/components/InlineReflection.tsx` | interactions | B | Post-weave inline writing area |
| `src/modules/journal/components/ThreadContinuityBar.tsx` | journal | C | Thread chips above writing area |
| `src/modules/journal/hooks/useActiveThreads.ts` | journal | C | WatermelonDB thread query hook |
| `src/modules/journal/components/ChipPromptHints.tsx` | journal | C | Chip-triggered writing prompts |
| `src/modules/journal/hooks/useEnrichedFeed.ts` | journal | D | Feed with signals and threads |
| `src/modules/journal/components/Journal/EnrichedEntryCard.tsx` | journal | D | Entry card with intelligence indicators |
| `src/modules/journal/components/Journal/ArcSummaryCard.tsx` | journal | D | Feed interstitial pattern cards |

---

## Version History

| Version | Date | Changes |
|---|---|---|
| 0.1 | February 6, 2026 | Initial draft from UX review findings |
