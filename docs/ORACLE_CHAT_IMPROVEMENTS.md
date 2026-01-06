# Oracle Chat Improvements Plan

## Overview

This document outlines improvements to the Oracle chat system based on a comprehensive review. These changes will make the Oracle more context-aware, personalized, and useful.

**Goals:**
- Make Oracle responses feel more tailored to the user's current state
- Fill in placeholder data that's currently missing
- Improve conversation continuity and personalization
- Expand the actions Oracle can suggest

---

## Improvement Areas

### 1. Fill Social Health Placeholders

**Current State:**
```typescript
// context-builder.ts - returns hardcoded zeros
socialHealth: {
  totalActiveFriends: 0,
  needingAttentionCount: 0,
  overallVibe: 'Unknown'
}
```

**Problem:** Oracle can't see the "big picture" of the user's social life.

**Proposed Implementation:**

```typescript
async function buildSocialHealth(): Promise<SocialHealth> {
  const friends = await database.get<Friend>('friends').query(
    Q.where('is_dormant', false)
  ).fetch()

  const now = Date.now()
  const ONE_DAY = 24 * 60 * 60 * 1000

  // Count active friends (interacted in last 30 days)
  const activeFriends = friends.filter(f => {
    if (!f.lastInteractionDate) return false
    const daysSince = (now - f.lastInteractionDate.getTime()) / ONE_DAY
    return daysSince <= 30
  })

  // Count friends needing attention (past expected cadence)
  const needingAttention = friends.filter(f => {
    if (!f.lastInteractionDate) return true
    const daysSince = (now - f.lastInteractionDate.getTime()) / ONE_DAY
    const expectedCadence = getExpectedCadence(f.tier)
    return daysSince > expectedCadence * 1.5
  })

  // Calculate overall vibe from recent interactions
  const recentInteractions = await database.get<Interaction>('interactions').query(
    Q.where('interaction_date', Q.gte(now - 14 * ONE_DAY)),
    Q.where('status', 'completed')
  ).fetch()

  const vibeScores = recentInteractions
    .filter(i => i.vibe)
    .map(i => i.vibe)

  const avgVibe = vibeScores.length > 0
    ? vibeScores.reduce((a, b) => a + b, 0) / vibeScores.length
    : null

  const overallVibe = avgVibe === null ? 'No recent data'
    : avgVibe >= 4 ? 'Thriving'
    : avgVibe >= 3 ? 'Good'
    : avgVibe >= 2 ? 'Mixed'
    : 'Low energy'

  return {
    totalActiveFriends: activeFriends.length,
    needingAttentionCount: needingAttention.length,
    overallVibe
  }
}
```

**Files to Modify:**
- `src/modules/oracle/services/context-builder.ts`

**Context Output Example:**
```
Social Health:
- 12 active friends (interacted in last 30 days)
- 3 friends need attention (past expected cadence)
- Overall vibe: Good (based on last 2 weeks)
```

---

### 2. Fill Journal Context Placeholders

**Current State:**
```typescript
// context-builder.ts - returns empty/neutral
recentJournaling: [
  { date: '...', topics: [], sentiment: 'neutral' }
]
```

**Problem:** Oracle misses emotional context from journal entries.

**Proposed Implementation:**

```typescript
async function buildJournalContext(): Promise<JournalContext[]> {
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000

  const entries = await database.get<JournalEntry>('journal_entries').query(
    Q.where('entry_date', Q.gte(twoWeeksAgo)),
    Q.sortBy('entry_date', Q.desc),
    Q.take(5)
  ).fetch()

  return entries.map(entry => ({
    date: formatRelativeDate(entry.entryDate),
    // Extract topics from title + first 100 chars
    summary: entry.title || entry.content.slice(0, 100),
    // Use mood if available, otherwise infer from content length/frequency
    sentiment: entry.mood || inferSentiment(entry),
    // Include friend mentions if any
    friendsMentioned: entry.friendIds || []
  }))
}

function inferSentiment(entry: JournalEntry): string {
  // Simple heuristic - could be enhanced with LLM later
  const contentLength = entry.content.length
  if (contentLength > 500) return 'reflective'
  if (contentLength > 200) return 'thoughtful'
  return 'brief'
}
```

