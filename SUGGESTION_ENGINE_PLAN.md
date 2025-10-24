# Suggestion Engine: Design & Implementation Plan

## Vision

Transform Weave from a **passive tracker** into an **intelligent companion** that proactively guides users toward meaningful connection. The suggestion engine serves as the "brain" that analyzes relationship health and surfaces the right action at the right time.

---

## Core Principles

1. **Proactive, Not Reactive**: Don't wait for friendships to die - prevent drift before it happens
2. **Archetype-Aware**: Suggestions respect HOW each friend prefers to connect
3. **Context-Sensitive**: Different suggestions for different relationship states
4. **Gentle Nudging**: Encouraging tone, never guilt or shame
5. **Actionable**: Every suggestion leads to a clear, one-tap action

---

## System Architecture

### Two Integration Points

#### 1. **Dashboard Suggestion Feed** (Main Entry Point)
- Shows 1-3 top-priority suggestions when user opens the app
- Surfaces friends who need attention across ALL tiers
- Swipeable cards with dismiss/act actions
- Refreshes based on real-time relationship states

#### 2. **Friend Profile Action Header** (Contextual Guidance)
- Single dynamic header that replaces static "Connect By" button
- Shows THE most relevant action for THIS specific friend
- State-driven UI that adapts to relationship health
- Pre-fills interaction forms with smart defaults

---

## Suggestion Engine Core

### Input Data
```typescript
interface SuggestionInput {
  friend: Friend;
  currentScore: number;        // Calculated from weave-engine
  lastInteractionDate: Date;   // When did we last connect?
  interactionCount: number;    // Total weaves logged
  momentumScore: number;       // Current momentum
  dunbarTier: Tier;           // Inner/Close/Community
  archetype: Archetype;       // Their connection style
  activeLifeEvents?: LifeEvent[]; // Future: Life circumstances
}
```

### Output
```typescript
interface Suggestion {
  id: string;
  friend: Friend;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  category: 'drift' | 'maintain' | 'deepen' | 'celebrate' | 'reflect';

  // Display content
  title: string;              // "Sarah is drifting"
  subtitle: string;           // Archetype-aware explanation
  actionLabel: string;        // Button text
  icon: string;               // Emoji indicator

  // Behavior
  action: {
    type: 'log' | 'plan' | 'reflect';
    prefilledCategory?: InteractionCategory;
    prefilledMode?: 'quick-touch' | 'detailed';
  };

  // Meta
  dismissible: boolean;       // Can user hide this?
  expiresAt?: Date;          // Some suggestions time out
}
```

---

## Rule-Based Suggestion Logic

### Priority Hierarchy
1. **Reflect** - Recent interaction needs meaning capture (last 24 hours)
2. **Critical Drift** - Inner Circle friend below 30 (relationship at risk)
3. **High Drift** - Inner Circle friend below 50 OR Close Friend below 35
4. **First Weave** - New friend with zero interactions
5. **Momentum Opportunity** - High score + high momentum (riding the wave)
6. **Maintenance** - Stable score but time to check in
7. **Deepen** - Thriving relationship (score > 85)

### Rule Definitions

#### Rule 1: Reflect (Highest Priority)
```typescript
Trigger:
  - Last interaction within 24 hours
  - Interaction has no reflection OR no vibe rating

Output:
  title: "Recent Weave"
  subtitle: "How was your time with {name}? Add your reflection."
  actionLabel: "Reflect on Weave"
  urgency: 'high'
  category: 'reflect'
  action: { type: 'reflect', interactionId: mostRecentInteraction.id }
  icon: '✨'
  dismissible: true
  expiresAt: 48 hours after interaction
```

#### Rule 2: Critical Drift (Inner Circle Emergency)
```typescript
Trigger:
  - dunbarTier === 'InnerCircle'
  - currentScore < 30

Output:
  title: "{name} is drifting away"
  subtitle: "{archetype-specific suggestion}"
    // e.g., "The High Priestess values deep, meaningful conversations.
    //       Invite her for a one-on-one coffee to reconnect."
  actionLabel: "Reach Out Now"
  urgency: 'critical'
  category: 'drift'
  action: {
    type: 'log',
    prefilledCategory: archetypePreferredCategory(friend.archetype),
    prefilledMode: 'detailed'
  }
  icon: '🚨'
  dismissible: false // Too important to dismiss
```

