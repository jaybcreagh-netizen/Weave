# Oracle Phase 7: Proactive Insights — Complete Implementation Plan

## Document Overview

| Property | Value |
|----------|-------|
| **Purpose** | Enable Oracle to surface proactive insights without user prompting |
| **Status** | Ready for Implementation |
| **Last Updated** | January 2025 |

---

## Part 1: Core Concept

### What We're Building

Oracle proactively surfaces observations about the user's friendships. These appear as cards on the Oracle Tab — grounded insights the user didn't ask for but will find valuable.

### What We're NOT Building

- Weekly insights (already handled by Sunday Weekly Reflection flow)
- A guilt-inducing inbox of unread insights
- Notifications (insights are pull, not push)

### Insight Categories

| Type | What It Surfaces | Where Generated |
|------|------------------|-----------------|
| `friend` | Observation about specific friend | Daily on app open |
| `pattern` | Cross-friend behavioral pattern | Daily on app open |
| `milestone` | Achievement or notable moment | After weave logged |
| `weekly` | Week summary | Part of Weekly Reflection (existing) |

---

## Part 2: Persistence Strategy

### Why Persist?

Insights are **persisted but transient**, not ephemeral.

| Reason | Benefit |
|--------|---------|
| Reliability | App crash doesn't lose valuable insight |
| History | Track which insights user has seen |
| Feedback | Stable ID to attach "helpful/not helpful" to |
| Deduplication | Know what we've already shown |

### Preventing "Guilt Inbox"

| Mechanism | How It Works |
|------------|--------------|
| Strict TTL | 24-48 hour expiry — miss it, it's gone |
| Auto-dismiss | Logging weave with Sarah removes "drifting from Sarah" |
| Cap at 3 | Maximum 3 active insights shown at once |
| No notifications | User discovers insights when they open Oracle Tab |

---

## Part 3: Data Model

### New Table: `proactive_insights`

```typescript
tableSchema({
  name: 'proactive_insights',
  columns: [
    // Identity
    { name: 'rule_id', type: 'string', isIndexed: true },
    { name: 'type', type: 'string' },  // 'friend' | 'pattern' | 'milestone'
    
    // Relations
    { name: 'friend_id', type: 'string', isOptional: true, isIndexed: true },
    
    // Content
    { name: 'headline', type: 'string' },
    { name: 'body', type: 'string' },
    { name: 'grounding_data_json', type: 'string' },
    
    // Action
    { name: 'action_type', type: 'string' },
    { name: 'action_params_json', type: 'string' },
    { name: 'action_label', type: 'string' },
    
    // Metadata
    { name: 'severity', type: 'number', isOptional: true },
    { name: 'generated_at', type: 'number', isIndexed: true },
    { name: 'expires_at', type: 'number', isIndexed: true },
    
    // Status
    { name: 'status', type: 'string', isIndexed: true },
    { name: 'feedback', type: 'string', isOptional: true },
    { name: 'status_changed_at', type: 'number', isOptional: true },
  ]
})
```

### Insight Status

```typescript
type InsightStatus = 
  | 'unseen'      // Generated, not yet viewed
  | 'seen'        // User saw the card
  | 'acted_on'    // User tapped the action button
  | 'dismissed'   // User tapped dismiss / "not now"
  | 'expired'     // TTL ran out
  | 'invalidated' // Reconciliation: situation changed
```

### New Table: `milestone_records`

Tracks which milestones have been achieved (for deduplication).

```typescript
tableSchema({
  name: 'milestone_records',
  columns: [
    { name: 'friend_id', type: 'string', isOptional: true, isIndexed: true },
    { name: 'milestone_type', type: 'string', isIndexed: true },
    { name: 'scope', type: 'string' },  // 'lifetime' | 'yearly' | 'streak'
    { name: 'threshold', type: 'number' },
    { name: 'achieved_at', type: 'number' },
    { name: 'year', type: 'number', isOptional: true },  // For yearly milestones
  ]
})
```

### User Preferences Addition

```typescript
interface OraclePreferences {
  // Master toggle
  proactiveInsightsEnabled: boolean
  
  // Per-rule suppressions (only stores disabled ones)
  suppressedInsightRules: Array<{
    ruleId: string
    suppressedAt: number
  }>
  
  // Milestones toggle
  milestonesEnabled: boolean
}
```

---

## Part 4: Insight Rules

