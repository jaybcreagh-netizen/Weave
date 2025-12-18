# Goals System Design Proposal

> Replacing the trophy/badge system with a goal-oriented gamification approach that helps users build consistent social habits.

---

## Executive Summary

The current gamification system (badges, achievements, trophy cabinet) feels disconnected from Weave's mindful positioning. Users collect trophies but don't get clear guidance on *what to do next*.

This proposal introduces a **Goals System** with three tiers:
- **Daily Goals** - Quick wins, immediate dopamine
- **Weekly Goals** - The core engagement loop
- **Monthly Challenges** - Dedication goals for committed users

Combined with contextual **Nudges** and a **new user ramp**, this system helps users build habits while feeling achievable rather than insurmountable.

---

## Design Principles

1. **Completable, not endless** - Users should be able to "finish" and feel accomplished
2. **Guided, not prescriptive** - System suggests, user chooses
3. **Progressive difficulty** - Start easy, unlock harder goals over time
4. **Mixed specificity** - Both abstract ("weave with 2 friends") and specific ("reach out to Sam")
5. **Integrated, not bolted on** - Lives in existing flows (reflection, journal widget)

---

## System Architecture

### Three Goal Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   MONTHLY CHALLENGES (opt-in, dedication goals)                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  "The Inner Circle Month"                               │   │
│   │   Weave with all 5 Inner Circle friends                 │   │
│   │   Progress: 3/5 · 2 weeks remaining                     │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   WEEKLY GOALS (core loop, 1-3 per week)                        │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  ✓ Weave with 2 different friends                       │   │
│   │  ✓ Reach out to Sam                                     │   │
│   │  ○ Add a reflection to a weave                          │   │
│   │                                                2/3      │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   DAILY GOALS (quick wins, 0-2 per day)                         │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  ○ Log yesterday's hangout with Alex                    │   │
│   │  ○ Send a quick message to someone                      │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tier 1: Daily Goals

**Purpose:** Quick wins that give immediate satisfaction and guide users who don't know what to do.

**Characteristics:**
- 0-2 active at a time
- Auto-generated based on context
- Expire at end of day (no guilt)
- Cannot be user-created (system only)

**Example Daily Goals:**

| Trigger | Goal |
|---------|------|
| Unlogged calendar event | "Log your coffee with Alex from yesterday" |
| 7+ days since any weave | "Reach out to one friend today" |
| Friend's birthday today | "Wish Sam a happy birthday" |
| Pending intention exists | "You wanted to call Mom - did it happen?" |
| Morning prompt (randomized) | "Send a quick 'thinking of you' message" |

**Tracking:** Binary completion. System detects when action is taken (weave logged, etc.)

**Display:** Appear as contextual cards on dashboard, dismissable.

```
┌─────────────────────────────────────────┐
│  Today                                  │
│                                         │
│  ○ Log your dinner with the team        │
│    from last night                      │
│                                    [→]  │
└─────────────────────────────────────────┘
```

---

## Tier 2: Weekly Goals

**Purpose:** The core engagement loop. Builds weekly habit of intentional connection.

**Characteristics:**
- User chooses 1-3 goals per week
- Set during weekly reflection flow
- System suggests based on patterns
- User can swap suggestions or add custom
- Progress tracked throughout week
- Completion celebrated

### Goal Selection Flow

During weekly reflection (new step after Week Snapshot):

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Set Your Goals for This Week                                   │
│                                                                 │
│  How many goals do you want?                                    │
│                                                                 │
│      [ 1 ]    [ 2 ]    [ 3 ]                                    │
│               ─────                                             │
│              selected                                           │
│                                                                 │
│  ───────────────────────────────────────────────────────────    │
│                                                                 │
│  Suggested for you:                                             │
│                                                                 │
│  [✓] Weave with 2 different friends                             │
│      Based on: You averaged 3 last month                        │
│                                                     [swap ↻]    │
│                                                                 │
│  [✓] Check in with Sam                                          │
│      It's been 18 days                                          │
│                                                     [swap ↻]    │
│                                                                 │
│  ───────────────────────────────────────────────────────────    │
│                                                                 │
│  [ + Add your own goal ]                                        │
│                                                                 │
│                                          [Set Goals →]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Swap Flow

