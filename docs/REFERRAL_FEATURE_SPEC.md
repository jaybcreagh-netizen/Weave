# Referral Feature: Share Weave with Unlinked Friends

> **Goal:** Allow users to share a weave plan with friends who don't have the app yet. When the friend installs and opens the app, the shared weave is auto-populated and a friend link is created.

---

## Table of Contents

1. [Deep Link Solutions Research](#1-deep-link-solutions-research)
2. [Recommended Approach](#2-recommended-approach)
3. [MVP: Manual Invite Code](#3-mvp-manual-invite-code)
4. [Full Feature: Smart Links](#4-full-feature-smart-links)
5. [Database Schema](#5-database-schema)
6. [Implementation Phases](#6-implementation-phases)

---

## 1. Deep Link Solutions Research

### The Challenge

Standard deep links (`weave://invite/abc123`) only work when the app is **already installed**. For referrals, we need **deferred deep links** that:

1. Store the link context (invite data)
2. Redirect to App Store/Play Store if not installed
3. Retrieve the context after first app launch

### Solution Comparison

| Solution | Expo Compatible | Deferred Links | Pricing | Complexity | Notes |
|----------|-----------------|----------------|---------|------------|-------|
| **Manual Invite Code** | Yes | N/A (manual) | Free | Low | User enters code manually |
| **DeepLinkNow** | Yes (plugin) | Yes | Unknown | Low | Lightweight, privacy-focused |
| **Branch.io** | Partial* | Yes | Freemium | Medium | Industry standard, some Expo issues |
| **AppsFlyer** | Yes | Yes | Paid | Medium | Enterprise-focused |
| **Adjust** | Yes | Yes | Paid | Medium | Strong attribution |
| **Custom (Supabase + Universal Links)** | Yes | Partial | Free | High | Full control, more work |

*Branch: Expo plugin not maintained by Branch, some reported issues with expo-router.

### Sources

- [Expo Linking Documentation](https://docs.expo.dev/linking/into-your-app/)
- [DeepLinkNow React Native Guide](https://deeplinknow.com/blog/deferred-deep-linking-react-native-expo)
- [Branch React Native SDK](https://help.branch.io/developers-hub/docs/react-native)
- [Branch Expo Issues](https://github.com/expo/expo/issues/30038)

---

## 2. Recommended Approach

### Start with MVP (Manual Code)

For initial validation, skip the complexity of deferred deep links:

1. **User A** shares a 6-character invite code (e.g., `WEAVE7`)
2. **User B** downloads app and enters code during onboarding
3. Backend retrieves the invite and populates the weave

**Benefits:**
- Zero third-party dependencies
- Works immediately
- Tests the core value proposition
- Can add smart links later

### Graduate to Smart Links

Once MVP validates the feature, add DeepLinkNow or similar for frictionless experience:

1. **User A** shares a smart link (`https://weave.app/i/WEAVE7`)
2. **User B** clicks link → App Store → Installs → Opens to shared weave

---

## 3. MVP: Manual Invite Code

### User Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER A (Existing User)                                         │
├─────────────────────────────────────────────────────────────────┤
│  1. Logs/plans a weave with "Sarah" (not on Weave yet)          │
│  2. Taps "Invite Sarah to Weave"                                │
│  3. App generates invite code: WEAVE7                           │
│  4. Native share sheet: "Join me on Weave! Use code: WEAVE7"    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  USER B (New User - "Sarah")                                    │
├─────────────────────────────────────────────────────────────────┤
│  1. Downloads Weave from App Store                              │
│  2. Signs up with Apple/Google                                  │
│  3. Sees "Have an invite code?" prompt                          │
│  4. Enters: WEAVE7                                              │
│  5. App shows: "Jay invited you to a hangout!"                  │
│  6. Weave auto-created, friend link pending                     │
└─────────────────────────────────────────────────────────────────┘
```

### Components

#### A. Share Flow (Sender)

**Location:** `src/modules/interactions/components/InviteFriendSheet.tsx`

```typescript
interface InviteFriendSheetProps {
  weaveId: string;         // The weave being shared
  friendName: string;      // Name to personalize invite
  onClose: () => void;
}

// Generate invite via Supabase Edge Function or RPC
const { data: invite } = await supabase.rpc('create_invite', {
  weave_id: weaveId,
  friend_name: friendName,
});

// Share via native share sheet
await Share.share({
  message: `Hey ${friendName}! Join me on Weave to plan our hangout. Download the app and use my invite code: ${invite.code}\n\nhttps://apps.apple.com/app/weave/id123456789`,
});
```

#### B. Claim Flow (Receiver)

**Location:** `src/modules/auth/components/InviteCodeEntry.tsx`

```typescript
// Show during onboarding or in settings
<TextInput
  placeholder="Enter invite code"
  value={code}
  onChangeText={setCode}
  autoCapitalize="characters"
  maxLength={6}
/>
<Button
  label="Claim Invite"
  onPress={handleClaimInvite}
/>
```

**Claim Logic:**
```typescript
const handleClaimInvite = async () => {
  const { data, error } = await supabase.rpc('claim_invite', {
    code: code.toUpperCase(),
  });

  if (error) {
    Alert.alert('Invalid Code', 'This invite code is invalid or expired.');
    return;
  }

  // data contains: { weave_snapshot, creator_id, creator_name }

  // 1. Create the weave locally
  await createWeaveFromInvite(data.weave_snapshot);

  // 2. Create pending friend link
  await createPendingFriendLink(data.creator_id, data.creator_name);

  // 3. Show success
  Alert.alert('Welcome!', `${data.creator_name} invited you to a hangout!`);
};
```

---

## 4. Full Feature: Smart Links

### User Flow (Frictionless)

```
┌─────────────────────────────────────────────────────────────────┐
│  USER A shares link: https://weave.app/i/WEAVE7                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  USER B clicks link                                             │
├─────────────────────────────────────────────────────────────────┤
│  App installed?                                                 │
│  ├── YES → Open app directly to invite screen                   │
│  └── NO  → Redirect to App Store                                │
│            └── After install, open to invite screen             │
└─────────────────────────────────────────────────────────────────┘
```

### Implementation with DeepLinkNow

#### 1. Install SDK

```bash
expo install react-native-deeplinknow
```

#### 2. Configure Plugin

```json
// app.json
{
  "expo": {
    "plugins": [
      [
        "react-native-deeplinknow",
        {
          "apiKey": "your-api-key"
        }
      ]
    ]
  }
}
```

#### 3. Initialize on App Start

```typescript
// App.tsx or _layout.tsx
import DeepLinkNow from 'react-native-deeplinknow';

useEffect(() => {
  DeepLinkNow.initialize('your-api-key');

  // Check for deferred deep link (post-install)
  DeepLinkNow.checkDeferredDeepLink().then((result) => {
    if (result?.url) {
      handleInviteLink(result.url);
    }
  });

  // Listen for direct deep links (app already installed)
  const unsubscribe = DeepLinkNow.addDeepLinkListener((url) => {
    handleInviteLink(url);
  });

  return unsubscribe;
}, []);
```

#### 4. Create Smart Links

```typescript
const createSmartLink = async (inviteCode: string): Promise<string> => {
  const link = await DeepLinkNow.createLink({
    url: `https://weave.app/i/${inviteCode}`,
    // Fallback for web
    fallbackUrl: 'https://weave.app/download',
    // Custom parameters preserved through install
    data: {
      inviteCode,
      source: 'weave-share',
    },
  });

  return link.url;
};
```

### Alternative: Universal Links + Supabase

If avoiding third-party SDKs:

1. **Setup Universal Links** (iOS) / **App Links** (Android)
   - Host `apple-app-site-association` / `assetlinks.json` on your domain
   - Configure in `app.json`

2. **Landing Page Fallback**
   - `https://weave.app/i/WEAVE7` serves a web page
   - Page detects platform and redirects to App Store
   - Stores invite code in URL params

3. **Deferred Link Storage**
   - When app opens, check `Linking.getInitialURL()`
   - If no URL but user just installed, prompt for code
   - Alternatively: Use clipboard API (privacy concerns)

**Limitation:** True deferred deep linking (preserving context through install) is unreliable without a dedicated SDK.

---

## 5. Database Schema

### Tables

```sql
-- ============================================================================
-- INVITE LINKS TABLE
-- ============================================================================

CREATE TABLE public.invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- The invite code (short, shareable)
    code TEXT UNIQUE NOT NULL,

    -- Who created the invite
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_display_name TEXT,  -- Cached for display after claim

    -- Optional: Link to existing shared_weave
    shared_weave_id UUID REFERENCES shared_weaves(id) ON DELETE SET NULL,

    -- Snapshot of weave data (for creating in new user's app)
    weave_snapshot JSONB,
    -- Example: {
    --   "title": "Coffee with Jay",
    --   "weave_date": "2026-01-20T10:00:00Z",
    --   "location": "Blue Bottle Coffee",
    --   "category": "coffee",
    --   "duration": "1h",
    --   "note": "Catch up!"
    -- }

    -- Friend name (what creator called them)
    friend_name TEXT,

    -- Status
    status TEXT DEFAULT 'pending',  -- 'pending', 'claimed', 'expired'

    -- Claim info
    claimed_by UUID REFERENCES auth.users(id),
    claimed_at TIMESTAMPTZ,

    -- Expiry (7 days default)
    expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick code lookup
CREATE UNIQUE INDEX idx_invite_links_code ON invite_links(code);

-- Index for user's invites
CREATE INDEX idx_invite_links_creator ON invite_links(creator_id);

-- RLS Policies
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;

-- Creators can see their own invites
CREATE POLICY "Creators can view own invites"
    ON invite_links FOR SELECT
    USING (creator_id = auth.uid());

-- Anyone can claim (but RPC handles validation)
CREATE POLICY "Anyone can claim via RPC"
    ON invite_links FOR UPDATE
    USING (true)
    WITH CHECK (
        claimed_by = auth.uid() AND
        status = 'pending' AND
        expires_at > NOW()
    );
```

### RPC Functions

```sql
-- ============================================================================
-- CREATE INVITE
-- ============================================================================

CREATE OR REPLACE FUNCTION create_invite(
    p_weave_snapshot JSONB,
    p_friend_name TEXT DEFAULT NULL
)
RETURNS TABLE (code TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_code TEXT;
    v_user_id UUID;
    v_display_name TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Get creator's display name
    SELECT display_name INTO v_display_name
    FROM user_profiles WHERE id = v_user_id;

    -- Generate unique 6-char code
    LOOP
        v_code := upper(substring(md5(random()::text) from 1 for 6));
        EXIT WHEN NOT EXISTS (SELECT 1 FROM invite_links WHERE invite_links.code = v_code);
    END LOOP;

    -- Insert invite
    INSERT INTO invite_links (code, creator_id, creator_display_name, weave_snapshot, friend_name)
    VALUES (v_code, v_user_id, v_display_name, p_weave_snapshot, p_friend_name);

    RETURN QUERY
    SELECT v_code, NOW() + INTERVAL '7 days';
END;
$$;

-- ============================================================================
-- CLAIM INVITE
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_invite(p_code TEXT)
RETURNS TABLE (
    weave_snapshot JSONB,
    creator_id UUID,
    creator_name TEXT,
    friend_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invite invite_links%ROWTYPE;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Find and lock the invite
    SELECT * INTO v_invite
    FROM invite_links
    WHERE invite_links.code = upper(p_code)
      AND status = 'pending'
      AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invite code';
    END IF;

    -- Can't claim your own invite
    IF v_invite.creator_id = v_user_id THEN
        RAISE EXCEPTION 'Cannot claim your own invite';
    END IF;

    -- Mark as claimed
    UPDATE invite_links
    SET status = 'claimed',
        claimed_by = v_user_id,
        claimed_at = NOW()
    WHERE id = v_invite.id;

    -- Return invite data
    RETURN QUERY
    SELECT v_invite.weave_snapshot,
           v_invite.creator_id,
           v_invite.creator_display_name,
           v_invite.friend_name;
END;
$$;
```

---

## 6. Implementation Phases

### Phase 1: Database & Backend (Day 1)

- [ ] Create `invite_links` table migration
- [ ] Implement `create_invite` RPC function
- [ ] Implement `claim_invite` RPC function
- [ ] Add RLS policies
- [ ] Test with Supabase dashboard

### Phase 2: Share Flow UI (Day 1-2)

- [ ] Create `InviteFriendSheet` component
- [ ] Add "Invite to Weave" button in WeaveLogger (for unlinked friends)
- [ ] Integrate native Share API
- [ ] Generate invite code via RPC
- [ ] Show share success state

### Phase 3: Claim Flow UI (Day 2)

- [ ] Create `InviteCodeEntry` component
- [ ] Add to onboarding flow (optional step)
- [ ] Add to Settings (for existing users)
- [ ] Handle claim success: create weave + friend link
- [ ] Show welcome modal with invite details

### Phase 4: Polish (Day 3)

- [ ] Handle edge cases (expired, already claimed, self-claim)
- [ ] Add invite history screen for creator
- [ ] Track successful referrals (analytics)
- [ ] Expire old invites (pg_cron or Edge Function)

### Phase 5: Smart Links (Future)

- [ ] Evaluate DeepLinkNow vs Branch vs custom
- [ ] Setup Universal Links / App Links
- [ ] Integrate deferred deep link SDK
- [ ] Replace manual code with smart link
- [ ] A/B test conversion rates

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Invites created | Track volume |
| Invites claimed | >30% claim rate |
| Referral → Active user | >50% of claimed |
| Time to claim | <24 hours average |

---

## Open Questions

1. **Should invites expire?** (Current: 7 days)
2. **Limit invites per user?** (Prevent spam)
3. **Reward referrers?** (Gamification, badges)
4. **Allow re-sharing?** (If friend doesn't claim)
5. **What if friend already has app?** (Skip install, just claim)
