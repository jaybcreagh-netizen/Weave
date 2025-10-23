# Weave Feature Roadmap & Analysis

## Current State Assessment

**What's Working:**
- ✅ Core Weave Score calculation with decay
- ✅ Living Color system for relationship health
- ✅ Quick-touch logging with radial menu
- ✅ Manual interaction logging with activity, vibe, duration
- ✅ Friend profiles with timeline visualization
- ✅ Archetype system with interaction multipliers
- ✅ Dunbar tier categorization
- ✅ Momentum & resilience mechanics
- ✅ Dormancy detection
- ✅ Dark mode theming

**What's Missing (Critical for User Value):**
- ❌ Post-interaction reflection/journaling
- ❌ Editing past interactions
- ❌ Calendar integration for auto-logging
- ❌ Context-aware suggestions
- ❌ Life events affecting friends
- ❌ Weekly reflection ritual
- ❌ Data visualization beyond cards
- ❌ Deep weave guided prompts

---

## Feature Analysis & Prioritization

### Tier 1: Essential for MVP Usability (Build These Next)

#### 1. **Post-Weave Reflection & Editing** 🔥 HIGHEST PRIORITY
**Why First:**
- Users need to correct mistakes and add forgotten details
- Captures qualitative richness (the "soul" of relationships)
- Low technical complexity, high user value
- Foundation for Deep Weave feature later

**Implementation:**
- Edit button on interaction detail modal
- Pre-fill form with existing data
- Update WatermelonDB records (already have update methods)
- Add "reflection" field to interactions schema for journal prompts
- Optional: Quick reflection prompt after logging ("How did this feel?")

**Schema Changes:**
```typescript
interactions table:
  + reflection: string (optional) // User's journal entry
  + quality_rating: number (optional) // 1-5 stars for interaction quality
  + last_edited: number (optional) // Timestamp of last edit
```

**User Flow:**
1. Tap interaction in timeline → Modal opens
2. "Edit Details" button → Pre-filled interaction form
3. Add reflection notes, adjust vibe/duration
4. Save → Updates DB, recalculates score

---

#### 2. **Weekly Reflection Ritual** 🔥 HIGH PRIORITY
**Why Second:**
- Creates engagement loop and retention
- Helps users catch missed weaves
- Builds mindfulness habit
- Relatively simple to implement

**Implementation:**
- Store last reflection date in AsyncStorage
- Notification permission on first open
- Weekly notification (Sunday evening works well)
- Modal that shows:
  - "This week's weaves" - summary
  - "Did we miss anyone?" - Friends with low scores
  - Quick-add interface for missed interactions
  - Gratitude prompt: "What moment brought you joy this week?"

**New Components:**
```
/src/components/WeeklyReflection/
  - WeeklyReflectionModal.tsx
  - WeekSummary.tsx
  - MissedConnectionsList.tsx
  - GratitudePrompt.tsx
```

**Data Requirements:**
- Weekly interaction count per friend
- Friends below tier thresholds
- Suggested prompts based on psychology

---

#### 3. **Context-Aware Suggestion Engine** 🎯 HIGH PRIORITY
**Why Third:**
- Core differentiator from simple tracking apps
- Makes app proactive, not reactive
- Uses existing data (score, tier, archetype)
- Can start simple and evolve

**V1 Implementation (Simple Rules):**
```typescript
getSuggestions(friends: Friend[]): Suggestion[] {
  const suggestions = [];

  // Rule 1: Critical attention needed
  friends.filter(f => f.weaveScore < 30 && f.dunbarTier === 'InnerCircle')
    .forEach(f => suggestions.push({
      friend: f,
      urgency: 'high',
      action: getArchetypeAction(f.archetype), // e.g., "Send a voice note"
      reason: `${f.name} is drifting - they value ${getArchetypeValue(f)}`
    }));

  // Rule 2: Maintenance mode
  friends.filter(f => f.weaveScore >= 50 && f.weaveScore < 70)
    .forEach(f => suggestions.push({
      urgency: 'medium',
      action: 'Quick coffee catch-up',
      reason: 'Keep the momentum going'
    }));

  // Rule 3: Strengthen strong bonds
  friends.filter(f => f.weaveScore > 80 && f.momentumScore > 0)
    .forEach(f => suggestions.push({
      urgency: 'low',
      action: 'Plan something meaningful',
      reason: 'Your connection is thriving - deepen it'
    }));

  return suggestions.sort((a, b) => urgencyScore(a) - urgencyScore(b));
}
```

**UI:**
- Dashboard "Suggested Actions" card
- Swipe to dismiss or act on suggestion
- Opens interaction form pre-filled with suggested friend/activity

---

### Tier 2: High Value, More Complex

#### 4. **Life Events System**
**Why Important:**
- Major life changes affect relationship dynamics
- Adds realism to the scoring model
- Helps users be more compassionate with themselves

**Implementation:**
```typescript
// Schema addition
friends table:
  + life_events: string[] // JSON array of event IDs

life_events table:
  + friend_id: string
  + event_type: string // 'new_baby', 'moved_away', 'new_job', 'health_issue', 'breakup'
  + start_date: number
  + end_date: number (optional)
  + score_multiplier: number // 0.5 for "they're busy", 1.5 for "they need support"
  + notes: string
```

**Weave Engine Update:**
```typescript
calculatePointsForWeave(friend, weaveData) {
  // ... existing logic

  const activeEvents = getActiveLifeEvents(friend);
  const eventMultiplier = activeEvents.reduce((mult, event) =>
    mult * event.score_multiplier, 1.0);

  return finalPoints * eventMultiplier;
}
```

**UX:**
- "Add Life Event" button on friend profile
- Predefined event types with smart defaults
- Visual indicator on friend card (icon badge)
- Compassionate messaging: "Alex just had a baby - they might be less available"

---

#### 5. **Calendar Sync & Auto-Logging**
**Why Powerful:**
- Reduces manual logging friction
- Captures real interaction data
- Increases accuracy

**Challenges:**
- Privacy concerns (need clear permissions)
- Calendar events don't always = meaningful interactions
- Name matching is hard

**Phased Approach:**

**Phase 1: Calendar Import (Semi-Auto)**
- Request calendar permission
- Scan for events with known friend names
- Show "Did you weave?" suggestions
- User confirms/adjusts before logging

**Phase 2: Smart Detection**
- Learn from user patterns (which calendar events = weaves)
- ML model to predict interaction type from event title
- Auto-log with review step

