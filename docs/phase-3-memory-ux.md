# Phase 3 Prompt: Memory Nudge UX

Copy this entire prompt into a new Claude conversation along with your journal and notification files.

---

## Context

I'm building Weave, a friendship tracking app with a journal feature. I have "memory nudges" - notifications that surface journal entries from one year ago. Currently they're broken: tapping them just opens the weekly reflection modal with a TODO comment.

I want to create a dedicated, emotionally resonant experience for memory surfacing.

## Current State

**What exists:**
- `JournalEntry` model with `entryDate`, `content`, `title`, friend links via `JournalEntryFriend`
- `WeeklyReflection` model with `weekStartDate`, `gratitudeText`, `storyChips`
- `getMemories()` in `journal-context-engine.ts` that finds anniversary entries
- `scheduleMemoryNudges()` in `notification-manager-enhanced.ts`
- `handleMemoryNudgeNotification()` in response handler that just opens `WeeklyReflectionModal`

**What's broken:**
- Memory nudge opens wrong modal
- No dedicated UI for the memory moment
- Anniversary detection only checks ±3 days (should be ±7 for weekly reflections)
- Notification copy is generic, not friend-aware

## Task

Create a complete memory nudge experience.

### Part 1: Create MemoryMomentModal

Create `src/components/Journal/MemoryMomentModal.tsx`:

**Design:**
```
┌─────────────────────────────────────┐
│  ✨ One year ago this week          │  ← Animated sparkle
│                                     │
│  ┌─────────────────────────────┐    │
│  │ "Had coffee with Marcus.    │    │  ← Entry preview card
│  │  He's going through a       │    │     with subtle border
│  │  rough patch at work..."    │    │
│  └─────────────────────────────┘    │
│                                     │
│  📅 December 8, 2024                │  ← Metadata row
│  👤 Marcus                          │
│                                     │
│  ┌─────────────┐ ┌─────────────┐   │
│  │ Read entry  │ │ Write now   │   │  ← Action buttons
│  └─────────────┘ └─────────────┘   │
│                                     │
│           Maybe later               │  ← Dismiss link
└─────────────────────────────────────┘
```

**Props:**
```typescript
interface MemoryMomentModalProps {
  visible: boolean;
  onClose: () => void;
  memory: Memory | null;  // From journal-context-engine types
  entry?: JournalEntry | WeeklyReflection | null;  // The actual entry
  friendName?: string;
}
```

**Behavior:**
- "Read entry" → calls `onReadEntry` prop, parent opens appropriate detail modal
- "Write now" → calls `onWriteAbout` prop, parent opens `GuidedReflectionModal` with context
- "Maybe later" → closes modal, optionally tracks dismissal
- Animate in with `FadeIn` + `SlideInUp`
- Use `Lora` for title, `Inter` for body (matching your design system)
- Use your existing `useTheme()` hook for colors

### Part 2: Enhance Memory Detection

Modify `src/modules/journal/services/journal-context-engine.ts`:

Update `getAnniversaryMemories()`:
- Expand window to ±7 days (not ±3)
- Prioritize entries with friend tags over general entries
- Prioritize entries with substantial content (>100 chars)
- Add "first entry anniversary" detection (1 year since first entry about a friend)
- Return richer data including the full entry reference

Add new function:
```typescript
export async function getMemoryForNotification(
  entryId: string,
  entryType: 'journal' | 'reflection'
): Promise<{
  memory: Memory;
  entry: JournalEntry | WeeklyReflection;
  friendName?: string;
} | null>
```

### Part 3: Create Memory Nudge Channel

Create `src/modules/notifications/services/channels/memory-nudge.ts` (or modify existing):

```typescript
export const MemoryNudgeChannel = {
  // Check for memories and schedule nudges
  scheduleDaily: async (): Promise<void> => { ... },
  
  // Cancel all memory nudges
  cancel: async (): Promise<void> => { ... },
  
  // Handle notification tap - returns data needed for modal
  handleTap: async (data: NotificationData): Promise<{
    memory: Memory;
    entry: JournalEntry | WeeklyReflection;
    friendName?: string;
  } | null> => { ... },
  
  // Generate notification content based on entry type
  generateContent: (memory: Memory, friendName?: string): {
    title: string;
    body: string;
  } => { ... },
};
```

