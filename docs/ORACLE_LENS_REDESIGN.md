# Oracle Lens System Redesign

**Date:** January 2026
**Status:** Proposed
**Author:** Design Audit

---

## Executive Summary

The Oracle Lens system is a sophisticated AI-powered reflection tool, but its current UX creates unnecessary cognitive load by presenting 8 abstract Tarot archetypes instead of clear user intents. This document proposes a redesign around **4 intent-based modes** that better serve what users actually want when they invoke the Oracle from a journal entry.

---

## Current State Analysis

### What Exists Today

The Oracle currently offers 8 archetypal "lenses" based on Tarot:

| Archetype | Current Purpose |
|-----------|-----------------|
| The Hermit | Deep introspection, one-on-one focus |
| The Emperor | Structure, planning, control |
| The Lovers | Relationships, harmony, conflict |
| The Magician | Creativity, collaboration, ideas |
| The Empress | Nurturing, self-care, support |
| The High Priestess | Intuition, hidden factors |
| The Fool | New beginnings, spontaneity |
| The Sun | Joy, gratitude, celebration |

### The Problem

1. **Cognitive Overload:** Users must decode abstract archetype meanings before choosing
2. **Overlapping Purposes:** Multiple archetypes serve similar user needs
3. **Conversation-First:** System asks questions before demonstrating value
4. **Buried Actions:** Useful app integrations hidden in conversational responses
5. **One-Size-Fits-All UI:** Same chat interface regardless of user intent

### User Research Insight

When users invoke Oracle from a journal entry, they want one of four things:

1. **Deeper Insights** - Understand this moment with wider context
2. **Planning Help** - Turn this into action
3. **Edit/Expand Entry** - Capture more with AI assistance
4. **Quick Tools** - Access app features with context pre-filled

---

## Proposed Redesign: Intent-First Oracle

### New Information Architecture

```
Journal Entry → "Ask Oracle" Button
                      ↓
         ┌─────────────────────────┐
         │   Mode Selection Sheet  │
         ├─────────────────────────┤
         │  🔮 Go Deeper           │
         │  📅 Plan Next Steps     │
         │  ✏️ Expand This Entry   │
         │  ⚡ Quick Actions       │
         └─────────────────────────┘
                      ↓
            Mode-Specific Flow
```

### Archetype Mapping (Internal Only)

Archetypes remain valuable for prompt engineering but are hidden from users:

| User Mode | Internal Archetype | Voice Characteristics |
|-----------|-------------------|----------------------|
| Go Deeper | High Priestess | Intuitive, pattern-seeing, reflective |
| Plan Next Steps | Emperor | Structured, actionable, concrete |
| Expand Entry | Magician | Creative, collaborative, generative |
| Quick Actions | N/A | No AI - direct navigation |

---

## Mode 1: Go Deeper (Insight Mode)

### User Intent
"I want to understand what this moment means in the bigger picture of my friendship."

### Behavior
- Oracle **leads with analysis** - no initial question required
- Surfaces patterns from friendship history
- Connects entry to broader relationship arc
- Cites specific data points (interaction count, last weave, themes)
- Ends with ONE open question for continued reflection

### UX Flow

```
[User selects "Go Deeper"]
            ↓
[Loading: "Analyzing with full context..."]
            ↓
┌─────────────────────────────────────────────────────────┐
│ 🔮 Oracle                                               │
│                                                         │
│ Looking at your coffee with Sarah yesterday, I notice   │
│ something worth exploring.                              │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📊 Pattern Detected                                 │ │
│ │ This is the 3rd entry in 2 months where plans with  │ │
│ │ Sarah felt "off" or tense. Your connection has      │ │
│ │ shifted from weekly meetups to monthly since Oct.   │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ The good news: yesterday's reconciliation moment when   │
│ she apologized suggests she's aware of the distance     │
│ too. That's meaningful.                                 │
│                                                         │
│ What do you think has been driving the drift?           │
│                                                         │
│                                                         │
│ [Her life changes]  [My availability]  [Something else] │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ ⚡ Suggested Next Step:                                 │
│ [📅 Plan a catch-up]                                    │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Value First:** Oracle demonstrates insight before asking anything
2. **Data-Grounded:** Every observation cites specific context
3. **Bridge to Action:** Explicitly link to "Plan Next Steps" if actionable intent is found
4. **Pattern Cards:** Visual callouts for detected patterns
5. **Suggested Responses:** Reduce typing friction with chip options
6. **Single Question:** End with ONE question, not multiple

---

## Mode 2: Plan Next Steps (Action Mode)

### User Intent
"I want to do something about this - schedule a follow-up, set a reminder, create an intention."

### Behavior
- Oracle extracts actionable items from entry
- Presents 2-3 concrete next steps with one-tap execution
- Each action pre-filled with relevant context
- Minimal prose, maximum utility
- Conversation optional (only if user wants to explore)

### UX Flow

```
[User selects "Plan Next Steps"]
            ↓
[Loading: "Finding actionable threads..."]
            ↓