**Implementation:**
```typescript
// Use expo-calendar
import * as Calendar from 'expo-calendar';

async function scanCalendarForWeaves(friends: Friend[], startDate: Date) {
  const calendars = await Calendar.getCalendarsAsync();
  const events = await Calendar.getEventsAsync(
    calendars.map(c => c.id),
    startDate,
    new Date()
  );

  const potentialWeaves = events
    .filter(event => {
      return friends.some(f =>
        event.title.toLowerCase().includes(f.name.toLowerCase()) ||
        event.attendees?.some(a => a.name === f.name)
      );
    })
    .map(event => ({
      event,
      matchedFriends: friends.filter(f => /* match logic */),
      suggestedActivity: inferActivityFromEvent(event),
      confidence: calculateConfidence(event)
    }));

  return potentialWeaves;
}
```

**UI Flow:**
- Weekly reflection asks: "Sync calendar?"
- Shows list of detected events
- Swipe right to log, left to dismiss
- Adjust details if needed

---

### Tier 3: Polish & Delight

#### 6. **Deep Weave Guided Reflection**
**Psychology Foundation:**
- Gratitude journaling (Emmons & McCullough)
- Narrative therapy (White & Epston)
- Savoring (Bryant & Veroff)

**Prompt Examples:**
```typescript
const deepWeavePrompts = {
  gratitude: [
    "What did ${friendName} do recently that made you feel valued?",
    "Describe a moment with ${friendName} that you want to remember.",
    "What quality in ${friendName} are you most grateful for right now?"
  ],
  narrative: [
    "How has your friendship with ${friendName} evolved in the past year?",
    "What story would you tell about ${friendName} to someone who's never met them?",
    "What role does ${friendName} play in your life story?"
  ],
  intention: [
    "What kind of friend do you want to be to ${friendName}?",
    "What would deepen your connection with ${friendName}?",
    "If you could plan one perfect day with ${friendName}, what would it include?"
  ]
};
```

**Implementation:**
- Monthly "Deep Weave" ritual
- Choose 1-3 friends from Inner Circle
- Guided 5-minute reflection per friend
- Save to friend notes
- Optional: AI summary of relationship arc over time

---

#### 7. **Ambient Data Visualization**
**Concepts:**
- Weave Graph: Network visualization of your social circle
- Interaction Heatmap: Calendar view of connection density
- Tier Balance Gauge: Visual of how time is distributed
- Momentum Curves: Sparklines showing relationship trajectories

**Implementation Ideas:**
- Interactive D3/Victory charts
- Subtle background animations
- Tap to explore deeper
- Share-worthy (Instagram-style year in review)

---

#### 8. **Mindful Gamification**
**Connection Streak:**
- Track consecutive weeks with all Inner Circle above threshold
- Celebrate milestones (4 weeks, 12 weeks, 52 weeks)
- Lose streak gracefully (with encouragement, not shame)

**Archetype Achievements:**
- "Matched Energy" - Logged 5 weaves perfectly aligned with friend's archetype
- "Depth Seeker" - Completed 10 Deep Weave reflections
- "Rhythm Keeper" - 8 weeks of consistent weekly reflections

**Visual Language:**
- Soft celebrations (gentle animation, not fireworks)
- Progress rings (like Apple Watch)
- Unlockable insights: "After 3 months, you've learned..."

---

## Recommended Implementation Order

### Sprint 1-2: Foundation (2-3 weeks)
1. **Post-Weave Reflection & Editing**
   - Schema changes
   - Edit interaction flow
   - Reflection prompt after quick-touch

### Sprint 3-4: Engagement Loop (2-3 weeks)
2. **Weekly Reflection Ritual**
   - Notification setup
   - Reflection modal UI
   - Missed weaves detection
   - Gratitude journaling

### Sprint 5-6: Intelligence (2-3 weeks)
3. **Context-Aware Suggestions V1**
   - Rule-based suggestion engine
   - Dashboard suggestion card
   - Action handlers

### Sprint 7-8: Realism (2 weeks)
4. **Life Events System**
   - Schema and CRUD
   - Event type library
   - Score multiplier integration
   - Friend profile UI

### Sprint 9-10: Automation (3 weeks)
5. **Calendar Sync (Phase 1)**
   - Permission flow
   - Calendar scanning
   - Suggestion UI
   - Confirmation flow

### Sprint 11+: Delight
6. **Deep Weave Guided Reflection**
7. **Data Visualization**
8. **Gamification Polish**

---

## Quick Wins (Can Build Alongside)

- **Notification for drifting friends** (1 day)
  - Daily check: Alert if Inner Circle friend drops below 40

- **Quick stats on dashboard** (1 day)
  - "3 weaves this week"
  - "Inner Circle: 4/5 thriving"

- **Archetype education tooltips** (1 day)
  - Help users understand why suggestions match archetypes

- **Export data** (2 days)
  - JSON export of all data
  - User peace of mind about data ownership

---

## Technical Considerations

**Database Migrations:**
- WatermelonDB supports migrations
- Test thoroughly before releasing schema changes
- Backup user data mechanism

**Performance:**
- Suggestion engine should be fast (<100ms)
- Cache calendar scan results
- Index database queries properly

**Privacy:**
- Clear permission dialogs
- Data stays local (no cloud sync in V1)
- Easy data deletion

**Testing:**
- Edge cases: 0 friends, 0 weaves, all dormant
- Score calculation regression tests
- Calendar sync error handling

---

## Metrics to Track Post-Launch

- Daily Active Users (DAU)
- Weekly Active Users (WAU)
- Weaves logged per week (avg)
- Weekly reflection completion rate
- Suggestion acceptance rate
- Feature usage breakdown
- Retention: D1, D7, D30
- Time to first weave (onboarding success)

---

## Implementation Guide: Feature #1 (Post-Weave Reflection & Editing)

### Step 1: Database Schema Migration

**File:** `src/db/schema.ts`

Current version: 8
New version: 9

Add to `interactions` table columns (lines 26-37):
```typescript
{ name: 'reflection', type: 'string', isOptional: true },
{ name: 'quality_rating', type: 'number', isOptional: true },
{ name: 'last_edited', type: 'number', isOptional: true },
```

**File:** `src/db/index.ts` (create migration)

Add migration handler:
```typescript
migrations: [
  {
    toVersion: 9,
    steps: [
      addColumns({
        table: 'interactions',
        columns: [
          { name: 'reflection', type: 'string', isOptional: true },
          { name: 'quality_rating', type: 'number', isOptional: true },
          { name: 'last_edited', type: 'number', isOptional: true },
        ]
      })
    ]
  }
]
```