When user taps "swap", show alternative suggestions:

```
┌─────────────────────────────────────────┐
│  Swap Goal                              │
│                                         │
│  Instead of "Weave with 2 friends":     │
│                                         │
│  ○ Have a 1+ hour conversation          │
│  ○ Reach out to a dormant friend        │
│  ○ Log a group hangout                  │
│  ○ Weave with an Inner Circle friend    │
│                                         │
│              [Cancel]  [Select]         │
└─────────────────────────────────────────┘
```

### Custom Goals

Users can add their own goals. Two types:

**A. Trackable Custom Goals** (template-based)
User picks from a simplified template:

```
┌─────────────────────────────────────────────────────────────────┐
│  Create Custom Goal                                             │
│                                                                 │
│  I want to...                                                   │
│                                                                 │
│  [ Weave with ▼ ]  [ 2 ▼ ]  [ friends ▼ ]                       │
│                                                                 │
│  Options:                                                       │
│  - Weave with [N] friends                                       │
│  - Reach out to [specific friend]                               │
│  - Log [N] weaves                                               │
│  - Add reflections to [N] weaves                                │
│  - Have a [category] type weave                                 │
│                                                                 │
│                                    [Add Goal]                   │
└─────────────────────────────────────────────────────────────────┘
```

**B. Freeform Custom Goals** (honor system)
For goals the app can't track:

```
┌─────────────────────────────────────────────────────────────────┐
│  Create Custom Goal                                             │
│                                                                 │
│  [ Write anything...                                       ]    │
│    e.g., "Plan a surprise for Alex's birthday"                  │
│                                                                 │
│  ⚠️ You'll mark this complete yourself                          │
│                                                                 │
│                                    [Add Goal]                   │
└─────────────────────────────────────────────────────────────────┘
```

Freeform goals show a manual checkbox:

```
│  ○ Plan surprise for Alex's birthday        [Mark Done]  │
```

### Weekly Goal Templates Library

**Diversity Goals:**
| Template | Tracking |
|----------|----------|
| Weave with {N} different friends | Count unique friend IDs in completed weaves |
| Contact someone outside family | Check if weave friend has tag ≠ "family" |
| Reach out to someone you haven't seen in {N}+ days | Check last_interaction_date on friend |

**Tier Health Goals:**
| Template | Tracking |
|----------|----------|
| Weave with an Inner Circle friend | Check friend.tier = 'inner_circle' on weave |
| Nurture a Close Friend | Check friend.tier = 'close_friends' on weave |
| Check in with someone in Community tier | Check friend.tier = 'community' on weave |

**Depth Goals:**
| Template | Tracking |
|----------|----------|
| Have a conversation over {N} minutes | Check interaction.duration >= N |
| Add reflections to {N} weaves | Count weaves with notes or vibe set |
| Log a "deep talk" weave | Check interaction.category = 'deep-talk' |

**Archetype Goals:**
| Template | Tracking |
|----------|----------|
| Connect with a {archetype} friend | Check friend.archetype on weave |
| Do a {archetype}-appropriate activity | Check category matches archetype affinity |

**Specific Friend Goals:**
| Template | Tracking |
|----------|----------|
| Reach out to {friend_name} | Any weave with friend_id |
| Follow up with {friend_name} | Any weave with friend_id |

### Progress Display

On Journal Widget:

```
┌─────────────────────────────────────────┐
│  📓 Journal                             │
│                                         │
│  Goals: 2/3  ·  🔥 4 week streak        │
│  ━━━━━━━━━━━━━━━━━○                     │
│                                         │
└─────────────────────────────────────────┘
```

Tapping expands or navigates to goal detail.

### Weekly Completion

When all goals completed mid-week:

```
┌─────────────────────────────────────────┐
│                                         │
│            ✨                           │
│                                         │
│     Weekly Goals Complete!              │
│                                         │
│     You finished all 3 goals            │
│     with 4 days to spare                │
│                                         │
│     🔥 5 week streak                    │
│                                         │
│     [Nice!]                             │
│                                         │
└─────────────────────────────────────────┘
```

### Week Review

