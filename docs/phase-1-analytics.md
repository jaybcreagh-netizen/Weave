# Phase 1 Prompt: Analytics Foundation

Copy this entire prompt into a new Claude conversation along with your notification files.

---

## Context

I'm building Weave, a friendship tracking app with a notification system. I need to instrument notifications with PostHog analytics so I can measure what's working.

**Current setup:**
- PostHog is already integrated in the app
- Notifications are offline-first (no backend)
- I have these notification types: `battery-checkin`, `weekly-reflection`, `event-reminder`, `deepening-nudge`, `friend-suggestion`, `memory-nudge`, `event-suggestion`

## Task

Create a `NotificationAnalytics` service and instrument my existing notification code.

### 1. Create the analytics service

Create `src/modules/notifications/services/notification-analytics.ts`:

```typescript
// Track these events:
// - notification_scheduled: when we schedule any notification
// - notification_delivered: when notification fires (best effort via listeners)
// - notification_tapped: when user taps notification
// - notification_action_completed: when user completes the intended action
// - notification_permission_requested: when we ask for permission
// - notification_permission_result: the outcome
// - notifications_disabled: when user turns off in settings

// Each event should include:
// - type: the notification type
// - notificationId: unique identifier
// - timestamp
// - Additional context per event type
```

### 2. Instrument scheduling

In `notification-manager-enhanced.ts` and `smart-notification-scheduler.ts`, add analytics calls when:
- A notification is scheduled (capture type, urgency, delay, friendId if applicable)
- A notification is cancelled (capture reason)

### 3. Instrument response handling

In `notification-response-handler.ts`:
- Track `notification_tapped` when `handleNotificationResponse` is called
- Track `notification_action_completed` after successful navigation/action

### 4. Instrument permission flow

In `NotificationPermissionModal.tsx` and `permission.service.ts`:
- Track when permission modal is shown
- Track the user's choice (enable/skip)
- Track the system permission result

### 5. Add correlation tracking

We need to correlate a scheduled notification with its tap. Since we're offline:
- Store `notificationId` → `scheduledAt` mapping in AsyncStorage
- Clean up entries older than 7 days
- Use this to calculate `secondsSinceScheduled` on tap

### Requirements

- Use PostHog's `capture()` method
- Don't break existing functionality
- Make analytics calls non-blocking (don't await them in critical paths)
- Add a feature flag check so we can disable analytics if needed: `if (!analyticsEnabled) return;`
- Include TypeScript types for all event payloads

### Files to modify

Please read these files first, then show me the changes:

1. Create new: `src/modules/notifications/services/notification-analytics.ts`
2. Modify: `src/modules/notifications/services/notification-manager-enhanced.ts`
3. Modify: `src/modules/notifications/services/smart-notification-scheduler.ts`
4. Modify: `src/modules/notifications/services/notification-response-handler.ts`
5. Modify: `src/modules/notifications/services/permission.service.ts`
6. Modify: `src/components/NotificationPermissionModal.tsx`

Show me the complete new file and diffs for modifications.