### Step 2: Update InteractionModel

**File:** `src/db/models/Interaction.ts`

Add properties to class:
```typescript
@field('reflection') reflection?: string;
@field('quality_rating') qualityRating?: number;
@field('last_edited') lastEdited?: Date;
```

### Step 3: Update InteractionStore

**File:** `src/stores/interactionStore.ts`

Add `updateInteraction` method:
```typescript
updateInteraction: async (interactionId: string, updates: Partial<InteractionFormData>) => {
  const interaction = await database.get<InteractionModel>('interactions').find(interactionId);

  await database.write(async () => {
    await interaction.update(record => {
      if (updates.activity) record.activity = updates.activity;
      if (updates.notes !== undefined) record.note = updates.notes;
      if (updates.vibe !== undefined) record.vibe = updates.vibe;
      if (updates.duration !== undefined) record.duration = updates.duration;
      if (updates.reflection !== undefined) record.reflection = updates.reflection;
      if (updates.qualityRating !== undefined) record.qualityRating = updates.qualityRating;
      record.lastEdited = new Date();
    });

    // Recalculate friend scores if vibe/duration changed
    if (updates.vibe || updates.duration) {
      // Fetch related friends and recalculate scores
      const friendLinks = await interaction.friends.fetch();
      for (const link of friendLinks) {
        const friend = await database.get<FriendModel>('friends').find(link.friendId);
        // Trigger score recalculation via weave engine
      }
    }
  });
}
```

### Step 4: Create Edit UI Component

**New File:** `src/components/EditInteractionModal.tsx`

Create modal that:
- Receives `interactionId` prop
- Pre-fills form with existing data
- Shows reflection textarea
- Shows 1-5 star quality rating
- Calls `updateInteraction` on save

### Step 5: Update InteractionDetailModal

**File:** `src/components/interaction-detail-modal.tsx`

Add "Edit" button:
```typescript
const [showEditModal, setShowEditModal] = useState(false);

// In render:
<TouchableOpacity onPress={() => setShowEditModal(true)}>
  <Edit size={20} color={colors['muted-foreground']} />
</TouchableOpacity>

<EditInteractionModal
  isOpen={showEditModal}
  interactionId={interaction.id}
  onClose={() => setShowEditModal(false)}
/>
```

### Step 6: Add Quick Reflection Prompt

**File:** `src/context/CardGestureContext.tsx`

After successful interaction log (line 92):
```typescript
showToast(activityLabel, friend.name);
// Add reflection prompt
setTimeout(() => {
  showReflectionPrompt(friendId, activityId);
}, 500);
```

**New File:** `src/components/ReflectionPrompt.tsx`

Simple bottom sheet with:
- "How did this feel?" heading
- TextInput for quick note
- Optional quality rating stars
- Skip/Save buttons

### Implementation Checklist:

- [ ] Create schema migration (v8 → v9)
- [ ] Update Interaction model with new fields
- [ ] Add `updateInteraction` to interactionStore
- [ ] Create `EditInteractionModal.tsx`
- [ ] Update `interaction-detail-modal.tsx` with edit button
- [ ] Create `ReflectionPrompt.tsx` component
- [ ] Add reflection prompt to quick-touch flow
- [ ] Test migration on existing data
- [ ] Test edit flow with score recalculation
- [ ] Test reflection prompt UX

### Testing Scenarios:

1. **Migration**: User with 50 existing interactions upgrades app
2. **Edit Past Interaction**: Change vibe from "NewMoon" to "FullMoon" - score updates correctly
3. **Quick Reflection**: Log quick-touch → Reflection prompt appears → Save → Shows in timeline
4. **Quality Rating**: Rate 5 interactions with 1-5 stars → See average in friend profile
5. **Empty State**: Skip reflection prompt → Still saves interaction without reflection

### Estimated Time: 2-3 days

- Schema migration: 2 hours
- Model updates: 1 hour
- Edit modal UI: 4 hours
- Reflection prompt UI: 3 hours
- Integration & testing: 6 hours

---

## Return on Investment Analysis

### Feature #1: Post-Weave Reflection & Editing
- **User Value**: ⭐⭐⭐⭐⭐ (Critical - users need to correct mistakes)
- **Technical Complexity**: ⭐⭐☆☆☆ (Low - CRUD operations)
- **Development Time**: 2-3 days
- **User Engagement Impact**: +25% (adds qualitative depth)
- **Retention Impact**: Medium (prevents frustration from mistakes)

### Feature #2: Weekly Reflection Ritual
- **User Value**: ⭐⭐⭐⭐☆ (High - creates habit loop)
- **Technical Complexity**: ⭐⭐⭐☆☆ (Medium - notifications, UI)
- **Development Time**: 2-3 weeks
- **User Engagement Impact**: +40% (weekly touchpoint)
- **Retention Impact**: Very High (creates recurring engagement)

### Feature #3: Context-Aware Suggestions
- **User Value**: ⭐⭐⭐⭐⭐ (Core differentiator)
- **Technical Complexity**: ⭐⭐⭐☆☆ (Medium - rule engine, UI)
- **Development Time**: 2-3 weeks
- **User Engagement Impact**: +35% (proactive guidance)
- **Retention Impact**: Very High (makes app feel intelligent)

### Feature #4: Life Events System
- **User Value**: ⭐⭐⭐☆☆ (Nice to have)
- **Technical Complexity**: ⭐⭐⭐☆☆ (Medium - new data model)
- **Development Time**: 2 weeks
- **User Engagement Impact**: +15% (adds realism)
- **Retention Impact**: Low (subtle improvement)

### Feature #5: Calendar Sync
- **User Value**: ⭐⭐⭐⭐⭐ (Very High - reduces friction)
- **Technical Complexity**: ⭐⭐⭐⭐☆ (High - permissions, matching)
- **Development Time**: 3 weeks
- **User Engagement Impact**: +50% (auto-logging = more data)
- **Retention Impact**: Very High (reduces manual work)

**Recommended Priority Order Based on ROI:**
1. Post-Weave Reflection & Editing (quick win, high value)
2. Weekly Reflection Ritual (engagement loop)
3. Context-Aware Suggestions (differentiation)
4. Calendar Sync (high effort, high reward)
5. Life Events (polish)

---

## Implementation Guide: Feature #2 (Weekly Reflection Ritual)

### Overview
Creates a weekly engagement loop where users review their weaves, add missed connections, and practice gratitude. Designed to build habit formation and increase retention.