**Files to Modify:**
- `src/modules/oracle/services/context-builder.ts`

**Context Output Example:**
```
Recent Journaling:
- 2 days ago: "Work stress and feeling overwhelmed" (reflective)
- 5 days ago: "Great catch-up with Sarah" (thoughtful, mentioned: Sarah)
- 1 week ago: "Quick note about weekend plans" (brief)
```

---

### 3. Use Tone Preference in Main Consultation

**Current State:**
- User can set tone preference (grounded/warm/playful/poetic) in settings
- `oracleTonePreference` is fetched but not injected into main consultation prompt

**Problem:** Oracle speaks the same way regardless of user preference.

**Proposed Implementation:**

```typescript
// prompt-registry.ts - Add tone modifiers
export const TONE_MODIFIERS = {
  grounded: `
TONE: Grounded
- Be concise and direct
- Lead with data and observations
- Minimal metaphors or flourishes
- Example: "You've seen Sarah 4 times this month, up from once last month."
`,
  warm: `
TONE: Warm
- Be empathetic and affirming
- Acknowledge feelings before data
- Use supportive language
- Example: "It sounds like Sarah has become a real anchor for you lately - you've connected 4 times this month."
`,
  playful: `
TONE: Playful
- Be light and witty
- Use humor where appropriate
- Keep energy up
- Example: "You and Sarah are on a roll! 4 hangouts this month - she might start charging rent."
`,
  poetic: `
TONE: Poetic
- Use evocative language and imagery
- Be reflective and contemplative
- Weave observations into narrative
- Example: "Your friendship with Sarah has been blooming - four encounters this month, each one a small garden."
`
}

// oracle-service.ts - Inject tone into consultation
async function buildSystemPrompt(userProfile: UserProfile): Promise<string> {
  const tone = userProfile.oracleTonePreference || 'grounded'
  const toneModifier = TONE_MODIFIERS[tone]

  return `${ORACLE_VOICE}

${toneModifier}

${CONSULTATION_RULES}
`
}
```

**Files to Modify:**
- `src/shared/services/llm/prompt-registry.ts` - Add TONE_MODIFIERS export
- `src/modules/oracle/services/oracle-service.ts` - Inject tone into system prompt

---

### 4. Personalize Starter Prompts

**Current State:**
```typescript
// Generic prompts regardless of user state
const STARTER_PROMPTS = [
  "What's weighing on you?",
  "Who have you been thinking about?",
  "How's your social energy?"
]
```

**Problem:** Prompts don't reflect what Oracle knows about the user.

**Proposed Implementation:**