### Friend Insights (5 rules)

| Rule ID | Name | Condition | Template |
|---------|------|-----------|----------|
| `friend_drift` | Drifting | Inner Circle: >21 days, Close Friend: >35 days | "Drifting from {{name}}. {{daysSince}} days since you connected — your rhythm is usually every {{expectedCadence}} days." |
| `friend_deepening` | Deepening | 50%+ more interactions than 3-month average | "Something's building with {{name}}. You've seen them {{recentCount}} times this month — more than usual." |
| `friend_one_sided` | One-sided | 85%+ initiation over 6+ interactions | "You've initiated the last {{count}} interactions with {{name}}. Are they reaching back?" |
| `friend_reconnection` | Reconnection | Community/dormant tier, 60+ days, was active | "{{name}} has been quiet for {{daysSince}} days. You used to see them regularly." |
| `friend_thread_pending` | Thread pending | Active thread >14 days without update | "You mentioned {{threadTopic}} with {{name}} {{daysSince}} days ago. Any update?" |

**Severity Levels (for `friend_drift`):**

| Level | Condition |
|-------|-----------|
| 1 | 1.5x expected cadence |
| 2 | 2x expected cadence |
| 3 | 3x expected cadence |
| 4 | 4x+ expected cadence |

### Pattern Insights (4 rules)

| Rule ID | Name | Condition | Min Data |
|---------|------|-----------|----------|
| `pattern_over_initiating` | Over-initiating | 75%+ initiation over 30 days | 8 interactions |
| `pattern_tier_neglect` | Tier neglect | 0 Inner Circle interactions, 14+ days | 3 other interactions |
| `pattern_group_heavy` | Group heavy | 70%+ group hangs over 3 weeks | 5 interactions |
| `pattern_low_energy_socializing` | Low energy | 60%+ interactions at battery 1-2 | 5 interactions |

### Milestone Insights (5 rules)

| Rule ID | Name | Scope | Thresholds |
|---------|------|-------|------------|
| `milestone_weave_count` | Weave count | Lifetime | 10, 25, 50, 100, 200 |
| `milestone_yearly_weave` | Yearly weave count | Yearly | 25, 50 |
| `milestone_streak` | Logging streak | Streak | 4, 8, 12, 26, 52 weeks |
| `milestone_anniversary` | Friendship anniversary | Yearly | 1, 2, 3, 5, 10 years |
| `milestone_first_journal` | First journal mention | Lifetime | First mention |

---

## Part 5: Action Mapping

### Action Types

```typescript
type InsightAction =
  | { type: 'open_contact'; friendId: string; preferredChannel?: string }
  | { type: 'guided_reflection'; friendId: string; threadId?: string }
  | { type: 'start_consultation'; prefill: string }
  | { type: 'view_friend_list'; filter?: string; sort?: string }
  | { type: 'view_friend_history'; friendId: string; year?: number }
  | { type: 'view_journal_entry'; entryId: string }
  | { type: 'plan_weave'; groupSize?: string }
  | { type: 'log_weave' }
```

### Friend Insight Actions

| Rule ID | Primary Action | Action Type | Label |
|---------|----------------|-------------|-------|
| `friend_drift` | Open messaging app | `open_contact` | "Reach out" |
| `friend_deepening` | Start guided reflection | `guided_reflection` | "Reflect on this" |
| `friend_one_sided` | Open messaging app | `open_contact` | "Reach out anyway" |
| `friend_reconnection` | Open messaging app | `open_contact` | "Reconnect" |
| `friend_thread_pending` | Start guided reflection with thread | `guided_reflection` | "Follow up" |

### Pattern Insight Actions

| Rule ID | Primary Action | Action Type | Label |
|---------|----------------|-------------|-------|
| `pattern_over_initiating` | Oracle consultation | `start_consultation` | "Explore this" |
| `pattern_tier_neglect` | View Inner Circle friends | `view_friend_list` | "See Inner Circle" |
| `pattern_group_heavy` | Plan 1-on-1 weave | `plan_weave` | "Plan a 1-on-1" |
| `pattern_low_energy_socializing` | Oracle consultation | `start_consultation` | "Explore this" |

### Milestone Insight Actions