### Step 1: Notification System Setup

**Install Dependencies:**
```bash
npx expo install expo-notifications
```

**New File:** `src/lib/notification-manager.ts`

```typescript
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_REFLECTION_KEY = '@weave:last_reflection_date';
const WEEKLY_NOTIFICATION_ID = 'weekly-reflection';

export async function requestNotificationPermissions() {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

export async function scheduleWeeklyReflection() {
  await Notifications.cancelScheduledNotificationAsync(WEEKLY_NOTIFICATION_ID);

  // Schedule for Sunday at 7 PM
  await Notifications.scheduleNotificationAsync({
    identifier: WEEKLY_NOTIFICATION_ID,
    content: {
      title: "Time to reflect on your weave 🕸️",
      body: "How did your friendships feel this week?",
      data: { type: 'weekly-reflection' },
    },
    trigger: {
      weekday: 1, // Sunday
      hour: 19,
      minute: 0,
      repeats: true,
    },
  });
}

export async function getLastReflectionDate(): Promise<Date | null> {
  const dateString = await AsyncStorage.getItem(LAST_REFLECTION_KEY);
  return dateString ? new Date(dateString) : null;
}

export async function markReflectionComplete(): Promise<void> {
  await AsyncStorage.setItem(LAST_REFLECTION_KEY, new Date().toISOString());
}

export function shouldShowReflection(lastDate: Date | null): boolean {
  if (!lastDate) return true;
  const daysSince = (Date.now() - lastDate.getTime()) / 86400000;
  return daysSince >= 7;
}
```

### Step 2: Weekly Stats Calculator

**New File:** `src/lib/weekly-stats.ts`

```typescript
import { database } from '../db';
import { Q } from '@nozbe/watermelondb';
import FriendModel from '../db/models/Friend';
import InteractionModel from '../db/models/Interaction';
import InteractionFriend from '../db/models/InteractionFriend';

export interface WeeklySummary {
  totalWeaves: number;
  friendsContacted: number;
  missedFriends: FriendModel[];
  topActivity: string;
  gratitudeMoments: string[];
}

export async function calculateWeeklySummary(): Promise<WeeklySummary> {
  const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

  // Get interactions from past week
  const interactions = await database.get<InteractionModel>('interactions')
    .query(Q.where('interaction_date', Q.gte(weekAgo)))
    .fetch();

  // Count unique friends contacted
  const friendLinks = await database.get<InteractionFriend>('interaction_friends')
    .query(Q.where('interaction_id', Q.oneOf(interactions.map(i => i.id))))
    .fetch();

  const contactedFriendIds = new Set(friendLinks.map(fl => fl.friendId));

  // Find missed friends (Inner Circle + Close Friends with no contact)
  const allImportantFriends = await database.get<FriendModel>('friends')
    .query(
      Q.or(
        Q.where('dunbar_tier', 'InnerCircle'),
        Q.where('dunbar_tier', 'CloseFriends')
      )
    )
    .fetch();

  const missedFriends = allImportantFriends
    .filter(f => !contactedFriendIds.has(f.id) && f.weaveScore < 60)
    .sort((a, b) => a.weaveScore - b.weaveScore)
    .slice(0, 5); // Top 5 most drifting

  // Find most common activity
  const activityCounts = interactions.reduce((acc, i) => {
    acc[i.activity] = (acc[i.activity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topActivity = Object.entries(activityCounts)
    .sort(([, a], [, b]) => b - a)[0]?.[0] || 'Chat';

  return {
    totalWeaves: interactions.length,
    friendsContacted: contactedFriendIds.size,
    missedFriends,
    topActivity,
    gratitudeMoments: [], // User will fill this in
  };
}
```

### Step 3: Weekly Reflection Modal Components

**New File:** `src/components/WeeklyReflection/WeeklyReflectionModal.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../../theme';
import { WeeklySummary, calculateWeeklySummary } from '../../lib/weekly-stats';
import { markReflectionComplete } from '../../lib/notification-manager';
import { WeekSummary } from './WeekSummary';
import { MissedConnectionsList } from './MissedConnectionsList';
import { GratitudePrompt } from './GratitudePrompt';
import { Sparkles, X } from 'lucide-react-native';

interface WeeklyReflectionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WeeklyReflectionModal({ isOpen, onClose }: WeeklyReflectionModalProps) {
  const { colors } = useTheme();
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [currentStep, setCurrentStep] = useState<'summary' | 'missed' | 'gratitude'>('summary');

  useEffect(() => {
    if (isOpen) {
      loadSummary();
    }
  }, [isOpen]);

  const loadSummary = async () => {
    const data = await calculateWeeklySummary();
    setSummary(data);
  };

  const handleComplete = async () => {
    await markReflectionComplete();
    onClose();
  };

  if (!summary) return null;

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Sparkles color={colors.primary} size={24} />
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>
              Weekly Reflection
            </Text>
          </View>
          <TouchableOpacity onPress={onClose}>
            <X color={colors['muted-foreground']} size={24} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          {currentStep === 'summary' && (
            <WeekSummary
              summary={summary}
              onNext={() => setCurrentStep('missed')}
            />
          )}
          {currentStep === 'missed' && (
            <MissedConnectionsList
              missedFriends={summary.missedFriends}
              onNext={() => setCurrentStep('gratitude')}
              onSkip={() => setCurrentStep('gratitude')}
            />
          )}
          {currentStep === 'gratitude' && (
            <GratitudePrompt onComplete={handleComplete} />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerTitle: { fontSize: 20, fontWeight: '600' },
  content: { flex: 1, padding: spacing.lg },
});
```

**New File:** `src/components/WeeklyReflection/WeekSummary.tsx`

Simple component showing stats with celebration animations.

**New File:** `src/components/WeeklyReflection/MissedConnectionsList.tsx`

Shows drifting friends with quick-add buttons.

**New File:** `src/components/WeeklyReflection/GratitudePrompt.tsx`

Gratitude journaling with psychological prompts.

### Step 4: Integration with Dashboard

**File:** `app/dashboard.tsx`

Add to component state:
```typescript
const [showWeeklyReflection, setShowWeeklyReflection] = useState(false);

useEffect(() => {
  checkWeeklyReflection();
}, []);

const checkWeeklyReflection = async () => {
  const lastDate = await getLastReflectionDate();
  if (shouldShowReflection(lastDate)) {
    // Wait a bit before showing (don't interrupt immediately)
    setTimeout(() => setShowWeeklyReflection(true), 2000);
  }
};

// In render:
<WeeklyReflectionModal
  isOpen={showWeeklyReflection}
  onClose={() => setShowWeeklyReflection(false)}
/>
```

