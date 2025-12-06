# Phase 2 Prompt: Architecture Consolidation

Copy this entire prompt into a new Claude conversation along with your notification files.

---

## Context

I'm building Weave, a friendship tracking app. My notification system works but has accumulated technical debt:

1. **Scattered AsyncStorage keys** across multiple files
2. **Deprecated functions** still present (`requestEventSuggestionPermissions`, `requestNotificationPermissions`)
3. **No central registry** of what's scheduled
4. **No clear trigger** for smart notification evaluation
5. **Timezone issues** - hardcoded to device locale
6. **14-day batch expiry** - if user doesn't open app, battery reminders silently stop

## Task

Refactor the notification system into a cleaner architecture without breaking existing functionality.

### Target Structure

```
src/modules/notifications/
├── index.ts
├── types.ts                          # Shared types
├── services/
│   ├── notification-orchestrator.ts  # NEW: Central coordinator
│   ├── notification-store.ts         # NEW: All AsyncStorage
│   ├── notification-analytics.ts     # From Phase 1
│   ├── permission.service.ts         # Keep
│   └── channels/
│       ├── battery-checkin.ts
│       ├── weekly-reflection.ts
│       ├── event-reminder.ts
│       ├── deepening-nudge.ts
│       ├── memory-nudge.ts
│       └── smart-suggestions.ts
├── hooks/
│   └── useNotificationPermissions.ts
└── handlers/
    └── notification-response-handler.ts
```

### Step 1: Create NotificationStore

Create `src/modules/notifications/services/notification-store.ts`:

- Move ALL AsyncStorage keys into a single `STORAGE_KEYS` object
- Create typed getter/setter functions for each piece of state
- Add `clearAll()` for testing/logout
- Add `getUserTimezone()` / `setUserTimezone()` for timezone handling

### Step 2: Create types.ts

Create `src/modules/notifications/types.ts`:

```typescript
export type NotificationType = 
  | 'battery-checkin'
  | 'weekly-reflection'
  | 'event-reminder'
  | 'deepening-nudge'
  | 'friend-suggestion'
  | 'memory-nudge'
  | 'event-suggestion';

export interface ScheduledNotification {
  id: string;
  type: NotificationType;
  scheduledFor: Date;
  data: Record<string, any>;
}

// ... other shared types
```

### Step 3: Extract channel files

For each notification type, create a channel file with this interface:

```typescript
// Example: src/modules/notifications/services/channels/battery-checkin.ts

export const BatteryCheckinChannel = {
  schedule: async (time: string, startDate?: Date): Promise<void> => { ... },
  cancel: async (): Promise<void> => { ... },
  cancelToday: async (): Promise<void> => { ... },
  getScheduled: async (): Promise<ScheduledNotification[]> => { ... },
  handleTap: (data: NotificationData, router: any): void => { ... },
};
```

Extract logic from `notification-manager-enhanced.ts` into:
- `battery-checkin.ts`
- `weekly-reflection.ts`
- `event-reminder.ts`
- `deepening-nudge.ts`
- `memory-nudge.ts`

Extract from `smart-notification-scheduler.ts` into:
- `smart-suggestions.ts`

### Step 4: Create NotificationOrchestrator

Create `src/modules/notifications/services/notification-orchestrator.ts`:

```typescript
export const NotificationOrchestrator = {
  // Called once on app launch
  initialize: async (): Promise<void> => {
    // Check permissions (don't request)
    // If granted, schedule all notification types based on user preferences
    // Clean up expired data
  },

  // Called when app comes to foreground
  onAppForeground: async (): Promise<void> => {
    // Re-evaluate smart notifications
    // Check for expired batches and reschedule
  },

  // Called after user logs an interaction
  onInteractionLogged: async (interaction: Interaction): Promise<void> => {
    // Maybe schedule deepening nudge
    // Maybe schedule event suggestion followup
    // Re-evaluate smart suggestions
  },

  // Get all pending notifications (for debugging/settings UI)
  getScheduledNotifications: async (): Promise<ScheduledNotification[]> => { ... },

  // Cancel everything (for logout or user request)
  cancelAll: async (): Promise<void> => { ... },
};
```

### Step 5: Update response handler

Modify `notification-response-handler.ts`:
- Import channel handlers
- Route to appropriate channel's `handleTap` method
- Keep analytics tracking from Phase 1

### Step 6: Clean up

- Delete deprecated functions from all files
- Update `src/modules/notifications/index.ts` to export new structure
- Update imports in `app/_layout.tsx` or wherever notifications are initialized

### Step 7: Fix the 14-day gap

In `battery-checkin.ts`, add logic to:
- Check if batch is about to expire (< 2 days remaining)
- If user opens app, extend the batch
- Consider using expo-background-fetch as a backup (optional, note if too complex)

### Requirements

- Don't break existing functionality - this is a refactor
- Keep the same notification IDs so existing scheduled notifications still work
- Add JSDoc comments to public functions
- Each channel file should be independently testable

### Files to read first

1. `src/modules/notifications/services/notification-manager-enhanced.ts`
2. `src/modules/notifications/services/smart-notification-scheduler.ts`
3. `src/modules/notifications/services/notification-response-handler.ts`
4. `src/modules/notifications/services/permission.service.ts`
5. `src/modules/notifications/services/event-notifications.ts`
6. `src/modules/notifications/services/notification-grace-periods.ts`

### Deliverables

1. All new files with complete code
2. Migration notes for any breaking changes
3. Updated `index.ts` exports
4. List of files that can be deleted after migration
