# Accounts & Sharing System - Design Document

> **Status**: Draft
> **Version**: 1.0
> **Last Updated**: December 2024

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Core Value Proposition](#3-core-value-proposition)
4. [User Account System](#4-user-account-system)
5. [Self-Sovereign Profile](#5-self-sovereign-profile)
6. [Archetype Discovery Quiz](#6-archetype-discovery-quiz)
7. [Friend Linking System](#7-friend-linking-system)
8. [Shared Weaves (Token Model)](#8-shared-weaves-token-model)
9. [Data Models](#9-data-models)
10. [Technical Architecture](#10-technical-architecture)
11. [Privacy & Security](#11-privacy--security)
12. [Migration Strategy](#12-migration-strategy)
13. [Phased Rollout](#13-phased-rollout)
14. [Future Possibilities](#14-future-possibilities)
15. [Open Questions](#15-open-questions)

---

## 1. Executive Summary

This document outlines the design for introducing **user accounts** and **bi-directional weave sharing** to Weave. The core insight is powerful: **reduce friction by leveraging the network effect** - if both parties use the app, the data entry burden is halved (or better).

### Key Features

- **User Accounts**: Email/password + OAuth (Apple, Google) + unique username
- **Self-Sovereign Profiles**: Users own their identity (photo, birthday, archetype) which flows to friends who add them
- **Archetype Quiz**: Optional onboarding experience to discover your social archetype
- **Friend Linking**: Connect with other Weave users via contacts, QR codes, or usernames
- **Shared Weaves**: Calendar-invite-style sharing where logistics are shared but reflections remain private

### Design Principles

1. **Opt-in everything** - No auto-discovery, no forced social features
2. **Privacy-first** - Personal reflections, scores, and tier assignments remain private
3. **Local-first remains default** - Sharing enhances but doesn't require accounts
4. **Graceful degradation** - App works fully offline and without an account

---

## 2. Problem Statement

### Current Pain Points

1. **Data Entry Friction**: Users must manually log every interaction, even when meeting with friends who also use Weave
2. **Duplicate Effort**: When Hannah and Rachel meet for coffee, both must log the same event separately
3. **Inaccurate Friend Data**: Users guess at friends' birthdays, archetypes, and other details
4. **No Verification**: Reciprocity tracking relies on user's perception, not actual data
5. **Single Device**: No cloud backup means data loss risk and no multi-device support

### Opportunity

If Rachel uses Weave:
- Hannah shouldn't have to manually enter Rachel's birthday
- When Hannah logs coffee with Rachel, Rachel should receive a notification
- Reciprocity can be **verified** rather than guessed
- Both users benefit from reduced data entry

---

## 3. Core Value Proposition

### Network Effect Incentive

```
┌─────────────────────────────────────────────────────────────────┐
│                    THE NETWORK EFFECT                           │
│                                                                 │
│  Friends on Weave: 0    → Full manual data entry               │
│  Friends on Weave: 5    → 50% less logging for those friends   │
│  Friends on Weave: 15   → Significant time savings             │
│  Friends on Weave: 30+  → Weave becomes effortless             │
│                                                                 │
│  "The relationship app that actually knows your relationships" │
└─────────────────────────────────────────────────────────────────┘
```

### Value by User Type

| User Type | Value Proposition |
|-----------|-------------------|
| Solo User (no linked friends) | Cloud backup, multi-device, archetype quiz |
| Partially Linked | Reduced data entry for linked friends, verified data |
| Fully Networked | Near-zero friction, verified reciprocity, shared planning |

---

## 4. User Account System

### Authentication Methods

| Method | Priority | Notes |
|--------|----------|-------|
| Email + Password | P0 | Core auth method |
| Sign in with Apple | P0 | Required for iOS App Store |
| Sign in with Google | P1 | Popular OAuth provider |
| Phone Number (future) | P2 | For contact matching |

### Account Identifiers

```typescript
interface UserAccount {
  id: string;                    // UUID, primary key
  email: string;                 // Unique, verified
  username: string;              // Unique, @handle style (like Instagram)
  phone?: string;                // Optional, for contact matching
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: Date;
  lastLoginAt: Date;
}
```

### Username Requirements

- **Format**: 3-30 characters, alphanumeric + underscores
- **Case**: Case-insensitive (stored lowercase)
- **Uniqueness**: Globally unique
- **Change Policy**: Can change once per 14 days
- **Reserved**: Block offensive terms, "weave", "admin", "support", etc.

### Account Creation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ACCOUNT CREATION                            │
│                                                                 │
│  [Continue with Apple]                                         │
│  [Continue with Google]                                        │
│  ─────────── or ───────────                                    │
│  [Sign up with Email]                                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Already have an account? [Sign In]                      │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CHOOSE YOUR USERNAME                          │
│                                                                 │
│  @  [________________]                                         │
│                                                                 │
│  ✓ Available                                                   │
│                                                                 │
│  This is how friends will find you on Weave                    │
│                                                                 │
│  [Continue →]                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SET UP YOUR PROFILE                           │
│                                                                 │
│        ┌─────────┐                                             │
│        │  📷 +   │  Add a photo (optional)                     │
│        └─────────┘                                             │
│                                                                 │
│  Display Name: [________________]                              │
│  Birthday:     [__/__] (MM/DD, optional)                       │
│                                                                 │
│  [Continue →]              [Skip for now]                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              ✨ DISCOVER YOUR ARCHETYPE                         │
│                                                                 │
│  Take a short quiz to discover your social archetype -         │
│  how you naturally show up in friendships.                     │
│                                                                 │
│  [Take the Quiz ✨]        [Maybe Later]                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Self-Sovereign Profile

### The Concept

Users **own their identity**. When someone adds you as a friend, your profile data flows to them automatically.

```
┌─────────────────────────────────────────┐
│         Rachel's Profile                │
│  ┌─────────────────────────────────┐    │
│  │ 📸 Photo                        │    │
│  │ 🎂 Birthday: March 15           │    │
│  │ 🌟 Archetype: The Hermit        │    │
│  │ 🌐 Timezone: EST                │    │
│  │ @rachelmiller                   │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
                    │
                    ▼ When Hannah links with Rachel
┌─────────────────────────────────────────┐
│   Hannah's Friend Record: Rachel        │
│  ┌─────────────────────────────────┐    │
│  │ 📸 Photo ← auto-filled          │    │
│  │ 🎂 Birthday ← auto-filled       │    │
│  │ 🌟 Archetype ← suggested        │    │  ← Can override
│  │ ─────────────────────────────── │    │
│  │ 🏷️ Dunbar Tier: [Hannah's]      │    │  ← Private to Hannah
│  │ 📝 Notes: [Hannah's]            │    │  ← Private to Hannah
│  │ 📊 Weave Score: [Hannah's]      │    │  ← Private to Hannah
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Profile Data Model

```typescript
interface UserProfile {
  // Identity (synced to linked friends)
  displayName: string;
  photoUrl?: string;
  birthday?: string;           // "MM-DD" format
  timezone?: string;
  archetype?: Archetype;       // Self-selected via quiz

  // Discovery settings
  discoverableByContacts: boolean;  // Default: false
  discoverableByUsername: boolean;  // Default: true
  showBirthdayYear: boolean;        // Default: false (only show MM-DD)

  // Profile visibility
  profileVisibility: 'linked_only' | 'anyone';  // Default: linked_only
}
```

### What's Shared vs. Private

| Data | Shared with Linked Friends | Notes |
|------|---------------------------|-------|
| Display Name | ✅ Yes | Always shared |
| Photo | ✅ Yes | If set |
| Birthday (MM-DD) | ✅ Yes | Year optional |
| Archetype | ✅ Yes | As suggestion |
| Timezone | ✅ Yes | For scheduling |
| Username | ✅ Yes | For discovery |
| **Dunbar Tier** | ❌ No | Your perception |
| **Weave Score** | ❌ No | Your relationship health |
| **Notes** | ❌ No | Private reflections |
| **Interaction history** | ❌ No | Unless shared |

### Archetype as Suggestion

The archetype system has an interesting tension:

- **Current Model**: Archetypes describe the *relationship dynamic*, not the person
  - Hannah-Rachel = "The Hermit" (deep 1:1 conversations)
  - Rachel-Tom = "The Fool" (spontaneous adventures)
  - Same person, different archetypes per relationship

- **New Model**: Self-set archetype as *starting point*
  - Rachel says "I'm The Hermit"
  - When Hannah adds Rachel, archetype pre-fills as "The Hermit"
  - Hannah can keep it OR change to match their specific dynamic

**Resolution**: Self-set archetype becomes a **suggestion**, not an override.

---

## 6. Archetype Discovery Quiz

### Purpose

A beautiful onboarding moment that helps users discover their social archetype - how they naturally show up in friendships.

### Quiz Design

**Format**: 8 questions, visual/emotional rather than analytical (one per archetype)

**Duration**: 2-3 minutes

**Result**: Archetype reveal with beautiful card artwork

```
┌─────────────────────────────────────────────────────────────────┐
│           ✨ Discover Your Social Archetype                     │
│                                                                 │
│  Question 1 of 7                                               │
│                                                                 │
│  "When you connect with friends, what energizes you most?"     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🌙 Deep, meaningful 1:1 conversations                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🎭 Spontaneous adventures & surprises                   │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☀️ Celebrating together in groups                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🎨 Creating or building things together                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│                    ○ ○ ○ ○ ○ ○ ○                               │
└─────────────────────────────────────────────────────────────────┘
```

### Sample Questions

1. **Energy Source**: "When you connect with friends, what energizes you most?"
2. **Ideal Hangout**: "Your ideal Friday night with a close friend looks like..."
3. **Support Style**: "When a friend is going through a hard time, you tend to..."
4. **Planning Preference**: "How do you prefer to make plans?"
5. **Conversation Style**: "In conversations, you're most drawn to..."
6. **Group Dynamics**: "In a group of friends, you naturally..."
7. **Connection Frequency**: "How often do you like to connect with close friends?"

### Scoring Algorithm

Each answer maps to one or more archetypes with weighted scores:

```typescript
interface QuizAnswer {
  questionId: string;
  selectedOption: string;
  archetypeScores: {
    sun: number;      // 0-10
    hermit: number;
    emperor: number;
    fool: number;
    empress: number;
    magician: number;
    highPriestess: number;
    lovers: number;
  };
}

// Final score = sum of all answer scores per archetype
// Result = archetype with highest score
// Secondary = second highest (shown as "with touches of...")
```

### Result Screen

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                    ┌─────────────────┐                         │
│                    │                 │                         │
│                    │   🌙 HERMIT     │                         │
│                    │   [Card Art]    │                         │
│                    │                 │                         │
│                    └─────────────────┘                         │
│                                                                 │
│                  You are The Hermit                            │
│              with touches of The High Priestess                │
│                                                                 │
│  You thrive in deep, meaningful one-on-one connections.        │
│  Quality over quantity defines your social world. You're       │
│  the friend who remembers the details and creates space        │
│  for real conversation.                                        │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Your Strengths                                          │   │
│  │ • Deep listening                                        │   │
│  │ • Thoughtful presence                                   │   │
│  │ • Meaningful conversation                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Save to Profile]              [Retake Quiz]                  │
└─────────────────────────────────────────────────────────────────┘
```

### Quiz Data Model

```typescript
interface QuizResult {
  id: string;
  userId: string;
  completedAt: Date;
  answers: QuizAnswer[];
  primaryArchetype: Archetype;
  secondaryArchetype?: Archetype;
  scores: Record<Archetype, number>;
}
```

---

## 7. Friend Linking System

### Linking Methods

| Method | Description | Privacy Level |
|--------|-------------|---------------|
| **Username Search** | Search by @username | Low friction, opt-in |
| **QR Code** | Scan in-person | High trust, immediate |
| **Share Code** | 6-character code | Medium friction |
| **Contact Matching** | Hash-based matching | Requires permission |

### Method 1: Username Search

```
┌─────────────────────────────────────────────────────────────────┐
│                    🔗 Link a Friend                             │
│                                                                 │
│  Search by username                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ @  [rachel_____________]                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 👤 Rachel Miller                                        │   │
│  │    @rachelmiller                                        │   │
│  │    [Send Link Request]                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────── or ───────────                                    │
│                                                                 │
│  [📱 Scan QR Code]    [🔢 Enter Code]    [📇 From Contacts]   │
└─────────────────────────────────────────────────────────────────┘
```

### Method 2: QR Code / Share Code

```
┌─────────────────────────────────────────────────────────────────┐
│                    🔗 Your Link Code                            │
│                                                                 │
│           ┌─────────────────────────────┐                      │
│           │                             │                      │
│           │     [QR CODE GRAPHIC]       │                      │
│           │                             │                      │
│           └─────────────────────────────┘                      │
│                                                                 │
│                    WEAVE-H7X9                                  │
│                                                                 │
│  Share this code with a friend to link your accounts           │
│                                                                 │
│  [Copy Code]              [Share...]                           │
│                                                                 │
│  Code expires in 24 hours                                      │
└─────────────────────────────────────────────────────────────────┘
```

### Method 3: Contact Matching

**Privacy-preserving flow:**

```
User enables "Find friends from contacts"
        │
        ▼
App requests contact permission
        │
        ▼
App hashes phone numbers/emails locally (SHA-256 of normalized value)
        │
        ▼
Only hashes sent to server (no names, no raw data)
        │
        ▼
Server matches against other users' hashed identifiers
        │
        ▼
Returns matches: "3 of your contacts use Weave"
        │
        ▼
User explicitly chooses to send link requests
```

**Normalization rules:**
- Phone: Remove all non-digits, add country code if missing
- Email: Lowercase, trim whitespace

```typescript
// Example
const normalizedPhone = "+14155551234";
const hash = SHA256(normalizedPhone + APP_SALT);
// Hash: "a1b2c3d4e5f6..."
```

### Link Request Flow

```
Hannah's App                          Rachel's App
────────────────                      ────────────────
[Friend Profile: Rachel]
    │
    ▼
[🔗 Link Weave Account]
    │
    ▼
[Shows QR / Searches @rachel]
    │                                     │
    └────── Request sent ─────────────────┘
                                          │
                                          ▼
                                      [Push: "Hannah wants to link"]
                                          │
                                          ▼
                                      ┌─────────────────────────┐
                                      │ Link Request from       │
                                      │ Hannah (@hannahj)       │
                                      │                         │
                                      │ [Accept]  [Decline]     │
                                      └─────────────────────────┘
                                          │
                                          ▼ (Accept)
                                      [✓ Linked! You can now    ]
                                      [  share weaves with      ]
                                      [  Hannah                 ]
```

### Link States

```typescript
type LinkStatus =
  | 'pending'      // Request sent, awaiting response
  | 'active'       // Both parties accepted
  | 'declined'     // Recipient declined
  | 'blocked'      // One party blocked the other
  | 'expired';     // Request expired (14 days)
```

### Link Expiration

- **Pending requests**: Expire after 14 days
- **Expired behavior**: Request disappears, sender can re-request
- **Declined behavior**: Cannot re-request for 30 days

---

## 8. Shared Weaves (Token Model)

### The Calendar Invite Analogy

Shared weaves work like calendar invites: **shared logistics, private reflections**.

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHARED (The Token)                           │
│  ─────────────────────────────────────────────────────────────  │
│  📅 Date: Saturday, Dec 14, 2024 @ 2:00 PM                     │
│  📍 Location: Blue Bottle Coffee, Hayes Valley                 │
│  📝 Title: "Catch-up coffee"                                   │
│  💬 Shared Notes: "Finally syncing up after the holidays"      │
│  👥 Participants: Hannah, Rachel                               │
│  🏷️ Type: plan → completed                                     │
└─────────────────────────────────────────────────────────────────┘
                    │                    │
         ┌─────────┘                    └─────────┐
         ▼                                        ▼
┌─────────────────────────┐          ┌─────────────────────────┐
│   Hannah's Private      │          │   Rachel's Private      │
│  ─────────────────────  │          │  ─────────────────────  │
│  🌙 Vibe: Warm          │          │  🌙 Vibe: Energizing    │
│  ⏱️ Duration: 2 hours    │          │  ⏱️ Duration: 1.5 hours  │
│  💭 Reflection: "Rachel │          │  💭 Reflection: "So     │
│     seemed stressed,    │          │     good to finally     │
│     should check in     │          │     catch up!"          │
│     more..."            │          │                         │
│  🎯 Initiator: Me       │          │  🎯 Initiator: Hannah   │
│  📊 +15 points          │          │  📊 +12 points          │
└─────────────────────────┘          └─────────────────────────┘
```

### What This Enables

1. **Same event, different experiences** - Totally valid for two people to perceive the same hangout differently
2. **Privacy preserved** - Personal reflections never shared
3. **Reduced duplication** - Log once, both benefit
4. **Verified reciprocity** - System knows who initiated
5. **Accurate timestamps** - No more "was it last week or two weeks ago?"

### Shared Weave Lifecycle

```
┌──────────────┐
│   Created    │  Hannah logs/plans a weave with Rachel
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Pending    │  Rachel receives notification
└──────┬───────┘
       │
       ├─────────────────┬─────────────────┐
       ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   Accepted   │  │   Declined   │  │   Expired    │
│              │  │              │  │  (7 days)    │
└──────┬───────┘  └──────────────┘  └──────────────┘
       │
       ▼
┌──────────────┐
│  Completed   │  Both parties can add private details
└──────────────┘
```

### Sharing Flow: Logging a Weave

```
┌─────────────────────────────────────────────────────────────────┐
│                    📝 Log a Weave                               │
│                                                                 │
│  Who did you connect with?                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ [Rachel 🔗]  [Tom]  [Sarah]  [+]                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  🔗 Rachel is on Weave! Share this weave with her?             │
│     [✓] Share logistics (date, location, activity)             │
│     [ ] Include shared notes                                   │
│                                                                 │
│  ... rest of logging flow ...                                  │
│                                                                 │
│  [Log Weave]                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Receiving a Shared Weave

```
┌─────────────────────────────────────────────────────────────────┐
│  [Push Notification]                                           │
│  "Hannah shared a weave with you"                              │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Shared Weave from Hannah                     │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ☕ Coffee @ Blue Bottle                                 │   │
│  │ Saturday, Dec 14 • 2:00 PM                              │   │
│  │ Hayes Valley                                            │   │
│  │                                                         │   │
│  │ "Catch-up coffee"                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  [Accept]     [Edit & Accept]     [Decline]                    │
│                                                                 │
│  Accepting will add this weave to your log.                    │
│  You can add your own private notes and reflection.            │
└─────────────────────────────────────────────────────────────────┘
```

### Shared Weave Editing

When the creator edits shared details, participants see updates:

**Editable by creator (syncs to all):**
- Date/time
- Location
- Title
- Shared notes
- Status (plan → completed, cancelled)

**Not editable after sharing:**
- Participants (can't remove someone after they accepted)

**Edit notification:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Hannah updated "Coffee @ Blue Bottle"                          │
│  📅 New time: Sunday, Dec 15 @ 3:00 PM                         │
│  📍 New location: Sightglass Coffee                            │
│                                                                 │
│  [View Details]                              [Dismiss]          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Data Models

### Supabase Tables (Server)

```sql
-- User accounts (extends Supabase auth.users)
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  username VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  photo_url TEXT,
  birthday VARCHAR(5),           -- "MM-DD"
  timezone VARCHAR(50),
  archetype VARCHAR(20),

  -- Discovery settings
  discoverable_by_contacts BOOLEAN DEFAULT false,
  discoverable_by_username BOOLEAN DEFAULT true,
  profile_visibility VARCHAR(20) DEFAULT 'linked_only',

  -- Contact identifiers (hashed)
  phone_hash VARCHAR(64),        -- SHA-256
  email_hash VARCHAR(64),        -- SHA-256

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Friend links (connections between users)
CREATE TABLE friend_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID REFERENCES user_profiles(id),
  user_b_id UUID REFERENCES user_profiles(id),

  -- Local friend record references
  user_a_friend_id VARCHAR(36),  -- A's local Friend record for B
  user_b_friend_id VARCHAR(36),  -- B's local Friend record for A

  status VARCHAR(20) DEFAULT 'pending',  -- pending, active, declined, blocked, expired
  initiated_by UUID REFERENCES user_profiles(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  linked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,        -- For pending requests

  UNIQUE(user_a_id, user_b_id)
);

-- Link codes for QR/manual linking
CREATE TABLE link_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  code VARCHAR(10) UNIQUE NOT NULL,  -- e.g., "WEAVE-H7X9"
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared weaves (the "token")
CREATE TABLE shared_weaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES user_profiles(id),

  -- Shared fields
  weave_date TIMESTAMPTZ NOT NULL,
  title VARCHAR(200),
  location VARCHAR(200),
  shared_notes TEXT,
  activity VARCHAR(50),
  weave_type VARCHAR(20) NOT NULL,  -- 'plan' or 'log'
  status VARCHAR(20) DEFAULT 'pending',  -- pending, confirmed, completed, cancelled

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared weave participants
CREATE TABLE shared_weave_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_weave_id UUID REFERENCES shared_weaves(id) ON DELETE CASCADE,
  user_id UUID REFERENCES user_profiles(id),

  -- Link to local interaction (after acceptance)
  local_interaction_id VARCHAR(36),

  response VARCHAR(20) DEFAULT 'pending',  -- pending, accepted, declined
  responded_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(shared_weave_id, user_id)
);

-- Archetype quiz results
CREATE TABLE quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  answers JSONB NOT NULL,
  primary_archetype VARCHAR(20) NOT NULL,
  secondary_archetype VARCHAR(20),
  scores JSONB NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact hashes for matching (privacy-preserving)
CREATE TABLE contact_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES user_profiles(id),
  hash_type VARCHAR(10) NOT NULL,  -- 'phone' or 'email'
  hash_value VARCHAR(64) NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(hash_type, hash_value)
);

-- Indexes
CREATE INDEX idx_friend_links_user_a ON friend_links(user_a_id);
CREATE INDEX idx_friend_links_user_b ON friend_links(user_b_id);
CREATE INDEX idx_friend_links_status ON friend_links(status);
CREATE INDEX idx_shared_weaves_created_by ON shared_weaves(created_by);
CREATE INDEX idx_shared_weave_participants_user ON shared_weave_participants(user_id);
CREATE INDEX idx_contact_hashes_value ON contact_hashes(hash_value);
```

### WatermelonDB Models (Local)

```typescript
// New: Linked user reference on Friend model
// Add to existing Friend model
@field('linked_user_id') linkedUserId?: string;        // Supabase user ID if linked
@field('linked_at') linkedAt?: number;                  // When link was established
@field('profile_synced_at') profileSyncedAt?: number;  // Last profile sync

// New table: Local shared weave tracking
tableSchema({
  name: 'shared_weave_refs',
  columns: [
    { name: 'shared_weave_id', type: 'string', isIndexed: true },  // Supabase ID
    { name: 'local_interaction_id', type: 'string', isIndexed: true },
    { name: 'direction', type: 'string' },  // 'outgoing' | 'incoming'
    { name: 'status', type: 'string' },     // pending, accepted, declined
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ]
})
```

---

## 10. Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (React Native)                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ WatermelonDB│  │ Auth Store  │  │ Sync Engine │             │
│  │ (local-first)│  │ (Zustand)   │  │             │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SUPABASE                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │    Auth     │  │  Database   │  │   Storage   │             │
│  │  (GoTrue)   │  │ (Postgres)  │  │  (S3-like)  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│  ┌──────┴────────────────┴────────────────┴──────┐             │
│  │              Edge Functions                    │             │
│  │  • Link request handling                       │             │
│  │  • Shared weave fan-out                        │             │
│  │  • Contact matching                            │             │
│  │  • Push notification triggers                  │             │
│  └───────────────────────────────────────────────┘             │
│                          │                                      │
│  ┌───────────────────────┴───────────────────────┐             │
│  │              Realtime                          │             │
│  │  • Link request notifications                  │             │
│  │  • Shared weave updates                        │             │
│  │  • Profile changes                             │             │
│  └───────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PUSH NOTIFICATIONS                           │
│                    (Expo Push / OneSignal)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Edge Functions

```typescript
// 1. Handle link requests
// POST /functions/v1/link-request
interface LinkRequestPayload {
  targetUserId?: string;      // Direct link by user ID
  targetUsername?: string;    // Link by username
  linkCode?: string;          // Link by code
}

// 2. Handle shared weave creation
// POST /functions/v1/shared-weave
interface SharedWeavePayload {
  date: string;
  title?: string;
  location?: string;
  sharedNotes?: string;
  activity: string;
  type: 'plan' | 'log';
  participantUserIds: string[];
}

// 3. Contact matching
// POST /functions/v1/match-contacts
interface ContactMatchPayload {
  hashes: Array<{
    type: 'phone' | 'email';
    hash: string;
  }>;
}

// 4. Profile sync
// GET /functions/v1/linked-profiles
// Returns profile data for all linked friends
```

### Real-time Subscriptions

```typescript
// Subscribe to link requests
supabase
  .channel('link-requests')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'friend_links',
    filter: `user_b_id=eq.${userId}`,
  }, handleLinkRequest)
  .subscribe();

// Subscribe to shared weave updates
supabase
  .channel('shared-weaves')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'shared_weave_participants',
    filter: `user_id=eq.${userId}`,
  }, handleSharedWeaveUpdate)
  .subscribe();
```

---

## 11. Privacy & Security

### Core Principles

1. **Opt-in Everything**: No auto-discovery, no forced connections
2. **Local-first**: App works fully offline, sharing is enhancement
3. **Minimal Data Sharing**: Only share what's necessary
4. **User Control**: Easy to unlink, block, or delete data
5. **Transparent**: Clear about what's shared and with whom

### What's NEVER Shared

| Data | Reason |
|------|--------|
| Your notes about friends | Private reflections |
| Your Dunbar tier assignments | Your perception of closeness |
| Your weave scores | Your relationship health metric |
| Your reflection content | Personal journaling |
| Your suggestions/insights | Personalized to you |
| Raw contact data | Only hashes sent for matching |

### What CAN Be Shared (With Consent)

| Data | Sharing Context |
|------|-----------------|
| Display name | With linked friends |
| Photo | With linked friends |
| Birthday (MM-DD) | With linked friends |
| Archetype | As suggestion to linked friends |
| Weave logistics | When explicitly sharing a weave |
| Shared notes | When explicitly included |

### Security Measures

1. **Contact Hashing**
   - SHA-256 with app-specific salt
   - Normalized before hashing
   - Only hashes transmitted
   - Hashes deleted on account deletion

2. **Link Request Throttling**
   - Max 10 requests per day
   - 30-day cooldown after decline
   - Blocked users can't see you exist

3. **Data Encryption**
   - All traffic over HTTPS
   - Sensitive fields encrypted at rest
   - Supabase Row Level Security (RLS)

4. **Account Deletion**
   - Deletes all server data
   - Unlinks all friends
   - Local data optionally preserved

### Row Level Security Policies

```sql
-- Users can only see their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can update own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- Users can view profiles of linked friends
CREATE POLICY "Users can view linked profiles"
  ON user_profiles FOR SELECT
  USING (
    id IN (
      SELECT user_b_id FROM friend_links
      WHERE user_a_id = auth.uid() AND status = 'active'
      UNION
      SELECT user_a_id FROM friend_links
      WHERE user_b_id = auth.uid() AND status = 'active'
    )
  );

-- Shared weaves visible to participants only
CREATE POLICY "Participants can view shared weaves"
  ON shared_weaves FOR SELECT
  USING (
    id IN (
      SELECT shared_weave_id FROM shared_weave_participants
      WHERE user_id = auth.uid()
    )
    OR created_by = auth.uid()
  );
```

---

## 12. Migration Strategy

### For Existing Local-Only Users

```
┌─────────────────────────────────────────────────────────────────┐
│  Existing User Opens App After Update                           │
│                                                                 │
│  [Banner: "New! Share weaves with friends on Weave"]           │
│  [Learn More]                              [Not Now]            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ (Learn More)
┌─────────────────────────────────────────────────────────────────┐
│              ✨ Introducing Weave Accounts                      │
│                                                                 │
│  Create an account to:                                         │
│  • Back up your data to the cloud                              │
│  • Share weaves with friends who use Weave                     │
│  • Sync across multiple devices                                │
│  • Never lose your relationship data                           │
│                                                                 │
│  Your existing data stays exactly where it is.                 │
│  Creating an account just adds cloud backup.                   │
│                                                                 │
│  [Create Account]              [Maybe Later]                   │
└─────────────────────────────────────────────────────────────────┘
```

### Migration Flow

```
1. User creates account (auth)
        │
        ▼
2. System assigns user_id to ALL existing local records
        │
        ▼
3. Initial full sync to cloud (background)
        │
        ▼
4. User prompted to complete profile (optional)
        │
        ▼
5. User prompted to take archetype quiz (optional)
        │
        ▼
6. User can now link with friends and share weaves
```

### Key Guarantees

| Concern | Solution |
|---------|----------|
| "I don't want an account" | Fully supported forever. Accounts optional. |
| "Will I lose my data?" | No. Data stays on device AND syncs to cloud. |
| "Can I delete cloud copy?" | Yes. Account deletion removes all server data. |
| "What if I change my mind?" | Can unlink friends, disable sharing anytime. |

---

## 13. Phased Rollout

### Phase 1: Foundation (Account System)

**Duration**: 2-3 weeks
**Goal**: Users can create accounts and back up data

**Deliverables**:
- [ ] Supabase auth setup (email + Apple + Google)
- [ ] `user_profiles` table and RLS policies
- [ ] Sign up / sign in UI flows
- [ ] Username selection and validation
- [ ] Basic profile creation (name, photo)
- [ ] Local → account migration flow
- [ ] Assign `user_id` to existing records

**Success Metrics**:
- Account creation completion rate
- Sync success rate
- User retention after account creation

---

### Phase 2: Profile & Quiz

**Duration**: 2 weeks
**Goal**: Rich user profiles with archetype discovery

**Deliverables**:
- [ ] Profile editing UI
- [ ] Birthday and timezone fields
- [ ] Archetype quiz questions and flow
- [ ] Quiz scoring algorithm
- [ ] Result screen with archetype reveal
- [ ] Save archetype to profile
- [ ] `quiz_results` table

**Success Metrics**:
- Quiz completion rate
- Quiz retake rate
- Profile completion rate

---

### Phase 3: Friend Linking

**Duration**: 2-3 weeks
**Goal**: Users can connect with other Weave users

**Deliverables**:
- [ ] `friend_links` table and RLS
- [ ] `link_codes` table
- [ ] Username search UI
- [ ] QR code generation/scanning
- [ ] Manual code entry
- [ ] Link request flow (send/receive)
- [ ] Accept/decline UI
- [ ] Push notifications for requests
- [ ] "Friends on Weave" indicator in app
- [ ] Profile data auto-fill for linked friends

**Success Metrics**:
- Links created per user
- Link request acceptance rate
- Time to first link

---

### Phase 4: Contact Discovery (Optional)

**Duration**: 1-2 weeks
**Goal**: Find friends via contacts (privacy-preserving)

**Deliverables**:
- [ ] Contact permission flow
- [ ] Local hash computation
- [ ] `contact_hashes` table
- [ ] Matching edge function
- [ ] "X contacts on Weave" UI
- [ ] Link request from matches

**Success Metrics**:
- Contact permission grant rate
- Matches found per user
- Conversion from match to link

---

### Phase 5: Basic Sharing

**Duration**: 2-3 weeks
**Goal**: Share logged weaves with linked friends

**Deliverables**:
- [ ] `shared_weaves` table and RLS
- [ ] `shared_weave_participants` table
- [ ] "Share with linked friends" option in logger
- [ ] Shared weave creation flow
- [ ] Incoming weave notification
- [ ] Accept/decline shared weave UI
- [ ] Local interaction creation on accept
- [ ] Real-time subscription for updates

**Success Metrics**:
- Weaves shared per user
- Share acceptance rate
- Time from share to accept

---

### Phase 6: Rich Sharing

**Duration**: 2-3 weeks
**Goal**: Full shared weave feature set

**Deliverables**:
- [ ] Shared weave editing (creator)
- [ ] Edit notifications to participants
- [ ] Plan invitations (share future plans)
- [ ] Plan → completed flow for shared weaves
- [ ] Shared weave history view
- [ ] Mutual reminders for plans

**Success Metrics**:
- Plans shared vs. logs shared
- Plan completion rate
- Edit frequency

---

### Phase 7: Verified Insights

**Duration**: 1-2 weeks
**Goal**: Leverage linked data for better insights

**Deliverables**:
- [ ] Verified reciprocity (who initiated, confirmed by both)
- [ ] "You've initiated X of Y recent weaves with [Friend]"
- [ ] Birthday sync from profile
- [ ] Archetype consistency indicator

**Success Metrics**:
- Verified vs. self-reported data accuracy
- User engagement with verified insights

---

## 14. Future Possibilities

Once the foundation is built, many doors open:

### Near-term (1-3 months post-launch)

| Feature | Description | Value |
|---------|-------------|-------|
| Multi-device sync | Same account on phone + tablet | Flexibility |
| Shared photo memories | Attach photos to shared weaves | Richer memories |
| Group weave invites | Plan weaves with multiple friends | Easier coordination |

### Medium-term (3-6 months post-launch)

| Feature | Description | Value |
|---------|-------------|-------|
| Weave suggestions from friends | "Rachel wants to grab coffee this week" | Mutual intent |
| Availability sharing | "I'm free Thursday evening" | Easier scheduling |
| Reciprocity insights | Verified "you always initiate" | Relationship awareness |

### Long-term (6+ months post-launch)

| Feature | Description | Value |
|---------|-------------|-------|
| Friendship health reports | Mutual view of relationship | Shared growth |
| Joint reflections | "How was your last hangout?" to both | Deeper insight |
| Friend recommendations | "You both know Sarah, maybe..." | Network weaving |

---

## 15. Open Questions

### Product Questions

1. **Subscription tier**: Should sharing be a premium feature, or free for all?
   - Option A: Free for all (network effect growth)
   - Option B: Premium only (monetization lever)
   - Option C: Free basic, premium for advanced (contact matching, etc.)

2. **Non-user invites**: Should users be able to invite non-Weave friends via the app?
   - Risk: Feels spammy, growth-hacky
   - Opportunity: Natural referral mechanism

3. **Shared weave limits**: Should there be limits on pending shared weaves?
   - Concern: Someone could spam you with weave shares
   - Mitigation: Easy mute/block, rate limiting

### Technical Questions

1. **Offline shared weaves**: How to handle sharing when offline?
   - Option A: Queue locally, sync when online
   - Option B: Require online for sharing

2. **Conflict resolution**: What if both people log the same event separately?
   - Option A: Smart merge suggestion
   - Option B: Keep both, show duplicate indicator
   - Option C: First-to-share wins

3. **Data retention**: How long to keep expired/declined shared weaves?
   - For analytics: Keep 90 days
   - For user: Delete immediately or after 30 days?

### Privacy Questions

1. **Profile visibility**: Should unlinked users see anything when searched?
   - Option A: Just username + photo (current design)
   - Option B: Nothing until linked
   - Option C: User chooses

2. **Block behavior**: What happens to shared weave history when blocked?
   - Option A: History preserved but no new sharing
   - Option B: History hidden
   - Option C: User chooses

---

## Appendix A: Archetype Descriptions

| Archetype | Energy | Ideal Activities | Quiz Traits |
|-----------|--------|------------------|-------------|
| **The Sun** | Celebration, shared joy | Group activities, events, parties | Extroverted, energized by groups |
| **The Hermit** | Deep 1:1 connection | Long talks, quiet hangouts | Introverted, values depth |
| **The Emperor** | Structure, reliability | Scheduled meetups, routines | Organized, consistent |
| **The Fool** | Spontaneity, adventure | Last-minute plans, new experiences | Flexible, excitement-seeking |
| **The Empress** | Nurturing, care | Support, thoughtful gestures | Caring, attentive |
| **The Magician** | Creativity, collaboration | Projects, brainstorming | Creative, idea-oriented |
| **The High Priestess** | Depth, intuition | Meaningful conversation, emotional support | Intuitive, emotionally intelligent |
| **The Lovers** | Deep bond, mutual devotion | Quality time, intimate connection, shared values | Harmonious, aligned, reflective |

---

## Appendix B: Notification Templates

### Link Requests

```
Title: "Hannah wants to connect on Weave"
Body: "Accept to share weaves and sync friend data"
Action: Opens link request screen
```

### Shared Weave (New)

```
Title: "Hannah shared a weave with you"
Body: "Coffee @ Blue Bottle • Dec 14"
Action: Opens shared weave detail
```

### Shared Weave (Updated)

```
Title: "Hannah updated your shared weave"
Body: "Coffee @ Blue Bottle moved to Dec 15"
Action: Opens shared weave detail
```

### Plan Reminder (Mutual)

```
Title: "Reminder: Coffee with Hannah tomorrow"
Body: "Blue Bottle @ 2:00 PM"
Action: Opens plan detail
```

---

## Appendix C: Error States

### Link Request Errors

| Error | User Message | Recovery |
|-------|--------------|----------|
| User not found | "No user found with that username" | Retry or use different method |
| Already linked | "You're already connected with Hannah" | Show existing link |
| Request pending | "You already have a pending request" | Show pending state |
| Blocked | "Unable to send request" | No recovery (don't reveal block) |
| Rate limited | "You've sent too many requests today. Try again tomorrow." | Wait |

### Shared Weave Errors

| Error | User Message | Recovery |
|-------|--------------|----------|
| Not linked | "You're not connected with this friend on Weave" | Offer to send link request |
| Participant declined | "Hannah declined this shared weave" | Create new share |
| Weave expired | "This shared weave has expired" | Create new share |
| Edit conflict | "Hannah is also editing this weave" | Refresh and retry |

---

*Document maintained by the Weave team. Last updated December 2024.*
