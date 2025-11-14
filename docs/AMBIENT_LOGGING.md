# Ambient Event Logging

**Status**: ✅ Implemented (Phase 1: Calendar Integration)
**Version**: 1.0.0
**Last Updated**: 2025-01-14

## Overview

Ambient Event Logging is Weave's intelligent background system that automatically detects when you've spent time with friends and gently prompts you to log those moments as weaves. The goal is to reduce friction in relationship tracking by making logging feel effortless.

## How It Works

### Phase 1: Calendar Integration (Current)

The system scans your calendar daily for past events that match your friends:

1. **Background Scanning**: Once per day (default: every 24 hours)
2. **Friend Matching**: Uses fuzzy name matching to detect friends in event titles
3. **Smart Filtering**: Only suggests medium+ importance events
4. **Notification**: Sends a gentle push notification suggesting you log the event
5. **One-Tap Logging**: Tap the notification to open pre-filled interaction form

### Example Flow

```
User's Calendar: "Coffee with Sarah" - Yesterday, 10am
         ↓
Background Scan (runs daily)
         ↓
Matches: Sarah (Friend in Inner Circle)
         ↓
Notification: "🧵 Did you weave? You had 'Coffee with Sarah' yesterday. Tap to log it."
         ↓
User Taps → Opens interaction form with:
  - Friend: Sarah (pre-selected)
  - Date: Yesterday
  - Category: meal (suggested)
  - Title: "Coffee with Sarah"
```

## Architecture

### Core Components

```
┌─────────────────────────────────────────────────────────┐
│                  App Initialization                      │
│  • Registers background task on app startup             │
│  • Configures notification handlers                     │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│          Background Task (Runs every 24h)               │
│  • src/lib/background-event-sync.ts                     │
│  • Checks if feature is enabled                         │
│  • Scans calendar for past events                       │
│  • Matches friends using fuzzy logic                    │
│  • Tracks already-suggested events (no duplicates)      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         Event Scanner & Classification                   │
│  • src/lib/event-scanner.ts                             │
│  • Extracts names from event titles                     │
│  • Classifies event type (meal, social, activity, etc)  │
│  • Suggests interaction category                        │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│           Notification Scheduling                        │
│  • src/lib/event-notifications.ts                       │
│  • Schedules push notification                          │
│  • Includes event data in notification payload          │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│         User Interaction & Logging                       │
│  • User taps notification                               │
│  • src/lib/notification-response-handler.ts             │
│  • Navigates to interaction form with pre-filled data   │
│  • User reviews/edits and logs weave                    │
└─────────────────────────────────────────────────────────┘
```

### Key Files

#### Core Services

- **`src/lib/background-event-sync.ts`**: Background task orchestrator
  - Registers/unregisters background fetch task
  - Manages scan settings and frequency
  - Tracks suggested events to prevent duplicates
  - Cleanup of old records

- **`src/lib/event-notifications.ts`**: Notification system
  - Schedules push notifications for event suggestions
  - Handles notification permissions
  - Manages notification channels (Android)
  - Provides navigation data for tapped notifications

- **`src/lib/event-scanner.ts`**: Event scanning & matching
  - Scans calendar events in date ranges
  - Fuzzy name matching (Levenshtein distance)
  - Event classification using keyword dictionary
  - Friend matching from attendees (Android)

#### State Management

- **`src/stores/backgroundSyncStore.ts`**: Zustand store for settings
  - Load/save background sync preferences
  - Toggle background sync on/off
  - Check background fetch availability
  - Manual sync trigger (for testing)

#### User Interface

- **`src/components/settings-modal.tsx`**: Settings UI
  - Toggle "Ambient Event Logging"
  - Shows last sync timestamp
  - Status indicators

- **`src/components/EventSuggestionModal.tsx`**: Suggestion display
  - Shows detected event details
  - Pre-fills interaction form
  - Dismissal handling

#### Integration Points