┌─────────────────────────────────────────────────────────┐
│ 📅 Next Steps for Sarah                                 │
│                                                         │
│ Based on your entry, here's what you might do:          │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📅  Schedule a proper catch-up                      │ │
│ │     You mentioned wanting "unrushed time"           │ │
│ │                                                     │ │
│ │     [Plan Weave with Sarah]                         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔔  Reminder: Her job interview                     │ │
│ │     She mentioned it's next Thursday                │ │
│ │                                                     │ │
│ │     [Set Reminder for Thu]                          │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 💭  Set an intention                                │ │
│ │     "Be more present when we meet"                  │ │
│ │                                                     │ │
│ │     [Save Intention]                                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│ Need something else? Ask me...                          │
│ [________________________________________________]     │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Actions First:** Don't make users chat to reach actions
2. **One-Tap Execution:** Each action is a single button press
3. **Context Pre-filled:** Actions carry relevant data (friend, date, notes)
4. **Conversation Optional:** Text input available but not required
5. **Limit to 3:** Never overwhelm with too many suggestions

---

## Mode 3: Expand This Entry (Writing Mode)

### User Intent
"I want to capture more detail but need help drawing it out."

### Behavior
### Behavior
- **Initial Audit:** Oracle first scans the entry to check for completeness.
  - **Complete?** Skips questions and goes straight to "Composition" (rewriting mode).
  - **Incomplete?** Identifies specific gaps and asks 1-3 targeted questions.
- **Dynamic Flow:** No hard loop. Adapts to the user's starting point.
- **Composition:** Oracle composes expanded entry in user's voice.
- **User Control:** User can edit before saving.

### UX Flow

```
[User selects "Expand This Entry"]
            ↓
┌─────────────────────────────────────────────────────────┐
│ ✏️ Let's capture more                                   │
│                                                         │
│ [Loading: "Assessing entry completeness..."]            │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ⚡ Insight                                          │ │
│ │ You've covered the logistics, but I'm missing the   │ │
│ │ emotional texture.                                  │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ What was the energy like between you two?               │
│                                                         │
│ [Warm & easy]  [Tense at first]  [Awkward]  [Mixed]     │
│                                                         │
│ [Write it now]                                          │
└─────────────────────────────────────────────────────────┘
            ↓
[After 2-3 answers]
            ↓
┌─────────────────────────────────────────────────────────┐
│ ✨ Expanded Entry                                       │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Coffee with Sarah started tense - there was         │ │
│ │ something unspoken hanging between us. But          │ │
│ │ somewhere between the second round of lattes, she   │ │
│ │ apologized for being distant lately. That shifted   │ │
│ │ everything.                                         │ │
│ │                                                     │ │
│ │ We warmed up after that. She told me about the job  │ │
│ │ interview coming up, and I could see how nervous    │ │
│ │ she was underneath the excitement. I promised to    │ │
│ │ text her Thursday morning. It felt like we found    │ │
│ │ our way back to each other, at least for now.       │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ [Edit Draft]                      [Save to Entry]       │
└─────────────────────────────────────────────────────────┘
```

### Key Design Principles

1. **Adaptive Length:** 0 questions if complete, up to 3 if brief.
2. **Early Exit:** Always offer "Write it now" to skip remaining questions.
2. **Progress Visible:** Show step indicator so user knows it's quick
3. **Chip Responses:** Offer common answers to reduce friction
4. **User's Voice:** Composed entry is first-person, natural
5. **Edit Before Save:** User has final control over content

---

## Mode 4: Quick Actions (Tool Mode)

### User Intent
"I just want to do something specific without conversation."

### Behavior
- **Hybrid "Silent Audit" Strategy:** 
  - **Background:** When a journal entry is saved or opened, a low-priority AI task (`oracle_action_extraction`) runs silently to extract context.
  - **Foreground:** If extraction is ready, actions are fully pre-filled (dates, specific notes).
  - **Fallback:** If extraction is pending/failed, actions default to "Smart Form" (direct nav with just generic context like Friend Name).
- **Result:** always instant (0ms latency), but "magically" smart when possible.

### UX Flow

```
[User selects "Quick Actions"]
            ↓
┌─────────────────────────────────────────────────────────┐
│ ⚡ Quick Actions                                        │
│                                                         │
│ What would you like to do?                              │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 📝  Log another weave with Sarah                    │ │
│ │     [✨ Context ready]                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🎂  Add a life event for Sarah                      │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🔔  Remind me about "Her Interview"                 │ │
│ │     Thursday at 2pm [✨ Auto-detected]              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 💫  Create an intention for this friendship         │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 👤  View Sarah's profile                            │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ └─────────────────────────────────────────────────────────┘
```