| Rule ID | Primary Action | Action Type | Label |
|---------|----------------|-------------|-------|
| `milestone_weave_count` | View friend history | `view_friend_history` | "See your history" |
| `milestone_yearly_weave` | View friend history (filtered) | `view_friend_history` | "See this year" |
| `milestone_streak` | Log a weave | `log_weave` | "Keep it going" |
| `milestone_anniversary` | Start guided reflection | `guided_reflection` | "Reflect on this" |
| `milestone_first_journal` | View journal entry | `view_journal_entry` | "Read it" |

### `open_contact` Implementation

```typescript
async function openContact(friendId: string, preferredChannel?: string): Promise<void> {
  const friend = await getFriend(friendId)
  
  const channel = preferredChannel 
    || friend.preferredContactMethod 
    || detectMostUsedChannel(friend)
    || 'sms'
  
  const contactUri = buildContactUri(channel, friend)
  await Linking.openURL(contactUri)
}

function buildContactUri(channel: string, friend: Friend): string {
  switch (channel) {
    case 'whatsapp':
      return `whatsapp://send?phone=${friend.phone}`
    case 'telegram':
      return `tg://resolve?domain=${friend.telegramHandle}`
    case 'sms':
      return `sms:${friend.phone}`
    case 'email':
      return `mailto:${friend.email}`
    default:
      return `sms:${friend.phone}`
  }
}
```

---

## Part 6: Generation Triggers

### When Insights Generate

| Type | Trigger | Frequency |
|------|---------|-----------|
| Friend insights | First app open of day | Daily |
| Pattern insights | First app open of day | Daily |
| Milestones | After weave logged | Event-driven |
| Weekly | Part of Sunday reflection | Weekly (existing flow) |

### Implementation

```typescript
const GENERATION_COOLDOWN_MS = 24 * 60 * 60 * 1000  // 24 hours

async function maybeGenerateInsights(): Promise<void> {
  const lastGeneration = await getLastInsightGeneration()
  const elapsed = Date.now() - lastGeneration
  
  if (elapsed < GENERATION_COOLDOWN_MS) {
    return  // Already generated today
  }
  
  await generateFriendInsights()
  await generatePatternInsights()
  await setLastInsightGeneration(Date.now())
}

async function onWeaveLogged(weave: Weave): Promise<void> {
  // Check milestones for this friend
  await checkMilestones(weave.friendId)
  
  // Also reconcile existing insights
  await reconcileInsightsForFriend(weave.friendId)
}
```

---

## Part 7: Deduplication

### Deduplication Key

```typescript
interface InsightDedupeKey {
  type: 'friend' | 'pattern' | 'milestone'
  ruleId: string
  friendId?: string  // For friend-specific insights
}
```

### Cooldown Rules

| Previous Status | Feedback | Cooldown |
|-----------------|----------|----------|
| `dismissed` | null | 14 days |
| `dismissed` | `not_helpful` | 30 days |
| `acted_on` | — | 21 days |
| `expired` | — | 7 days |
| `invalidated` | — | 7 days |

### Severity Override

If user dismissed an insight but situation worsened significantly, regenerate anyway.

**Applies to:** `dismissed` with feedback = null (not "not helpful")

**Threshold:** Severity increased by 2+ levels or doubled

```typescript
async function shouldOverrideDismissal(
  key: InsightDedupeKey, 
  currentSeverity: number
): Promise<boolean> {
  const dismissed = await findDismissedInsight(key)
  if (!dismissed) return false
  if (dismissed.feedback === 'not_helpful') return false  // Respect explicit feedback
  
  const originalSeverity = dismissed.severity || 0
  const severityIncrease = currentSeverity - originalSeverity
  
  return severityIncrease >= 2 || currentSeverity >= originalSeverity * 2
}
```

### Milestone Deduplication

```typescript
type MilestoneScope = 'lifetime' | 'yearly' | 'streak'