- **`app/_layout.tsx`**: App initialization
  - Registers background task on startup
  - Configures notification handlers
  - Loads background sync settings

- **`src/lib/notification-response-handler.ts`**: Deep linking
  - Handles notification taps
  - Routes to interaction form with pre-filled data

## Settings

### User-Configurable Settings

All settings are stored in AsyncStorage and managed via `BackgroundSyncSettings`:

```typescript
interface BackgroundSyncSettings {
  enabled: boolean;                // Master toggle (default: false)
  scanIntervalHours: number;        // Scan frequency (default: 24 hours)
  scanPastDays: number;             // Look-back window (default: 2 days)
  minImportance: 'low' | 'medium' | 'high' | 'critical'; // Filter threshold (default: 'medium')
  notificationsEnabled: boolean;    // Send push notifications (default: true)
  lastSyncTimestamp: number | null; // Last successful sync
}
```

### Accessing Settings

In the app:
1. Open Settings (⚙️ icon)
2. Scroll to "Calendar Integration"
3. Enable "Calendar Integration"
4. Enable "Two-Way Sync"
5. Toggle "Ambient Event Logging"

## Technical Details

### Background Fetch

**iOS**: Uses `UIBackgroundModes` with "fetch" capability
- Configured in `app.json`
- System decides when to run (battery-aware)
- Typical interval: 15min - 24hours depending on usage patterns

**Android**: Uses WorkManager via Expo Background Fetch
- More reliable scheduling
- Guaranteed to run at specified intervals (if battery allows)

### Notification System

**iOS**: Local notifications via expo-notifications
- Requires notification permissions
- Shows in Notification Center
- Tap opens app to interaction form

**Android**:
- Uses notification channels ("event-suggestions")
- Custom notification icon
- Rich notification with action buttons (future)

### Performance Optimizations

1. **Duplicate Prevention**: Tracks suggested events in AsyncStorage
   - Key: `@weave_suggested_event_{eventId}`
   - Auto-cleanup after 30 days

2. **Incremental Scanning**: Only scans past N days (configurable)
   - Default: 2 days
   - Prevents processing old events repeatedly

3. **Importance Filtering**: Only processes medium+ importance events
   - Reduces noise
   - Focuses on meaningful interactions

4. **Battery Respect**:
   - Respects system battery saver modes
   - Background fetch status checking
   - Graceful degradation if restricted

### Database Integration

The system logs all suggestion events to WatermelonDB for analytics:

```typescript
// Model: SuggestionEvent
{
  suggestionId: 'calendar-event-{eventId}',
  friendId: '{friendId}',
  suggestionType: 'calendar-event',
  urgency: 'medium',
  actionType: 'log',
  eventType: 'shown',
  eventTimestamp: Date
}
```

This enables future analytics:
- Conversion rates (shown → acted)
- Most effective event types
- User preferences learning

## Debugging & Testing

### Manual Sync Trigger

For development/testing, you can manually trigger a sync:

```typescript
import { useBackgroundSyncStore } from '../stores/backgroundSyncStore';

// Trigger manual sync
await useBackgroundSyncStore.getState().testManualSync();
```

### Check Background Fetch Status

```typescript
import { getBackgroundFetchStatus } from '../lib/background-event-sync';
import * as BackgroundFetch from 'expo-background-fetch';

const status = await getBackgroundFetchStatus();

// Status values:
// - Available: Background fetch is working
// - Denied: User denied background app refresh
// - Restricted: Battery saver or Low Power Mode active
```

### View Pending Notifications

```typescript
import { getPendingEventSuggestions } from '../lib/event-notifications';

const pending = await getPendingEventSuggestions();
console.log(`${pending.length} pending event suggestions`);
```

### Logs

Background sync emits detailed logs:

```
[BackgroundSync] Starting background event scan...
[BackgroundSync] Scanned 12 events, found 3 with friend matches
[BackgroundSync] Skipping already-suggested event: Coffee with Sarah
[BackgroundSync] Completed. Created 2 suggestions.
```