At next weekly reflection, first show review:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Last Week's Goals                                              │
│                                                                 │
│  ✓ Weave with 2 different friends                               │
│  ✓ Check in with Sam                                            │
│  ✗ Add a reflection to a weave                                  │
│                                                                 │
│  2/3 complete                                                   │
│                                                                 │
│  ───────────────────────────────────────────────────────────    │
│                                                                 │
│  You connected with 4 friends including Sam.                    │
│  Next time, try adding a quick note after logging!              │
│                                                                 │
│                                          [Continue →]           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tier 3: Monthly Challenges

**Purpose:** Longer-term dedication goals for engaged users. Opt-in commitment.

**Characteristics:**
- User explicitly opts in
- 4-week duration
- 1 active challenge at a time
- Harder/more meaningful than weekly goals
- Visible progress throughout month
- Significant celebration on completion

### Challenge Examples

| Challenge | Description | Tracking |
|-----------|-------------|----------|
| The Inner Circle Month | Weave with all 5 Inner Circle friends | Unique IC friend IDs |
| Rekindling Season | Reach out to 3 dormant friendships | Weaves with friends where status was 'dormant' |
| Depth Dive | Add reflections to 15 weaves | Count weaves with notes |
| Archetype Explorer | Connect with 5 different archetypes | Unique archetypes in weaves |
| Consistency Champion | Complete all weekly goals for 4 weeks | Weekly goal completion |
| Group Connector | Log 4 group hangouts | Weaves with 2+ friends |
| The Supporter | Log 3 "support" type weaves | Category = 'support' |

### Challenge Flow

**Discovery:** Challenges shown in a dedicated section (could be in Journal or Settings):

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Monthly Challenges                                             │
│                                                                 │
│  Take on a bigger goal this month                               │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🌟 The Inner Circle Month                                │  │
│  │                                                           │  │
│  │  Weave with all 5 of your Inner Circle friends            │  │
│  │  this month. Prioritize your closest bonds.               │  │
│  │                                                           │  │
│  │  Duration: 4 weeks                                        │  │
│  │                                           [Start →]       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  🔥 Rekindling Season                                     │  │
│  │  Reach out to 3 friends you haven't seen in 30+ days      │  │
│  │                                           [Start →]       │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Active Challenge Display:**

On Journal Widget (when challenge active):

```
┌─────────────────────────────────────────┐
│  📓 Journal                             │
│                                         │
│  Goals: 2/3  ·  🔥 4 week streak        │
│                                         │
│  Challenge: Inner Circle Month          │
│  ████████░░░░░░░░  3/5 · 12 days left   │
│                                         │
└─────────────────────────────────────────┘
```

**Challenge Completion:**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                          🏆                                     │
│                                                                 │
│              Challenge Complete!                                │
│                                                                 │
│              The Inner Circle Month                             │
│                                                                 │
│     You connected with all 5 Inner Circle friends               │
│     Sarah · Alex · Mom · Jake · Lin                             │
│                                                                 │
│     Completed in 3 weeks                                        │
│                                                                 │
│                        [Celebrate!]                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Nudges (Contextual Prompts)

**Purpose:** Ambient suggestions that help users take action without being "goals."

**Characteristics:**
- Not tracked toward any goal
- Dismissable without guilt
- Context-aware
- Guide users who are unsure what to do

**Nudge Types:**

| Context | Nudge |
|---------|-------|
| App open, no recent weaves | "Who did you connect with recently? Log it →" |
| Friend birthday in 3 days | "Sam's birthday is Friday - want to set a reminder?" |
| Unlogged calendar event | "Looks like you had dinner with Alex - add it?" |
| Pending intention, 3+ days old | "You wanted to call Mom - did it happen?" |
| Dormant friend anniversary | "1 year ago you were hanging out with Jake regularly" |
| After logging weave | "Want to add a quick reflection?" |

**Display:** Cards on dashboard, easily dismissable:

```
┌─────────────────────────────────────────┐
│  💭 Sam's birthday is in 3 days         │
│                                         │
│  [Set reminder]           [Dismiss ✕]   │
└─────────────────────────────────────────┘
```

---

## New User Ramp

**Problem:** New users don't have enough data for meaningful goal suggestions. They need easy wins to build the habit.