```typescript
// oracle-service.ts or new file: starter-prompts.ts
async function getPersonalizedStarterPrompts(context: OracleContext): Promise<StarterPrompt[]> {
  const prompts: StarterPrompt[] = []

  // Social season awareness
  if (context.userProfile.socialSeason === 'resting') {
    prompts.push({
      text: "You're in a resting season - how's your energy?",
      icon: 'battery-low'
    })
  } else if (context.userProfile.socialSeason === 'blooming') {
    prompts.push({
      text: "Lots of social momentum lately - feeling good?",
      icon: 'sparkles'
    })
  }

  // Friends needing attention
  if (context.socialHealth.needingAttentionCount > 0) {
    const count = context.socialHealth.needingAttentionCount
    prompts.push({
      text: `${count} friend${count > 1 ? 's' : ''} might be missing you`,
      icon: 'users'
    })
  }

  // Specific friend drift
  const driftingFriend = context.friends.find(f => f.dynamics?.trend === 'drifting')
  if (driftingFriend) {
    prompts.push({
      text: `Haven't seen ${driftingFriend.name} in a while?`,
      icon: 'user-minus'
    })
  }

  // Recent journal sentiment
  const recentJournal = context.recentJournaling?.[0]
  if (recentJournal?.sentiment === 'reflective') {
    prompts.push({
      text: "You seemed thoughtful in your last entry",
      icon: 'book-open'
    })
  }

  // Battery trend
  if (context.userProfile.socialBattery.trend === 'Draining') {
    prompts.push({
      text: "Your social battery has been draining - need to recharge?",
      icon: 'battery-charging'
    })
  }

  // Fallback generic prompts if none matched
  if (prompts.length < 3) {
    prompts.push(
      { text: "What's on your mind?", icon: 'message-circle' },
      { text: "Who have you been thinking about?", icon: 'heart' }
    )
  }

  return prompts.slice(0, 4) // Max 4 prompts
}
```

**Files to Modify:**
- `src/modules/oracle/services/oracle-service.ts` - Add `getPersonalizedStarterPrompts()`
- `src/modules/oracle/components/OracleChat.tsx` - Use personalized prompts
- `src/modules/oracle/hooks/useOracle.ts` - Expose starter prompts

**UI Example:**
```
┌─────────────────────────────────────┐
│ "You're in a resting season -       │
│  how's your energy?"                │
├─────────────────────────────────────┤
│ "Haven't seen Sarah in a while?"    │
├─────────────────────────────────────┤
│ "3 friends might be missing you"    │
└─────────────────────────────────────┘
```

---

### 5. Add Conversation Persistence

**Current State:**
- Conversation is stored in React state only
- Lost on app restart or component unmount
- No way to review past conversations

**Problem:** Users lose valuable conversation history.

**Proposed Implementation:**

#### A. New Database Model

```typescript
// src/db/models/OracleConversation.ts
import { Model } from '@nozbe/watermelondb'
import { field, date, json, readonly } from '@nozbe/watermelondb/decorators'

export default class OracleConversation extends Model {
  static table = 'oracle_conversations'

  @field('context') context!: 'default' | 'friend' | 'journal'
  @field('friend_id') friendId?: string
  @field('title') title!: string  // First user question, truncated
  @json('turns', sanitizeTurns) turns!: OracleTurn[]
  @field('turn_count') turnCount!: number
  @readonly @date('started_at') startedAt!: Date
  @date('last_message_at') lastMessageAt!: Date
  @field('is_archived') isArchived!: boolean
}

interface OracleTurn {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  suggestedAction?: SuggestedAction
}
```

#### B. Schema Addition

```typescript
// src/db/schema.ts
{
  name: 'oracle_conversations',
  columns: [
    { name: 'context', type: 'string' },
    { name: 'friend_id', type: 'string', isOptional: true },
    { name: 'title', type: 'string' },
    { name: 'turns', type: 'string' },  // JSON stringified
    { name: 'turn_count', type: 'number' },
    { name: 'started_at', type: 'number' },
    { name: 'last_message_at', type: 'number' },
    { name: 'is_archived', type: 'boolean' }
  ]
}
```

#### C. Service Updates

```typescript
// oracle-service.ts additions
class OracleService {
  private currentConversationId: string | null = null

  async startConversation(context: OracleContext['type']): Promise<string> {
    const conversation = await database.write(async () => {
      return database.get<OracleConversation>('oracle_conversations').create(rec => {
        rec.context = context
        rec.title = 'New conversation'
        rec.turns = []
        rec.turnCount = 0
        rec.startedAt = new Date()
        rec.lastMessageAt = new Date()
        rec.isArchived = false
      })
    })
    this.currentConversationId = conversation.id
    return conversation.id
  }

  async addTurn(turn: OracleTurn): Promise<void> {
    if (!this.currentConversationId) return

    await database.write(async () => {
      const conversation = await database.get<OracleConversation>('oracle_conversations')
        .find(this.currentConversationId!)

      await conversation.update(rec => {
        rec.turns = [...rec.turns, turn]
        rec.turnCount = rec.turns.length
        rec.lastMessageAt = new Date()

        // Set title from first user message
        if (rec.turns.length === 1 && turn.role === 'user') {
          rec.title = turn.content.slice(0, 50) + (turn.content.length > 50 ? '...' : '')
        }
      })
    })
  }