async function shouldGenerateMilestone(
  friendId: string, 
  type: string, 
  threshold: number,
  scope: MilestoneScope
): Promise<boolean> {
  const existing = await findMilestoneRecord(friendId, type, threshold, scope)
  
  if (!existing) return true
  
  if (scope === 'lifetime') {
    return false  // Once ever
  }
  
  if (scope === 'yearly') {
    return existing.year !== currentYear()  // Once per year
  }
  
  if (scope === 'streak') {
    const streakBroken = await wasStreakBroken(existing.achievedAt)
    return streakBroken  // Can re-earn after breaking
  }
  
  return false
}
```

### Full Deduplication Logic

```typescript
async function shouldGenerateInsight(
  key: InsightDedupeKey, 
  severity?: number
): Promise<boolean> {
  // Check user preferences
  const prefs = await getOraclePreferences()
  if (!prefs.proactiveInsightsEnabled) return false
  if (key.type === 'milestone' && !prefs.milestonesEnabled) return false
  if (prefs.suppressedInsightRules.some(r => r.ruleId === key.ruleId)) return false
  
  // Milestones have their own logic
  if (key.type === 'milestone') {
    return shouldGenerateMilestone(...)
  }
  
  // Check for existing insight
  const existing = await findInsightByKey(key)
  if (!existing) return true
  
  // Active insight exists
  if (['unseen', 'seen'].includes(existing.status)) {
    return false
  }
  
  // Check severity override for dismissed (not "not helpful")
  if (existing.status === 'dismissed' && severity) {
    if (existing.feedback !== 'not_helpful') {
      const shouldOverride = await shouldOverrideDismissal(key, severity)
      if (shouldOverride) return true
    }
  }
  
  // Standard cooldowns
  const daysSince = daysBetween(existing.statusChangedAt, new Date())
  
  switch (existing.status) {
    case 'dismissed':
      const cooldown = existing.feedback === 'not_helpful' ? 30 : 14
      return daysSince > cooldown
    case 'acted_on':
      return daysSince > 21
    case 'expired':
    case 'invalidated':
      return daysSince > 7
    default:
      return true
  }
}
```

---

## Part 8: "Not Helpful" Feedback

### Standard Flow

```typescript
async function markNotHelpful(insightId: string): Promise<void> {
  const insight = await getInsight(insightId)
  
  // 1. Update insight
  await updateInsight(insightId, {
    status: 'dismissed',
    feedback: 'not_helpful',
    statusChangedAt: Date.now()
  })
  
  // 2. Log for analytics
  logger.info('InsightFeedback', {
    action: 'not_helpful',
    ruleId: insight.ruleId,
    type: insight.type,
    friendId: insight.friendId,
  })
  
  // 3. Check for rule suppression
  await checkAndPromptRuleSuppression(insight.ruleId)
}
```

### Three Strikes Prompt

```typescript
async function checkAndPromptRuleSuppression(ruleId: string): Promise<void> {
  const recentNotHelpful = await countRecentNotHelpful(ruleId, { days: 60 })
  
  if (recentNotHelpful >= 3) {
    const shouldSuppress = await showSuppressionPrompt(ruleId)
    
    if (shouldSuppress) {
      await suppressRule(ruleId)
    } else {
      // Reset strike count
      await resetNotHelpfulCount(ruleId)
    }
  }
}
```

### Suppression Prompt UI

```
┌─────────────────────────────────────────┐
│                                         │
│  You've dismissed "drifting" insights   │
│  a few times. Want me to stop showing   │
│  these?                                 │
│                                         │
│  You can always re-enable them in       │
│  Settings → Oracle.                     │
│                                         │
│  [Keep showing]          [Turn off]     │
│                                         │
└─────────────────────────────────────────┘
```

### Settings UI

Location: Settings → Oracle → Insight Preferences

```
┌─────────────────────────────────────────┐
│ Oracle Insights                         │
│─────────────────────────────────────────│
│                                         │
│ Proactive Insights           [Toggle ON]│
│ Oracle surfaces observations about      │
│ your friendships                        │
│                                         │
│─────────────────────────────────────────│
│                                         │
│ INSIGHT TYPES                           │
│                                         │
│ Drifting friends             [Toggle ON]│
│ When you haven't seen someone           │
│                                         │
│ Deepening friendships        [Toggle ON]│
│ When a friendship is growing            │
│                                         │
│ One-sided initiation         [Toggle ON]│
│ When you're always reaching out         │
│                                         │
│ Reconnection opportunities  [Toggle OFF]│
│ ⚠️ You turned this off                  │
│                                         │
│ ... (all 14 rules listed)               │
│                                         │
│─────────────────────────────────────────│
│                                         │
│ Milestones                   [Toggle ON]│
│ Celebrate friendship moments            │
│                                         │
└─────────────────────────────────────────┘
```

---

## Part 9: Reconciliation

### Purpose

Check if active insights are still valid. Auto-dismiss stale ones.

### Triggers

| Trigger | Scope | Frequency |
|---------|-------|-----------|
| App open | All active insights | Max once per hour |
| After weave logged | Insights for that friend | Immediate |
| After journal saved | Insights for mentioned friends | Immediate |

### Implementation

```typescript
const RECONCILE_COOLDOWN_MS = 60 * 60 * 1000  // 1 hour