#### Rule 3: High Drift (Attention Needed)
```typescript
Trigger:
  - (dunbarTier === 'InnerCircle' && currentScore < 50) OR
  - (dunbarTier === 'CloseFriends' && currentScore < 35)

Output:
  title: "Time to reconnect with {name}"
  subtitle: "Your connection is cooling. {archetype-action}"
    // e.g., "The Adventurer would love to try something new together."
  actionLabel: "Plan a Weave"
  urgency: 'high'
  category: 'drift'
  action: { type: 'plan', prefilledCategory: archetypePreferredCategory }
  icon: '⚠️'
  dismissible: true
```

#### Rule 4: First Weave (New Friend)
```typescript
Trigger:
  - interactionCount === 0
  - Friend created more than 24 hours ago

Output:
  title: "A new thread with {name}"
  subtitle: "Log your first weave to begin strengthening this connection."
  actionLabel: "Log First Weave"
  urgency: 'medium'
  category: 'maintain'
  action: { type: 'log' }
  icon: '🧵'
  dismissible: true
```

#### Rule 5: Momentum Opportunity
```typescript
Trigger:
  - currentScore > 60
  - momentumScore > 10
  - Last interaction within 7 days

Output:
  title: "You're connecting well with {name}"
  subtitle: "Ride this momentum! {archetype-suggestion}"
    // e.g., "The Collaborator would enjoy working on a project together."
  actionLabel: "Deepen the Bond"
  urgency: 'medium'
  category: 'deepen'
  action: {
    type: 'plan',
    prefilledCategory: archetypeDeepCategory(friend.archetype)
  }
  icon: '🌟'
  dismissible: true
```

#### Rule 6: Maintenance (Keep It Warm)
```typescript
Trigger:
  - currentScore between 40-70
  - Days since last interaction > (tier-appropriate threshold)
    // InnerCircle: 7 days, CloseFriends: 14 days, Community: 21 days

Output:
  title: "Keep the thread warm with {name}"
  subtitle: "A simple text or voice note can maintain your connection."
  actionLabel: "Log Quick Weave"
  urgency: 'low'
  category: 'maintain'
  action: {
    type: 'log',
    prefilledCategory: 'text-call',
    prefilledMode: 'quick-touch'
  }
  icon: '💛'
  dismissible: true
```

#### Rule 7: Deepen (Celebrate Thriving)
```typescript
Trigger:
  - currentScore > 85
  - dunbarTier in ['InnerCircle', 'CloseFriends']

Output:
  title: "Your bond with {name} is thriving"
  subtitle: "Plan something special to celebrate this connection."
  actionLabel: "Plan Something Meaningful"
  urgency: 'low'
  category: 'celebrate'
  action: { type: 'plan' }
  icon: '✨'
  dismissible: true
```

---

## Archetype-Aware Content

### Archetype → Preferred Categories
```typescript
const ARCHETYPE_PREFERRED_CATEGORIES: Record<Archetype, InteractionCategory> = {
  'The High Priestess': 'deep-talk',      // Values depth and insight
  'The Adventurer': 'activity-hobby',     // Loves shared experiences
  'The Sun': 'event-party',               // Thrives in joyful gatherings
  'The Hermit': 'deep-talk',              // Prefers intimate conversations
  'The Magician': 'activity-hobby',       // Enjoys creative collaboration
  'The Empress': 'meal-drink',            // Nurturing through sharing meals
  'The Emperor': 'hangout',               // Values quality time together
};

const ARCHETYPE_DEEP_CATEGORIES: Record<Archetype, InteractionCategory> = {
  'The High Priestess': 'deep-talk',
  'The Adventurer': 'activity-hobby',
  'The Sun': 'event-party',
  'The Hermit': 'deep-talk',
  'The Magician': 'activity-hobby',
  'The Empress': 'meal-drink',
  'The Emperor': 'hangout',
};
```

### Archetype → Suggestion Language
```typescript
const ARCHETYPE_DRIFT_SUGGESTIONS: Record<Archetype, string> = {
  'The High Priestess': 'She values deep, meaningful conversations. Invite her for a one-on-one coffee to reconnect.',
  'The Adventurer': 'He loves shared experiences. Suggest a hike or trying something new together.',
  'The Sun': 'She thrives in joyful moments. Plan a fun hangout or celebrate something together.',
  'The Hermit': 'He appreciates quiet, intimate time. Reach out for a thoughtful conversation.',
  'The Magician': 'She values creativity and collaboration. Suggest working on a project or exploring ideas together.',
  'The Empress': 'She nurtures through presence. Share a meal or spend quality time together.',
  'The Emperor': 'He values loyalty and consistency. Show up and spend solid time together.',
};

const ARCHETYPE_MOMENTUM_SUGGESTIONS: Record<Archetype, string> = {
  'The High Priestess': 'Deepen your conversations - she values insight and truth.',
  'The Adventurer': 'Plan an adventure - he\'d love to explore something new with you.',
  'The Sun': 'Celebrate this connection - create a joyful moment together.',
  'The Hermit': 'Create space for depth - he appreciates meaningful solitude with you.',
  'The Magician': 'Collaborate on something creative - she loves co-creating magic.',
  'The Empress': 'Nurture each other - share warmth and care.',
  'The Emperor': 'Build something together - he values purposeful connection.',
};
```