### Step 5: Notification Handler

**File:** `app/_layout.tsx`

```typescript
useEffect(() => {
  // Request permissions on first launch
  requestNotificationPermissions().then(granted => {
    if (granted) {
      scheduleWeeklyReflection();
    }
  });

  // Handle notification tap
  const subscription = Notifications.addNotificationResponseReceivedListener(response => {
    if (response.notification.request.content.data.type === 'weekly-reflection') {
      // Navigate to dashboard and show reflection
      router.push('/dashboard');
      // Trigger reflection modal via state/event
    }
  });

  return () => subscription.remove();
}, []);
```

### Implementation Checklist:

- [ ] Install expo-notifications
- [ ] Create notification-manager.ts
- [ ] Create weekly-stats.ts calculator
- [ ] Build WeeklyReflectionModal component
- [ ] Build WeekSummary sub-component
- [ ] Build MissedConnectionsList sub-component
- [ ] Build GratitudePrompt sub-component
- [ ] Integrate with dashboard launch check
- [ ] Add notification handler to _layout
- [ ] Test notification scheduling
- [ ] Test weekly stats accuracy
- [ ] Test gratitude prompt saves to AsyncStorage
- [ ] Polish animations and transitions

### Estimated Time: 2-3 weeks

---

## Implementation Guide: Feature #3 (Context-Aware Suggestion Engine)

### Overview
Rule-based intelligent system that analyzes friend data to provide personalized, archetype-aware suggestions for who to contact and how.

### Step 1: Suggestion Engine Core

**New File:** `src/lib/suggestion-engine.ts`

```typescript
import FriendModel from '../db/models/Friend';
import { Archetype, Tier } from '../components/types';
import { calculateCurrentScore } from './weave-engine';

export type SuggestionUrgency = 'critical' | 'high' | 'medium' | 'low';

export interface Suggestion {
  id: string;
  friend: FriendModel;
  urgency: SuggestionUrgency;
  action: string;
  reason: string;
  archetypeAction?: string;
  icon: string;
  color: string;
}

const ARCHETYPE_ACTIONS: Record<Archetype, string[]> = {
  Conversationalist: ['Send a voice note', 'Call for a chat', 'Long phone catch-up'],
  Adventurer: ['Plan an outing', 'Suggest a hike', 'Try something new together'],
  Intellectual: ['Share an article', 'Discuss a book', 'Deep conversation over coffee'],
  Supporter: ['Check in on them', 'Offer to help', 'Be present and listen'],
  Collaborator: ['Work on a project', 'Brainstorm together', 'Plan something creative'],
  Celebrator: ['Celebrate a win', 'Plan a fun hangout', 'Create a special moment'],
};

const ARCHETYPE_VALUES: Record<Archetype, string> = {
  Conversationalist: 'deep dialogue',
  Adventurer: 'shared experiences',
  Intellectual: 'stimulating ideas',
  Supporter: 'emotional presence',
  Collaborator: 'co-creation',
  Celebrator: 'joyful moments',
};

export function generateSuggestions(friends: FriendModel[]): Suggestion[] {
  const suggestions: Suggestion[] = [];

  friends.forEach(friend => {
    const currentScore = calculateCurrentScore(friend);
    const tier = friend.dunbarTier as Tier;
    const archetype = friend.archetype as Archetype;

    // Rule 1: Critical - Inner Circle drifting badly
    if (tier === 'InnerCircle' && currentScore < 30) {
      suggestions.push({
        id: `critical-${friend.id}`,
        friend,
        urgency: 'critical',
        action: ARCHETYPE_ACTIONS[archetype][0],
        archetypeAction: ARCHETYPE_ACTIONS[archetype][0],
        reason: `${friend.name} is drifting away. They value ${ARCHETYPE_VALUES[archetype]}.`,
        icon: '🚨',
        color: '#ef4444',
      });
    }

    // Rule 2: High - Inner Circle needs attention
    else if (tier === 'InnerCircle' && currentScore < 50) {
      suggestions.push({
        id: `high-${friend.id}`,
        friend,
        urgency: 'high',
        action: ARCHETYPE_ACTIONS[archetype][1],
        archetypeAction: ARCHETYPE_ACTIONS[archetype][1],
        reason: `Time to reconnect with ${friend.name}. Keep this bond strong.`,
        icon: '⚠️',
        color: '#f59e0b',
      });
    }

    // Rule 3: Medium - Close Friends maintenance
    else if (tier === 'CloseFriends' && currentScore < 60 && currentScore >= 40) {
      suggestions.push({
        id: `medium-${friend.id}`,
        friend,
        urgency: 'medium',
        action: 'Quick coffee or call',
        reason: `${friend.name} would appreciate hearing from you.`,
        icon: '💛',
        color: '#eab308',
      });
    }

    // Rule 4: Momentum opportunity - riding positive wave
    else if (friend.momentumScore > 10 && currentScore > 60) {
      suggestions.push({
        id: `momentum-${friend.id}`,
        friend,
        urgency: 'medium',
        action: ARCHETYPE_ACTIONS[archetype][2],
        archetypeAction: ARCHETYPE_ACTIONS[archetype][2],
        reason: `You've been connecting well with ${friend.name}. Deepen the bond!`,
        icon: '🌟',
        color: '#8b5cf6',
      });
    }

    // Rule 5: Low - Strengthen thriving bonds
    else if (currentScore > 80) {
      suggestions.push({
        id: `strengthen-${friend.id}`,
        friend,
        urgency: 'low',
        action: 'Plan something meaningful',
        reason: `Your connection with ${friend.name} is thriving. Celebrate it.`,
        icon: '✨',
        color: '#10b981',
      });
    }
  });

  // Sort by urgency
  const urgencyOrder: Record<SuggestionUrgency, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return suggestions
    .sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency])
    .slice(0, 8); // Limit to top 8
}
```

### Step 2: Suggestion Card Component

**New File:** `src/components/SuggestionCard.tsx`

```typescript
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { Suggestion } from '../lib/suggestion-engine';
import { spacing } from '../theme';
import { ChevronRight, X } from 'lucide-react-native';

interface SuggestionCardProps {
  suggestion: Suggestion;
  onDismiss: (id: string) => void;
  onAct: (suggestion: Suggestion) => void;
}

