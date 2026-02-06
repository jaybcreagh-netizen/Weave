# Weave Notification System Roadmap

## Overview

This document outlines a four-phase improvement plan for Weave's notification system, covering analytics instrumentation, architecture consolidation, memory nudge UX, and evening digest.

**Current State (Dec 2024):** Mature notification system with centralized architecture, channel-based design, analytics instrumentation, memory nudge UX, and evening digest. Most phases complete.

**Phase Status:**
- ✅ Phase 1: Analytics Foundation - Complete
- ✅ Phase 2: Architecture Consolidation - Complete  
- ✅ Phase 3: Memory Nudge UX - Complete
- ✅ Phase 4: Evening Digest - Complete

---

## Phase 1: Analytics Foundation ✅

### Goal
Instrument notifications so you can answer: "Which notifications drive engagement vs. annoyance?"

### Key Metrics to Track

| Event | Properties | Why It Matters |
|-------|------------|----------------|
| `notification_scheduled` | `type`, `urgency`, `friendId`, `delayMinutes` | Volume baseline |
| `notification_delivered` | `type`, `notificationId` | Delivery rate |
| `notification_tapped` | `type`, `notificationId`, `secondsSinceDelivery` | Engagement signal |
| `notification_dismissed` | `type`, `notificationId`, `method` (swipe/clear-all) | Friction signal |
| `notification_action_completed` | `type`, `notificationId`, `action` (logged_interaction, opened_journal, etc.) | Conversion |
| `notification_permission_requested` | `source` (onboarding/settings/prompt) | Funnel tracking |
| `notification_permission_result` | `granted`, `canAskAgain` | Permission health |
| `notifications_disabled_in_settings` | `previouslyEnabled`, `daysSinceInstall` | Churn signal |

### Derived Metrics (Calculate in PostHog)
- **Tap-through rate:** `notification_tapped / notification_delivered`
- **Conversion rate:** `notification_action_completed / notification_tapped`
- **Annoyance ratio:** `notifications_disabled_in_settings / total_users_with_notifications`
- **Time-to-action:** Average `secondsSinceDelivery` for tapped notifications

### Implementation Approach
1. Create a `NotificationAnalytics` service that wraps PostHog calls
2. Instrument at scheduling, delivery (via notification listeners), and response handler
3. Track permission flow separately in the modal component
4. Store `notificationId` in AsyncStorage temporarily to correlate delivery → tap → action

### Success Criteria
- Can see notification funnel in PostHog within 1 week of beta
- Can identify which `type` has highest/lowest tap-through
- Can see if `urgency` correlates with engagement

---

## Phase 2: Architecture Consolidation ✅

### Goal
Unify scattered notification logic into a maintainable structure before adding features.

### Current Problems
1. **Scattered AsyncStorage keys** across 3+ files
2. **Duplicate permission functions** (deprecated but still present)
3. **No central registry** of scheduled notifications
4. **No clear trigger** for `evaluateAndScheduleSmartNotifications`
5. **Timezone assumptions** hardcoded to device locale
6. **14-day batch gap** - notifications expire silently if user doesn't open app

### Target Architecture

```
src/modules/notifications/
├── index.ts                          # Public exports
├── services/
│   ├── notification-orchestrator.ts  # NEW: Central brain
│   ├── notification-store.ts         # NEW: All AsyncStorage in one place
│   ├── notification-analytics.ts     # NEW: PostHog wrapper
│   ├── permission.service.ts         # Keep (already clean)
│   ├── notification-scheduler.ts     # Renamed from smart-notification-scheduler
│   ├── notification-content.ts       # NEW: Copy/tone generation
│   └── channels/
│       ├── battery-checkin.ts        # Extract from manager-enhanced
│       ├── weekly-reflection.ts      # Extract from manager-enhanced
│       ├── event-reminder.ts         # Extract from manager-enhanced
│       ├── deepening-nudge.ts        # Extract from manager-enhanced
│       ├── memory-nudge.ts           # Extract + enhance
│       └── event-suggestion.ts       # Keep (already separate)
├── hooks/
│   └── useNotificationPermissions.ts # Keep
├── components/
│   └── NotificationPermissionModal.tsx # Move from components/
└── types.ts                          # Shared types
```

### Key Changes