*Note: UI should subtly indicate when "Enhanced Context" is available (e.g., a sparkle icon or populated subtext), otherwise show standard labels.*
```

### Key Design Principles

1. **No AI:** Instant response, no loading
2. **Context Carried:** Friend name, entry date, etc. pre-filled
3. **Full List:** Show all available actions (5-6 max)
4. **Direct Navigation:** Each button goes straight to destination

---

## New System Prompts

### Shared Preamble (All Modes)

```
ORACLE_VOICE_V2 = """
You are the Oracle in Weave, a companion for nurturing meaningful friendships.

VOICE PRINCIPLES:
- Warm but direct. Like a thoughtful friend who respects your time.
- Grounded in data: EVERY observation must cite specific context provided.
- No filler phrases: Skip "I see that...", "It sounds like...", "I understand..."
- Curious, not prescriptive: Offer perspectives, not instructions.
- Concise: 2-4 sentences for observations, short paragraphs for analysis.

ABSOLUTE RULES:
- NEVER invent data not in the context (interactions, dates, patterns, frequencies)
- NEVER speculate about a friend's feelings or motivations
- If asked about something not in context: "I don't have visibility into that based on what you've logged."
- Always cite your sources naturally: "Looking at your last few weaves with..." or "Your pattern shows..."

WEAVE LANGUAGE:
- Weave: An interaction or time spent together
- Thread: An ongoing topic, concern, or conversation across weaves
- Pattern: A recurring behavior or dynamic in the friendship
- Drift: When connection frequency or quality declines over time

FORMATTING:
- Use **bold** for key insights or friend names
- Use line breaks between distinct thoughts
- Never use em dashes. Use commas or periods instead.
"""
```

---

### Mode 1: Go Deeper - Insight Analysis Prompt

```
ORACLE_INSIGHT_ANALYSIS = """
{ORACLE_VOICE_V2}

MODE: Deep Insight Analysis
You are analyzing a journal entry to surface meaningful patterns and context.

YOUR TASK:
1. Analyze the entry in context of the full friendship history provided
2. Identify the most significant pattern, shift, or insight
3. Connect this moment to the broader relationship arc
4. Present your analysis, then ask ONE follow-up question

RESPONSE STRUCTURE:
1. Opening observation (1-2 sentences grounded in this entry)
2. Pattern or context card (the key insight, with supporting data)
3. Interpretation (what this might mean, 2-3 sentences)
4. Single question (under 20 words, inviting reflection)

PATTERN CARD FORMAT:
When you identify a significant pattern, format it as:
[PATTERN: {short title}]
{1-2 sentence description with specific data points}

WHAT TO LOOK FOR:
- Frequency changes (meeting more/less often)
- Vibe trends (recent interactions skewing positive/negative)
- Recurring themes or concerns across entries
- Life events affecting the friendship
- Reciprocity shifts (who initiates, who responds)
- Comparison to friendship's "baseline" from history

CRITICAL:
- Lead with insight, not questions
- Your analysis should feel like a gift, not an interrogation
- The user should think "I hadn't noticed that" or "That's exactly right"
- Cite specific data: "3 of your last 5 weaves" not "recently"

OUTPUT FORMAT:
Return JSON:
{
  "analysis": "Your full response text with natural formatting",
  "patternDetected": {
    "title": "Short pattern name",
    "description": "1-2 sentence description",
    "dataPoints": ["specific data point 1", "specific data point 2"]
  } | null,
  "followUpQuestion": "Your single question",
  "suggestedResponses": ["Option 1", "Option 2", "Option 3"]
}
"""
```

**User Prompt Template:**
```
ORACLE_INSIGHT_ANALYSIS_USER = """
[JOURNAL ENTRY]
Date: {entry_date}
Friend: {friend_name}
Content:
{entry_content}

[FRIENDSHIP CONTEXT]
{friendship_context}

[NETWORK CONTEXT]
{network_context}

Analyze this entry and surface the most meaningful insight.
"""
```

---

### Mode 2: Plan Next Steps - Action Extraction Prompt

```
ORACLE_ACTION_EXTRACTION = """
{ORACLE_VOICE_V2}

MODE: Action Extraction
You are scanning a journal entry to identify concrete next steps the user might take.

YOUR TASK:
1. Read the entry for actionable threads (mentioned events, follow-ups, concerns, intentions)
2. Generate 2-3 specific, concrete actions the user could take
3. Each action must map to an app capability
4. Prioritize by likely value to the user

AVAILABLE ACTIONS:
- plan_weave: Schedule time with this friend (params: friend_id, suggested_activity, suggested_timeframe)
- set_reminder: Remind about something mentioned (params: friend_id, reminder_text, suggested_date)
- add_life_event: Record a milestone for the friend (params: friend_id, event_title, event_date)
- create_intention: Set a personal intention (params: friend_id, intention_text)
- log_weave: Log an interaction that happened (params: friend_id, prefill_notes)

ACTION QUALITY RULES:
- Be specific: "Schedule coffee next week" not "Spend more time together"
- Extract from entry: Only suggest what's grounded in the content
- Include context: "Her job interview is Thursday" not just "Set a reminder"
- Realistic timing: Don't suggest things for today if entry was yesterday

OUTPUT FORMAT:
Return JSON:
{
  "summary": "One sentence framing the actions (e.g., 'Here are some ways to follow up on your time with Sarah:')",
  "actions": [
    {
      "type": "plan_weave|set_reminder|add_life_event|create_intention|log_weave",
      "title": "Short action title",
      "description": "Why this action, grounded in entry",
      "params": { action-specific parameters },
      "priority": 1|2|3
    }
  ],
  "fallbackMessage": "Message if no clear actions found"
}

CRITICAL:
- Maximum 3 actions
- If no clear actions, return empty array with helpful fallbackMessage
- Actions should feel helpful, not pushy
- The user should think "Yes, I should do that"
"""
```

**User Prompt Template:**
```
ORACLE_ACTION_EXTRACTION_USER = """
[JOURNAL ENTRY]
Date: {entry_date}
Friend: {friend_name}
Content:
{entry_content}

[FRIEND CONTEXT]
{friend_context}

Extract actionable next steps from this entry.
"""
```

---

### Mode 3: Expand Entry - Question Generation Prompt

```
ORACLE_EXPAND_QUESTION = """
{ORACLE_VOICE_V2}

MODE: Entry Expansion - Question Phase
You are helping the user capture more detail about a moment they journaled.

YOUR TASK:
1. Identify what's missing from the entry (emotion, sensory details, turning points, dialogue)
2. Ask ONE question that will draw out richer narrative
3. Provide suggested quick responses to reduce friction

QUESTION QUALITY:
- Ask about texture, not facts (you have the facts)
- Good: "What was the energy like?" / "Was there a moment that shifted things?"
- Bad: "Who else was there?" / "What time was it?"
- Under 15 words
- Conversational, not clinical

QUESTION PROGRESSION:
- Question 1: Usually about emotional quality or vibe
- Question 2: Usually about a specific moment or turning point
- Question 3: Usually about what lingered after, or what surprised them

SUGGESTED RESPONSES:
- Provide 3-4 chip options that are common answers
- Make them natural phrases, not single words
- Include range (positive to negative, simple to complex)

OUTPUT FORMAT:
Return JSON:
{
  "question": "Your question under 15 words",
  "questionType": "vibe|moment|reflection|detail",
  "suggestedResponses": ["Option 1", "Option 2", "Option 3", "Option 4"],
  "questionNumber": 1|2|3
}

CRITICAL:
- This is question {question_number} of 3 maximum
- After question 3, the system will auto-compose (you don't control this)
- Make each question count - you only get 3
"""
```

**User Prompt Template:**
```
ORACLE_EXPAND_QUESTION_USER = """
[ORIGINAL ENTRY]
{entry_content}

[CONVERSATION SO FAR]
{qa_history}

[QUESTION NUMBER]
This is question {question_number} of 3.

Generate the next question to draw out more detail.
"""
```

---

### Mode 3: Expand Entry - Composition Prompt

```
ORACLE_EXPAND_COMPOSE = """
{ORACLE_VOICE_V2}

MODE: Entry Expansion - Composition Phase
You are a skilled journal ghostwriter. Transform the Q&A into an expanded entry.

YOUR TASK:
1. Weave the original entry + new answers into flowing narrative
2. Write in FIRST PERSON as the user
3. Capture emotional texture, not just facts
4. Maintain the user's voice (casual, reflective, whatever tone the original had)

WRITING PRINCIPLES:
- Synthesize, don't concatenate. This should flow as one piece.
- Add sensory details where answers suggest them
- Let the entry breathe - vary sentence length
- Capture the FEELING, not just what happened
- Make connections the user implied but didn't state

WHAT TO INCLUDE:
- Scene/context (already in original, enhance if answers add detail)
- Emotional quality (from Q&A answers)
- Turning points or standout moments (from Q&A)
- Any realizations that emerged

WHAT TO AVOID:
- Bullet points or choppy lists
- Therapy language ("I felt validated", "meaningful connection")
- Obvious conclusions ("I'm grateful for this friendship")
- ANYTHING the user didn't mention or imply
- Excessive length - aim for 4-6 sentences total

OUTPUT FORMAT:
Return plain text - the journal entry content only.
No JSON wrapper, no metadata, no suggestions.
Just the entry text, ready to save.

CRITICAL:
- This replaces/expands the original entry
- User will review before saving
- Quality > quantity - a tight 4 sentences beats a rambling 10
"""
```

**User Prompt Template:**
```
ORACLE_EXPAND_COMPOSE_USER = """
[ORIGINAL ENTRY]
{entry_content}

[Q&A EXPANSION]
{qa_history}

[FRIEND CONTEXT]
Friend: {friend_name}
Tier: {friend_tier}
Archetype: {friend_archetype}

Compose an expanded journal entry incorporating the new details.
"""
```

---

### Consultation Mode (General Questions)

The existing `oracle_consultation` prompt remains for when users ask freeform questions, but should be updated with V2 voice:

```
ORACLE_CONSULTATION_V2 = """
{ORACLE_VOICE_V2}

MODE: Open Consultation
The user is asking a question about their friendships or social life.

YOUR TASK:
1. Answer their question with grounded, specific insight
2. Reference relevant context naturally
3. Optionally suggest a helpful action
4. Keep response focused - don't over-explain

RESPONSE LENGTH:
- Simple questions: 2-3 sentences
- Complex questions: Short paragraph (4-6 sentences)
- Never more than 2 paragraphs

ACTIONS:
If a next step would be helpful, suggest ONE action.
Actions should feel natural, not forced.
Only include if genuinely useful.

OUTPUT FORMAT:
Return JSON:
{
  "text": "Your response with natural formatting",
  "suggestedAction": {
    "type": "action_type",
    "label": "Button text",
    "params": { ... }
  } | null
}
"""
```

---

## Visual Design Specifications

### Mode Selection Sheet

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   ✨ Oracle                                    [×]      │
│                                                         │
│   What would you like to do?                            │
│                                                         │
│   ┌─────────────────────────────────────────────────┐   │
│   │  🔮  Go Deeper                                  │   │
│   │  Understand this moment with full context       │   │
│   │  about {friendName} and your connection         │   │
│   └─────────────────────────────────────────────────┘   │
│   ↑ 64pt height, 16pt padding, subtle background tint   │
│                                                         │
│   [... other mode cards ...]                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Card Specifications:**
- Height: 64pt minimum (touch target)
- Padding: 16pt all sides
- Icon: 24pt, left-aligned
- Title: 16pt semibold
- Description: 14pt regular, muted color
- Background: Subtle tint per mode (10% opacity of mode color)
- Border radius: 12pt
- Spacing between cards: 12pt

**Mode Colors:**
- Go Deeper: Purple (primary)
- Plan Next Steps: Blue
- Expand Entry: Green
- Quick Actions: Orange

### Pattern Card (Insight Mode)

```
┌─────────────────────────────────────────────────────────┐
│ 📊 Pattern Detected                                     │
│ ─────────────────────────────────────────────────────── │
│ This is the 3rd entry in 2 months where plans with      │
│ Sarah felt "off." Your connection has shifted from      │
│ weekly to monthly since October.                        │
└─────────────────────────────────────────────────────────┘
```

**Specifications:**
- Background: backgroundMuted token
- Border-left: 3pt solid primary color
- Padding: 12pt
- Title: 14pt semibold with icon
- Body: 14pt regular
- Border radius: 8pt

### Action Card (Planning Mode)

```
┌─────────────────────────────────────────────────────────┐
│ 📅  Schedule a proper catch-up                          │
│     You mentioned wanting "unrushed time"               │
│                                                         │
│     [Plan Weave with Sarah]  ← Primary button           │
└─────────────────────────────────────────────────────────┘
```

**Specifications:**
- Background: backgroundSubtle token
- Padding: 16pt
- Icon + Title: 16pt semibold
- Description: 14pt regular, muted
- Button: Ghost style, right-aligned or full-width
- Border radius: 12pt
- Spacing between cards: 12pt

### Progress Indicator (Writing Mode)

```
[● Q1] ─── [● Q2] ─── [○ Q3] ─── [○ ✨]

