# Shared Weaves UX Design

## Overview

This document outlines the design for a **hybrid shared weaves experience** that:
1. Shows pending shared weaves both in a central inbox **and** inline in friend profiles
2. Adds **visual distinction** for shared/reciprocal weaves to indicate mutual connection

---

## Core Concept: Reciprocity Visibility

Shared weaves represent a **mutual acknowledgment** of a moment together. This should be visually distinct from solo-logged weaves to reinforce the social nature of the app.

### Visual Language

| Weave Type | Visual Treatment | Description |
|------------|------------------|-------------|
| **Solo weave** | Standard card | You logged this moment |
| **Shared (confirmed)** | Accent border + ↔️ icon | Both parties accepted |
| **Shared (pending - sent)** | Muted/grayed accent | Waiting for their response |
| **Shared (pending - received)** | Accent + action buttons | Waiting for your response |

### Design Elements

```
┌─────────────────────────────────────┐
│ ↔️  Coffee with Hannah     📅 Jan 9 │  ← Reciprocity icon
│     Morning catch-up                │
│     ☕ Cafe                         │
├─────────────────────────────────────┤
│ 👤👤 You + Hannah                   │  ← Dual avatars
└─────────────────────────────────────┘
```

**Visual options:**
- **Border**: 2px accent color (e.g., warm amber `#F59E0B`)
- **Badge**: Small `↔️` or `🤝` icon in corner
- **Avatar pair**: Both participants' thumbnails overlapping
- **Background**: Very subtle tint (5% accent)

---

## Hybrid Experience

### 1. Central Inbox (Activity Sheet)

**Purpose**: Quick notification hub and action center

**Features:**
- Badge count for pending items
- Accept/Decline in one place
- Shows all pending weaves regardless of sender
- Tabs: Requests | Inbox | Sent | History

**Keep as-is**, just ensure synced with profile view.

### 2. Friend Profile Timeline

**Purpose**: Contextual discovery

**New behavior:**
- Pending shared weaves from this friend appear **at the top** of their timeline
- Visually distinct card with Accept/Decline buttons inline
- Once accepted, slides into normal position in timeline

```
┌─ Sarah's Weaves ─────────────────────┐
│                                       │
│  ┌────── PENDING ─────────────────┐  │
│  │ 🔔 Sarah shared a weave        │  │
│  │    Dinner at Mario's   Jan 9   │  │
│  │    [ Decline ]    [ Accept ]   │  │
│  └────────────────────────────────┘  │
│                                       │
│  ── Past Weaves ───────────────────  │
│  • Movie night         Jan 5         │
│  • Birthday party      Dec 28        │
│                                       │
└───────────────────────────────────────┘
```

---

## Data Model

### Interaction (local)

Add fields to track sharing status:

```typescript
// Existing
id: string
date: Date
category: string
// ...

// New
isShared: boolean           // True if this is a shared weave
sharedWeaveId?: string      // Reference to server shared_weave ID
sharedStatus?: 'pending' | 'confirmed' | 'declined'
sharedBy?: 'me' | 'them'    // Who initiated the share
```

### SharedWeaveRef (existing)

Already tracks:
- `isCreator` - Did current user send this?
- `serverSharedWeaveId` - Link to Supabase
- `interactionId` - Link to local Interaction

---

## User Flows

### Flow 1: Sender Shares a Weave

```
1. User logs weave with sharing enabled
2. Creates local Interaction + SharedWeaveRef
3. Queue syncs to Supabase
4. Local shows as "shared (pending)"
5. Visual: muted accent border, "Awaiting response" badge
```

### Flow 2: Recipient Receives Share

```
1. App fetches pending weaves on launch/refresh
2. Shows in Inbox AND at top of sender's profile
3. User can Accept/Decline from either location

Accept:
  → Creates local Interaction linked to SharedWeaveRef
  → Updates server response to 'accepted'
  → Card transforms to "shared (confirmed)" styling

Decline:
  → Updates server response to 'declined'
  → Card fades out / removed from view
```

### Flow 3: Both Accepted

```
1. Both users have Interaction linked to same sharedWeaveId
2. Card shows reciprocity styling
3. Optional: Show "Confirmed by both" celebration toast
```

---

## Implementation Roadmap

> **Legend**: ✅ Complete | 🔄 In Progress | ⏳ Not Started

### Current State Summary

| Layer | Status | Notes |
|-------|--------|-------|
| Data Model (`SharedWeaveRef`) | ✅ | Tracks `status`, `isCreator`, `serverWeaveId` |
| Central Inbox | ✅ | `ActivityInboxSheet` shows pending weaves |
| Accept/Decline Services | ✅ | `receive-weave.service.ts` functional |
| Share Flow | ✅ | `share-weave.service.ts` functional |
| Visual Distinction (Timeline) | ⏳ | `TimelineItem` has no shared styling |
| Friend Profile Integration | ⏳ | Pending weaves not shown on profile |
| Expiration Logic | ⏳ | No 90-day auto-expire |

---

### Phase 1: Data Bridge *(Foundation)*

**Goal**: Connect `SharedWeaveRef` data to timeline/profile queries so components can render shared status.

| Task | Files | Details |
|------|-------|---------|
| 1.1 Create `useInteractionShareStatus` hook | `src/modules/sync/hooks/` | Given an `interactionId`, return `{ isShared, status, isCreator }` by querying `SharedWeaveRef` |
| 1.2 Extend `InteractionShape` | `src/shared/types/derived.ts` | Add optional `shareInfo?: { status, isCreator }` field |
| 1.3 Update timeline queries | `src/modules/relationships/hooks/useFriendTimeline.ts` | Enrich interactions with share status lookup |