#### 1. NotificationStore (Single Source of Truth)
```typescript
// All keys in one place
const STORAGE_KEYS = {
  lastReflectionDate: '@weave:last_reflection_date',
  deepeningNudges: '@weave:deepening_nudges',
  initialized: '@weave:notifications_initialized',
  lastMemoryCheck: '@weave:last_memory_check',
  smartNotificationLast: '@weave:last_smart_notification',
  smartNotificationCount: '@weave:smart_notification_count',
  scheduledSmartNotifications: '@weave:scheduled_smart_notifications',
  permissionRequested: '@weave:notification_permission_requested',
  userTimezone: '@weave:user_timezone',
} as const;
```

#### 2. NotificationOrchestrator (Central Brain)
- Single `initialize()` called on app launch
- Single `evaluateAndSchedule()` called on app foreground + after interactions
- Owns the "should we notify?" decision tree
- Delegates to channel-specific schedulers

#### 3. Channel Extraction
Each notification type becomes its own file with:
- `schedule(params)` - Schedule this notification type
- `cancel(id?)` - Cancel one or all of this type
- `getScheduled()` - List pending of this type
- `handleTap(data)` - Navigation logic for this type

#### 4. Remove Dead Code
- Delete deprecated `requestEventSuggestionPermissions`
- Delete deprecated `requestNotificationPermissions`
- Remove duplicate permission logic

### Migration Strategy
1. Create new files alongside existing
2. Move logic function-by-function with tests
3. Update imports in consuming code
4. Delete old files only after verification

### Success Criteria
- Can answer "what notifications will fire in next 24h?" with one function call
- No duplicate AsyncStorage keys
- No deprecated functions
- Clear ownership of each notification type

---

## Phase 3: Memory Nudge UX ✅

### Goal
Transform memory nudges from "opens weekly reflection modal" into a dedicated, emotionally resonant experience tied to the journal.

### Implementation Status: Complete

**Current Flow (Implemented):**
```
Memory nudge notification → MemoryNudgeChannel.handleTap()
                         → getMemoryForNotification() fetches entry + friend context
                         → UIEventBus.emit('OPEN_MEMORY_MOMENT')
                         → GlobalModals renders MemoryMomentModal
                         → User actions: "Read Entry" / "Write About This"
```

**Key Files:**
- `channels/memory-nudge.ts` - Scheduling + handleTap with full data passing
- `journal-context-engine.ts` - `getMemoryForNotification()` fetches entry, friend context
- `ui-event-bus.ts` - `OPEN_MEMORY_MOMENT` event with `MemoryMomentData` type
- `GlobalModals.tsx` - Subscribes to UIEventBus, renders MemoryMomentModal
- `MemoryMomentModal.tsx` - Dedicated modal with Read/Write actions

### Design Spec (Reference)

#### MemoryMomentModal
A dedicated modal that surfaces when user taps a memory nudge or when `JournalHome` detects a surfaceable memory.

**Visual Structure:**
```
┌─────────────────────────────────────┐
│  ✨ One year ago this week          │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ "Had coffee with Marcus.    │    │
│  │  He's going through a       │    │
│  │  rough patch at work..."    │    │
│  └─────────────────────────────┘    │
│                                     │
│  📅 December 8, 2024                │
│  👤 Marcus                          │
│                                     │
│  ┌─────────────┐ ┌─────────────┐   │
│  │ Read entry  │ │ Write now   │   │
│  └─────────────┘ └─────────────┘   │
│                                     │
│           Maybe later               │
└─────────────────────────────────────┘
```

**Data Sources:**
- `JournalEntry` from 1 year ago (±7 days)
- `WeeklyReflection` from 1 year ago (±7 days)
- Friend context via `JournalEntryFriend` join

**Actions:**
1. **Read entry** → Opens `JournalEntryModal` or `WeeklyReflectionDetailModal`
2. **Write now** → Opens `GuidedReflectionSheet` (prompted flow) with prefilled friend + "A year ago, you wrote..." context
3. **Maybe later** → Dismisses, optionally reschedules for tomorrow

#### Integration Points

1. **Notification tap** → `handleMemoryNudgeNotification` opens `MemoryMomentModal`
2. **JournalHome** → Memory card already exists, enhance to open `MemoryMomentModal` on tap
3. **FriendshipArcView** → Add "1 year ago" badges on timeline entries

#### Enhanced Memory Detection

