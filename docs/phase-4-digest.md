# Phase 4 Prompt: Evening Digest

Copy this entire prompt into a new Claude conversation along with your notification files and the TodaysFocusWidgetV2 component.

---

## Context

I'm building Weave, a friendship tracking app. I have a "Today's Focus" widget that surfaces:
- Today's plans (interactions scheduled for today)
- Pending confirmations (past plans not yet marked complete)
- Suggestions (friends to reach out to)
- Upcoming dates (birthdays, life events in next 7-30 days)

I want to create an **Evening Digest** notification that delivers this same information at a user-chosen time, so they don't have to open the app to stay on top of their friendships.

## Design Philosophy

- **Sparse**: If there's nothing meaningful, don't send anything
- **Consolidated**: One notification instead of many scattered ones
- **Actionable**: Tapping opens a focused view, not just the app
- **Respectful**: User controls the time, can disable entirely

## Task

### Part 1: Digest Content Generator

Create `src/modules/notifications/services/channels/evening-digest.ts`:

```typescript
export interface DigestItem {
  type: 'plan' | 'confirmation' | 'suggestion' | 'birthday' | 'life_event' | 'memory';
  priority: number;  // Higher = more important
  title: string;
  subtitle?: string;
  friendId?: string;
  friendName?: string;
  interactionId?: string;
  data?: Record<string, any>;
}

export interface DigestContent {
  items: DigestItem[];
  notificationTitle: string;
  notificationBody: string;
  shouldSend: boolean;
}

export const EveningDigestChannel = {
  // Generate digest content (reuses TodaysFocus logic)
  generateContent: async (): Promise<DigestContent> => { ... },
  
  // Schedule the digest notification
  schedule: async (time: string): Promise<void> => { ... },
  
  // Cancel scheduled digest
  cancel: async (): Promise<void> => { ... },
  
  // Handle notification tap
  handleTap: (data: NotificationData, router: any): void => { ... },
};
```

**Content Generation Rules:**

Priority order (highest first):
1. `priority: 100` - Today's plans not yet confirmed
2. `priority: 90` - Birthdays today or tomorrow  
3. `priority: 80` - Critical/high importance life events this week
4. `priority: 70` - Pending confirmations from past days
5. `priority: 60` - Memory nudges (1 year ago entries)
6. `priority: 50` - High urgency suggestions (fading close friends)
7. `priority: 40` - Medium urgency suggestions
8. `priority: 30` - Upcoming birthdays (3-7 days)
9. `priority: 20` - Other life events

**Notification Copy Generation:**

```typescript
// 1 item
{ title: "Sarah's birthday tomorrow", body: "Tap to see details" }

// 2-3 items, lead with highest priority
{ title: "2 things for today", body: "Sarah's birthday + 1 suggestion" }

// 4+ items
{ title: "Your evening check-in", body: "3 plans, 1 birthday, 2 suggestions" }

// Nothing meaningful
{ shouldSend: false }
```

**"Nothing meaningful" criteria:**
- No plans for today/tomorrow
- No pending confirmations
- No birthdays within 3 days
- No high/critical life events within 7 days
- No high-urgency suggestions
- Already sent digest with same items in last 24h

### Part 2: Digest Detail Sheet

Create `src/components/DigestSheet.tsx`:

A bottom sheet that opens when user taps the digest notification. Similar to `FocusDetailSheet` but:
- Opens as a modal/sheet over current screen
- Can be opened from anywhere in the app (not just home)
- Shows the digest items grouped by type
- Each item is tappable to take action

**Visual Structure:**
```
┌─────────────────────────────────────┐
│  ━━━  (drag handle)                 │
│                                     │
│  Evening Check-in                   │
│  Tuesday, December 10               │
│                                     │
│  ─── Plans ───                      │
│  ☐ Coffee with Marcus • 3pm        │
│  ☐ Call Mom • 6pm                  │
│                                     │
│  ─── Coming Up ───                  │
│  🎂 Sarah's birthday tomorrow       │
│                                     │
│  ─── Suggestions ───                │
│  💭 It's been 6 weeks since Tom     │
│                                     │
│  ─── Memories ───                   │
│  ✨ One year ago with Dad           │
│                                     │
└─────────────────────────────────────┘
```