export function SuggestionCard({ suggestion, onDismiss, onAct }: SuggestionCardProps) {
  const { colors } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.content}>
        <Text style={styles.icon}>{suggestion.icon}</Text>
        <View style={styles.textContent}>
          <Text style={[styles.friendName, { color: colors.foreground }]}>
            {suggestion.friend.name}
          </Text>
          <Text style={[styles.action, { color: suggestion.color }]}>
            {suggestion.action}
          </Text>
          <Text style={[styles.reason, { color: colors['muted-foreground'] }]}>
            {suggestion.reason}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => onDismiss(suggestion.id)}
          style={[styles.dismissButton, { borderColor: colors.border }]}
        >
          <X size={16} color={colors['muted-foreground']} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onAct(suggestion)}
          style={[styles.actButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.actButtonText, { color: colors['primary-foreground'] }]}>
            Log Weave
          </Text>
          <ChevronRight size={16} color={colors['primary-foreground']} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
  },
  content: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  icon: { fontSize: 32 },
  textContent: { flex: 1 },
  friendName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  action: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  reason: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  dismissButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
    borderWidth: 1,
  },
  actButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
  },
  actButtonText: { fontSize: 14, fontWeight: '500' },
});
```

### Step 3: Dashboard Integration

**File:** `app/dashboard.tsx`

Add suggestions section above tier tabs:
```typescript
import { generateSuggestions } from '../src/lib/suggestion-engine';
import { SuggestionCard } from '../src/components/SuggestionCard';

function DashboardContent() {
  const suggestions = useMemo(() => {
    return generateSuggestions(allFriends);
  }, [allFriends]);

  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  const visibleSuggestions = suggestions
    .filter(s => !dismissedSuggestions.has(s.id))
    .slice(0, 3); // Show max 3 at a time

  const handleDismiss = (id: string) => {
    setDismissedSuggestions(prev => new Set(prev).add(id));
  };

  const handleAct = (suggestion: Suggestion) => {
    router.push(`/interaction-form?friendId=${suggestion.friend.id}&activity=${suggestion.action}`);
  };

  return (
    <SafeAreaView>
      {/* Header */}

      {visibleSuggestions.length > 0 && (
        <View style={styles.suggestionsSection}>
          <Text style={styles.suggestionsHeader}>Suggested Actions</Text>
          {visibleSuggestions.map(s => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              onDismiss={handleDismiss}
              onAct={handleAct}
            />
          ))}
        </View>
      )}

      {/* Tier tabs... */}
    </SafeAreaView>
  );
}
```

### Implementation Checklist:

- [ ] Create suggestion-engine.ts with rule system
- [ ] Build SuggestionCard component
- [ ] Add suggestions section to dashboard
- [ ] Implement dismiss functionality
- [ ] Implement "act on suggestion" flow
- [ ] Add persistence for dismissed suggestions (AsyncStorage)
- [ ] Test with various friend states (drifting, thriving, momentum)
- [ ] Test all archetypes get appropriate suggestions
- [ ] Polish animations for suggestion cards
- [ ] Add empty state when no suggestions

### Estimated Time: 2-3 weeks

---

## Implementation Guide: Feature #4 (Life Events System)

### Overview
Allows users to tag friends with life events that temporarily modify their Weave Score calculations, adding realism and compassion to relationship tracking.

### Step 1: Database Schema Extension

**File:** `src/db/schema.ts`

Version: 9 → 10

Add new table:
```typescript
tableSchema({
  name: 'life_events',
  columns: [
    { name: 'friend_id', type: 'string', isIndexed: true },
    { name: 'event_type', type: 'string' },
    { name: 'start_date', type: 'number' },
    { name: 'end_date', type: 'number', isOptional: true },
    { name: 'score_multiplier', type: 'number' },
    { name: 'notes', type: 'string', isOptional: true },
    { name: 'is_active', type: 'boolean', defaultValue: true },
    { name: 'created_at', type: 'number' },
  ]
})
```

### Step 2: Life Event Model

**New File:** `src/db/models/LifeEvent.ts`

```typescript
import { Model } from '@nozbe/watermelondb';
import { field, date, readonly } from '@nozbe/watermelondb/decorators';

export type LifeEventType =
  | 'new_baby'
  | 'moved_away'
  | 'new_job'
  | 'health_issue'
  | 'breakup'
  | 'loss'
  | 'wedding'
  | 'travel';

export default class LifeEvent extends Model {
  static table = 'life_events';

  @field('friend_id') friendId!: string;
  @field('event_type') eventType!: LifeEventType;
  @date('start_date') startDate!: Date;
  @date('end_date') endDate?: Date;
  @field('score_multiplier') scoreMultiplier!: number;
  @field('notes') notes?: string;
  @field('is_active') isActive!: boolean;
  @readonly @date('created_at') createdAt!: Date;
}
```

### Step 3: Event Type Library

**New File:** `src/lib/life-event-types.ts`

```typescript
import { LifeEventType } from '../db/models/LifeEvent';

export interface LifeEventTemplate {
  type: LifeEventType;
  label: string;
  icon: string;
  defaultMultiplier: number;
  defaultDuration: number; // days
  description: string;
  suggestions: string[];
}

