# Accounts & Sharing System - Design Document

> **Status**: Draft
> **Version**: 1.2
> **Last Updated**: December 2024

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Core Value Proposition](#3-core-value-proposition)
4. [Subscription Model](#4-subscription-model)
5. [User Account System](#5-user-account-system)
6. [Self-Sovereign Profile](#6-self-sovereign-profile)
7. [Archetype Discovery Quiz](#7-archetype-discovery-quiz)
8. [Friend Linking System](#8-friend-linking-system)
9. [Shared Weaves (Token Model)](#9-shared-weaves-token-model)
10. [Duplicate Detection (Fuzzy Matching)](#10-duplicate-detection-fuzzy-matching)
11. [Offline-First Sharing Architecture](#11-offline-first-sharing-architecture)
12. [Photo Storage](#12-photo-storage)
13. [Data Models](#13-data-models)
14. [Technical Architecture](#14-technical-architecture)
15. [Leveraging Existing Infrastructure](#15-leveraging-existing-infrastructure)
16. [Privacy & Security](#16-privacy--security)
17. [Account Deletion & Unlinking](#17-account-deletion--unlinking)
18. [Migration Strategy](#18-migration-strategy)
19. [Phased Rollout](#19-phased-rollout)
20. [Future Possibilities](#20-future-possibilities)
21. [Open Questions](#21-open-questions)

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

### Why Accounts? The Philosophical Shift

Accounts aren't just a technical feature—they represent a fundamental evolution in Weave's philosophy.

#### From Personal Tracker → Shared Relationship Garden

**Current Model (Local-Only):**
```
┌─────────────────────────────────────────────────────────────────┐
│  Hannah's Weave                    Rachel's Weave              │
│  ┌─────────────────────┐          ┌─────────────────────┐      │
│  │ Rachel: 72 points   │          │ Hannah: 65 points   │      │
│  │ Tier: Close Friend  │          │ Tier: Inner Circle  │      │
│  │ Last saw: 2 weeks   │          │ Last saw: 3 weeks   │      │
│  │ I initiate: 60%     │          │ I initiate: 40%     │      │
│  └─────────────────────┘          └─────────────────────┘      │
│                                                                 │
│  Two separate views of the SAME relationship                   │
│  Neither knows how the other perceives it                       │
│  Both guessing at reciprocity                                   │
└─────────────────────────────────────────────────────────────────┘
```

**With Accounts (Linked):**
```
┌─────────────────────────────────────────────────────────────────┐
│                 Hannah ←→ Rachel Relationship                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              SHARED REALITY                              │    │
│  │  Last weave: Coffee @ Blue Bottle (both confirmed)      │    │
│  │  Total weaves together: 24 this year                    │    │
│  │  Initiation: Hannah 55% / Rachel 45% (verified)         │    │
│  │  Upcoming: Rachel wants to plan something               │    │
│  └─────────────────────────────────────────────────────────┘    │
│        │                                    │                    │
│        ▼                                    ▼                    │
│  ┌──────────────┐                  ┌──────────────┐             │
│  │ Hannah's     │                  │ Rachel's     │             │
│  │ Private View │                  │ Private View │             │
│  │ Tier: Close  │                  │ Tier: Inner  │             │
│  │ Notes: ...   │                  │ Notes: ...   │             │
│  │ Score: 72    │                  │ Score: 65    │             │
│  └──────────────┘                  └──────────────┘             │
│                                                                 │
│  Shared facts + private perceptions = complete picture          │
└─────────────────────────────────────────────────────────────────┘
```

#### The Core Insight: Relationships Are Inherently Mutual

A friendship isn't something one person owns—it's a shared bond that both people nurture. The local-only model treats relationships as **one-sided perceptions**. Accounts enable Weave to model relationships as they actually exist: **mutual investments**.

This unlocks:

| Capability | Why It Matters |
|-----------|----------------|
| **Verified Reciprocity** | Stop guessing who initiates. Know for certain. |
| **Mutual Intent Signals** | "Rachel wants to hang out" becomes visible to Hannah |
| **Shared Memory** | Both people contribute to the relationship's story |
| **Reduced Cognitive Load** | Log once, both benefit. The network does the work. |
| **Relationship as Shared Responsibility** | Both parties can invest, not just one |

#### Growth Through Philosophy, Not Gimmicks

The network effect isn't a growth hack—it's philosophically aligned with how relationships work:

```
┌─────────────────────────────────────────────────────────────────┐
│                    NATURAL GROWTH LOOP                           │
│                                                                 │
│  1. Hannah logs coffee with Rachel                              │
│     └─► Rachel receives: "Hannah logged a weave with you"       │
│                                                                 │
│  2. Rachel thinks: "Oh, Hannah is tracking our friendship"      │
│     └─► Rachel is curious, downloads Weave                      │
│                                                                 │
│  3. Rachel creates account, links with Hannah                   │
│     └─► Hannah sees: "Rachel is now on Weave!"                  │
│                                                                 │
│  4. Now both benefit:                                           │
│     └─► Neither has to manually log their hangouts              │
│     └─► Both see verified reciprocity                           │
│     └─► Both can express intent ("I want to hang out")          │
│                                                                 │
│  5. Rachel invites Tom, Sarah, Mike...                          │
│     └─► The network grows organically                           │
│                                                                 │
│  THIS IS NOT SPAM. This is modeling how friendships actually    │
│  spread—through genuine connection, not marketing.              │
└─────────────────────────────────────────────────────────────────┘
```

#### What Accounts Unlock for the Philosophy

| Weave Principle | How Accounts Enhance It |
|----------------|------------------------|
| **Mindful Connection** | Shared weaves create moments of mutual acknowledgment |
| **Reducing Social Guilt** | "They're tracking too" normalizes intentional friendship |
| **Quality Over Quantity** | Verified data reveals true relationship patterns |
| **Social Health as Priority** | Both parties actively investing = healthier relationships |
| **Combating Loneliness** | Seeing a friend cares (they logged you!) reduces isolation |

---

## 4. Subscription Model

### Decision: Free Core, Premium Intelligence

The subscription model is designed to maximize network effect growth while monetizing advanced features.

### Tier Breakdown

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Core weave logging, tier management, all 7 archetypes, basic suggestions, friend linking, shared weaves, cloud backup |
| **Plus** | $4.99/mo | Advanced insights, portfolio analysis, relationship health trends, priority support |
| **Premium** | $9.99/mo | Everything in Plus + AI-powered features, smart suggestions, conversation starters, relationship coaching |

### Free Tier (Core Experience)

**Included:**
- ✅ Unlimited friends and weave logging
- ✅ Dunbar tier management (Inner Circle, Close Friends, Community)
- ✅ All 7 tarot archetypes with decay modifiers
- ✅ Basic suggestions ("You haven't seen Rachel in 2 weeks")
- ✅ Friend linking and shared weaves
- ✅ Cloud backup and multi-device sync
- ✅ Archetype discovery quiz
- ✅ Birthday and life event tracking
- ✅ Basic reciprocity tracking (self-reported)

**Rationale:** The free tier must be compelling enough to drive adoption and network effects. Linking and sharing are free because they become more valuable as more people use them.

### Plus Tier (Advanced Insights)

**Includes Free +:**
- ✅ Portfolio analysis (tier distribution, balance scores)
- ✅ Effectiveness scoring per friend
- ✅ Relationship health trends over time
- ✅ Social season insights (Resting/Balanced/Blooming)
- ✅ Verified reciprocity metrics (with linked friends)
- ✅ Weekly reflection prompts with personalized insights
- ✅ Export data to CSV/JSON

### Premium Tier (AI-Powered)

**Includes Plus +:**
- ✅ AI-generated conversation starters
- ✅ Smart activity suggestions based on archetype
- ✅ Relationship coaching insights
- ✅ Conflict pattern detection
- ✅ Natural language weave logging ("Had coffee with Rachel yesterday")
- ✅ AI-summarized relationship history
- ✅ Future: Voice-based logging

### Mapping to Existing Infrastructure

The codebase already has subscription infrastructure:

```typescript
// Existing in auth.store.ts
type SubscriptionTier = 'free' | 'plus' | 'premium';

// Existing in user_subscriptions table
tier: 'free' | 'plus' | 'premium'
status: 'active' | 'canceled' | 'past_due' | 'trialing'
```

**Implementation:** Use existing `useFeatureGate()` hook (currently stubbed) to gate features:

```typescript
// In useFeatureGate.ts - implement actual gating
const FEATURE_TIERS: Record<string, SubscriptionTier[]> = {
  'basic-logging': ['free', 'plus', 'premium'],
  'friend-linking': ['free', 'plus', 'premium'],
  'shared-weaves': ['free', 'plus', 'premium'],
  'portfolio-analysis': ['plus', 'premium'],
  'effectiveness-scoring': ['plus', 'premium'],
  'ai-suggestions': ['premium'],
  'ai-coaching': ['premium'],
  'voice-logging': ['premium'],
};
```

---

## 5. User Account System

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

**Format**: 7 questions, visual/emotional rather than analytical

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

## 10. Duplicate Detection (Fuzzy Matching)

### The Problem

When both Hannah and Rachel log the same coffee meetup separately, the system needs to detect this and avoid double-counting while preserving each user's private data.

### Fuzzy Matching Algorithm

```typescript
interface WeaveSignature {
  date: Date;
  participantIds: string[];  // Linked user IDs
  location?: string;
  activity?: string;
}

interface MatchScore {
  score: number;          // 0-100
  confidence: 'high' | 'medium' | 'low';
  matchedFields: string[];
}

function calculateMatchScore(weave1: WeaveSignature, weave2: WeaveSignature): MatchScore {
  let score = 0;
  const matchedFields: string[] = [];

  // Date proximity (max 40 points)
  const hoursDiff = Math.abs(weave1.date - weave2.date) / (1000 * 60 * 60);
  if (hoursDiff <= 2) {
    score += 40;
    matchedFields.push('date_exact');
  } else if (hoursDiff <= 6) {
    score += 30;
    matchedFields.push('date_close');
  } else if (hoursDiff <= 24) {
    score += 15;
    matchedFields.push('date_same_day');
  }

  // Participant overlap (max 35 points)
  const overlap = intersect(weave1.participantIds, weave2.participantIds);
  const overlapRatio = overlap.length / Math.max(weave1.participantIds.length, weave2.participantIds.length);
  score += Math.round(overlapRatio * 35);
  if (overlapRatio > 0.8) matchedFields.push('participants_match');

  // Location similarity (max 15 points)
  if (weave1.location && weave2.location) {
    const locationSimilarity = fuzzyStringMatch(weave1.location, weave2.location);
    score += Math.round(locationSimilarity * 15);
    if (locationSimilarity > 0.7) matchedFields.push('location_match');
  }

  // Activity match (max 10 points)
  if (weave1.activity === weave2.activity) {
    score += 10;
    matchedFields.push('activity_match');
  }

  return {
    score,
    confidence: score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low',
    matchedFields,
  };
}
```

### Match Thresholds

| Score | Confidence | Action |
|-------|------------|--------|
| 70-100 | High | Auto-merge (link weaves silently) |
| 50-69 | Medium | Suggest merge to user |
| 0-49 | Low | Treat as separate events |

### Merge Behavior

When duplicates are detected:

```
┌─────────────────────────────────────────────────────────────────┐
│  Hannah logs: "Coffee with Rachel @ Blue Bottle, 2pm"           │
│                          │                                      │
│                          ▼                                      │
│  Server checks: Any weaves from Rachel with Hannah in last 24h? │
│                          │                                      │
│                          ▼ (Found: Rachel logged "Coffee with   │
│                              Hannah @ Blue Bottle, 2:30pm")     │
│                          │                                      │
│                          ▼ Match score: 85 (High confidence)    │
│                          │                                      │
│                          ▼                                      │
│  Auto-link: Both weaves reference same shared_weave_id          │
│  Each keeps their private data (vibe, reflection, points)       │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model for Linked Duplicates

```sql
-- Add to shared_weaves table
ALTER TABLE shared_weaves ADD COLUMN
  merge_source VARCHAR(20) DEFAULT 'manual';  -- 'manual' | 'auto_detected' | 'user_confirmed'

ALTER TABLE shared_weaves ADD COLUMN
  match_score INTEGER;  -- Score when auto-detected

-- Track merge decisions for ML improvement
CREATE TABLE merge_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_weave_id UUID REFERENCES shared_weaves(id),
  user_id UUID REFERENCES user_profiles(id),
  feedback VARCHAR(20) NOT NULL,  -- 'correct' | 'incorrect' | 'unsure'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Edge Cases

| Scenario | Resolution |
|----------|------------|
| Group weave, partial logging | Match if 70%+ participants overlap |
| Same day, different activities | Keep separate (low score) |
| Multi-day trip | Match by date range, not single point |
| Recurring meetup (e.g., weekly coffee) | Use date precision; same week = different events |

---

## 11. Offline-First Sharing Architecture

### Design Principle

Weaves are stored locally first, then synced when online. The existing `SyncEngine` provides the foundation.

### Offline Share Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     OFFLINE SHARING FLOW                         │
│                                                                 │
│  1. User logs weave with linked friend (offline)                │
│     └─► Interaction created locally (WatermelonDB)              │
│     └─► SharedWeaveRef created with status='pending_upload'     │
│                                                                 │
│  2. Device comes online                                         │
│     └─► SyncEngine detects pending SharedWeaveRefs              │
│     └─► Creates shared_weave on server                          │
│     └─► Notifies linked friend                                  │
│     └─► Updates local status='synced'                           │
│                                                                 │
│  3. Linked friend receives (may be offline)                     │
│     └─► Push notification queued                                │
│     └─► When online: shared_weave_participants row created      │
│     └─► Friend's device pulls on next sync                      │
│     └─► Local SharedWeaveRef created with status='pending_accept'│
└─────────────────────────────────────────────────────────────────┘
```

### Local Tracking Model

Extends existing WatermelonDB schema:

```typescript
// New table: shared_weave_refs (local tracking)
tableSchema({
  name: 'shared_weave_refs',
  columns: [
    { name: 'shared_weave_id', type: 'string', isIndexed: true },  // Server ID (null until synced)
    { name: 'local_interaction_id', type: 'string', isIndexed: true },
    { name: 'direction', type: 'string' },  // 'outgoing' | 'incoming'
    { name: 'status', type: 'string' },     // See status enum below
    { name: 'linked_friend_ids', type: 'string' },  // JSON array of linked user IDs
    { name: 'queued_at', type: 'number' },  // When share was initiated
    { name: 'synced_at', type: 'number' },  // When successfully synced
    { name: 'error_message', type: 'string' },  // If sync failed
    { name: 'retry_count', type: 'number' },
    { name: 'created_at', type: 'number' },
    { name: 'updated_at', type: 'number' },
  ]
})

type SharedWeaveStatus =
  | 'pending_upload'    // Created offline, waiting to sync
  | 'uploading'         // Currently syncing
  | 'synced'            // Successfully on server
  | 'pending_accept'    // Incoming, user hasn't responded
  | 'accepted'          // User accepted incoming share
  | 'declined'          // User declined incoming share
  | 'failed'            // Sync failed after retries
  | 'expired';          // Server-side expiration
```

### Integration with Existing SyncEngine

```typescript
// Add to sync-engine.ts SYNCED_TABLES array
const SYNCED_TABLES = [
  // ... existing tables
  'shared_weave_refs',  // New
];

// Extend pushChanges to handle shared weaves
async function pushSharedWeaves(userId: string): Promise<void> {
  const pendingShares = await database
    .get<SharedWeaveRef>('shared_weave_refs')
    .query(Q.where('status', 'pending_upload'))
    .fetch();

  for (const share of pendingShares) {
    try {
      // Mark uploading
      await share.update(r => { r.status = 'uploading'; });

      // Create on server
      const { data, error } = await supabase
        .from('shared_weaves')
        .insert({
          created_by: userId,
          weave_date: share.interaction.interactionDate,
          // ... map other fields
        })
        .select()
        .single();

      if (error) throw error;

      // Update local ref
      await share.update(r => {
        r.sharedWeaveId = data.id;
        r.status = 'synced';
        r.syncedAt = Date.now();
      });
    } catch (error) {
      await share.update(r => {
        r.status = r.retryCount >= 3 ? 'failed' : 'pending_upload';
        r.retryCount = (r.retryCount || 0) + 1;
        r.errorMessage = error.message;
      });
    }
  }
}
```

### Conflict Resolution

Uses existing `SyncConflictStore` pattern:

| Conflict Type | Resolution |
|---------------|------------|
| Both log same event | Fuzzy match → auto-link or suggest merge |
| Edit while offline | Last-write-wins on shared fields, both keep private data |
| Accept while creator cancels | Creator's cancel wins, acceptor notified |
| Network failure during share | Retry with exponential backoff (3 attempts) |

---

## 12. Photo Storage

### Supabase Storage Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE STORAGE BUCKETS                      │
│                                                                 │
│  weave-profiles/                                                │
│  └── {user_id}/                                                 │
│      └── avatar.jpg                 ← User profile photo        │
│      └── avatar_thumb.jpg           ← 200x200 thumbnail         │
│                                                                 │
│  weave-friends/                                                 │
│  └── {user_id}/                                                 │
│      └── {friend_id}/                                           │
│          └── photo.jpg              ← Friend photo              │
│          └── photo_thumb.jpg        ← Thumbnail                 │
│                                                                 │
│  weave-shared/                      ← For shared weave photos   │
│  └── {shared_weave_id}/                                         │
│      └── memory_1.jpg                                           │
│      └── memory_2.jpg                                           │
└─────────────────────────────────────────────────────────────────┘
```

### Bucket Policies

```sql
-- Profile photos: Owner can upload, linked friends can view
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'weave-profiles' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Linked friends can view profile photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'weave-profiles' AND
    (
      (storage.foldername(name))[1] = auth.uid()::text  -- Own photos
      OR
      (storage.foldername(name))[1] IN (                -- Linked friends' photos
        SELECT user_b_id::text FROM friend_links WHERE user_a_id = auth.uid() AND status = 'active'
        UNION
        SELECT user_a_id::text FROM friend_links WHERE user_b_id = auth.uid() AND status = 'active'
      )
    )
  );

-- Friend photos: Only owner can access (private)
CREATE POLICY "Users can manage own friend photos"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'weave-friends' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Shared weave photos: Participants only
CREATE POLICY "Participants can view shared weave photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'weave-shared' AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM shared_weaves WHERE created_by = auth.uid()
      UNION
      SELECT shared_weave_id::text FROM shared_weave_participants WHERE user_id = auth.uid()
    )
  );
```

### Image Processing

```typescript
// image.service.ts - Extend existing service
import * as ImageManipulator from 'expo-image-manipulator';

interface UploadResult {
  url: string;
  thumbnailUrl: string;
}

async function uploadProfilePhoto(userId: string, uri: string): Promise<UploadResult> {
  // Compress and resize
  const processed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 800 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );

  const thumbnail = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 200, height: 200 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Upload to Supabase Storage
  const mainPath = `${userId}/avatar.jpg`;
  const thumbPath = `${userId}/avatar_thumb.jpg`;

  await Promise.all([
    supabase.storage.from('weave-profiles').upload(mainPath, processed.uri, { upsert: true }),
    supabase.storage.from('weave-profiles').upload(thumbPath, thumbnail.uri, { upsert: true }),
  ]);

  return {
    url: supabase.storage.from('weave-profiles').getPublicUrl(mainPath).data.publicUrl,
    thumbnailUrl: supabase.storage.from('weave-profiles').getPublicUrl(thumbPath).data.publicUrl,
  };
}
```

### Caching Strategy

```typescript
// Use React Query for image caching
function useProfilePhoto(userId: string) {
  return useQuery({
    queryKey: ['profile-photo', userId],
    queryFn: async () => {
      const { data } = supabase.storage
        .from('weave-profiles')
        .getPublicUrl(`${userId}/avatar_thumb.jpg`);
      return data.publicUrl;
    },
    staleTime: 1000 * 60 * 60,  // 1 hour
    cacheTime: 1000 * 60 * 60 * 24,  // 24 hours
  });
}
```

---

## 13. Data Models

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

## 14. Technical Architecture

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

## 15. Leveraging Existing Infrastructure

### What Already Exists

The codebase has significant infrastructure that can be leveraged for the accounts and sharing system:

#### Authentication & Sync

| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| Supabase Client | `src/modules/auth/services/supabase.service.ts` | ✅ Ready | OAuth configured, secure token storage |
| SyncEngine | `src/modules/auth/services/sync-engine.ts` | ✅ Ready | Bidirectional delta sync, conflict detection |
| AuthStore | `src/modules/auth/store/auth.store.ts` | ✅ Ready | Session, subscription tier tracking |
| Conflict Resolution | `src/modules/auth/store/sync-conflict.store.ts` | ✅ Ready | Modal-based user resolution |
| Background Sync | `src/modules/auth/services/background-event-sync.ts` | ✅ Ready | Expo task manager integration |

#### Data Layer

| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| User isolation (`user_id`) | All main models | ✅ Ready | Added in schema v31 |
| Sync status tracking | All main models | ✅ Ready | `sync_status`, `synced_at`, `server_updated_at` |
| Subscription tiers | `user_subscriptions` table | ✅ Ready | Free/Plus/Premium structure |
| Usage tracking | `usage_tracking` table | ✅ Ready | Friends count, weaves count |

#### Missing (To Build)

| Component | Priority | Notes |
|-----------|----------|-------|
| `user_profiles` table | P0 | Username, display name, archetype |
| `friend_links` table | P0 | User-to-user connections |
| `shared_weaves` table | P1 | Shared weave storage |
| Feature gating logic | P0 | `useFeatureGate()` is stubbed |
| Profile photo storage | P1 | Supabase Storage buckets |
| Archetype quiz UI | P1 | User will design |

### Reuse Patterns

#### 1. Sync Fields Pattern

All new tables should follow the existing pattern:

```typescript
// Existing pattern in schema.ts
{ name: 'user_id', type: 'string', isIndexed: true },
{ name: 'synced_at', type: 'number' },
{ name: 'sync_status', type: 'string' },  // 'pending' | 'synced' | 'conflict'
{ name: 'server_updated_at', type: 'number' },
```

#### 2. Store Pattern (Zustand)

Follow existing auth module stores:

```typescript
// Pattern from auth.store.ts
interface SharingState {
  linkedFriends: LinkedFriend[];
  pendingRequests: LinkRequest[];

  // Actions
  fetchLinkedFriends: () => Promise<void>;
  sendLinkRequest: (username: string) => Promise<void>;
  acceptLinkRequest: (requestId: string) => Promise<void>;
}

export const useSharingStore = create<SharingState>((set, get) => ({
  // Implementation follows existing patterns
}));
```

#### 3. Service Pattern

Business logic in services, not components:

```typescript
// src/modules/sharing/services/link.service.ts
export class LinkService {
  async sendLinkRequest(targetUsername: string): Promise<LinkRequest> {
    // Use existing supabase client
    const { data, error } = await supabase
      .from('friend_links')
      .insert({ /* ... */ });
    // ...
  }
}
```

#### 4. Hook Pattern

Expose via hooks for components:

```typescript
// src/modules/sharing/hooks/useLinkedFriends.ts
export function useLinkedFriends(friendId: string) {
  const linkedUserId = useFriendLinkedUserId(friendId);  // From Friend model

  return useQuery({
    queryKey: ['linked-profile', linkedUserId],
    queryFn: () => fetchLinkedProfile(linkedUserId),
    enabled: !!linkedUserId,
  });
}
```

### Module Structure (Proposed)

```
src/modules/sharing/
├── components/
│   ├── LinkFriendModal.tsx
│   ├── SharedWeaveCard.tsx
│   ├── LinkRequestNotification.tsx
│   └── QRCodeScanner.tsx
├── screens/
│   ├── LinkedFriendsScreen.tsx
│   └── ShareWeaveScreen.tsx
├── services/
│   ├── link.service.ts
│   ├── shared-weave.service.ts
│   ├── duplicate-detection.service.ts
│   └── profile-sync.service.ts
├── store/
│   └── sharing.store.ts
├── hooks/
│   ├── useLinkedFriends.ts
│   ├── useSharedWeaves.ts
│   └── useLinkRequests.ts
├── types/
│   └── index.ts
└── index.ts
```

---

## 16. Privacy & Security

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

## 17. Account Deletion & Unlinking

### Design Decision: Linked Friend → Offline Friend

When a linked friend deletes their account or unlinks, the friend record is preserved but reverts to "offline" status.

### Unlinking Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                       UNLINKING SCENARIOS                        │
│                                                                 │
│  1. User A explicitly unlinks User B                            │
│     └─► A's local Friend record: linkedUserId = null            │
│     └─► B's local Friend record: linkedUserId = null            │
│     └─► friend_links row: status = 'unlinked'                   │
│     └─► Both keep all local data (weaves, notes, scores)        │
│                                                                 │
│  2. User A deletes their Weave account                          │
│     └─► All of A's friend_links: status = 'deleted'             │
│     └─► All linked friends' local records: linkedUserId = null  │
│     └─► Friends keep their Friend record as "offline friend"    │
│     └─► A's server data: deleted (GDPR compliant)               │
│     └─► A's local data: preserved (their choice to keep/delete) │
│                                                                 │
│  3. User A blocks User B                                        │
│     └─► friend_links row: status = 'blocked', blocked_by = A    │
│     └─► B cannot see A exists (searches return nothing)         │
│     └─► B's Friend record preserved as offline                  │
│     └─► Shared weaves: preserved but no new sharing allowed     │
└─────────────────────────────────────────────────────────────────┘
```

### Data Preservation Guarantees

| Scenario | Your Friend Record | Your Weave History | Their Profile Data |
|----------|-------------------|-------------------|-------------------|
| They unlink you | ✅ Kept | ✅ Kept | ❌ Cleared (name reverts to original) |
| You unlink them | ✅ Kept | ✅ Kept | ❌ Cleared |
| They delete account | ✅ Kept | ✅ Kept | ❌ Cleared |
| You delete account | ✅ Kept locally | ✅ Kept locally | N/A |
| They block you | ✅ Kept | ✅ Kept | ❌ Cleared |

### Implementation

```typescript
// On receiving unlink/deletion notification
async function handleFriendUnlinked(friendId: string): Promise<void> {
  const friend = await database.get<Friend>('friends').find(friendId);

  await database.write(async () => {
    await friend.update(f => {
      // Clear linked data but preserve the friend
      f.linkedUserId = null;
      f.linkedAt = null;
      f.profileSyncedAt = null;

      // Optionally preserve last-known profile data
      // or revert to user's original entries
    });
  });

  // Update local shared_weave_refs
  const sharedRefs = await database
    .get<SharedWeaveRef>('shared_weave_refs')
    .query(Q.where('linked_friend_ids', Q.like(`%${linkedUserId}%`)))
    .fetch();

  await database.write(async () => {
    for (const ref of sharedRefs) {
      await ref.update(r => {
        r.status = 'orphaned';  // Keep history but mark as no longer linked
      });
    }
  });
}
```

### Shared Weave History After Unlinking

```
┌─────────────────────────────────────────────────────────────────┐
│              SHARED WEAVE HISTORY PRESERVATION                   │
│                                                                 │
│  Before unlink:                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Coffee @ Blue Bottle (Dec 14)                           │   │
│  │ 🔗 Shared with Rachel (@rachelmiller)                   │   │
│  │ ✓ Both confirmed                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  After unlink:                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Coffee @ Blue Bottle (Dec 14)                           │   │
│  │ 📤 Was shared with Rachel                               │   │
│  │ ─ Link no longer active                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  The weave exists in your history. The share metadata shows     │
│  it was previously shared but the link is no longer active.     │
└─────────────────────────────────────────────────────────────────┘
```

### Account Deletion (Full)

When a user deletes their account:

```sql
-- Server-side deletion (Edge Function)
CREATE OR REPLACE FUNCTION delete_user_account(user_id UUID)
RETURNS void AS $$
BEGIN
  -- 1. Mark all friend links as deleted
  UPDATE friend_links
  SET status = 'deleted', updated_at = NOW()
  WHERE user_a_id = user_id OR user_b_id = user_id;

  -- 2. Delete shared weave participation (but not the weaves themselves)
  DELETE FROM shared_weave_participants
  WHERE user_id = user_id;

  -- 3. Delete user's created shared weaves (after notifying participants)
  -- Note: Participants keep their local interaction copies
  DELETE FROM shared_weaves
  WHERE created_by = user_id;

  -- 4. Delete profile data
  DELETE FROM user_profiles WHERE id = user_id;
  DELETE FROM quiz_results WHERE user_id = user_id;
  DELETE FROM contact_hashes WHERE user_id = user_id;
  DELETE FROM link_codes WHERE user_id = user_id;

  -- 5. Delete from Supabase Auth (triggers storage cleanup)
  -- This is handled by Supabase admin API

  -- 6. Delete from storage buckets
  -- Handled by storage policies + cleanup job
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Client-Side After Account Deletion

```typescript
async function handleAccountDeleted(): Promise<void> {
  // Local data is preserved by default
  // User can choose to wipe local data too

  const shouldWipeLocal = await showConfirmation(
    "Delete local data too?",
    "Your weave history is still on this device. Delete it as well?"
  );

  if (shouldWipeLocal) {
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });
  } else {
    // Clear sync metadata but keep data
    await AsyncStorage.removeItem('weave:sync:lastTimestamp:*');
    await AsyncStorage.removeItem('weave:auth:session');
  }
}
```

---

## 18. Migration Strategy

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

## 19. Phased Rollout

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

## 20. Future Possibilities

Once the foundation is built, accounts unlock an entirely new category of features that would be impossible with local-only data.

### What Only Accounts Can Enable

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACCOUNTS UNLOCK                               │
│                                                                 │
│  LOCAL-ONLY                          WITH ACCOUNTS              │
│  ───────────                          ────────────              │
│  "I think I initiate more"     →     "You initiate 62%"        │
│  "We should hang out"          →     "Rachel wants to see you" │
│  "When did we last meet?"      →     "Nov 23 (both confirmed)" │
│  "I hope they had fun"         →     "Rachel rated it 🌟🌟🌟🌟" │
│  "Is this friendship balanced?"→     "Mutual investment: 8/10" │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Near-term (1-3 months post-launch)

| Feature | Description | Value |
|---------|-------------|-------|
| **Multi-device sync** | Same account on phone + tablet | Flexibility |
| **Shared photo memories** | Attach photos to shared weaves | Richer memories |
| **Group weave invites** | Plan weaves with multiple friends | Easier coordination |
| **Birthday from profile** | Auto-populate from linked friend's profile | Never forget |
| **"On Weave" indicator** | Badge on friends who use Weave | Encourage linking |

### Medium-term (3-6 months post-launch)

| Feature | Description | Value |
|---------|-------------|-------|
| **Mutual Intent** | "Rachel wants to grab coffee this week" | Both parties express desire to connect |
| **Availability hints** | "I'm free Thursday evening" (opt-in) | Easier scheduling |
| **Verified Reciprocity** | "You initiate 65% of weaves with Rachel" | Stop guessing, know for certain |
| **Weave streaks** | "You and Rachel have hung out 4 weeks in a row" | Gamified mutual investment |
| **Relationship milestones** | "1 year since your first logged weave together" | Celebrate the relationship |

### Long-term (6+ months post-launch)

| Feature | Description | Value |
|---------|-------------|-------|
| **Friendship Health Score** | Mutual view: "Your relationship is thriving" | Shared awareness |
| **Joint Reflections** | Both answer: "How was your last hangout?" | Deeper mutual insight |
| **Friend Introductions** | "You both know Sarah. Maybe a group hangout?" | Network weaving |
| **Social Circle Overlap** | "Your Inner Circles share 3 people" | Understand social topology |
| **Relationship Coaching** | AI insights based on both perspectives | Premium feature |

### Transformative Concepts (Vision)

These require significant network adoption but represent the ultimate vision:

#### 1. Mutual Nurturing Dashboard

```
┌─────────────────────────────────────────────────────────────────┐
│             Hannah ←→ Rachel: Relationship Dashboard             │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Relationship Health: ████████░░ 82%                    │   │
│  │  You've connected 24 times this year                    │   │
│  │  Initiation balance: 55% Hannah / 45% Rachel ✓          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Recent Weaves (shared view):                                   │
│  • Dec 14: Coffee @ Blue Bottle (both gave 4/5 vibe)           │
│  • Nov 28: Thanksgiving dinner (Rachel's idea)                  │
│  • Nov 12: Walk in the park (Hannah's idea)                     │
│                                                                 │
│  Mutual Intent:                                                 │
│  🟢 Rachel wants to plan something                              │
│  🟡 Hannah hasn't expressed intent yet                          │
│                                                                 │
│  [Plan Together]              [View Full History]               │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. Friend Group Coordination

```
┌─────────────────────────────────────────────────────────────────┐
│              "Coffee Crew" Group (4 people on Weave)            │
│                                                                 │
│  Recent Activity:                                               │
│  • Hannah & Rachel: Coffee last week                            │
│  • Tom & Sarah: Lunch yesterday                                 │
│  • Group hasn't all met in: 3 weeks                            │
│                                                                 │
│  Mutual Intent:                                                 │
│  🟢 Hannah: "I want to see everyone"                            │
│  🟢 Rachel: "Let's do something"                                │
│  🟡 Tom: No recent intent                                       │
│  🟡 Sarah: No recent intent                                     │
│                                                                 │
│  [Suggest Group Weave]         [View Group Insights]            │
└─────────────────────────────────────────────────────────────────┘
```

#### 3. Relationship Investment Parity

```
┌─────────────────────────────────────────────────────────────────┐
│                    Investment Parity Alert                       │
│                                                                 │
│  ⚠️ Imbalance detected with Tom                                 │
│                                                                 │
│  You've initiated the last 5 weaves in a row.                  │
│  Tom hasn't expressed any intent to connect.                    │
│                                                                 │
│  This doesn't mean Tom doesn't care! Life gets busy.           │
│  But it might be worth:                                         │
│  • Waiting for Tom to reach out                                │
│  • Checking in with a simple message                           │
│  • Reflecting on the relationship                              │
│                                                                 │
│  [Mute these alerts for Tom]   [Adjust my expectations]        │
└─────────────────────────────────────────────────────────────────┘
```

### Network Effects at Scale

As adoption grows, entirely new categories emerge:

| Adoption Level | Unlocks |
|---------------|---------|
| **5 linked friends** | Personal network starts self-documenting |
| **15 linked friends** | Close Friends tier becomes effortless |
| **50+ linked friends** | Community tier nearly automated |
| **Most friends linked** | Weave becomes relationship operating system |

### The Ultimate Vision

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Today: You manually track relationships                        │
│  Tomorrow: Your relationships track themselves                  │
│                                                                 │
│  The more friends on Weave, the less YOU have to do.           │
│  The network does the work.                                     │
│  You just show up and connect.                                  │
│                                                                 │
│  Weave becomes invisible—the way good infrastructure should be. │
│  You stop logging and start living.                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 21. Open Questions

### Resolved Decisions ✅

| Question | Decision | Section |
|----------|----------|---------|
| **Subscription tier** | Free core (logging, linking, sharing), Premium for insights + AI | [Section 4](#4-subscription-model) |
| **Offline sharing** | Queue locally, sync when online | [Section 11](#11-offline-first-sharing-architecture) |
| **Duplicate detection** | Fuzzy matching with auto-merge for high confidence | [Section 10](#10-duplicate-detection-fuzzy-matching) |
| **Photo storage** | Supabase Storage with bucket policies | [Section 12](#12-photo-storage) |
| **Account deletion** | Friend becomes offline friend, data preserved | [Section 17](#17-account-deletion--unlinking) |
| **Block behavior** | History preserved, no new sharing | [Section 17](#17-account-deletion--unlinking) |

### Remaining Product Questions

1. **Non-user invites**: Should users be able to invite non-Weave friends via the app?
   - Risk: Feels spammy, growth-hacky
   - Opportunity: Natural referral mechanism
   - **Recommendation**: Defer to Phase 3+. Focus on linking existing users first.

2. ~~**Shared weave limits**~~: **RESOLVED - No limits**
   - Limiting shares contradicts core philosophy (network effect reduces data entry)
   - If someone shares excessively, the recipient can mute/unlink that specific friend
   - The more shares flowing through the network, the more value everyone gets

3. **Quiz design**: Who designs the archetype discovery quiz?
   - **Decision**: User will design the quiz. Technical infrastructure documented in [Section 7](#7-archetype-discovery-quiz).

### Remaining Technical Questions

1. **Data retention**: How long to keep expired/declined shared weaves?
   - For analytics: Keep 90 days
   - For user: Delete immediately or after 30 days?
   - **Recommendation**: Keep 30 days for user, 90 days server-side for analytics

2. **Group weave edge case**: How to handle group weaves where some are linked and some aren't?
   - **Recommendation**: Share with linked friends only; unlinked friends remain local-only

3. **Profile update propagation**: When a user updates their profile, how quickly should linked friends see it?
   - **Recommendation**: Real-time via Supabase Realtime for online users; next sync for offline

### Remaining Privacy Questions

1. **Profile visibility**: Should unlinked users see anything when searched?
   - Option A: Just username + photo (current design)
   - Option B: Nothing until linked
   - Option C: User chooses
   - **Recommendation**: Option C (user chooses), default to Option A

2. **Contact discovery opt-in**: How prominently to offer contact matching?
   - **Recommendation**: Secondary option, not default. Privacy-conscious users may be put off.

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