"Question 2 of 3"
```

**Specifications:**
- Dots: 8pt diameter
- Active: Primary color, filled
- Inactive: Border only, muted
- Connector lines: 1pt, muted color
- Label below: 12pt, muted

### Suggested Response Chips

```
[Warm & easy]  [Tense at first]  [Awkward]  [Mixed]
```

**Specifications:**
- Height: 36pt
- Padding: 12pt horizontal, 8pt vertical
- Font: 14pt regular
- Background: backgroundMuted
- Border: 1pt border color
- Border radius: 18pt (pill shape)
- Spacing: 8pt between chips
- Wrap to multiple rows if needed

---

## Implementation Roadmap

### Phase 1: Intent-First Entry Point (Week 1)

**Files to Modify:**
- `src/modules/oracle/components/OracleSuggestionSheet.tsx` - Replace with mode selection
- `src/modules/oracle/services/oracle-service.ts` - Add mode routing
- `src/modules/oracle/hooks/useOracleSheet.ts` - Add mode parameter

**New Files:**
- `src/modules/oracle/components/OracleModeSheet.tsx` - New mode selection component
- `src/modules/oracle/components/modes/` - Directory for mode-specific components

**Tasks:**
1. Create `OracleModeSheet` with 4 mode cards
2. Update `useOracleSheet` to accept `mode` parameter
3. Route mode selection to appropriate handler
4. Remove archetype selection UI (keep archetypes for internal use)

### Phase 2: Mode-Specific Flows (Week 2)

**Go Deeper Mode:**
- New prompt: `oracle_insight_analysis`
- New component: `InsightModeView.tsx`
- Pattern card component
- Auto-analyze on mode selection (no initial user input)

**Plan Next Steps Mode:**
- New prompt: `oracle_action_extraction`
- New component: `ActionModeView.tsx`
- Action card components with one-tap execution
- Connect to existing action handlers

**Expand Entry Mode:**
- Implement `oracle_assess_completeness` prompt
- Dynamic question routing (0-3 questions)
- "Write it now" interrupt button
- New composition preview component

**Quick Actions Mode:**
**Quick Actions Mode:**
- Implement "Silent Audit" trigger on journal save/mount
- `QuickActionsView.tsx` component
- Logic to merge "Background Extracted Data" with "Default Context"
- Fallback UI (standard forms) vs Enhanced UI (pre-filled forms)

### Phase 3: Polish & Integration (Week 3)

**Tasks:**
1. Implement all visual design specs
2. Add loading states per mode
3. Add error handling per mode
4. Analytics events for mode selection
5. A/B test: old archetypes vs new modes (optional)
6. Update empty states
7. Documentation and prompt registry updates

---

## Success Metrics

### Quantitative
- **Mode Selection Rate:** % of users who select a mode vs. dismiss
- **Completion Rate:** % who complete the flow once started
- **Action Execution:** % of suggested actions that get tapped
- **Entry Expansion:** Average character increase in Expand mode
- **Time to Value:** Seconds from Oracle open to first insight shown

### Qualitative
- User feedback on mode clarity
- Perceived usefulness of insights (survey)
- Quality of composed entries (sample review)

---

## Open Questions

1. **Should Quick Actions be in this sheet?** Yes. With the "Silent Audit", it bridges the gap between manual and AI tools. Users don't care *how* it works, just that it's useful.

2. **How to handle entries without a clear friend?** Some entries may be about multiple friends or general reflection.

3. **Should modes be mutually exclusive?** No. Use "Bridge Suggestions" at the end of flows to link them (e.g., Insight -> Action). The UI stays focused, but the path is open.

4. **What about the existing Insights Carousel?** Does it still appear in chat, or only in dedicated insights view?

5. **Rate limiting per mode?** Currently 999 (disabled). Should different modes have different limits?

---

## Appendix: Migration from Archetypes

### Archetype → Mode Mapping

When `analyzeEntryContext` is called, instead of returning archetypes, return mode suggestions:

**Old Response:**
```json
[
  {"archetype": "THE_HERMIT", "title": "Explore the tension", ...},
  {"archetype": "THE_EMPEROR", "title": "Plan next steps", ...},
  {"archetype": "THE_LOVERS", "title": "Understand the dynamic", ...}
]
```

**New Response:**
```json
{
  "recommendedMode": "go_deeper",
  "modeContext": {
    "go_deeper": {"available": true, "reason": "Entry contains emotional complexity"},
    "plan_next_steps": {"available": true, "reason": "Mentioned following up on interview"},
    "expand_entry": {"available": true, "reason": "Entry is brief, could capture more"},
    "quick_actions": {"available": true}
  }
}
```

### Prompt Registry Updates

Add new prompts to `src/shared/services/llm/prompt-registry.ts`:

```typescript
// New prompts for Oracle Lens V2
'oracle_insight_analysis': { ... },
'oracle_action_extraction': { ... },
'oracle_expand_question': { ... },
'oracle_expand_compose': { ... },
'oracle_consultation_v2': { ... },
```

Deprecate (but don't remove yet):
```typescript
// Deprecated - use mode-specific prompts
'oracle_lens_analysis': { deprecated: true, ... },
```

---

## Appendix B: Smart Journal Action Buttons

### Problem Statement

The current journal entry detail view has static action buttons:
- **Ask Oracle** - Always shows "Ask Oracle"
- **Mimic Plan** - Always shows "Mimic Plan"
- **Add Milestone** - Always shows "Add Milestone"
- **Reach Out** - Always shows "Reach Out"

These buttons don't adapt to entry content. A user writing "Saw Liam - he's had a baby!" sees the same generic "Add Milestone" button as someone writing "Quick coffee with Sarah."

### Proposed Solution: Contextual Smart Actions

Analyze journal entry content to surface the most relevant action with intelligent pre-filling:

| Entry Content | Smart Button | Pre-fill |
|---------------|--------------|----------|
| "Liam's had a baby!" | 🎁 **Add: Liam's Baby** | Life event → Baby, Friend: Liam |
| "Can't wait for the group holiday!" | 📅 **Plan: Group Holiday** | Plan Wizard → Activity: Holiday |
| "Her interview is Thursday" | 🔔 **Remind: Her Interview** | Reminder → Thu, text: Interview |
| "Haven't seen him in months" | 💬 **Reach Out to Jake** | Message with context |

### Silent Audit Architecture

To avoid latency when opening entries, use a **background extraction** pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                    SILENT AUDIT FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Entry Saved] ──→ Queue background task                    │
│                         ↓                                   │
│              analyzeEntryActions(entry)                     │
│                         ↓                                   │
│              Store in SmartActionCache                      │
│                                                             │
│  [Entry Opened] ──→ Check SmartActionCache                  │
│                         ↓                                   │
│         ┌─────────────────────────────────┐                 │
│         │ Cache Hit?                      │                 │
│         ├─────────────────────────────────┤                 │
│         │ YES → Show smart buttons        │                 │
│         │ NO  → Show generic buttons      │                 │
│         │       + trigger background task │                 │
│         └─────────────────────────────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Result:** 0ms latency on open, but "magically" smart when cache is warm.

### System Prompt: `journal_action_detection`

```
JOURNAL_ACTION_DETECTION = """
You analyze journal entries to detect actionable events worth surfacing as quick actions.

DETECT THESE ACTION TYPES:

LIFE_EVENT (confidence threshold: 0.8)
Milestone worth recording for a friend:
- New baby, pregnancy announcement
- Engagement, wedding, anniversary
- New job, promotion, graduation
- Moving, new home
- Health milestone (recovery, diagnosis)
- Birthday mention
- Loss, bereavement

PLAN_SUGGESTION (confidence threshold: 0.7)
Something to schedule together:
- Mentioned future plans ("can't wait for the holiday")
- Desire to meet again ("we should do this more often")
- Upcoming event to attend together
- Group activity mentioned

FOLLOW_UP (confidence threshold: 0.7)
Something to remember/remind about:
- Friend mentioned upcoming event (interview, appointment, trip)
- Unresolved conversation topic
- Promise made ("I said I'd send them that article")
- Check-in needed ("she seemed stressed about...")

REACH_OUT (confidence threshold: 0.6)
Reconnection signal detected:
- Long time since last contact mentioned
- Friend going through difficulty
- Gratitude that should be expressed
- Drift or distance acknowledged

EXTRACTION RULES:
- Only extract what's explicitly stated or strongly implied
- Prefer specific over generic (\"Thursday\" not \"soon\")
- Extract friend name if determinable from context
- Extract dates in ISO format when mentioned
- Max 2 actions per entry (highest confidence first)

OUTPUT FORMAT:
Return JSON array (empty if no clear actions):
[
  {
    "type": "life_event|plan_suggestion|follow_up|reach_out",
    "confidence": 0.0-1.0,
    "label": "Button label (max 4 words)",
    "reason": "Quote or paraphrase from entry",
    "prefill": {
      "friendName": "extracted or null",
      "friendId": "if determinable",
      "eventType": "baby|wedding|job|birthday|trip|interview|etc",
      "title": "Suggested title for the action",
      "date": "ISO date if mentioned, null otherwise",
      "notes": "Additional context to pre-fill"
    }
  }
]

EXAMPLES:

Entry: "Coffee with Sarah - she told me about her new job at Google! So proud of her."
Output: [{"type": "life_event", "confidence": 0.95, "label": "Add: Sarah's New Job", "reason": "new job at Google", "prefill": {"friendName": "Sarah", "eventType": "job", "title": "New job at Google"}}]

Entry: "Quick catch up with Mike. His interview is next Thursday - hope it goes well!"
Output: [{"type": "follow_up", "confidence": 0.9, "label": "Remind: Mike's Interview", "reason": "interview is next Thursday", "prefill": {"friendName": "Mike", "eventType": "interview", "title": "Mike's interview", "date": "next Thursday"}}]

Entry: "Great dinner with the group - can't wait for our trip to Portugal next month!"
Output: [{"type": "plan_suggestion", "confidence": 0.85, "label": "Plan: Portugal Trip", "reason": "trip to Portugal next month", "prefill": {"eventType": "trip", "title": "Portugal trip", "notes": "Group trip"}}]

Entry: "Nice walk in the park with Emma."
Output: []  // No clear actionable event
"""
```

**User Prompt Template:**
```
JOURNAL_ACTION_DETECTION_USER = """
[JOURNAL ENTRY]
Date: {entry_date}
Content:
{entry_content}

[LINKED FRIENDS]
{friend_names}

Analyze this entry and extract actionable events.
"""
```

### Data Model: SmartActionCache

```typescript
// New table or field on JournalEntry
interface SmartActionCache {
  entryId: string;
  analyzedAt: number;           // Timestamp
  actions: SmartAction[];
  contentHash: string;          // To detect if entry changed
}