export const LIFE_EVENT_TEMPLATES: Record<LifeEventType, LifeEventTemplate> = {
  new_baby: {
    type: 'new_baby',
    label: 'New Baby',
    icon: '👶',
    defaultMultiplier: 0.4, // They're very busy
    defaultDuration: 90,
    description: 'They just had a baby and are adjusting to parenthood',
    suggestions: [
      'Send a care package',
      'Offer specific help (meal, errands)',
      'Short text to check in'
    ]
  },
  moved_away: {
    type: 'moved_away',
    label: 'Moved Away',
    icon: '✈️',
    defaultMultiplier: 0.7, // Harder to connect
    defaultDuration: 60,
    description: 'They recently moved to a new city or country',
    suggestions: [
      'Schedule video calls',
      'Plan a visit',
      'Send voice notes'
    ]
  },
  new_job: {
    type: 'new_job',
    label: 'New Job',
    icon: '💼',
    defaultMultiplier: 0.6,
    defaultDuration: 30,
    description: 'Starting a new job and adjusting',
    suggestions: [
      'Quick encouragement text',
      'Coffee break call',
      'Celebrate after first month'
    ]
  },
  health_issue: {
    type: 'health_issue',
    label: 'Health Issue',
    icon: '🏥',
    defaultMultiplier: 1.5, // They need support
    defaultDuration: 60,
    description: 'Dealing with a health challenge',
    suggestions: [
      'Check in regularly',
      'Offer practical help',
      'Be present and listen'
    ]
  },
  loss: {
    type: 'loss',
    label: 'Loss/Grief',
    icon: '💔',
    defaultMultiplier: 2.0, // Very important to stay connected
    defaultDuration: 90,
    description: 'Experiencing grief or loss',
    suggestions: [
      'Be consistently present',
      'Don\'t wait for them to ask',
      'Remember significant dates'
    ]
  },
  breakup: {
    type: 'breakup',
    label: 'Breakup',
    icon: '💔',
    defaultMultiplier: 1.3,
    defaultDuration: 45,
    description: 'Going through a relationship ending',
    suggestions: [
      'Make time to listen',
      'Plan distracting activities',
      'Regular check-ins'
    ]
  },
  wedding: {
    type: 'wedding',
    label: 'Wedding Planning',
    icon: '💍',
    defaultMultiplier: 0.5,
    defaultDuration: 60,
    description: 'Busy planning their wedding',
    suggestions: [
      'Offer to help if appropriate',
      'Be understanding of their time',
      'Celebrate the excitement'
    ]
  },
  travel: {
    type: 'travel',
    label: 'Extended Travel',
    icon: '🌍',
    defaultMultiplier: 0.8,
    defaultDuration: 30,
    description: 'Away traveling for an extended period',
    suggestions: [
      'Send travel messages',
      'Share photos',
      'Plan reunion when back'
    ]
  },
};
```

### Step 4: Update Weave Engine

**File:** `src/lib/weave-engine.ts`

Add life event multiplier to score calculation:

```typescript
import LifeEvent from '../db/models/LifeEvent';
import { Q } from '@nozbe/watermelondb';

async function getActiveLifeEvents(friend: FriendModel): Promise<LifeEvent[]> {
  const now = Date.now();
  return await database.get<LifeEvent>('life_events')
    .query(
      Q.where('friend_id', friend.id),
      Q.where('is_active', true),
      Q.where('start_date', Q.lte(now)),
      Q.or(
        Q.where('end_date', Q.gte(now)),
        Q.where('end_date', null)
      )
    )
    .fetch();
}

export async function calculatePointsForWeave(
  friend: FriendModel,
  weaveData: { interactionType: InteractionType; duration: Duration | null; vibe: Vibe | null }
): Promise<number> {
  // ... existing logic ...

  const activeEvents = await getActiveLifeEvents(friend);
  const eventMultiplier = activeEvents.reduce((mult, event) =>
    mult * event.scoreMultiplier, 1.0
  );

  return finalPoints * eventMultiplier;
}
```

### Step 5: Life Event UI Components

**New File:** `src/components/LifeEventBadge.tsx`

Small badge shown on friend card when event is active.

**New File:** `src/components/AddLifeEventModal.tsx`

Modal for adding/editing life events with:
- Event type selector
- Custom date range
- Multiplier adjustment
- Notes field
- Auto-end date calculation

### Step 6: Friend Profile Integration

**File:** `app/friend-profile.tsx`

Add section showing active life events:
```typescript
<View style={styles.lifeEventsSection}>
  <Text style={styles.sectionHeader}>Life Events</Text>
  {activeLifeEvents.map(event => (
    <LifeEventCard key={event.id} event={event} />
  ))}
  <TouchableOpacity onPress={() => setShowAddEventModal(true)}>
    <Text>+ Add Life Event</Text>
  </TouchableOpacity>
</View>
```

### Implementation Checklist:

- [ ] Schema migration v9 → v10
- [ ] Create LifeEvent model
- [ ] Build life event templates library
- [ ] Update weave engine with multiplier logic
- [ ] Create LifeEventBadge component
- [ ] Create AddLifeEventModal component
- [ ] Integrate with friend profile
- [ ] Add visual indicator on friend cards
- [ ] Test score calculations with multiple events
- [ ] Test event expiration logic

### Estimated Time: 2 weeks

---

## Implementation Guide: Feature #5 (Calendar Sync - Phase 1)

### Overview
Semi-automated system that scans device calendar for potential interactions with friends and suggests logging them as weaves.

### Step 1: Setup Calendar Permissions

**Install Dependencies:**
```bash
npx expo install expo-calendar
```

**File:** `src/lib/calendar-manager.ts`

```typescript
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';

export async function requestCalendarPermissions(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === 'granted';
  }
  return true; // Android handles differently
}

export async function getDefaultCalendar(): Promise<Calendar.Calendar | null> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars.find(cal => cal.isPrimary) || calendars[0] || null;
}
```

### Step 2: Calendar Event Scanner

**New File:** `src/lib/calendar-scanner.ts`

```typescript
import * as Calendar from 'expo-calendar';
import FriendModel from '../db/models/Friend';
import { database } from '../db';

export interface PotentialWeave {
  event: Calendar.Event;
  matchedFriends: FriendModel[];
  suggestedActivity: string;
  confidence: 'high' | 'medium' | 'low';
}

export async function scanCalendarForWeaves(
  startDate: Date,
  endDate: Date = new Date()
): Promise<PotentialWeave[]> {
  const calendars = await Calendar.getCalendarsAsync();
  const friends = await database.get<FriendModel>('friends').query().fetch();

  const events = await Calendar.getEventsAsync(
    calendars.map(c => c.id),
    startDate,
    endDate
  );

  const potentialWeaves: PotentialWeave[] = [];

  for (const event of events) {
    const matched = matchEventToFriends(event, friends);
    if (matched.length > 0) {
      potentialWeaves.push({
        event,
        matchedFriends: matched,
        suggestedActivity: inferActivity(event),
        confidence: calculateConfidence(event, matched),
      });
    }
  }

  return potentialWeaves;
}

function matchEventToFriends(
  event: Calendar.Event,
  friends: FriendModel[]
): FriendModel[] {
  const matched: FriendModel[] = [];
  const eventText = `${event.title} ${event.notes || ''}`.toLowerCase();

  for (const friend of friends) {
    // Simple name matching (can be improved)
    const nameParts = friend.name.toLowerCase().split(' ');
    const hasMatch = nameParts.some(part =>
      part.length > 2 && eventText.includes(part)
    );

    if (hasMatch) {
      matched.push(friend);
    }

    // Check attendees if available
    if (event.attendees) {
      const attendeeMatch = event.attendees.some(a =>
        a.name?.toLowerCase().includes(friend.name.toLowerCase())
      );
      if (attendeeMatch && !matched.includes(friend)) {
        matched.push(friend);
      }
    }
  }

  return matched;
}

