# Weave Accounts & Sharing System

## Design Document & Implementation Roadmap

**Version:** 1.0
**Date:** December 2024
**Status:** Draft

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Vision & Goals](#2-vision--goals)
3. [User Account System](#3-user-account-system)
4. [Profile System & Archetype Quiz](#4-profile-system--archetype-quiz)
5. [Friend Discovery & Linking](#5-friend-discovery--linking)
6. [Shared Weaves (Token Model)](#6-shared-weaves-token-model)
7. [Data Models](#7-data-models)
8. [API Design](#8-api-design)
9. [Migration Strategy](#9-migration-strategy)
10. [Security & Privacy](#10-security--privacy)
11. [Implementation Roadmap](#11-implementation-roadmap)
12. [Success Metrics](#12-success-metrics)

---

## 1. Executive Summary

### The Problem

Weave's core friction point is **data entry**. Users must manually log every interaction, remember birthdays, and guess at friends' preferences. This creates cognitive load that reduces engagement over time.

### The Solution

Introduce an **accounts and sharing system** that enables:

1. **Self-sovereign profiles** - Users define their own identity (name, photo, birthday, archetype)
2. **Friend linking** - Connect with friends who also use Weave
3. **Auto-filled friend data** - When you add a linked friend, their profile data populates automatically
4. **Shared weaves** - Log once, appear for both parties (like a calendar invite)

### The Value

- **Reduced friction**: One person logs, both benefit
- **Better data quality**: Birthdays come from the source, not memory
- **Network effects**: More friends on Weave = less work for everyone
- **Verified reciprocity**: Know who actually initiated interactions

---

## 2. Vision & Goals

### Primary Goals

| Goal | Description | Success Metric |
|------|-------------|----------------|
| **Reduce data entry** | Shared weaves eliminate duplicate logging | 50% reduction in manual logs for linked friends |
| **Improve data accuracy** | Profile data from source | 90%+ birthday accuracy for linked friends |
| **Drive adoption** | Network effects incentivize invites | 30% of users link with 1+ friend within 60 days |
| **Maintain privacy** | Sharing is additive, not invasive | Zero complaints about unwanted data exposure |

### Non-Goals

- **Not a social network**: No feeds, no public profiles, no follower counts
- **Not required**: Local-only usage remains fully supported
- **Not intrusive**: No spam, no aggressive friend suggestions

### Guiding Principles

1. **Opt-in everything** - Every sharing feature requires explicit consent
2. **Privacy by default** - Personal reflections, scores, and tiers are never shared
3. **Graceful degradation** - App works fully offline and without an account
4. **User owns their data** - Export, delete, or migrate anytime

---

## 3. User Account System

### 3.1 Authentication Methods

Users can create accounts via:

| Method | Implementation | Notes |
|--------|----------------|-------|
| **Email/Password** | Supabase Auth | Standard flow with email verification |
| **Apple Sign-In** | Supabase Auth + Apple provider | Required for iOS App Store |
| **Google Sign-In** | Supabase Auth + Google provider | Popular choice for Android |
| **Username** | Custom field in profile | Instagram-style @username for easy discovery |

### 3.2 Username System

```
Format: @username
Rules:
  - 3-30 characters
  - Lowercase letters, numbers, underscores, periods
  - Must start with a letter
  - Unique across all users
  - Can be changed (with cooldown: once per 30 days)

Examples:
  - @rachel.m
  - @tom_smith
  - @hannah2024
```

**Reservation strategy:**
- Reserve common words and brand terms
- Prevent impersonation (no @weave, @admin, etc.)
- Allow reclaiming of inactive usernames after 2 years

### 3.3 Account States

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   No        │     │   Account   │     │   Account   │
│   Account   │────►│   Created   │────►│   Verified  │
│   (Local)   │     │   (Pending) │     │   (Active)  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
                                        ┌─────────────┐
                                        │   Account   │
                                        │   Deleted   │
                                        └─────────────┘
```

### 3.4 Account Creation Flow

```
1. User taps "Create Account" (settings or prompted contextually)
        │
        ▼
2. Choose method: Email / Apple / Google
        │
        ▼
3. Authentication completes
        │
        ▼
4. Username selection screen
   ┌─────────────────────────────────┐
   │  Choose your username          │
   │  ┌─────────────────────────┐   │
   │  │ @│                      │   │
   │  └─────────────────────────┘   │
   │  ✓ Available                   │
   │                                │
   │  This is how friends find you  │
   │         [Continue]             │
   └─────────────────────────────────┘
        │
        ▼
5. Profile setup (name, photo, birthday - all optional except name)
        │
        ▼
6. Archetype quiz prompt
   ┌─────────────────────────────────┐
   │  Discover your social archetype │
   │                                 │
   │  Take a quick quiz to find out  │
   │  how you connect with friends   │
   │                                 │
   │  [Take Quiz]  [Skip for now]   │
   └─────────────────────────────────┘
        │
        ▼
7. Account created, existing local data associated with user_id
        │
        ▼
8. Initial sync to cloud
```

---

## 4. Profile System & Archetype Quiz

### 4.1 Public Profile Fields

These fields are visible to linked friends:

| Field | Required | Description |
|-------|----------|-------------|
| `displayName` | Yes | How you appear to friends |
| `username` | Yes | Unique @handle for discovery |
| `photoUrl` | No | Profile picture |
| `birthday` | No | MM-DD format (year optional for privacy) |
| `archetype` | No | Self-selected via quiz |
| `timezone` | No | For scheduling awareness |
| `bio` | No | Short description (max 150 chars) |

### 4.2 Private Profile Fields

Never shared, stored locally or in user's private cloud space:

| Field | Description |
|-------|-------------|
| `email` | Authentication only |
| `phone` | Contact matching (hashed) |
| `notificationPreferences` | Push settings |
| `privacySettings` | Discoverability options |
| `subscriptionTier` | free / plus / premium |

### 4.3 Archetype Quiz Design

**Purpose:** Help users discover their dominant social archetype in an engaging way.

**Quiz Structure:**
- 7 questions
- Each question maps to archetype affinities
- Visual, intuitive format
- ~2 minutes to complete

**Sample Questions:**

```
Question 1 of 7

"Your ideal weekend with a close friend looks like..."

┌─────────────────────────────────────────┐
│  🏔️  An adventure - hiking, road trip,  │
│      something spontaneous              │
├─────────────────────────────────────────┤
│  ☕  Deep conversation at a cozy café   │
│                                         │
├─────────────────────────────────────────┤
│  🎨  Working on a creative project      │
│      together                           │
├─────────────────────────────────────────┤
│  🎉  A group gathering or party         │
│                                         │
└─────────────────────────────────────────┘
```

**Scoring Matrix:**

| Answer Theme | Primary Archetype | Secondary |
|--------------|-------------------|-----------|
| Adventure/Spontaneity | The Fool | The Sun |
| Deep 1:1 conversation | The Hermit | High Priestess |
| Creative collaboration | The Magician | The Hermit |
| Group celebration | The Sun | The Empress |
| Caring/Nurturing | The Empress | High Priestess |
| Structured plans | The Emperor | The Magician |
| Emotional depth | High Priestess | The Hermit |

**Result Screen:**

```
┌─────────────────────────────────────────┐
│                                         │
│         ✨ Your Archetype ✨            │
│                                         │
│        ┌───────────────────┐            │
│        │                   │            │
│        │   [Tarot Card     │            │
│        │    Illustration]  │            │
│        │                   │            │
│        │   THE HERMIT      │            │
│        │                   │            │
│        └───────────────────┘            │
│                                         │
│   You thrive in meaningful one-on-one   │
│   connections. Deep conversations and   │
│   quality time energize your bonds.     │
│                                         │
│   Your friendships flourish when you    │
│   create space for authentic sharing.   │
│                                         │
│        [Save to Profile]                │
│        [Retake Quiz]                    │
└─────────────────────────────────────────┘
```

### 4.4 Profile → Friend Auto-Fill

When Hannah adds Rachel (a linked Weave user):

```
Before linking:                    After linking:
┌─────────────────────┐           ┌─────────────────────┐
│ Friend: Rachel      │           │ Friend: Rachel      │
│ ─────────────────── │           │ ─────────────────── │
│ Photo: [empty]      │    ──►    │ Photo: [Rachel's]   │
│ Birthday: [unknown] │           │ Birthday: Mar 15    │
│ Archetype: [guess?] │           │ Archetype: Hermit ✨│
│ Tier: [Hannah sets] │           │ Tier: [Hannah sets] │
│ Notes: [Hannah's]   │           │ Notes: [Hannah's]   │
└─────────────────────┘           └─────────────────────┘

✨ = Suggested from Rachel's profile, Hannah can override
```

**Auto-fill behavior:**
- Photo: Synced automatically, updates when Rachel changes it
- Birthday: Synced automatically
- Archetype: Suggested, Hannah can accept or set her own
- Tier, notes, score: Always Hannah's private data

---

## 5. Friend Discovery & Linking

### 5.1 Discovery Methods

| Method | Description | Privacy Level |
|--------|-------------|---------------|
| **Username search** | Search for @username directly | User must know username |
| **QR Code** | Scan friend's QR code in person | Requires physical presence |
| **Share link** | Send a unique invite link | Shareable via any channel |
| **Contact matching** | Find contacts who use Weave | Opt-in, uses hashed identifiers |

### 5.2 Username Search

```
┌─────────────────────────────────────┐
│  🔍 Find Friends                    │
│  ┌─────────────────────────────┐   │
│  │ @rachel                     │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ 👤 Rachel Martinez          │   │
│  │    @rachel.m                │   │
│  │    [Send Link Request]      │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ 👤 Rachel Wong              │   │
│  │    @rachelw                 │   │
│  │    [Send Link Request]      │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 5.3 QR Code Linking

Each user has a unique, persistent QR code:

```
┌─────────────────────────────────────┐
│         Your Weave Code             │
│                                     │
│        ┌─────────────────┐          │
│        │ ▄▄▄▄▄ ▄▄▄ ▄▄▄▄▄│          │
│        │ █   █ ▄▄▄ █   █│          │
│        │ █▄▄▄█ █▄█ █▄▄▄█│          │
│        │ ▄▄▄▄▄ ▄▄▄ ▄▄▄▄▄│          │
│        │ █ ▄▄▄ █▄█ ▄▄▄ █│          │
│        │ █▄▄▄█ ▄▄▄ █▄▄▄█│          │
│        └─────────────────┘          │
│                                     │
│         @hannah.lee                 │
│                                     │
│    [Scan a Code]  [Share Link]      │
└─────────────────────────────────────┘
```

**QR Code contains:**
- Unique user identifier (not username, for privacy)
- Deep link: `weave://link/{user_id}`

### 5.4 Share Link

```
https://weave.app/link/hannah.lee
   or
weave://link/{encoded_user_id}
```

**Link behavior:**
1. If recipient has Weave: Opens app, shows link request
2. If recipient doesn't have Weave: Opens app store page with referral

### 5.5 Contact Matching

**Opt-in flow:**

```
┌─────────────────────────────────────┐
│  📱 Find Friends in Contacts        │
│                                     │
│  We'll check if any of your         │
│  contacts use Weave.                │
│                                     │
│  Your contacts are never stored.    │
│  We only compare encrypted          │
│  identifiers.                       │
│                                     │
│  [Allow Contact Access]             │
│  [Not Now]                          │
└─────────────────────────────────────┘
```

**Technical flow:**

```
1. User grants contact permission
        │
        ▼
2. App extracts phone numbers and emails
        │
        ▼
3. Normalize: +1 (555) 123-4567 → +15551234567
        │
        ▼
4. Hash: SHA-256(normalized_value + app_salt)
        │
        ▼
5. Send hashed identifiers to server
        │
        ▼
6. Server compares against hashed user identifiers
        │
        ▼
7. Return matching user IDs (not contact info)
        │
        ▼
8. App displays: "3 contacts use Weave"
```

**Privacy guarantees:**
- Raw contact data never leaves device
- Server only sees hashed values
- App salt prevents rainbow table attacks
- Hashes are not stored after comparison

### 5.6 Link Request Flow

```
Hannah sends request              Rachel receives
─────────────────────            ─────────────────────

[Send Link Request]              [Push notification]
       │                         "Hannah wants to link"
       ▼                                │
Request created                         ▼
status: 'pending'               ┌─────────────────────┐
expires: +30 days               │ Link Request        │
                                │ ─────────────────── │
                                │ 👤 Hannah Lee       │
                                │    @hannah.lee      │
                                │                     │
                                │ "Hannah added you   │
                                │  as a friend and    │
                                │  wants to connect"  │
                                │                     │
                                │ [Accept]  [Decline] │
                                └─────────────────────┘
```

**Request states:**

| State | Duration | Outcome |
|-------|----------|---------|
| `pending` | Up to 30 days | Awaiting response |
| `accepted` | - | Link created, both notified |
| `declined` | - | No link, requester not notified of decline |
| `expired` | After 30 days | Auto-cleanup, can re-request |
| `blocked` | Permanent until unblocked | Cannot send new requests |

### 5.7 Link States

```
┌──────────┐     accept      ┌──────────┐
│ pending  │────────────────►│  active  │
└──────────┘                 └──────────┘
     │                            │
     │ decline/expire             │ either user unlinks
     ▼                            ▼
┌──────────┐                ┌──────────┐
│ rejected │                │ unlinked │
└──────────┘                └──────────┘
     │
     │ block
     ▼
┌──────────┐
│ blocked  │
└──────────┘
```

**Unlinking behavior:**
- Either party can unlink at any time
- Unlinking is silent (other party not notified)
- Local Friend records remain, just disconnected
- Can re-link later by sending new request

---

## 6. Shared Weaves (Token Model)

### 6.1 Concept Overview

A **Shared Weave** is like a calendar invite:
- **Shared data**: Date, title, location, shared notes
- **Private data**: Each participant's vibe, reflection, duration perception

```
                    ┌─────────────────────────────────┐
                    │        SHARED WEAVE TOKEN       │
                    │  ─────────────────────────────  │
                    │  📅 Saturday, Dec 14, 3pm       │
                    │  📍 Blue Bottle Coffee          │
                    │  📝 "Catch-up after holidays"   │
                    │  👥 Hannah, Rachel              │
                    │  🔄 Status: Confirmed           │
                    └─────────────────────────────────┘
                           │              │
              ┌────────────┘              └────────────┐
              ▼                                        ▼
┌─────────────────────────────┐      ┌─────────────────────────────┐
│   HANNAH'S LOCAL RECORD     │      │   RACHEL'S LOCAL RECORD     │
│  ─────────────────────────  │      │  ─────────────────────────  │
│  🌙 Vibe: Warm              │      │  🌙 Vibe: Energizing        │
│  ⏱️ Duration: 2 hours        │      │  ⏱️ Duration: 1.5 hours      │
│  💭 "Rachel seemed stressed │      │  💭 "Great to catch up,     │
│      about work..."         │      │      feeling refreshed"     │
│  🎯 Initiator: Me           │      │  🎯 Initiator: Hannah       │
│  📊 Score: +15              │      │  📊 Score: +12              │
│  🏷️ Tier: Close Friends     │      │  🏷️ Tier: Inner Circle      │
└─────────────────────────────┘      └─────────────────────────────┘
```

### 6.2 Shared vs Private Fields

| Field | Shared | Private | Notes |
|-------|--------|---------|-------|
| Date/Time | ✓ | | Same event, same time |
| Title | ✓ | | "Coffee catch-up" |
| Location | ✓ | | Logistics |
| Shared Notes | ✓ | | Like calendar description |
| Participants | ✓ | | Who was there |
| Status | ✓ | | planned/completed/cancelled |
| Vibe | | ✓ | Subjective experience |
| Duration | | ✓ | Perception may differ |
| Private Notes | | ✓ | Personal reflection |
| Reflection | | ✓ | Structured reflection |
| Initiator | | ✓ | From each perspective |
| Dunbar Tier | | ✓ | Your classification |
| Score Impact | | ✓ | Your weave score |

### 6.3 Creating a Shared Weave

**From the Weave Logger:**

```
┌─────────────────────────────────────┐
│  Log a Weave                        │
│  ─────────────────────────────────  │
│                                     │
│  Friends: Rachel ✓ (linked)         │
│           Tom                       │
│                                     │
│  Date: Dec 14, 2024                 │
│  Activity: Coffee                   │
│                                     │
│  ─────────────────────────────────  │
│  📤 Share with Rachel?              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │ ☑️ Share this weave          │   │
│  │                             │   │
│  │ Rachel will receive this    │   │
│  │ weave and can add her own   │   │
│  │ notes and reflections.      │   │
│  └─────────────────────────────┘   │
│                                     │
│  Shared title: Coffee catch-up      │
│  Shared notes: Finally syncing up!  │
│                                     │
│           [Log Weave]               │
└─────────────────────────────────────┘
```

**What happens:**

1. Hannah logs the weave with "Share" enabled
2. System creates `SharedWeave` record
3. Hannah's local `Interaction` is created and linked
4. Rachel receives push notification
5. Rachel can accept (creates her local `Interaction`) or decline

### 6.4 Receiving a Shared Weave

**Push notification:**
```
Weave: Hannah logged a weave with you
"Coffee catch-up at Blue Bottle"
```

**In-app view:**

```
┌─────────────────────────────────────┐
│  Incoming Weave from Hannah         │
│  ─────────────────────────────────  │
│                                     │
│  ☕ Coffee catch-up                 │
│  📅 Saturday, Dec 14 at 3pm         │
│  📍 Blue Bottle Coffee              │
│                                     │
│  📝 "Finally syncing up after       │
│      the holidays!"                 │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│  [Accept]  [Edit & Accept]  [✕]     │
│                                     │
└─────────────────────────────────────┘
```

**Accept options:**

| Option | Behavior |
|--------|----------|
| **Accept** | Creates local Interaction with shared fields, user fills private fields later |
| **Edit & Accept** | Opens weave logger pre-filled, user can modify before saving |
| **Decline (✕)** | No local record created, Hannah not notified |

### 6.5 Planned Weaves (Invitations)

For future events, shared weaves act as invitations:

```
Hannah plans: "Dinner Saturday?"
        │
        ▼
┌─────────────────────────────────────┐
│  📨 Weave Invitation from Hannah    │
│  ─────────────────────────────────  │
│                                     │
│  🍽️ Dinner at Chez Panisse          │
│  📅 Saturday, Dec 21 at 7pm         │
│  📍 Chez Panisse                    │
│                                     │
│  📝 "Birthday dinner! My treat 🎂"  │
│                                     │
│  [Accept]  [Maybe]  [Decline]       │
│                                     │
└─────────────────────────────────────┘
```

**Invitation states:**

| State | Rachel's Action | Hannah Sees |
|-------|-----------------|-------------|
| `pending` | No response yet | "Awaiting response" |
| `accepted` | Tapped Accept | "Rachel is coming!" |
| `maybe` | Tapped Maybe | "Rachel might come" |
| `declined` | Tapped Decline | "Rachel can't make it" |

### 6.6 Editing Shared Weaves

**Who can edit:**
- Creator can edit shared fields
- Changes propagate to all participants
- Participants receive update notification

**Edit flow:**

```
Hannah changes location: "Blue Bottle" → "Starbucks"
        │
        ▼
SharedWeave record updated
        │
        ▼
Rachel receives notification:
"Hannah updated the weave location"
        │
        ▼
Rachel's linked Interaction updated automatically
(shared fields only, her private data unchanged)
```

**Conflict prevention:**
- Only creator can edit shared fields
- Participants edit their own private fields
- No merge conflicts possible

### 6.7 Completing Shared Weaves

After a planned weave occurs:

```
┌─────────────────────────────────────┐
│  How was your weave?                │
│  ─────────────────────────────────  │
│                                     │
│  🍽️ Dinner at Chez Panisse          │
│  📅 Saturday, Dec 21                │
│  👥 with Hannah                     │
│                                     │
│  [Mark Complete]  [Didn't Happen]   │
│                                     │
└─────────────────────────────────────┘
```

**Completion is individual:**
- Each participant marks complete independently
- Each adds their own vibe/reflection
- Hannah completing doesn't auto-complete for Rachel

---

## 7. Data Models

### 7.1 Supabase Tables (Cloud)

```sql
-- User accounts and public profiles
CREATE TABLE user_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT,
  phone_hash TEXT,  -- For contact matching
  email_hash TEXT,  -- For contact matching
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Public profile
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  photo_url TEXT,
  birthday TEXT,  -- MM-DD format
  archetype TEXT,
  timezone TEXT,
  bio TEXT,

  -- Privacy settings
  discoverable_by_contacts BOOLEAN DEFAULT true,
  discoverable_by_username BOOLEAN DEFAULT true,

  -- Metadata
  last_seen_at TIMESTAMPTZ,
  app_version TEXT
);

CREATE INDEX idx_user_accounts_username ON user_accounts(username);
CREATE INDEX idx_user_accounts_phone_hash ON user_accounts(phone_hash);
CREATE INDEX idx_user_accounts_email_hash ON user_accounts(email_hash);

-- Friend links between users
CREATE TABLE friend_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID REFERENCES user_accounts(id),
  user_b_id UUID REFERENCES user_accounts(id),

  -- Local friend record references (for profile sync)
  user_a_friend_id TEXT,  -- A's local Friend ID for B
  user_b_friend_id TEXT,  -- B's local Friend ID for A

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, active, blocked
  initiated_by UUID REFERENCES user_accounts(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  linked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,  -- For pending requests

  -- Sharing preferences (per-link)
  user_a_share_preference TEXT DEFAULT 'ask',  -- auto, ask, never
  user_b_share_preference TEXT DEFAULT 'ask',

  UNIQUE(user_a_id, user_b_id)
);

CREATE INDEX idx_friend_links_user_a ON friend_links(user_a_id);
CREATE INDEX idx_friend_links_user_b ON friend_links(user_b_id);
CREATE INDEX idx_friend_links_status ON friend_links(status);

-- Shared weave tokens
CREATE TABLE shared_weaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES user_accounts(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Shared fields
  weave_date TIMESTAMPTZ NOT NULL,
  title TEXT,
  location TEXT,
  shared_notes TEXT,
  weave_type TEXT NOT NULL,  -- 'plan' or 'log'

  -- Status
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, confirmed, completed, cancelled

  -- For plans
  event_importance TEXT  -- low, medium, high, critical
);

CREATE INDEX idx_shared_weaves_created_by ON shared_weaves(created_by);
CREATE INDEX idx_shared_weaves_date ON shared_weaves(weave_date);

-- Participants in shared weaves
CREATE TABLE shared_weave_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_weave_id UUID REFERENCES shared_weaves(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_accounts(id),

  -- Local interaction reference
  local_interaction_id TEXT,  -- Their local Interaction ID once accepted

  -- Response
  response TEXT NOT NULL DEFAULT 'pending',  -- pending, accepted, maybe, declined
  responded_at TIMESTAMPTZ,

  -- Notifications
  notified_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,

  UNIQUE(shared_weave_id, user_id)
);

CREATE INDEX idx_swp_shared_weave ON shared_weave_participants(shared_weave_id);
CREATE INDEX idx_swp_user ON shared_weave_participants(user_id);
CREATE INDEX idx_swp_response ON shared_weave_participants(response);
```

### 7.2 WatermelonDB Models (Local)

```typescript
// New: Extended Friend model fields
// Add to existing Friend model

@field('linked_user_id') linkedUserId?: string;  // If linked to a Weave user
@field('linked_at') linkedAt?: number;
@field('profile_synced_at') profileSyncedAt?: number;

// Existing fields that can now be auto-filled:
// - photoUrl (from linked profile)
// - birthday (from linked profile)
// - archetype (suggested from linked profile)
```

```typescript
// New: SharedWeaveRef model (local reference to shared weave)
// Tracks which local interactions are linked to shared weaves

@Model.table('shared_weave_refs')
class SharedWeaveRef extends Model {
  @field('shared_weave_id') sharedWeaveId!: string;  // Cloud shared_weave ID
  @field('interaction_id') interactionId!: string;   // Local Interaction ID
  @field('is_creator') isCreator!: boolean;
  @field('response') response!: string;  // pending, accepted, declined
  @field('last_synced_at') lastSyncedAt?: number;
}
```

### 7.3 Schema Migration

```typescript
// Add to migrations
{
  toVersion: 45,  // or next version
  steps: [
    // Add linked user fields to friends
    addColumns({
      table: 'friends',
      columns: [
        { name: 'linked_user_id', type: 'string', isOptional: true },
        { name: 'linked_at', type: 'number', isOptional: true },
        { name: 'profile_synced_at', type: 'number', isOptional: true },
      ],
    }),
    // New table for shared weave references
    createTable({
      name: 'shared_weave_refs',
      columns: [
        { name: 'shared_weave_id', type: 'string', isIndexed: true },
        { name: 'interaction_id', type: 'string', isIndexed: true },
        { name: 'is_creator', type: 'boolean' },
        { name: 'response', type: 'string' },
        { name: 'last_synced_at', type: 'number', isOptional: true },
      ],
    }),
  ],
}
```

---

## 8. API Design

### 8.1 Authentication Endpoints

```typescript
// Supabase Auth handles these, but for reference:

POST /auth/signup
POST /auth/signin
POST /auth/signout
POST /auth/refresh
POST /auth/verify-email
POST /auth/reset-password
```

### 8.2 Profile Endpoints

```typescript
// Get current user profile
GET /api/profile
Response: UserAccount

// Update profile
PATCH /api/profile
Body: { displayName?, photoUrl?, birthday?, archetype?, bio?, timezone? }

// Check username availability
GET /api/profile/username/check?username=hannah.lee
Response: { available: boolean, suggestions?: string[] }

// Set username
POST /api/profile/username
Body: { username: string }

// Get public profile by username
GET /api/profile/public/@{username}
Response: PublicProfile (limited fields)

// Get public profile by user ID
GET /api/profile/public/{userId}
Response: PublicProfile
```

### 8.3 Discovery Endpoints

```typescript
// Search users by username
GET /api/discover/search?q=rachel
Response: { users: PublicProfile[] }

// Find contacts
POST /api/discover/contacts
Body: { hashes: string[] }  // SHA-256 hashes
Response: { matches: { hash: string, userId: string, profile: PublicProfile }[] }

// Get user's QR code data
GET /api/discover/qr-code
Response: { code: string, deepLink: string }

// Resolve QR code / invite link
GET /api/discover/resolve/{code}
Response: PublicProfile
```

### 8.4 Friend Link Endpoints

```typescript
// Send link request
POST /api/links/request
Body: { targetUserId: string, localFriendId?: string }
Response: FriendLink

// Get pending requests (received)
GET /api/links/requests/incoming
Response: { requests: FriendLinkWithProfile[] }

// Get pending requests (sent)
GET /api/links/requests/outgoing
Response: { requests: FriendLinkWithProfile[] }

// Respond to request
POST /api/links/requests/{linkId}/respond
Body: { action: 'accept' | 'decline' | 'block', localFriendId?: string }

// Get active links
GET /api/links
Response: { links: FriendLinkWithProfile[] }

// Update link preferences
PATCH /api/links/{linkId}
Body: { sharePreference: 'auto' | 'ask' | 'never' }

// Remove link
DELETE /api/links/{linkId}

// Block user
POST /api/links/block/{userId}
```

### 8.5 Shared Weave Endpoints

```typescript
// Create shared weave
POST /api/shared-weaves
Body: {
  participantUserIds: string[],
  weaveDate: string,
  title?: string,
  location?: string,
  sharedNotes?: string,
  weaveType: 'plan' | 'log',
  eventImportance?: string,
  localInteractionId: string  // Creator's local ID
}
Response: SharedWeave

// Get shared weaves (incoming)
GET /api/shared-weaves/incoming?status=pending
Response: { weaves: SharedWeaveWithCreator[] }

// Get shared weaves (created by me)
GET /api/shared-weaves/outgoing
Response: { weaves: SharedWeaveWithResponses[] }

// Respond to shared weave
POST /api/shared-weaves/{id}/respond
Body: {
  response: 'accepted' | 'maybe' | 'declined',
  localInteractionId?: string  // If accepting
}

// Update shared weave (creator only)
PATCH /api/shared-weaves/{id}
Body: { title?, location?, sharedNotes?, weaveDate?, status? }

// Get shared weave details
GET /api/shared-weaves/{id}
Response: SharedWeaveWithParticipants
```

### 8.6 Supabase Edge Functions

```typescript
// Trigger: On shared_weave insert
// Function: notify-shared-weave-participants
// Purpose: Send push notifications to all participants

// Trigger: On shared_weave update
// Function: notify-shared-weave-update
// Purpose: Notify participants of changes

// Trigger: On friend_link accept
// Function: sync-friend-profiles
// Purpose: Exchange profile data between linked users

// Scheduled: Daily
// Function: expire-pending-requests
// Purpose: Clean up expired link requests (30 days)

// Scheduled: Daily
// Function: send-weave-reminders
// Purpose: Remind about upcoming planned shared weaves
```

---

## 9. Migration Strategy

### 9.1 User Segments

| Segment | Current State | Migration Path |
|---------|---------------|----------------|
| **New users** | No data | Account creation in onboarding |
| **Existing, engaged** | Rich local data | Prompted migration with value prop |
| **Existing, casual** | Some data | Soft prompts over time |
| **Privacy-focused** | Local preference | Account optional, never forced |

### 9.2 Migration Flow for Existing Users

```
1. User opens app after update
        │
        ▼
2. What's New screen highlights sharing features
        │
        ▼
3. Contextual prompts appear over time:
   - When adding a friend: "Know their Weave username?"
   - When logging: "Your friend uses Weave - share this weave?"
   - In settings: "Create account to unlock sharing"
        │
        ▼
4. User taps "Create Account"
        │
        ▼
5. Account creation flow (Section 3.4)
        │
        ▼
6. System assigns user_id to ALL existing records:
   - Friends
   - Interactions
   - InteractionFriends
   - UserProfile
   - LifeEvents
   - Intentions
   - WeeklyReflections
   - JournalEntries
        │
        ▼
7. Initial sync uploads all data to cloud
        │
        ▼
8. User can now:
   - Share weaves with linked friends
   - Be discovered by username/contacts
   - Sync across devices
```

### 9.3 Data Assignment Script

```typescript
async function migrateLocalDataToAccount(userId: string) {
  await database.write(async () => {
    // Get all tables that need user_id assignment
    const tables = [
      'friends',
      'interactions',
      'interaction_friends',
      'user_profile',
      'life_events',
      'intentions',
      'intention_friends',
      'weekly_reflections',
      'journal_entries',
      'user_progress',
    ];

    const operations: any[] = [];

    for (const table of tables) {
      const records = await database.get(table).query().fetch();

      for (const record of records) {
        if (!record.userId) {
          operations.push(
            record.prepareUpdate((r: any) => {
              r.userId = userId;
              r.customSyncStatus = 'pending';
            })
          );
        }
      }
    }

    await database.batch(...operations);
  });

  // Trigger initial sync
  await syncEngine.syncAll();
}
```

### 9.4 Rollback Safety

- Local data is never deleted during migration
- Account deletion removes cloud data, local data remains
- User can continue using app locally if account creation fails
- Sync failures don't block local operations

---

## 10. Security & Privacy

### 10.1 Data Classification

| Data Type | Storage | Encryption | Sharing |
|-----------|---------|------------|---------|
| Auth credentials | Supabase Auth | At rest + transit | Never |
| Email/Phone (raw) | Supabase (private) | At rest | Never |
| Email/Phone (hash) | Supabase (indexed) | At rest | For matching only |
| Public profile | Supabase | At rest + transit | With linked friends |
| Friend records | Local + Cloud | At rest | Never (user's private view) |
| Interactions | Local + Cloud | At rest | Shared fields only, with consent |
| Reflections/Notes | Local + Cloud | At rest | Never |
| Weave scores | Local + Cloud | At rest | Never |

### 10.2 Contact Hashing

```typescript
// Normalization
function normalizePhone(phone: string): string {
  // Remove all non-digits, add country code
  return phone.replace(/\D/g, '').replace(/^0/, '+1');
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// Hashing with app-specific salt
const APP_SALT = 'weave-contact-discovery-v1';

function hashIdentifier(value: string): string {
  return crypto
    .createHash('sha256')
    .update(value + APP_SALT)
    .digest('hex');
}

// Example
hashIdentifier(normalizePhone('+1 (555) 123-4567'))
// → 'a1b2c3d4e5f6...' (64 char hex)
```

### 10.3 Privacy Controls

**User settings:**

```typescript
interface PrivacySettings {
  discoverableByUsername: boolean;   // Can be found via username search
  discoverableByContacts: boolean;   // Can be found via contact matching
  shareProfilePhoto: boolean;        // Show photo to linked friends
  shareBirthday: boolean;            // Share birthday with linked friends
  shareArchetype: boolean;           // Share archetype with linked friends
  defaultSharePreference: 'auto' | 'ask' | 'never';
}
```

**Per-link overrides:**

```typescript
interface LinkPrivacy {
  shareWeaves: 'auto' | 'ask' | 'never';  // Per-friend setting
}
```

### 10.4 Rate Limiting

| Action | Limit | Window |
|--------|-------|--------|
| Link requests sent | 20 | 24 hours |
| Username searches | 60 | 1 hour |
| Contact matching | 3 | 24 hours |
| Shared weave creation | 50 | 24 hours |
| Profile updates | 10 | 1 hour |

### 10.5 Abuse Prevention

**Link request spam:**
- Rate limited
- Users can block to prevent future requests
- Blocked users cannot discover blocker

**Fake profiles:**
- Email verification required for contact matching
- Report mechanism for impersonation
- Account age requirements for certain features

**Data scraping:**
- Username search returns limited results
- Profile data requires authentication
- Contact matching returns user IDs only (not profiles directly)

---

## 11. Implementation Roadmap

### Phase 1: Account Foundation (4-6 weeks)

**Goal:** Basic account system, no sharing yet

**Deliverables:**
- [ ] Supabase Auth setup (email, Apple, Google)
- [ ] Username system with availability check
- [ ] Profile creation and editing screens
- [ ] Archetype quiz flow
- [ ] Local data migration to user_id
- [ ] Basic cloud sync for account holders
- [ ] Account deletion flow

**Database:**
- [ ] `user_accounts` table
- [ ] Profile API endpoints
- [ ] Auth edge functions

**UI Screens:**
- [ ] Sign up / Sign in
- [ ] Username selection
- [ ] Profile edit
- [ ] Archetype quiz (7 questions)
- [ ] Quiz result reveal
- [ ] Account settings

**Success Criteria:**
- Users can create accounts
- Profile data syncs to cloud
- Archetype quiz completion rate > 60%

---

### Phase 2: Friend Discovery & Linking (3-4 weeks)

**Goal:** Connect Weave users as linked friends

**Deliverables:**
- [ ] Username search
- [ ] QR code generation and scanning
- [ ] Share link generation
- [ ] Contact matching (hashed)
- [ ] Link request send/receive flow
- [ ] Link acceptance/decline
- [ ] Friend profile auto-fill from linked user

**Database:**
- [ ] `friend_links` table
- [ ] Link API endpoints
- [ ] Discovery API endpoints
- [ ] Contact hash matching function

**UI Screens:**
- [ ] Find friends screen
- [ ] QR code display/scan
- [ ] Link requests inbox
- [ ] Link confirmation modal
- [ ] Linked indicator on friend profile

**Success Criteria:**
- 20% of account holders send a link request
- 50% of link requests accepted
- Profile auto-fill works correctly

---

### Phase 3: Basic Shared Weaves (4-5 weeks)

**Goal:** Log once, share with linked friends

**Deliverables:**
- [ ] "Share this weave" option in logger
- [ ] Shared weave creation API
- [ ] Incoming weave notifications
- [ ] Accept/decline flow
- [ ] Local interaction creation from shared weave
- [ ] Shared field sync (date, title, location, notes)

**Database:**
- [ ] `shared_weaves` table
- [ ] `shared_weave_participants` table
- [ ] `shared_weave_refs` local table
- [ ] Shared weave API endpoints
- [ ] Notification triggers

**UI Screens:**
- [ ] Share toggle in weave logger
- [ ] Shared fields input (title, notes)
- [ ] Incoming weaves list
- [ ] Accept/edit/decline modal
- [ ] Shared indicator on interaction

**Success Criteria:**
- 30% of weaves with linked friends are shared
- 70% of shared weaves accepted
- Time to log weave reduced by 40% for shared

---

### Phase 4: Planned Weave Invitations (3-4 weeks)

**Goal:** Plan weaves together, RSVP system

**Deliverables:**
- [ ] "Invite to weave" for planned interactions
- [ ] RSVP flow (accept/maybe/decline)
- [ ] Response status visible to creator
- [ ] Mutual reminders before planned weave
- [ ] Completion prompts for both parties

**Database:**
- [ ] Extend `shared_weave_participants` for RSVP
- [ ] Reminder scheduling

**UI Screens:**
- [ ] Invite friends picker
- [ ] RSVP status display
- [ ] Invitation received screen
- [ ] Reminder notifications

**Success Criteria:**
- 40% of planned weaves with linked friends are shared
- 80% of invitations receive a response
- 60% of accepted invitations completed

---

### Phase 5: Shared Weave Editing & Polish (2-3 weeks)

**Goal:** Full collaborative weave management

**Deliverables:**
- [ ] Creator can edit shared fields
- [ ] Changes propagate to participants
- [ ] Update notifications
- [ ] Reschedule flow
- [ ] Cancel flow with notifications
- [ ] Historical shared weave view

**UI Screens:**
- [ ] Edit shared weave modal
- [ ] Update notification
- [ ] Shared weave history

**Success Criteria:**
- Edit propagation latency < 5 seconds
- Reschedule notifications received by 95%+

---

### Phase 6: Advanced Features (Ongoing)

**Future enhancements:**
- [ ] Shared photo attachments
- [ ] Verified reciprocity (who initiated)
- [ ] Shared life events (birthday sync)
- [ ] "Suggest a weave" to linked friend
- [ ] Weekly shared weave summary
- [ ] Multi-participant weaves (group invitations)

---

## 12. Success Metrics

### Acquisition Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Account creation rate | 40% of DAU | Accounts created / DAU |
| Quiz completion rate | 60% of signups | Quiz completed / signups |
| Username claim rate | 95% of signups | Usernames set / signups |

### Engagement Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Link request rate | 30% of accounts | Accounts sending 1+ request |
| Link acceptance rate | 50% | Accepted / total requests |
| Avg links per user | 3+ | Total active links / users |
| Shared weave rate | 40% of eligible | Shared weaves / weaves with linked friends |
| Shared weave acceptance | 70% | Accepted / total shared |

### Retention Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| D7 retention (account) | 50% | Return within 7 days |
| D30 retention (account) | 30% | Return within 30 days |
| Linked user D30 | 45% | D30 for users with 1+ link |

### Quality Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Profile data accuracy | 90%+ | Birthday matches for linked friends |
| Sync reliability | 99.5% | Successful syncs / attempts |
| Notification delivery | 98% | Delivered / sent |
| Time to accept shared weave | < 4 hours median | Time from creation to acceptance |

---

## Appendix A: Archetype Quiz Questions

### Question 1
**"When you have free time with a friend, you're most drawn to..."**
- A deep conversation over coffee (Hermit, High Priestess)
- An adventure or new experience (Fool, Sun)
- Working on something creative together (Magician)
- A cozy hangout at home (Empress, Emperor)

### Question 2
**"In your friendships, you tend to be the one who..."**
- Listens and offers emotional support (High Priestess, Empress)
- Plans and organizes get-togethers (Emperor)
- Suggests spontaneous plans (Fool)
- Brings energy and celebrates wins (Sun, Magician)

### Question 3
**"The friendships that energize you most are ones where..."**
- You can be completely yourself, no filter (Hermit, High Priestess)
- There's always something new to explore (Fool, Magician)
- You feel taken care of and can return the favor (Empress)
- You laugh a lot and have fun together (Sun)

### Question 4
**"When a friend is going through a hard time, you typically..."**
- Create space for them to share and process (Hermit, High Priestess)
- Try to distract them with fun activities (Fool, Sun)
- Show up with practical help and care (Empress, Emperor)
- Help them brainstorm solutions (Magician)

### Question 5
**"Your ideal friend group size is..."**
- Just one close friend at a time (Hermit)
- A small, consistent crew (Emperor, Empress)
- The more the merrier! (Sun)
- Depends on the adventure (Fool, Magician)

### Question 6
**"You feel most connected to friends when..."**
- Sharing meaningful conversations (Hermit, High Priestess)
- Experiencing something new together (Fool, Magician)
- Celebrating milestones and wins (Sun)
- Being there through thick and thin (Empress, Emperor)

### Question 7
**"If you could describe your friendship style in one word..."**
- Deep (Hermit, High Priestess)
- Fun (Sun, Fool)
- Reliable (Emperor, Empress)
- Creative (Magician)

---

## Appendix B: Error States & Edge Cases

### Account Creation
- Email already exists → Offer sign-in or password reset
- Username taken → Suggest variations
- Network failure → Retry with exponential backoff
- Verification email not received → Resend option

### Friend Linking
- User not found → "No user with that username"
- Already linked → "You're already connected with @username"
- Request pending → "Request already sent, awaiting response"
- User blocked you → "Unable to send request" (no indication of block)
- Self-request → Prevent in UI

### Shared Weaves
- Participant unlinks before responding → Mark as "participant unavailable"
- Creator deletes account → Shared weave orphaned, local copies remain
- Network failure during share → Retry, show "pending sync" state
- Participant declines → No notification to creator

### Profile Sync
- Linked user deletes photo → Local photo remains until manual refresh
- Birthday format mismatch → Normalize on save
- Archetype changes → Notify linked friends? (TBD)

---

## Appendix C: Notification Templates

### Push Notifications

```
Link Request:
  Title: "New connection request"
  Body: "{name} wants to connect on Weave"

Link Accepted:
  Title: "You're connected!"
  Body: "{name} accepted your connection request"

Shared Weave (Log):
  Title: "Weave logged"
  Body: "{name} logged a weave with you: {title}"

Shared Weave (Invitation):
  Title: "Weave invitation"
  Body: "{name} invited you to: {title}"

Weave Updated:
  Title: "Weave updated"
  Body: "{name} changed the {field} for {title}"

Weave Reminder:
  Title: "Upcoming weave"
  Body: "{title} with {name} is tomorrow"
```

---

*Document Version 1.0 - December 2024*