### Week 1: Onboarding Goals

Simplified goal set, only 1 goal:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Your First Week                                                │
│                                                                 │
│  Let's start simple. One goal:                                  │
│                                                                 │
│  [✓] Log your first weave                                       │
│                                                                 │
│  Think about a recent hangout, call, or message                 │
│  with a friend. We'll help you track it.                        │
│                                                                 │
│                                      [Got it →]                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Week 2: Building Habit

After first weave logged, introduce second goal:

```
│  This week's goals:                                             │
│                                                                 │
│  [✓] Log 2 weaves                                               │
│  [✓] Add at least one friend to your Inner Circle               │
```

### Week 3-4: Expanding

Introduce friend-specific goals:

```
│  This week's goals:                                             │
│                                                                 │
│  [✓] Weave with 2 different friends                             │
│  [✓] Reach out to someone in your Close Friends tier            │
```

### Week 5+: Full System

Unlock full goal selection (1-3 user choice), challenges become available.

### Progression Unlock Table

| Week | Goals Available | Features Unlocked |
|------|-----------------|-------------------|
| 1 | 1 (assigned) | Basic logging goals only |
| 2 | 1-2 (assigned) | Friend-tier goals |
| 3 | 1-2 (can swap) | Depth goals, archetype goals |
| 4 | 1-3 (can swap) | Custom goals |
| 5+ | 1-3 (full selection) | Monthly challenges |

---

## Streaks & Progress

### Goal Streak

Tracks consecutive weeks of completing ALL weekly goals:

- Complete 3/3 goals = streak continues
- Complete 2/3 goals = streak breaks
- Displayed on journal widget: "🔥 5 week streak"

### Streak Recovery (Optional, TBD)

If streak breaks, user could have option to "recover" by completing extra goal next week. Prevents discouragement from single bad week.

### Milestone Integration

Keep lightweight milestones that surface contextually:

- "You've had 50 weaves with Sarah" (shown on 50th weave)
- "Your longest streak: 8 weeks" (shown when beaten)
- "You've completed 10 challenges" (shown on 10th)

These appear as celebratory moments, not collected trophies.

---

## Data Model

### New Database Tables

**Goal**
```typescript
interface Goal {
  id: string;

  // Type & tier
  tier: 'daily' | 'weekly' | 'monthly';
  templateId?: string;        // Reference to goal template
  isCustom: boolean;

  // Content
  title: string;              // "Weave with 2 friends"
  description?: string;       // Longer explanation

  // Tracking
  targetType: 'count' | 'boolean' | 'manual';
  targetCount?: number;       // For count-based goals
  currentProgress: number;

  // Filters (for auto-tracking)
  friendId?: string;          // Specific friend goal
  tierId?: string;            // Tier filter
  archetypeId?: string;       // Archetype filter
  categoryId?: string;        // Interaction category filter
  minDuration?: number;       // Duration filter

  // Lifecycle
  status: 'active' | 'completed' | 'expired' | 'abandoned';
  periodStart: Date;          // Week/month start
  periodEnd: Date;
  completedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

**Challenge**
```typescript
interface Challenge {
  id: string;

  // Definition
  templateId: string;
  title: string;
  description: string;

  // Tracking
  targetCount: number;
  currentProgress: number;

  // Lifecycle
  status: 'active' | 'completed' | 'abandoned';
  startedAt: Date;
  endsAt: Date;
  completedAt?: Date;

  createdAt: Date;
}
```

**GoalStreak**
```typescript
interface GoalStreak {
  id: string;

  currentStreak: number;      // Consecutive weeks
  longestStreak: number;
  lastCompletedWeek: Date;    // Week start date

  // Monthly challenge stats
  challengesCompleted: number;

  updatedAt: Date;
}
```

**GoalTemplate** (seed data)
```typescript
interface GoalTemplate {
  id: string;

  tier: 'daily' | 'weekly' | 'monthly';
  category: 'diversity' | 'depth' | 'tier_health' | 'archetype' | 'specific' | 'consistency';

  title: string;              // With placeholders: "Weave with {count} friends"
  description: string;

  // Tracking config
  targetType: 'count' | 'boolean';
  defaultTarget?: number;