interface SmartAction {
  type: 'life_event' | 'plan_suggestion' | 'follow_up' | 'reach_out';
  confidence: number;
  label: string;
  reason: string;
  prefill: {
    friendName?: string;
    friendId?: string;
    eventType?: string;
    title?: string;
    date?: string;
    notes?: string;
  };
}
```

### Implementation: JournalEntryDetailSheet

```typescript
// Add to JournalEntryDetailSheet.tsx

const [smartActions, setSmartActions] = useState<SmartAction[]>([]);
const [isSmartActionsReady, setIsSmartActionsReady] = useState(false);

useEffect(() => {
  const loadSmartActions = async () => {
    // 1. Check cache first (instant)
    const cached = await getSmartActionCache(entry.id);

    if (cached && cached.contentHash === hashContent(entry.content)) {
      setSmartActions(cached.actions);
      setIsSmartActionsReady(true);
      return;
    }

    // 2. No cache - show generic buttons, trigger background analysis
    setIsSmartActionsReady(false);

    // Fire and forget - will be ready next time
    analyzeEntryActionsBackground(entry, friends);
  };

  loadSmartActions();
}, [entry.id]);

// Render smart or generic buttons
const renderActionButtons = () => {
  if (isSmartActionsReady && smartActions.length > 0) {
    return (
      <>
        <ActionButton
          icon={Sparkles}
          label="Ask Oracle"
          onPress={handleAskOracle}
        />
        {smartActions.map(action => (
          <SmartActionButton
            key={action.type}
            action={action}
            onPress={() => handleSmartAction(action)}
            enhanced={true}  // Shows sparkle indicator
          />
        ))}
      </>
    );
  }

  // Fallback: generic buttons
  return (
    <>
      <ActionButton icon={Sparkles} label="Ask Oracle" onPress={handleAskOracle} />
      {friends.length > 0 && (
        <>
          <ActionButton icon={Gift} label="Add Milestone" onPress={handleLifeEvent} />
          <ActionButton icon={Calendar} label="Plan Weave" onPress={handleMimic} />
          <ActionButton icon={MessageCircle} label="Reach Out" onPress={handleReachOut} />
        </>
      )}
    </>
  );
};
```

### Smart Action Handler

```typescript
const handleSmartAction = (action: SmartAction) => {
  // Track analytics
  Analytics.track('smart_action_tapped', {
    type: action.type,
    confidence: action.confidence
  });

  switch (action.type) {
    case 'life_event':
      // Navigate to life event modal with prefill
      setLifeEventPrefill({
        friendId: action.prefill.friendId || friends[0]?.id,
        eventType: action.prefill.eventType,
        title: action.prefill.title,
        date: action.prefill.date ? new Date(action.prefill.date) : new Date(),
      });
      setShowLifeEventModal(true);
      break;

    case 'plan_suggestion':
      // Navigate to plan wizard with prefill
      router.push({
        pathname: '/weave-logger',
        params: {
          mode: 'plan',
          friendId: action.prefill.friendId || friends[0]?.id,
          suggestedActivity: action.prefill.title,
          notes: action.prefill.notes,
        }
      });
      break;

    case 'follow_up':
      // Navigate to reminder creation with prefill
      setReminderPrefill({
        friendId: action.prefill.friendId || friends[0]?.id,
        text: action.prefill.title,
        suggestedDate: action.prefill.date,
      });
      setShowReminderModal(true);
      break;

    case 'reach_out':
      // Use existing reach out flow with context
      handleReachOut(action.prefill.friendId || friends[0]?.id, {
        contextMessage: action.prefill.notes
      });
      break;
  }
};
```

### Visual Design: Smart Action Button

```
┌─────────────────────────────────────────────────────────────┐
│ GENERIC BUTTON (cache miss)                                 │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐  ┌───────────────────────┐       │
│  │ 🎁 Add Milestone      │  │ 📅 Plan Weave         │       │
│  └───────────────────────┘  └───────────────────────┘       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ SMART BUTTON (cache hit)                                    │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐  ┌───────────────────────┐       │
│  │ 🎁 Add: Liam's Baby   │  │ 🔔 Remind: Interview  │       │
│  │    ✨ Ready           │  │    Thu · ✨ Auto      │       │
│  └───────────────────────┘  └───────────────────────┘       │
│                                                             │
│  Note: Enhanced buttons show:                               │
│  - Specific label (not generic)                             │
│  - Sparkle indicator (✨)                                   │
│  - Optional subtext (date, context)                         │
└─────────────────────────────────────────────────────────────┘
```

**Button Specifications:**

| State | Background | Label | Subtext |
|-------|------------|-------|---------|
| Generic | `backgroundMuted` | Static ("Add Milestone") | None |
| Smart (ready) | `primary/10` | Dynamic ("Add: Liam's Baby") | "✨ Ready" or date |
| Loading | `backgroundMuted` | Static | Skeleton shimmer |

### Trigger Points for Background Analysis

1. **On Entry Save** (primary trigger)
   ```typescript
   // In journal entry save flow
   await entry.save();
   queueSmartActionAnalysis(entry.id); // Fire and forget
   ```

2. **On Entry Open** (fallback if not cached)
   ```typescript
   // In JournalEntryDetailSheet mount
   if (!cachedActions) {
     queueSmartActionAnalysis(entry.id);
   }
   ```

3. **On App Foreground** (batch refresh)
   ```typescript
   // In app state handler
   const staleEntries = await getEntriesNeedingAnalysis();
   staleEntries.forEach(e => queueSmartActionAnalysis(e.id));
   ```

### Performance Considerations

| Metric | Target | Notes |
|--------|--------|-------|
| Cache hit rate | >80% | Most entries opened after save |
| Analysis latency | <1s | Small prompt, ~100 tokens output |
| UI latency | 0ms | Always instant (cache or fallback) |
| Token cost | ~150/entry | Minimal, one-time per entry |

### Integration with Oracle Quick Actions Mode

The Smart Action system feeds directly into **Quick Actions Mode** in the Oracle:

1. When user selects "Quick Actions" from Oracle mode sheet
2. Check SmartActionCache for current entry
3. If available: show enhanced actions with pre-fill
4. If not: show generic actions + trigger analysis

This creates a unified experience where smart context is available both:
- **Inline** on the journal detail sheet (always visible)
- **In Oracle** via Quick Actions mode (explicit selection)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| Jan 2026 | Initial design document | Design Audit |
| Jan 2026 | Added Smart Journal Action Buttons appendix | Design Audit |