Search for `[BackgroundSync]` in device logs.

## Known Limitations

### Current Phase (Phase 1)

1. **iOS Background Fetch Restrictions**:
   - System controls when background tasks run
   - May not run exactly every 24 hours
   - Disabled in Low Power Mode
   - Requires "Background App Refresh" to be enabled

2. **Friend Matching**:
   - Only matches names in event titles
   - No access to calendar attendee list on iOS
   - Requires friends' names to be spelled correctly in calendar

3. **Event Classification**:
   - Uses keyword-based matching
   - May misclassify some events
   - Limited to predefined interaction categories

4. **Single User**:
   - No cross-user features yet
   - Can't detect when two Weave users meet

### Future Improvements (Phase 2+)

See roadmap in `README.md` for planned features:
- Messaging metadata integration
- Location-based proximity detection
- Multi-user shared weave logging
- Machine learning for better classification

## Privacy & Security

### Data Collection

**What We Collect**:
- Calendar event titles, dates, locations
- Friend names for matching
- Notification interaction data (shown/tapped/dismissed)

**What We DON'T Collect**:
- Full calendar event descriptions
- Attendee email addresses
- Event notes/attachments
- Calendar data older than 30 days

### Data Storage

- **Local-First**: All calendar data stays on device
- **Ephemeral**: Suggested events auto-delete after 30 days
- **No Server Sync**: Calendar scanning happens entirely on-device

### User Control

- ✅ Opt-in by default (feature disabled until user enables)
- ✅ One-tap disable in Settings
- ✅ Granular notification controls
- ✅ Clear data retention policy (30 days)
- ✅ No hidden tracking

## Troubleshooting

### "Background sync could not be enabled"

**Possible causes**:
1. Notification permissions not granted
   - Fix: Go to Settings → Notifications → Weave → Enable
2. Background App Refresh disabled (iOS)
   - Fix: Settings → General → Background App Refresh → Enable for Weave
3. Battery Saver mode active (Android)
   - Fix: Disable battery optimization for Weave

### "No suggestions appearing"

**Debug steps**:
1. Check if calendar integration is enabled
2. Verify "Two-Way Sync" is enabled
3. Confirm "Ambient Event Logging" is toggled on
4. Check last sync timestamp (should update daily)
5. Manually trigger sync via `testManualSync()` (development only)
6. Look for events in calendar with friend names in titles

### "Wrong friends suggested"

This indicates fuzzy name matching issues:

1. Check friend names in Weave match calendar event titles exactly
2. Minimum similarity threshold: 80% (configurable in `event-scanner.ts`)
3. Example: "Sara" (calendar) vs "Sarah" (Weave) → 80% match ✅
4. Example: "S" (calendar) vs "Sarah" (Weave) → 20% match ❌

### "Notifications not appearing"

1. Check notification permissions
2. Verify `notificationsEnabled` is true in settings
3. Check notification channel settings (Android)
4. Look for pending notifications: `getPendingEventSuggestions()`

## Future Roadmap

### Phase 2: Messaging Insights (Privacy-First)
- iOS CallKit integration for call detection
- Android notification listener for messaging app metadata
- "You just called Alex. Log a quick weave?"

### Phase 3: Location-Based Logging
- Opt-in proximity detection between Weave users
- Geofencing for favorite spots
- "You and Alex were at the same coffee shop. Did you weave?"

### Phase 4: Machine Learning
- Learn from user acceptance/dismissal patterns
- Personalized event classification
- Predictive suggestions based on patterns

## Contributing

When working on ambient logging features:

1. **Privacy First**: Always ask for explicit consent
2. **Battery Aware**: Minimize background processing
3. **User Control**: Every feature must be toggleable
4. **Clear Communication**: Explain what data is used and why
5. **Graceful Degradation**: Handle permission denials gracefully

## License

Part of Weave - Mindful Relationship Companion