  // Filters
  requiresFriend: boolean;    // Needs friend selection
  tierFilter?: string[];
  archetypeFilter?: string[];
  categoryFilter?: string[];

  // Availability
  minUserWeek: number;        // Week 1, 2, 3, etc. (for new user ramp)
  isChallenge: boolean;

  // Suggestion logic
  triggerConditions?: object; // When to suggest this goal
}
```

---

## Service Architecture

### GoalService

```typescript
class GoalService {
  // Goal generation
  generateDailyGoals(userId: string): Goal[];
  generateWeeklySuggestions(userId: string): Goal[];
  getAvailableChallenges(userId: string): ChallengeTemplate[];

  // Goal management
  setWeeklyGoals(userId: string, goals: Goal[]): void;
  startChallenge(userId: string, challengeId: string): void;
  abandonChallenge(userId: string, challengeId: string): void;

  // Progress tracking
  checkGoalProgress(interaction: Interaction): void;  // Called on weave log
  markGoalComplete(goalId: string): void;             // For manual goals
  dismissDailyGoal(goalId: string): void;

  // Week lifecycle
  completeWeek(userId: string): WeekSummary;
  calculateStreak(userId: string): number;

  // Queries
  getActiveGoals(userId: string): Goal[];
  getActiveChallenge(userId: string): Challenge | null;
  getGoalHistory(userId: string, weeks: number): Goal[];
}
```

### Integration Points

**On interaction created:**
```typescript
eventBus.on('interaction:created', async (interaction) => {
  await goalService.checkGoalProgress(interaction);
});
```

**During weekly reflection:**
```typescript
// After Week Snapshot step
const lastWeekGoals = await goalService.getGoalsForWeek(lastWeek);
const suggestions = await goalService.generateWeeklySuggestions(userId);
// Show review + selection UI
```

**On app open:**
```typescript
const dailyGoals = await goalService.generateDailyGoals(userId);
// Display on dashboard
```

---

## Migration Path

### What We Remove

1. **Badge system** (`src/modules/gamification/services/badge.service.ts`)
2. **Achievement system** (`src/modules/gamification/services/achievement.service.ts`)
3. **Trophy cabinet UI** (`TrophyCabinetModal.tsx`, `AchievementsModal.tsx`)
4. **Badge unlock notifications** (`BadgeUnlockModal.tsx`)
5. **FriendBadge model**
6. **Achievement-related fields in UserProgress**

### What We Keep

1. **Streak tracking** (repurpose for goal streaks)
2. **Milestone tracker** (simplified, contextual celebrations)
3. **Celebration animations** (reuse for goal completion)
4. **Event bus pattern** (for goal progress checking)

### What We Add

1. **Goal, Challenge, GoalStreak models**
2. **GoalService**
3. **Goal templates (seed data)**
4. **Weekly reflection goal steps**
5. **Journal widget goal display**
6. **Daily goal cards on dashboard**
7. **Challenge discovery UI**

---

## Open Questions

1. **Notifications:** Should we send push notifications for goal progress? ("You're 1 away from completing your weekly goals!")

2. **Social/sharing:** Any desire to share goal completion? Or keep it private?

3. **Difficulty scaling:** Should goal difficulty increase over time based on user's history?

4. **Streak forgiveness:** Should there be a way to recover a broken streak?

5. **Challenge rotation:** Should challenges rotate monthly, or always be available?

6. **Empty states:** What happens if user has no friends in a tier/archetype a goal requires?

---

## Success Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| Weekly goal completion rate | >60% | Users are engaged and goals are achievable |
| Week 2 retention | +15% vs current | Goals give reason to return |
| Weekly reflection completion | +20% vs current | Goal setting adds value to reflection |
| Challenge opt-in rate | >30% of Week 5+ users | Challenges feel appealing |
| Goal streak median | 3+ weeks | Users building habits |

---

## Next Steps

1. **Team review** of this proposal
2. **Prioritize MVP scope** (likely: weekly goals + journal widget + reflection integration)
3. **Design mockups** for key flows
4. **Technical spike** on goal progress tracking
5. **Define goal template library** (full list of templates)
6. **Plan migration** from badge system

---

*Last updated: December 2024*