function inferActivity(event: Calendar.Event): string {
  const title = event.title.toLowerCase();

  if (title.includes('lunch') || title.includes('dinner') || title.includes('breakfast')) {
    return 'Meal';
  }
  if (title.includes('coffee') || title.includes('cafe')) {
    return 'Coffee';
  }
  if (title.includes('call') || title.includes('zoom') || title.includes('meet')) {
    return 'Call';
  }
  if (title.includes('walk') || title.includes('hike') || title.includes('run')) {
    return 'Walk';
  }

  return 'Hangout';
}

function calculateConfidence(
  event: Calendar.Event,
  matched: FriendModel[]
): 'high' | 'medium' | 'low' {
  let score = 0;

  // Has attendees = more confident
  if (event.attendees && event.attendees.length > 0) score += 2;

  // Matched multiple friends = less confident (might be group)
  if (matched.length === 1) score += 2;
  else if (matched.length <= 3) score += 1;

  // Duration suggests social interaction
  if (event.endDate && event.startDate) {
    const duration = (event.endDate.getTime() - event.startDate.getTime()) / 60000;
    if (duration >= 30 && duration <= 240) score += 1;
  }

  if (score >= 4) return 'high';
  if (score >= 2) return 'medium';
  return 'low';
}
```

### Step 3: Calendar Sync UI

**New File:** `src/components/CalendarSyncModal.tsx`

Modal showing:
- List of detected potential weaves
- Swipeable cards (right = log, left = dismiss)
- Ability to adjust details before saving
- Confidence indicators

### Step 4: Weekly Reflection Integration

**File:** `src/components/WeeklyReflection/MissedConnectionsList.tsx`

Add "Scan Calendar" button:
```typescript
<TouchableOpacity onPress={handleCalendarScan}>
  <Calendar size={20} />
  <Text>Scan Calendar for Missed Weaves</Text>
</TouchableOpacity>
```

### Implementation Checklist:

- [ ] Install expo-calendar
- [ ] Create calendar-manager.ts
- [ ] Build calendar-scanner.ts with matching logic
- [ ] Create CalendarSyncModal component
- [ ] Add swipe-to-log interaction
- [ ] Integrate with weekly reflection
- [ ] Test name matching accuracy
- [ ] Test activity inference
- [ ] Add user feedback loop (learn from corrections)
- [ ] Handle edge cases (all-day events, recurring events)

### Estimated Time: 3 weeks

---

## Development Strategy & Phasing

### Phase 1: Core Usability (Weeks 1-4)
**Goal:** Make the app essential for daily use

**Features:**
1. ✅ Post-Weave Reflection & Editing (Week 1-2)
2. ✅ Quick Win: Dashboard stats widget (Week 2)

**Success Metrics:**
- Users edit at least 1 interaction per week
- 60% of quick-touch weaves include reflections
- Average session length increases by 20%

### Phase 2: Engagement Loop (Weeks 5-10)
**Goal:** Create retention through ritual

**Features:**
1. ✅ Weekly Reflection Ritual (Week 5-7)
2. ✅ Context-Aware Suggestions (Week 8-10)
3. ✅ Quick Win: Drifting friend notifications (Week 7)

**Success Metrics:**
- 40%+ weekly reflection completion rate
- 25%+ suggestion acceptance rate
- D7 retention increases to 60%+

### Phase 3: Intelligence & Automation (Weeks 11-16)
**Goal:** Reduce friction, increase accuracy

**Features:**
1. ✅ Life Events System (Week 11-12)
2. ✅ Calendar Sync Phase 1 (Week 13-16)

**Success Metrics:**
- 30%+ of users add life events to friends
- 50%+ of calendar suggestions accepted
- Average weaves logged per week increases by 40%

### Phase 4: Delight & Differentiation (Weeks 17+)
**Goal:** Premium experience and virality

**Features:**
1. Deep Weave Guided Reflection
2. Ambient Data Visualization
3. Mindful Gamification
4. Share-worthy "Year in Weave" recap

---

## Key Technical Risks & Mitigations

### Risk 1: WatermelonDB Schema Migrations
**Concern:** Breaking user data during updates

**Mitigation:**
- Comprehensive migration testing with mock data
- Backup/restore mechanism before each migration
- Gradual rollout with version checks
- Migration rollback capability

### Risk 2: Calendar Sync Privacy Concerns
**Concern:** Users uncomfortable with calendar access

**Mitigation:**
- Clear, transparent permission dialogs
- Explain exactly what data is accessed
- Make sync completely optional
- Local-only processing, no cloud upload
- Easy disable/revoke

### Risk 3: Notification Fatigue
**Concern:** Too many notifications annoy users

**Mitigation:**
- Weekly reflection as primary notification
- Drifting friend alerts limited to Inner Circle only
- Smart timing (not during work hours)
- Easy opt-out in settings
- Gentle, encouraging tone

### Risk 4: Performance with Large Friend Lists
**Concern:** Slow calculations with 150+ friends

**Mitigation:**
- Lazy loading of friend lists
- Memoized suggestion calculations
- Indexed database queries
- Background processing for non-urgent calculations
- Pagination on community tier

---

## Conclusion & Recommended First Steps

Based on this analysis, here's the recommended immediate action plan:

### Week 1-2: Implement Feature #1 (Post-Weave Reflection & Editing)
**Why:** Lowest complexity, highest immediate user value, foundation for future features

**Action Items:**
1. Create schema migration (v8 → v9)
2. Update Interaction model and store
3. Build reflection prompt UI
4. Add edit button to interaction detail modal
5. Test with existing data

### Week 3: User Testing & Feedback
**Dogfood the reflection feature internally**
- Does it feel natural?
- Is the reflection prompt intrusive or helpful?
- Quality rating - valuable or noise?

### Week 4: Decision Point
Based on user feedback:
- **If reflections are valuable:** Proceed to Feature #2 (Weekly Ritual)
- **If calendar sync is more urgent:** Skip to Feature #5
- **If suggestions would help adoption:** Jump to Feature #3

### Success Looks Like:
After 3 months:
- Core app is stable and delightful
- Features #1-3 shipped and adopted
- Positive user feedback on intelligent suggestions
- Clear data showing increased engagement
- Foundation laid for calendar sync
- Roadmap validated through user behavior

The key is **iterative development** - ship fast, learn, adjust. Don't build everything before getting user feedback.