  async getRecentConversations(limit = 10): Promise<OracleConversation[]> {
    return database.get<OracleConversation>('oracle_conversations').query(
      Q.where('is_archived', false),
      Q.sortBy('last_message_at', Q.desc),
      Q.take(limit)
    ).fetch()
  }

  async resumeConversation(id: string): Promise<OracleConversation> {
    this.currentConversationId = id
    return database.get<OracleConversation>('oracle_conversations').find(id)
  }
}
```

#### D. UI Updates

```typescript
// OracleChat.tsx - Add conversation history section
function ConversationHistory({ onSelect }: { onSelect: (id: string) => void }) {
  const conversations = useOracleConversations() // New hook

  if (conversations.length === 0) return null

  return (
    <View className="mb-4">
      <Text className="text-sm font-medium mb-2" style={{ color: colors['muted-foreground'] }}>
        Recent conversations
      </Text>
      {conversations.slice(0, 3).map(conv => (
        <TouchableOpacity
          key={conv.id}
          onPress={() => onSelect(conv.id)}
          className="p-3 mb-2 rounded-lg"
          style={{ backgroundColor: colors.muted }}
        >
          <Text numberOfLines={1} style={{ color: colors.foreground }}>
            {conv.title}
          </Text>
          <Text className="text-xs mt-1" style={{ color: colors['muted-foreground'] }}>
            {formatRelativeDate(conv.lastMessageAt)} · {conv.turnCount} messages
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}
```

**Files to Modify:**
- `src/db/models/OracleConversation.ts` - New file
- `src/db/schema.ts` - Add table
- `src/db/migrations.ts` - Add migration
- `src/db/index.ts` - Register model
- `src/modules/oracle/services/oracle-service.ts` - Add persistence methods
- `src/modules/oracle/hooks/useOracle.ts` - Add conversation management
- `src/modules/oracle/components/OracleChat.tsx` - Add history UI

---

### 6. Dynamic Context Tier Scaling

**Current State:**
- Always uses PATTERN tier (medium detail)
- Same amount of context regardless of conversation depth

**Problem:** Wastes tokens on simple questions, lacks depth for complex ones.

**Proposed Implementation:**

```typescript
// context-builder.ts
function getContextTierForConversation(turnCount: number): ContextTier {
  if (turnCount <= 2) return 'ESSENTIAL'  // Quick questions
  if (turnCount <= 4) return 'PATTERN'    // Medium depth
  return 'RICH'                            // Deep conversations
}

// oracle-service.ts
async ask(question: string): Promise<OracleResponse> {
  const turnCount = this.conversationHistory.length
  const tier = getContextTierForConversation(turnCount)

  const context = await oracleContextBuilder.buildContext({
    tier,
    friendIds: this.focusedFriendIds
  })

  // ... rest of ask logic
}
```

**Context Tiers:**

| Tier | Turn Count | Included Data |
|------|------------|---------------|
| ESSENTIAL | 1-2 | User profile, social season, battery, friend names only |
| PATTERN | 3-4 | + Friend themes, dynamics, recent stats |
| RICH | 5+ | + Full history, venues, activities, life events, journal |

**Files to Modify:**
- `src/modules/oracle/services/context-builder.ts` - Add tier selection logic
- `src/modules/oracle/services/oracle-service.ts` - Use dynamic tier

---

### 7. Expand Action Types

**Current State:**
```typescript
type ActionType = 'log_weave' | 'add_life_event' | 'plan_weave' | 'create_reflection'
```

**Problem:** Limited actions Oracle can suggest.

**Proposed Implementation:**

```typescript
// types.ts
type ActionType =
  // Existing
  | 'log_weave'
  | 'add_life_event'
  | 'plan_weave'
  | 'create_reflection'
  // New
  | 'set_reminder'        // "Remind me to reach out to Sarah next week"
  | 'view_friend'         // "Let me show you Sarah's profile"
  | 'view_insights'       // "I have some observations about this"
  | 'start_deepening'     // "Want to explore this more deeply?"
  | 'share_summary'       // "Want me to summarize this for you to share?"

// Action handlers in OracleChat.tsx
const handleAction = (action: SuggestedAction) => {
  switch (action.type) {
    case 'set_reminder':
      // Navigate to reminder creation with prefilled data
      router.push({
        pathname: '/reminder',
        params: {
          friendId: action.params.friendId,
          message: action.params.message,
          suggestedDate: action.params.suggestedDate
        }
      })
      break

    case 'view_friend':
      router.push({
        pathname: '/friend-profile',
        params: { friendId: action.params.friendId }
      })
      break

    case 'start_deepening':
      setShowDeepeningFlow(true)
      break

    // ... other handlers
  }
}
```

**Prompt Update:**
```typescript
// prompt-registry.ts - Update oracle_consultation
SUGGESTED ACTIONS (choose one if appropriate):
- log_weave: User should log an interaction they mentioned
- plan_weave: User should plan to see someone
- add_life_event: User mentioned a significant event for a friend
- create_reflection: User seems ready to write a deeper reflection
- set_reminder: User wants to remember to do something later
- view_friend: Relevant to show a friend's full context
- start_deepening: Conversation warrants deeper exploration
```

**Files to Modify:**
- `src/modules/oracle/services/types.ts` - Expand ActionType
- `src/shared/services/llm/prompt-registry.ts` - Update prompt
- `src/modules/oracle/components/OracleChat.tsx` - Add handlers
- `src/modules/oracle/components/OracleActionButton.tsx` - Add new action UIs

---

## Implementation Phases

### Phase 1: Data Completeness (Foundation)
**Priority: High | Effort: Medium**

1. [ ] Fill social health placeholders in context-builder
2. [ ] Fill journal context placeholders in context-builder
3. [ ] Test context output quality

**Expected Impact:** Oracle responses become grounded in real data.

---

### Phase 2: Personalization (Quick Wins)
**Priority: High | Effort: Low**

1. [ ] Inject tone preference into main consultation prompt
2. [ ] Create personalized starter prompts based on context
3. [ ] Update OracleChat to use personalized prompts

**Expected Impact:** Oracle feels tailored to each user.

---

### Phase 3: Conversation Persistence (Major Feature)
**Priority: Medium | Effort: High**

1. [ ] Create OracleConversation model and schema
2. [ ] Add migration for new table
3. [ ] Update oracle-service with persistence methods
4. [ ] Add conversation history UI to OracleChat
5. [ ] Add resume conversation flow

**Expected Impact:** Users can continue conversations, builds trust.

---

### Phase 4: Efficiency & Expansion (Polish)
**Priority: Low | Effort: Medium**

1. [ ] Implement dynamic context tier scaling
2. [ ] Add new action types
3. [ ] Update prompts for new actions
4. [ ] Add action handlers in UI

**Expected Impact:** More efficient token usage, richer interactions.

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Context data completeness | ~60% | 95% |
| Conversations saved to journal | Unknown | Track this |
| Conversations resumed | 0% (not possible) | >20% |
| Actions taken from suggestions | Unknown | >30% |

---

## Files Summary

| File | Changes |
|------|---------|
| `src/modules/oracle/services/context-builder.ts` | Social health, journal context, tier scaling |
| `src/modules/oracle/services/oracle-service.ts` | Tone injection, starter prompts, persistence |
| `src/shared/services/llm/prompt-registry.ts` | Tone modifiers, expanded actions |
| `src/modules/oracle/components/OracleChat.tsx` | Personalized prompts, history UI |
| `src/modules/oracle/hooks/useOracle.ts` | Conversation management |
| `src/modules/oracle/services/types.ts` | New action types |
| `src/db/models/OracleConversation.ts` | New model |
| `src/db/schema.ts` | New table |
| `src/db/migrations.ts` | Migration |

---

## Open Questions

1. How long should conversations be retained? (30 days? Forever?)
2. Should archived conversations be searchable?
3. Should starter prompts rotate or stay consistent per session?
4. For set_reminder action - do we need a full reminders feature first?
5. Should conversation history sync across devices?