Current `getAnniversaryMemories()` only checks ±3 days. Enhance to:
- Check ±7 days for weekly reflections (they're weekly, after all)
- Prioritize entries with friend tags over general entries
- Prioritize entries with substantial content (>100 chars)
- Include "first entry" anniversaries (1 year since you started writing about X)

#### Notification Content Upgrade

Current:
```
Title: "🌙 A year ago this week..."
Body: [preview text]
```

Enhanced (urgency-aware):
```
// For friend-tagged entries
Title: "Marcus, one year ago"
Body: "You wrote about coffee and his work struggles"

// For weekly reflections
Title: "Your reflection from December 2024"
Body: "A week of 8 weaves and gratitude for..."

// For milestone (first entry anniversary)
Title: "1 year of documenting Marcus"
Body: "Your first journal entry about this friendship"
```

### Implementation Order
1. Create `MemoryMomentModal` component
2. Create `memory-nudge.ts` channel file with enhanced detection
3. Update `notification-response-handler.ts` to use new modal
4. Enhance `JournalHome` memory card to use same modal
5. Add "1 year ago" badges to `FriendshipArcView`
6. Instrument with analytics

### Success Criteria
- Memory nudge tap opens dedicated modal (not weekly reflection)
- User can navigate to original entry or start new reflection
- Analytics show memory nudge → journal entry conversion rate
- FriendshipArcView surfaces anniversary entries visually

---

## Phase 4: Evening Digest ✅

### Goal
Consolidate scattered notifications into a single, user-timed daily summary that mirrors the Today's Focus widget.

### Implementation Status: Complete

**Key Files:**
- `channels/evening-digest.ts` - Scheduling, content generation, handleTap
- `EveningCheckinSheet.tsx` - Dedicated digest UI component
- `GlobalModals.tsx` - Subscribes to `OPEN_DIGEST_SHEET` events

**Features Implemented:**
- User-configured digest time (default 7pm)
- Smart suppression (skips if nothing meaningful)
- Respects ignore patterns (reduces frequency after 3x ignored)
- Opens dedicated `EveningCheckinSheet` with battery check-in integration
- Content priority: birthdays, life events, memories, suggestions

---

## Execution Summary

| Phase | Status | Completed |
|-------|--------|----------|
| Phase 1 (Analytics) | ✅ Complete | Dec 2024 |
| Phase 2 (Architecture) | ✅ Complete | Dec 2024 |
| Phase 3 (Memory UX) | ✅ Complete | Dec 2024 |
| Phase 4 (Digest) | ✅ Complete | Dec 2024 |


Files to Reference
When executing prompts, these are the key files:

### Notification System (Current Architecture)

**Core Services:**
- `src/modules/notifications/services/notification-orchestrator.ts` - Central coordinator
- `src/modules/notifications/services/notification-store.ts` - AsyncStorage management
- `src/modules/notifications/services/notification-analytics.ts` - Event tracking
- `src/modules/notifications/services/notification-response-handler.ts` - Tap routing
- `src/modules/notifications/services/permission.service.ts` - Native permissions
- `src/modules/notifications/services/notification-grace-periods.ts` - New user protection
- `src/modules/notifications/services/season-notifications.service.ts` - Social season awareness

**Channels:**
- `src/modules/notifications/services/channels/smart-suggestions.ts` - AI friend outreach
- `src/modules/notifications/services/channels/evening-digest.ts` - Daily summary
- `src/modules/notifications/services/channels/battery-checkin.ts` - Social battery check-ins
- `src/modules/notifications/services/channels/weekly-reflection.ts` - Weekly reflection
- `src/modules/notifications/services/channels/memory-nudge.ts` - Anniversary memories
- `src/modules/notifications/services/channels/deepening-nudge.ts` - Post-interaction reflection
- `src/modules/notifications/services/channels/event-reminder.ts` - Planned event reminders
- `src/modules/notifications/services/channels/event-suggestion.ts` - Calendar event batching

**Configuration:**
- `src/modules/notifications/notification.config.ts` - Centralized config and timing
- `src/modules/notifications/types.ts` - Type definitions and stored data interfaces

### Improvements Completed (Dec 2024)

1. **Race Condition Fix**: `notification-orchestrator.ts` now uses promise guard pattern
2. **Type Safety**: Added 7 interfaces for stored data types to replace `any`
3. **N+1 Query Fix**: `smart-suggestions.ts` batch fetches all data upfront
4. **Navigation Error Handling**: `notification-response-handler.ts` has safe wrappers
5. **Centralized Timing**: `NOTIFICATION_TIMING` constants in config

Journal (for Phase 3):

src/modules/journal/ - Journal module
src/db/models/JournalEntry.ts
src/db/models/WeeklyReflection.ts

Today's Focus (for Phase 4):

src/modules/home/components/widgets/ - Home widgets
src/modules/home/components/widgets/TodaysFocusWidgetV2.tsx

Components:

src/modules/notifications/components/NotificationPermissionModal.tsx