---

## Dashboard Integration

### Philosophy: Helpful Companion, Not Gatekeeper

**Core Principle**: Suggestions should be **present and helpful** without **blocking or interrupting** the user's intent. Think of it like a helpful assistant in the background, not a pop-up demanding attention.

### Design Strategy: Persistent Access Point

Create a **dedicated thread button** in the header that:
- Is **always accessible** - Never blocks, never intrudes
- Shows **badge count** when there are insights
- Opens **full suggestions sheet** on tap
- Lives **opposite the add friend button** for symmetry
- Uses the **thread icon** (🧵) to represent woven connections

---

### UI Design: Thread Button + Insights Sheet

**Dashboard Header Layout**:
```
┌─────────────────────────────────────────┐
│  [🧵 3]  Weave                [+]  [⚙️] │
├─────────────────────────────────────────┤
│  [Inner Circle 4] [Close 12] [Comm. 8] │
└─────────────────────────────────────────┘
```

**Key Elements**:
- **Left**: Thread button with badge count (🧵 3)
- **Center**: "Weave" title
- **Right**: Add friend (+) and Settings (⚙️)

**Tapping the thread button opens the Insights Sheet**:
```
╔═════════════════════════════════════════╗
║  [×]                                    ║
║                                         ║
║  🧵 Insights for Your Weave             ║
║                                         ║
║  ┌───────────────────────────────────┐ ║
║  │ 🚨 Sarah is drifting              │ ║
║  │ Your last chat was 3 weeks ago.   │ ║
║  │ The High Priestess values deep    │ ║
║  │ conversations. Invite her for     │ ║
║  │ coffee to reconnect.              │ ║
║  │                                   │ ║
║  │         [Reach Out Now →]         │ ║
║  │              [Later]               │ ║
║  └───────────────────────────────────┘ ║
║                                         ║
║  ┌───────────────────────────────────┐ ║
║  │ 💡 Missing Mark's depth           │ ║
║  │ Your last 3 weaves (meal, text,   │ ║
║  │ hangout) didn't create space for  │ ║
║  │ The Hermit's preferred intimacy.  │ ║
║  │ Try a one-on-one walk.            │ ║
║  │                                   │ ║
║  │      [Plan Deep Connection →]     │ ║
║  │              [Later]               │ ║
║  └───────────────────────────────────┘ ║
║                                         ║
║  ┌───────────────────────────────────┐ ║
║  │ 🌟 You're connecting well         │ ║
║  │ You and Alex have great momentum. │ ║
║  │ The Adventurer would love to try  │ ║
║  │ something new together.           │ ║
║  │                                   │ ║
║  │      [Deepen the Bond →]          │ ║
║  │              [Later]               │ ║
║  └───────────────────────────────────┘ ║
║                                         ║
║            [Close]                      ║
║                                         ║
╚═════════════════════════════════════════╝
```

**Key Benefits**:
- ✅ **Always accessible** - Button never disappears
- ✅ **Zero intrusion** - User chooses when to engage
- ✅ **Badge visibility** - Shows count without details
- ✅ **Full context** - Sheet provides room for explanations
- ✅ **Symmetry** - Balances header layout (Thread ↔ Add Friend)
- ✅ **Semantic icon** - Thread (🧵) represents woven connections
- ✅ **Dismissible** - "Later" on each suggestion, "Close" for sheet
- ✅ **Re-accessible** - User can always come back after dismissing

---

### Badge Behavior

**Badge Count Logic**:
```typescript
const badgeCount = suggestions.filter(s => {
  // Count critical suggestions (always shown)
  if (s.urgency === 'critical') return true;

  // Count non-dismissed suggestions
  if (!dismissedIds.has(s.id)) return true;

  return false;
}).length;
```