**Interactions:**
- Plan item tap → navigate to plan detail or confirm flow
- Birthday tap → navigate to friend profile
- Suggestion tap → navigate to friend profile
- Memory tap → open MemoryMomentModal (from Phase 3)

### Part 3: User Settings

Add to user preferences/settings:

```typescript
interface DigestSettings {
  enabled: boolean;
  time: string;  // "19:00" format
  includeSuggestions: boolean;  // Some users may only want concrete items
  includeMemories: boolean;
}
```

Default: `{ enabled: true, time: "19:00", includeSuggestions: true, includeMemories: true }`

### Part 4: Smart Suppression

Add logic to prevent annoying patterns:

1. **Same-content suppression**: Hash the digest items, don't resend if identical to yesterday
2. **Recent activity suppression**: If user opened app in last 2 hours, skip tonight's digest
3. **Consecutive skip detection**: If user ignores 3 digests in a row (no tap), reduce to every-other-day
4. **Weekend awareness**: Optional setting to skip weekends (some people have different social patterns)

Store suppression state in `NotificationStore`:
```typescript
{
  lastDigestHash: string;
  lastDigestSent: number;
  consecutiveIgnored: number;
  lastDigestTapped: number;
}
```

### Part 5: Integration

**Scheduling:**
- On app launch, schedule next digest based on user's preferred time
- Reschedule after each digest fires
- Cancel and reschedule if user changes time in settings

**UIStore addition:**
```typescript
interface UIState {
  // ... existing
  digestSheetVisible: boolean;
  digestItems: DigestItem[];
  openDigestSheet: (items: DigestItem[]) => void;
  closeDigestSheet: () => void;
}
```

**Response handler:**
```typescript
function handleDigestNotification(data: NotificationData): void {
  // Parse items from notification data (or regenerate fresh)
  const items = await EveningDigestChannel.generateContent();
  useUIStore.getState().openDigestSheet(items.items);
}
```

### Part 6: Analytics

Track:
```typescript
// When digest is generated
analytics.track('digest_generated', { 
  itemCount: number,
  itemTypes: string[],  // ['plan', 'birthday', 'suggestion']
  shouldSend: boolean,
  suppressionReason?: string  // 'same_content' | 'recent_activity' | 'consecutive_ignored'
});

// When digest is sent
analytics.track('digest_sent', { itemCount: number, itemTypes: string[] });

// When digest is tapped
analytics.track('digest_tapped', { secondsSinceSent: number });

// When user acts on a digest item
analytics.track('digest_item_action', { itemType: string, action: string });

// When digest is dismissed without action
analytics.track('digest_dismissed', { method: 'swipe' | 'clear_all' | 'timeout' });
```

## Files to Read First

**Existing focus logic:**
- `src/components/home/widgets/TodaysFocusWidgetV2.tsx` - the logic to reuse
- `src/components/FocusDetailSheet.tsx` - the existing detail view

**Notifications:**
- `src/modules/notifications/services/notification-manager-enhanced.ts`
- `src/modules/notifications/services/notification-store.ts` (if Phase 2 complete)
- `src/modules/notifications/services/notification-response-handler.ts`

**Suggestions:**
- `src/modules/interactions/hooks/useSuggestions.ts` (or wherever suggestion generation lives)

**Settings:**
- Wherever user preferences are stored (UserProfile model or settings store)

## Deliverables

1. `evening-digest.ts` - complete channel implementation
2. `DigestSheet.tsx` - the detail sheet component
3. Settings UI additions (or notes on where to add)
4. `notification-response-handler.ts` updates
5. UIStore additions
6. Analytics instrumentation

## Key Constraints

- Reuse `TodaysFocusWidgetV2` logic where possible - don't duplicate
- Extract shared logic into a `generateFocusItems()` function both can use
- Digest should feel like a natural extension of Today's Focus, not a separate system
- If Phase 2 architecture is complete, follow that structure
- If Phase 3 memory nudges are complete, integrate them into digest