**Content generation rules:**
```typescript
// Friend-tagged journal entry
{ title: "Marcus, one year ago", body: "You wrote about coffee and his work struggles" }

// Weekly reflection
{ title: "Your reflection from December 2024", body: "A week of 8 weaves and gratitude" }

// First entry anniversary
{ title: "1 year of writing about Marcus", body: "Your first journal entry about this friendship" }

// Generic entry
{ title: "A memory from last year", body: "[first 50 chars of content]..." }
```

### Part 4: Update Response Handler

Modify `notification-response-handler.ts`:

Replace `handleMemoryNudgeNotification`:
```typescript
async function handleMemoryNudgeNotification(data: NotificationData): Promise<void> {
  // Get memory data
  const memoryData = await MemoryNudgeChannel.handleTap(data);
  
  if (!memoryData) {
    // Entry was deleted, navigate to journal home
    router.push('/(tabs)/journal');
    return;
  }
  
  // Store in global state for modal to pick up
  useUIStore.getState().openMemoryMoment(memoryData);
}
```

### Part 5: Add to UIStore

Add to your existing `uiStore.ts`:
```typescript
interface UIState {
  // ... existing
  memoryMomentData: MemoryMomentData | null;
  openMemoryMoment: (data: MemoryMomentData) => void;
  closeMemoryMoment: () => void;
}
```

### Part 6: Integrate with JournalHome

Modify `src/components/Journal/JournalHome.tsx`:

Update `renderMemoryCard()`:
- On tap, fetch full entry data
- Open `MemoryMomentModal` instead of calling `onMemoryAction`

Add `MemoryMomentModal` to the component's render.

### Part 7: Add Anniversary Badges to FriendshipArcView

Modify `src/components/Journal/FriendshipArcView.tsx`:

In the timeline rendering:
- Check if entry date is ~1 year ago from today
- If so, add a "✨ 1 year ago" badge to the entry card
- Use subtle styling (small text, muted color with primary accent)

### Part 8: Analytics Integration

Add tracking (assumes Phase 1 is complete):
```typescript
// When memory nudge notification is scheduled
analytics.track('notification_scheduled', { type: 'memory-nudge', hasFrend: !!friendName });

// When memory modal is opened
analytics.track('memory_moment_opened', { source: 'notification' | 'journal_home', entryType });

// When user takes action
analytics.track('memory_moment_action', { action: 'read' | 'write' | 'dismiss' });
```

## Files to Read First

**Journal:**
- `src/components/Journal/JournalHome.tsx`
- `src/components/Journal/FriendshipArcView.tsx`
- `src/components/Journal/JournalEntryModal.tsx`
- `src/components/Journal/GuidedReflectionModal.tsx`
- `src/modules/journal/services/journal-context-engine.ts`

**Notifications:**
- `src/modules/notifications/services/notification-manager-enhanced.ts` (search for "memory")
- `src/modules/notifications/services/notification-response-handler.ts`
- `src/stores/uiStore.ts` (if exists, for global state pattern)

**Models:**
- `src/db/models/JournalEntry.ts`
- `src/db/models/WeeklyReflection.ts`

## Deliverables

1. `MemoryMomentModal.tsx` - complete component
2. Updated `journal-context-engine.ts` - enhanced memory detection
3. `memory-nudge.ts` channel file (or modifications to existing)
4. Updated `notification-response-handler.ts`
5. Updated `JournalHome.tsx` - modal integration
6. Updated `FriendshipArcView.tsx` - anniversary badges
7. Any UIStore changes needed

## Design Requirements

- Match existing Weave aesthetic (Lora headers, Inter body, rounded corners, subtle shadows)
- Use existing color tokens from `useTheme()`
- Animations should be gentle (200-400ms), not flashy
- Modal should feel like a "moment" - not utilitarian
- Preview text should be truncated elegantly with "..."