**Badge States**:
- **No badge**: No active suggestions
- **Number (1-9)**: Shows count
- **9+**: Shows "9+" for many suggestions
- **Critical pulse**: Badge pulses red if any critical suggestions

**Visual Design**:
```typescript
<View style={styles.threadButton}>
  <Text style={styles.threadIcon}>🧵</Text>
  {badgeCount > 0 && (
    <View style={[
      styles.badge,
      hasCritical && styles.badgeCritical
    ]}>
      <Text style={styles.badgeText}>
        {badgeCount > 9 ? '9+' : badgeCount}
      </Text>
    </View>
  )}
</View>
```

---

### Suggestion Display Rules

#### What to Show (Prioritized)
1. **Critical Drift** (Inner Circle < 30)
2. **Archetype Mismatch** (Last 3+ interactions don't align)
3. **First Weave** (New friend, 3+ days, zero interactions)
4. **High Drift** (Inner Circle < 50, Close Friends < 35)
5. **Momentum Opportunity** (Score > 60, momentum > 10)
6. **Maintenance** (Score 40-70, no contact in tier threshold)

#### When to Show
- **Always available** - Not gated by time/frequency
- **Smart rotation** - If 5+ suggestions, rotate which ones show
- **Sticky critical** - Critical drift always appears first
- **User preference** - Remember if user dismissed and honor cooldown

#### What NOT to Show
- Low urgency "deepen" suggestions (score > 85) - Only in profile header
- Reflection prompts - Handled immediately after logging

---

### New Filter Logic: "Dashboard-Worthy" Suggestions

```typescript
interface DashboardSuggestion extends Suggestion {
  isDashboardWorthy: boolean;  // Only these show on dashboard
  insightType?: 'archetype-mismatch' | 'critical-drift' | 'momentum';
}

function getDashboardSuggestion(
  allSuggestions: Suggestion[],
  dismissedIds: Set<string>,
  recentInteractions: Interaction[]
): DashboardSuggestion | null {

  // Filter to only dashboard-worthy suggestions
  const dashboardCandidates = allSuggestions.filter(s => {
    // Critical drift always shows
    if (s.urgency === 'critical') return true;

    // Archetype mismatch insight
    if (s.insightType === 'archetype-mismatch') return true;

    // Momentum opportunity (only if high momentum)
    if (s.insightType === 'momentum' && s.friend.momentumScore > 12) return true;

    // First weave for new friend (after grace period)
    if (s.category === 'first-weave') {
      const daysSinceAdded = (Date.now() - s.friend.createdAt.getTime()) / 86400000;
      return daysSinceAdded >= 3;
    }

    return false;
  });

  // Respect dismissals (except critical)
  const visible = dashboardCandidates.filter(s =>
    !dismissedIds.has(s.id) || s.urgency === 'critical'
  );

  // Return ONLY the top priority (not multiple)
  return visible.sort((a, b) => urgencyScore(a) - urgencyScore(b))[0] || null;
}
```

---

### New Insight Type: Archetype Mismatch

**Trigger**:
- Last 3+ interactions with this friend
- None match their preferred archetype category
- Friend score is stable (not drifting), so wouldn't normally surface

**Example**:
```typescript
{
  friend: highPriestessFriend,
  urgency: 'medium',
  category: 'insight',
  insightType: 'archetype-mismatch',
  title: "You're missing Sarah's depth",
  subtitle: "The High Priestess values meaningful conversations. Your last 3 weaves (meal, hangout, text) didn't create space for that. Try a one-on-one coffee.",
  actionLabel: "Plan Deep Connection",
  action: { type: 'plan', prefilledCategory: 'deep-talk' },
  icon: '💡',
  isDashboardWorthy: true,
}
```

This creates **quality insights** rather than just urgent reminders.

---

### Component Structure

```typescript
// Dashboard.tsx
<SafeAreaView>
  <View style={styles.header}>
    {/* NEW: Thread button with badge */}
    <TouchableOpacity
      style={styles.threadButton}
      onPress={() => setInsightsSheetVisible(true)}
    >
      <Text style={styles.threadIcon}>🧵</Text>
      {suggestionCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {suggestionCount > 9 ? '9+' : suggestionCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>

    <Text style={styles.title}>Weave</Text>

    <View style={styles.headerRight}>
      <TouchableOpacity onPress={handleAddFriend}>
        <Text style={styles.addIcon}>+</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={handleSettings}>
        <Text style={styles.settingsIcon}>⚙️</Text>
      </TouchableOpacity>
    </View>
  </View>

  <TierTabs />
  <FriendCards />

  {/* NEW: Insights bottom sheet */}
  <InsightsSheet
    isVisible={insightsSheetVisible}
    suggestions={activeSuggestions}
    onClose={() => setInsightsSheetVisible(false)}
    onAct={handleActOnSuggestion}
    onLater={handleDismissSuggestion}
  />
</SafeAreaView>
```

**New Component: `InsightsSheet.tsx`**:
```typescript
interface InsightsSheetProps {
  isVisible: boolean;
  suggestions: Suggestion[];
  onClose: () => void;
  onAct: (suggestion: Suggestion) => void;
  onLater: (suggestionId: string) => void;
}

export function InsightsSheet({
  isVisible,
  suggestions,
  onClose,
  onAct,
  onLater
}: InsightsSheetProps) {
  // Entrance/exit animations
  const backdropOpacity = useSharedValue(0);
  const sheetTranslateY = useSharedValue(SHEET_HEIGHT);

  useEffect(() => {
    if (isVisible) {
      backdropOpacity.value = withTiming(1, { duration: 200 });
      sheetTranslateY.value = withSpring(0, { damping: 30, stiffness: 400 });
    }
  }, [isVisible]);

  const animateOut = (callback: () => void) => {
    backdropOpacity.value = withTiming(0, { duration: 150 });
    sheetTranslateY.value = withTiming(SHEET_HEIGHT, { duration: 200 }, (finished) => {
      if (finished) runOnJS(callback)();
    });
  };

  if (!isVisible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={styles.header}>
          <Text style={styles.title}>🧵 Insights for Your Weave</Text>
          <TouchableOpacity onPress={() => animateOut(onClose)}>
            <Text style={styles.closeButton}>×</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView}>
          {suggestions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✨</Text>
              <Text style={styles.emptyTitle}>All caught up!</Text>
              <Text style={styles.emptySubtitle}>
                Your weave is looking strong. Keep nurturing your connections.
              </Text>
            </View>
          ) : (
            suggestions.map(suggestion => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onAct={() => onAct(suggestion)}
                onLater={() => onLater(suggestion.id)}
              />
            ))
          )}
        </ScrollView>

        <TouchableOpacity
          style={styles.closeFooter}
          onPress={() => animateOut(onClose)}
        >
          <Text style={styles.closeFooterText}>Close</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
```

---

### User Flow: From Badge to Action

**Step 1: Discovery**
- User opens dashboard
- Sees thread button (🧵) with badge count
- Badge pulses red if any critical suggestions exist

**Step 2: Exploration**
- User taps thread button
- Insights sheet slides up from bottom
- Shows all active suggestions, prioritized by urgency
- Critical suggestions appear first

**Step 3: Decision**
- User reads suggestion details
- Sees archetype-aware recommendation
- Two choices per suggestion:
  - **Primary action button** (e.g., "Reach Out Now")
  - **Secondary "Later" button**

**Step 4A: Act**
- User taps primary action
- Navigates to interaction form
- Form pre-filled with suggested category
- Sheet closes automatically
- Success haptic + toast

**Step 4B: Later**
- User taps "Later"
- Suggestion dismissed for cooldown period
- Card slides out with subtle animation
- Badge count decrements
- Light haptic feedback

**Step 5: Re-access**
- User can always reopen sheet via thread button
- Dismissed suggestions don't reappear until cooldown expires
- Critical suggestions may bypass cooldown if urgency increases

---

### Interaction Patterns

**"Maybe Later" Behavior**:
- Gentle dismissal - "I see this, but not now"
- Cooldown: 2 days for insights, 1 day for critical drift
- Stores in AsyncStorage: `suggestion-snoozed:${id}`
- Language shift from "Dismiss" signals this is helpful, not annoying

**Act Behavior**:
- Same as before: Navigate to interaction form
- Mark suggestion as completed (won't reappear)
- Success haptic + subtle celebration
- Dashboard clears immediately

**Auto-Hide Scenarios**:
1. User acts on the suggestion
2. Relationship state changes (e.g., they log a weave with that friend)
3. Cooldown expires after "Maybe Later"
4. User navigates to that friend's profile (acknowledgment)

---

### Display Frequency Limits

```typescript
const DASHBOARD_SUGGESTION_LIMITS = {
  maxPerDay: 2,              // Don't overwhelm with multiple suggestions per day
  minHoursBetween: 6,        // Space out suggestions (at least 6 hours apart)
  criticalBypass: true,      // Critical drift can bypass daily limit

  cooldowns: {
    'critical-drift': 1,     // 1 day before re-showing
    'archetype-mismatch': 3, // 3 days
    'momentum': 7,           // 7 days
    'first-weave': 2,        // 2 days
  }
};

function shouldShowDashboardSuggestion(
  suggestion: DashboardSuggestion,
  lastShownTimestamp: number
): boolean {
  const hoursSinceLastShown = (Date.now() - lastShownTimestamp) / 3600000;

  // Critical always shows (bypass frequency limits)
  if (suggestion.urgency === 'critical') return true;

  // Otherwise respect spacing
  return hoursSinceLastShown >= DASHBOARD_SUGGESTION_LIMITS.minHoursBetween;
}
```

---

## Friend Profile Integration

### Dynamic Action Header

Replaces the current static "Connect By" button with an intelligent, context-aware header.

**Visual Design**:
```
┌─────────────────────────────────────────┐
│  [← Back]                    [📅] [✏️] │
├─────────────────────────────────────────┤
│                                         │
│  [Friend Card - Sarah]                  │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│  🚨  Connection is Drifting             │
│                                         │
│  Sarah values deep, one-on-one          │
│  conversations. Invite her for a        │
│  coffee chat to reconnect.              │
│                                         │
│      [                Reach Out        ]│
│                                         │
├─────────────────────────────────────────┤
│  Timeline                               │
│  • Today                                │
│  • This Week                            │
└─────────────────────────────────────────┘
```

### Component: `FriendActionHeader.tsx`

```typescript
interface FriendActionHeaderProps {
  friend: Friend;
  interactions: Interaction[];
  onAction: (action: SuggestionAction) => void;
}

export function FriendActionHeader({ friend, interactions, onAction }: Props) {
  const { colors } = useTheme();
  const state = useFriendActionState(friend, interactions);

  if (!state) return null; // No suggestion for this friend

  const urgencyColors = {
    critical: colors.destructive,
    high: colors.accent,
    medium: colors.primary,
    low: colors['muted-foreground'],
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.icon}>{state.icon}</Text>
        <View style={styles.textContent}>
          <Text style={[styles.title, { color: urgencyColors[state.urgency] }]}>
            {state.title}
          </Text>
          <Text style={[styles.subtitle, { color: colors.foreground }]}>
            {state.subtitle}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: urgencyColors[state.urgency] }]}
        onPress={() => onAction(state.action)}
      >
        <Text style={styles.actionLabel}>{state.actionLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Hook: `useFriendActionState.ts`

```typescript
export function useFriendActionState(
  friend: Friend,
  interactions: Interaction[]
): FriendActionState | null {
  const currentScore = calculateCurrentScore(friend);
  const lastInteraction = interactions[0]; // Assumes sorted by date desc

  // PRIORITY 1: Reflect on recent interaction
  if (lastInteraction) {
    const hoursSince = (Date.now() - lastInteraction.interactionDate.getTime()) / 3600000;
    const needsReflection = hoursSince < 24 && (!lastInteraction.reflection || !lastInteraction.vibe);

    if (needsReflection) {
      return {
        state: 'reflect',
        title: 'Recent Weave',
        subtitle: `How was your time with ${friend.name}? Add your reflection.`,
        actionLabel: 'Reflect on Weave',
        urgency: 'high',
        category: 'reflect',
        action: { type: 'reflect', interactionId: lastInteraction.id },
        icon: '✨',
      };
    }
  }

  // PRIORITY 2: Critical drift (Inner Circle emergency)
  if (friend.dunbarTier === 'InnerCircle' && currentScore < 30) {
    return {
      state: 'critical-drift',
      title: 'Connection is Drifting',
      subtitle: ARCHETYPE_DRIFT_SUGGESTIONS[friend.archetype],
      actionLabel: 'Reach Out Now',
      urgency: 'critical',
      category: 'drift',
      action: {
        type: 'log',
        prefilledCategory: ARCHETYPE_PREFERRED_CATEGORIES[friend.archetype]
      },
      icon: '🚨',
    };
  }

  // PRIORITY 3: High drift (needs attention)
  if (
    (friend.dunbarTier === 'InnerCircle' && currentScore < 50) ||
    (friend.dunbarTier === 'CloseFriends' && currentScore < 35)
  ) {
    return {
      state: 'drift',
      title: 'Time to Reconnect',
      subtitle: ARCHETYPE_DRIFT_SUGGESTIONS[friend.archetype],
      actionLabel: 'Plan a Weave',
      urgency: 'high',
      category: 'drift',
      action: { type: 'plan', prefilledCategory: ARCHETYPE_PREFERRED_CATEGORIES[friend.archetype] },
      icon: '⚠️',
    };
  }

  // PRIORITY 4: First weave (new friend)
  if (interactions.length === 0) {
    return {
      state: 'first-weave',
      title: 'A New Thread',
      subtitle: `Log your first weave with ${friend.name} to begin strengthening your connection.`,
      actionLabel: 'Log First Weave',
      urgency: 'medium',
      category: 'maintain',
      action: { type: 'log' },
      icon: '🧵',
    };
  }

  // PRIORITY 5: Momentum opportunity
  if (currentScore > 60 && friend.momentumScore > 10) {
    return {
      state: 'momentum',
      title: `You're Connecting Well`,
      subtitle: ARCHETYPE_MOMENTUM_SUGGESTIONS[friend.archetype],
      actionLabel: 'Deepen the Bond',
      urgency: 'medium',
      category: 'deepen',
      action: { type: 'plan', prefilledCategory: ARCHETYPE_DEEP_CATEGORIES[friend.archetype] },
      icon: '🌟',
    };
  }

  // PRIORITY 6: Maintenance
  const daysSinceInteraction = lastInteraction
    ? (Date.now() - lastInteraction.interactionDate.getTime()) / 86400000
    : 999;

  const maintenanceThreshold = {
    InnerCircle: 7,
    CloseFriends: 14,
    Community: 21,
  }[friend.dunbarTier];

  if (currentScore >= 40 && currentScore <= 70 && daysSinceInteraction > maintenanceThreshold) {
    return {
      state: 'maintain',
      title: 'Keep the Thread Warm',
      subtitle: `A simple voice note or text can maintain your connection with ${friend.name}.`,
      actionLabel: 'Log Quick Weave',
      urgency: 'low',
      category: 'maintain',
      action: { type: 'log', prefilledCategory: 'text-call', prefilledMode: 'quick-touch' },
      icon: '💛',
    };
  }

  // PRIORITY 7: Deepen (thriving)
  if (currentScore > 85 && friend.dunbarTier !== 'Community') {
    return {
      state: 'deepen',
      title: 'Your Bond is Thriving',
      subtitle: `Plan something special to celebrate your connection with ${friend.name}.`,
      actionLabel: 'Plan Something Meaningful',
      urgency: 'low',
      category: 'celebrate',
      action: { type: 'plan' },
      icon: '✨',
    };
  }

  return null; // No suggestion for this friend right now
}
```

---

## Implementation Roadmap

### Week 1: Core Engine
**Goal**: Build the suggestion generation logic

Tasks:
- [ ] Create `src/lib/suggestion-engine.ts` with rule system
- [ ] Create `src/hooks/useFriendActionState.ts` for profile header
- [ ] Define archetype content mappings
- [ ] Write unit tests for rule priority
- [ ] Test with various friend states (drifting, thriving, new, etc.)

**Deliverable**: `generateSuggestions(friends)` function returns smart suggestions

---

### Week 2: Dashboard Integration
**Goal**: Add thread button and insights sheet to dashboard

Tasks:
- [ ] Create `src/components/SuggestionCard.tsx` - Individual suggestion card
- [ ] Create `src/components/InsightsSheet.tsx` - Bottom sheet container
- [ ] Add thread button to dashboard header (opposite add friend button)
- [ ] Implement badge count logic (shows number of active suggestions)
- [ ] Add critical pulse animation for urgent suggestions
- [ ] Add dismiss logic with AsyncStorage persistence
- [ ] Integrate sheet into `app/dashboard.tsx`
- [ ] Add navigation handlers (suggestion → interaction form)
- [ ] Implement pre-fill logic for quick actions
- [ ] Add haptic feedback for actions (medium impact on act, light on later)
- [ ] Polish animations (sheet slide-up, badge pulse, card animations)
- [ ] Empty state when no suggestions ("All caught up!")

**Deliverable**: Thread button with badge that opens insights sheet containing all active suggestions

---

### Week 3: Profile Header + Polish
**Goal**: Replace static "Connect By" with dynamic action header

Tasks:
- [ ] Create `src/components/FriendActionHeader.tsx`
- [ ] Integrate hook into friend profile
- [ ] Remove old "Connect By" button logic
- [ ] Update interaction form to handle pre-filled categories
- [ ] Add analytics tracking for suggestion engagement
- [ ] Test with all 7 archetypes
- [ ] Test all priority states
- [ ] Write user-facing documentation
- [ ] Create onboarding tooltip for new users

**Deliverable**: Friend profiles show context-aware action header

---

## Testing Strategy

### Test Scenarios

#### Dashboard Suggestions
1. **New user (0 friends)**: No suggestions shown, empty state
2. **All friends thriving (score > 85)**: Show 1-2 "deepen" suggestions
3. **One critical drift (score < 30)**: Critical suggestion always on top
4. **Mixed states**: Correct priority ordering (critical > high > medium > low)
5. **Dismissed suggestions**: Don't reappear until cooldown expires
6. **Act on suggestion**: Navigates correctly with pre-filled data

#### Profile Action Header
1. **Recent interaction (< 24h)**: Shows "Reflect" state
2. **Critical drift (IC < 30)**: Shows emergency reconnect
3. **New friend (0 interactions)**: Shows "First Weave" prompt
4. **Momentum (high score + momentum)**: Shows "Deepen" state
5. **Stable maintenance**: Shows "Keep Warm" state
6. **Thriving bond (score > 85)**: Shows "Plan Something Special"
7. **All archetypes**: Correct language and category suggestions

#### Edge Cases
1. Multiple friends in critical state: All shown (not limited to 3)
2. Suggestion cooldown expiration: Reappears at correct time
3. Friend score changes: Suggestion updates on next app open
4. No active suggestions: Empty state with encouraging message

---

## Success Metrics

### Engagement Metrics
- **Suggestion View Rate**: % of app opens that show suggestions
- **Action Rate**: % of suggestions that are acted upon (not dismissed)
- **Dismissal Rate**: % of suggestions dismissed
- **Category Accuracy**: How often users accept pre-filled categories

### Relationship Health Metrics
- **Drift Prevention**: % of critical drift suggestions acted on within 24h
- **Proactive Planning**: % of "plan" actions vs reactive "log" actions
- **Reflection Completion**: % of recent interactions that get reflections
- **Score Improvements**: Average score change for friends with acted-on suggestions

### Target Goals (After 1 Month)
- 70%+ of users see at least one suggestion per week
- 35%+ suggestion action rate (industry standard: 15-25%)
- <20% permanent dismissal rate
- 50%+ of critical drift suggestions acted on

---

## Future Enhancements

### Phase 2: Learning Engine
- Track which suggestions users act on vs dismiss
- Adjust rule weights based on user behavior
- Personalize urgency thresholds per user
- A/B test different suggestion copy

### Phase 3: Contextual Intelligence
- Time-based suggestions (weekend vs weekday)
- Location-based suggestions (when near friend's area)
- Calendar integration (suggest during free time)
- Seasonal patterns (holiday check-ins, birthdays)

### Phase 4: AI-Powered Prompts
- Use LLM to generate personalized, natural language suggestions
- Analyze interaction notes to understand relationship nuances
- Suggest specific topics or activities based on shared interests
- Generate reflection prompts based on interaction history

---

## Open Questions for Discussion

1. **Notification Strategy**: Should suggestions trigger push notifications, or only appear in-app?
2. **Cooldown Periods**: How long before a dismissed suggestion reappears? (Current: 3-7 days)
3. **Overwhelming Users**: Max 3 suggestions on dashboard - is this right? Should critical drift bypass this limit?
4. **Community Tier**: Should we generate suggestions for Community tier friends, or focus on Inner/Close only?
5. **Gamification**: Should acting on suggestions contribute to streaks/achievements?

---

## Design Assets Needed

- [ ] Urgency color palette (critical: red, high: orange, medium: purple, low: gray)
- [ ] Thread button design with badge (position, size, badge styling)
- [ ] Badge pulse animation for critical suggestions
- [ ] Insights sheet component design (Figma)
- [ ] Suggestion card component design (Figma)
- [ ] Action header component design (Figma)
- [ ] Empty state illustration for "All caught up!"
- [ ] Success state animation when user acts on suggestion
- [ ] Sheet slide-up/slide-down animation

---

## Conclusion

The suggestion engine transforms Weave from a passive relationship tracker into an **intelligent friendship companion**. By combining relationship health data with archetype awareness, we create a system that:

- **Prevents drift** before it becomes irreversible
- **Guides action** with clear, personalized suggestions
- **Respects individuality** through archetype-aware recommendations
- **Reduces friction** with one-tap pre-filled actions

This positions Weave as **the app that helps you be the friend you want to be** - not just tracking relationships, but actively nurturing them.