async function maybeReconcile(): Promise<void> {
  const lastReconcile = await getLastReconcileTime()
  const elapsed = Date.now() - lastReconcile
  
  if (elapsed < RECONCILE_COOLDOWN_MS) {
    return
  }
  
  await reconcileAllInsights()
  await setLastReconcileTime(Date.now())
}

async function reconcileAllInsights(): Promise<void> {
  const activeInsights = await getActiveInsights()
  
  for (const insight of activeInsights) {
    const stillValid = await validateInsight(insight)
    
    if (!stillValid) {
      await updateInsight(insight.id, {
        status: 'invalidated',
        statusChangedAt: Date.now()
      })
    }
  }
}

async function reconcileInsightsForFriend(friendId: string): Promise<void> {
  const friendInsights = await getActiveInsightsForFriend(friendId)
  
  for (const insight of friendInsights) {
    const stillValid = await validateInsight(insight)
    
    if (!stillValid) {
      await updateInsight(insight.id, {
        status: 'invalidated',
        statusChangedAt: Date.now()
      })
    }
  }
}
```

### Validation Rules

#### Friend Insights

| Rule ID | Still Valid If... |
|---------|-------------------|
| `friend_drift` | `daysSince > (threshold * 0.7)` |
| `friend_deepening` | `recentWeaves > avgWeaves * 1.3` |
| `friend_one_sided` | `initiationRatio > 0.75` |
| `friend_reconnection` | `daysSince > 45` |
| `friend_thread_pending` | Thread still active, no new mention |

#### Pattern Insights

| Rule ID | Still Valid If... |
|---------|-------------------|
| `pattern_over_initiating` | `overallInitiationRatio > 0.65` |
| `pattern_tier_neglect` | `innerCircleDaysSince > 10` |
| `pattern_group_heavy` | `groupRatio > 0.6` |
| `pattern_low_energy_socializing` | `lowEnergyRatio > 0.5` |

#### Milestone Insights

| Rule ID | Still Valid If... |
|---------|-------------------|
| `milestone_weave_count` | Always (historical fact) |
| `milestone_yearly_weave` | Always (historical fact) |
| `milestone_streak` | `currentStreak >= achievedStreak` |
| `milestone_anniversary` | Within 7 days of date |
| `milestone_first_journal` | Always (historical fact) |

### Example Validator

```typescript
async function validateInsight(insight: ProactiveInsight): Promise<boolean> {
  switch (insight.ruleId) {
    case 'friend_drift':
      return validateDrift(insight)
    case 'milestone_streak':
      return validateStreak(insight)
    // ... etc
    default:
      return true
  }
}

async function validateDrift(insight: ProactiveInsight): Promise<boolean> {
  const friend = await getFriend(insight.friendId)
  const expectedCadence = getExpectedCadence(friend.tier)
  const threshold = expectedCadence * 1.5
  const stillDriftingThreshold = threshold * 0.7
  
  return friend.daysSince > stillDriftingThreshold
}

async function validateStreak(insight: ProactiveInsight): Promise<boolean> {
  const currentStreak = await calculateCurrentStreak()
  const achievedStreak = insight.groundingData.streakWeeks
  
  return currentStreak >= achievedStreak
}
```

---

## Part 10: UI Components

### OracleInsightCard

Location: Top of Oracle Tab, above chat interface

```
┌─────────────────────────────────────────┐
│ 🔮                                      │
│                                         │
│ Drifting from Sarah                     │
│                                         │
│ 24 days since you connected. She's in   │
│ your Inner Circle — your rhythm is      │
│ usually every 10 days.                  │
│                                         │
│ [Reach out]                  [Not now]  │
└─────────────────────────────────────────┘
```

**Aesthetic:**
- Deep purple/indigo gradients
- Gold accent borders
- Subtle shimmer animation
- Distinct from analytical Calendar Patterns

### InsightsCarousel

If multiple insights, horizontal scroll:

```
┌─────────────────────────────────────────┐
│ ← [Card 1] [Card 2] [Card 3] →          │
└─────────────────────────────────────────┘
```

Maximum 3 visible. Priority order:
1. Severity (higher first)
2. Type (friend > pattern > milestone)
3. Recency (newer first)

---

## Part 11: Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/db/models/ProactiveInsight.ts` | WatermelonDB model |
| `src/db/models/MilestoneRecord.ts` | WatermelonDB model |
| `src/modules/journal/services/oracle/insight-generator.ts` | Generation logic |
| `src/modules/journal/services/oracle/insight-rules.ts` | Rule definitions |
| `src/modules/journal/services/oracle/insight-reconciler.ts` | Reconciliation logic |
| `src/modules/journal/components/Oracle/OracleInsightCard.tsx` | Card component |
| `src/modules/journal/components/Oracle/InsightsCarousel.tsx` | Carousel component |
| `src/modules/settings/components/OracleInsightSettings.tsx` | Settings UI |