**Success Criteria**: `TimelineItem` receives `shareInfo` prop with accurate shared/pending/confirmed status.

---

### Phase 2: Visual Distinction *(Timeline Styling)*

**Goal**: Shared weaves are visually distinct in the friend profile timeline.

| Task | Files | Details |
|------|-------|---------|
| 2.1 Add reciprocity icon | `TimelineItem.tsx` | Show `↔️` or `ArrowLeftRight` icon for confirmed shared weaves |
| 2.2 Add accent border | `TimelineItem.tsx` | 2px warm amber (`#F59E0B`) border for shared weaves |
| 2.3 Add "pending sent" styling | `TimelineItem.tsx` | Muted/grayed accent + "Awaiting response" badge for outgoing pending |
| 2.4 Add status pill | `TimelineItem.tsx` | Small pill showing "Confirmed by both" or "Pending" |

**Visual Reference**:
```
┌─────────────────────────────────────────┐
│ ↔️  Coffee with Hannah      📅 Jan 9   │  ← Reciprocity icon
│     Morning catch-up                    │
│     ☕ Cafe                             │
│     ──────────────────────────────────  │
│     🟢 Confirmed by both                │  ← Status pill
└─────────────────────────────────────────┘
```

**Success Criteria**: Users can visually distinguish solo vs shared vs pending weaves at a glance.

---

### Phase 3: Friend Profile Integration *(Inline Pending)*

**Goal**: Pending incoming weaves from a specific friend appear at the top of their profile.

| Task | Files | Details |
|------|-------|---------|
| 3.1 Create `usePendingWeavesForFriend` hook | `src/modules/sync/hooks/` | Filter pending weaves by `creatorUserId` matching the friend's linked account |
| 3.2 Add pending section to profile | `FriendProfileScreen.tsx` or `TimelineList.tsx` | Render `SharedWeaveCard` above timeline if pending weaves exist |
| 3.3 Handle Accept/Decline inline | Reuse existing handlers | On accept, card transforms to timeline item; on decline, card fades out |
| 3.4 Sync with Inbox | Shared state | Accepting from profile should update Inbox counts |

**UX Note**: Declined weaves do NOT appear on friend profile (per design decision), only in central history.

**Success Criteria**: Users can accept shared weaves directly from the friend's profile without navigating to the central inbox.

---

### Phase 4: Expiration Service *(90-Day Cleanup)*

**Goal**: Pending weaves auto-expire after 90 days, reverting to solo weaves on sender's side.

| Task | Files | Details |
|------|-------|---------|
| 4.1 Create `SharedWeaveExpirationService` | `src/modules/sync/services/` | Check `sharedAt` timestamp, mark as `'expired'` if > 90 days |
| 4.2 Schedule expiration check | App startup or background task | Run expiration check on app launch and/or daily interval |
| 4.3 Handle sender-side reversion | `ShareWeaveService` | On expiration, sender's local weave loses "shared pending" status, becomes solo |
| 4.4 Server-side expiration (optional) | Supabase function or cron | Auto-update `shared_weave_participants.status` to `'expired'` |

**Success Criteria**: Stale pending weaves don't accumulate; expired weaves handled gracefully on both sides.

---

### Phase 5: Unlinked Friend Handling *(Already Satisfied)*

**Goal**: Shared weaves persist even if friend link is severed.

| Task | Files | Status |
|------|-------|--------|
| 5.1 Preserve `SharedWeaveRef` on unlink | `friend-linking.service.ts` | ✅ `unlinkFriend` only clears linking fields, does NOT touch SharedWeaveRef |
| 5.2 Graceful UI fallback | `TimelineItem.tsx` | ✅ `shareInfo` is optional - weave displays normally if null |
| 5.3 Re-link edge case | N/A | New weaves create new refs; old refs remain as historical record |

**Implementation Note**: By design, `SharedWeaveRef` records are independent of the `Friend.linkedUserId` field. When a friend is unlinked, their historical shared weaves retain the reciprocity styling as a record of past mutual moments.

---

### Phase 6: Polish & Delight

**Goal**: Add celebratory moments and real-time feedback.

| Task | Files | Details |
|------|-------|---------|
| 6.1 Celebration toast on mutual confirm | `uiStore.ts` + `CelebrationOverlay` | Show confetti or subtle animation when both parties accept |
| 6.2 Push notification on accept | `shared-weave-notifications.ts` | Notify sender when recipient accepts |
| 6.3 Real-time status update (stretch) | Supabase Realtime or polling | Reflect acceptance immediately without full refresh |
| 6.4 Badge count on friend profile | `FriendCard` or profile header | Small badge showing pending weave count from that friend |

**Success Criteria**: Sharing feels delightful and users get immediate feedback on reciprocal actions.

---

## Resolved Design Decisions

1. **Should declined weaves still show in history?**
   - ✅ **Yes** — Declined weaves appear in the central history/inbox but **NOT** on the friend profile timeline. This keeps the friend profile focused on positive shared moments while preserving a complete record in the activity history.

2. **What happens if friend is unlinked?**
   - ✅ **Shared weaves remain** — If a linked friend is later unlinked, any shared weaves that were already accepted should persist in both users' local databases. The reciprocity styling can remain as a record of the mutual moment, even if the live link is severed.

3. **Expire pending weaves?**
   - ✅ **90 days** — Pending shared weaves that haven't been accepted or declined will expire after 90 days. This prevents stale notifications while giving ample time for response. On expiration, the sender's local weave reverts to a solo weave (loses "shared pending" status).

---

## Success Metrics

- Increase in shared weave adoption
- Faster accept rates (from profile vs inbox)
- User feedback on reciprocity visibility