### Modified Files

| File | Changes |
|------|---------|
| `src/db/schema.ts` | Add `proactive_insights`, `milestone_records` tables |
| `src/modules/journal/services/oracle/oracle-service.ts` | Add `getProactiveInsights()`, `dismissInsight()`, `actOnInsight()` |
| `src/modules/journal/components/Oracle/OracleTab.tsx` | Add InsightsCarousel at top |
| `src/modules/settings/screens/SettingsScreen.tsx` | Add Oracle Insights link |

---

## Part 12: Implementation Order

| Step | Work | Effort |
|------|------|--------|
| 1 | Add DB tables (`proactive_insights`, `milestone_records`) | Small |
| 2 | Create `insight-rules.ts` — declarative rule definitions | Small |
| 3 | Create `insight-generator.ts` — generation logic | Medium |
| 4 | Add deduplication logic | Medium |
| 5 | Create `insight-reconciler.ts` — validation logic | Medium |
| 6 | Add `OracleInsightCard.tsx` component | Medium |
| 7 | Add `InsightsCarousel.tsx` component | Small |
| 8 | Integrate into `OracleTab.tsx` | Small |
| 9 | Add action handlers (`open_contact`, etc.) | Medium |
| 10 | Add "not helpful" flow with 3-strike prompt | Small |
| 11 | Add Settings UI for rule toggles | Medium |
| 12 | Wire up triggers (app open, weave logged) | Small |

**Total: ~2 weeks focused work**

---

## Part 13: Acceptance Criteria

### Core Functionality
- [ ] Insights generate daily on first app open
- [ ] Milestones generate after weave logged
- [ ] Maximum 3 active insights shown
- [ ] Insights expire after 24-48 hours
- [ ] Insights auto-dismiss when situation changes

### Deduplication
- [ ] Same insight doesn't regenerate while active
- [ ] Dismissed insights respect cooldown periods
- [ ] "Not helpful" gets longer cooldown than regular dismiss
- [ ] Severity override works for worsening situations
- [ ] Milestones respect scope (lifetime/yearly/streak)

### User Controls
- [ ] "Not helpful" dismisses with extended cooldown
- [ ] 3 strikes prompts rule suppression
- [ ] Settings allows toggling each rule
- [ ] Suppressed rules can be re-enabled

### Actions
- [ ] Each insight has contextual primary action
- [ ] `open_contact` opens correct messaging app
- [ ] `guided_reflection` opens with friend context
- [ ] `start_consultation` prefills Oracle question

### Reconciliation
- [ ] Full reconciliation runs max once per hour
- [ ] Friend-specific reconciliation runs after weave/journal
- [ ] Invalidated insights tracked separately from user dismissals

---

## Part 14: Analytics to Track

| Metric | What It Tells Us |
|--------|------------------|
| Insights generated per day | Volume |
| Insights seen vs unseen | Visibility |
| `acted_on` rate | Engagement |
| `dismissed` rate | Relevance |
| `not_helpful` rate | Quality |
| `invalidated` rate | Timeliness (are we too slow?) |
| Rule-specific rates | Which rules resonate |
| Time to action | Urgency |

---

## Part 15: Future Enhancements (Not MVP)

- **Push notifications** — Opt-in daily insight notification
- **Insight sharing** — Export milestone cards as images
- **Oracle commentary in weekly reflection** — "Oracle's Take" section
- **Cross-reference with Calendar Patterns** — "You're high-energy on Tuesdays — that's when you see your Inner Circle"
- **Collaborative insights** — "You and Marcus both have anniversaries this week"
