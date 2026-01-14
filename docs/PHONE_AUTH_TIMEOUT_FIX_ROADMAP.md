# Phone Auth Timeout Fix - Implementation Roadmap

## Executive Summary

The phone authentication flow experiences UI timeouts due to missing timeout wrappers in `signInWithPhone()` and potential database trigger failures. This plan addresses these issues in 4 phases, prioritized by impact.

---

## Phase 1: Critical Client-Side Timeout Fixes (Immediate)

**Goal:** Prevent UI hangs by adding consistent timeout handling to all auth operations.

### 1.1 Add Timeout to `signInWithPhone()`

**File:** `src/modules/auth/services/supabase-auth.service.ts`

**Current Problem:** Lines 354-398 - No timeout wrapper on `signInWithOtp()` call.

**Change:**
```typescript
// Add Promise.race timeout matching existing pattern (lines 411-421)
const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('Auth request timed out')), 15000);
});

const authPromise = client.auth.signInWithOtp({ phone });
const { error } = await Promise.race([authPromise, timeoutPromise]);
```

**Timeout Duration:** 15 seconds (SMS delivery should be fast; 30s is too long for UX).

### 1.2 Extract Timeout Utility

**File:** `src/modules/auth/services/auth-utils.ts` (new file)

**Purpose:** DRY principle - avoid repeating timeout logic.

```typescript
export const AUTH_TIMEOUTS = {
  OTP_SEND: 15000,      // SMS should arrive quickly
  OTP_VERIFY: 30000,    // Verification can take longer
  PROFILE_UPDATE: 10000 // DB operations
} as const;

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  operation: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out`)), ms)
    )
  ]);
}
```

### 1.3 Update All Phone Auth Functions

Refactor these functions to use the new utility:
- `signInWithPhone()` - line 354
- `verifyPhoneOtp()` - line 403
- `linkPhoneToUser()` - line 457
- `verifyAndLinkPhone()` - line 493

### 1.4 Fix Duplicate `detectCountry()` Call

**File:** `src/modules/auth/screens/PhoneAuthScreen.tsx`

**Line 74:** Remove duplicate call.

```diff
  useEffect(() => {
    const detectCountry = () => { /* ... */ };
    detectCountry();
-   detectCountry();
  }, []);
```

---

## Phase 2: Supabase Client Global Timeout (High Priority)

**Goal:** Prevent any Supabase request from hanging indefinitely.

### 2.1 Add Global Fetch Timeout

**File:** `src/shared/services/supabase-client.ts`

**Lines 64-71:** Add custom fetch with AbortController.

```typescript
supabaseInstance = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    fetch: (url, options = {}) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      return fetch(url, {
        ...options,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
    },
  },
});
```

### 2.2 Add Network State Awareness (Optional Enhancement)

Consider integrating with `@react-native-community/netinfo` to:
- Fail fast when offline
- Show appropriate messaging

---

## Phase 3: Database Trigger Consolidation (High Priority)

**Goal:** Ensure auth signup never fails due to trigger errors.

### 3.1 Create Consolidated Trigger Migration

**File:** `supabase/migrations/20260114_consolidate_auth_trigger.sql` (new)

This migration will:

1. **Drop all existing `on_auth_user_created` triggers**
2. **Create single authoritative `handle_new_user()` function**
3. **Use correct table name (`user_profiles`)**
4. **Add proper error handling**

```sql
-- Drop any existing triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Consolidated function with error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  random_suffix TEXT;
  new_username TEXT;
BEGIN
  random_suffix := (floor(random() * 90000 + 10000))::text;
  new_username := 'user_' || random_suffix;

  -- 1. Create free tier subscription (safe - ON CONFLICT)
  INSERT INTO public.user_subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  -- 2. Initialize usage tracking (safe - ON CONFLICT)
  INSERT INTO public.usage_tracking (user_id, period_start, period_end)
  VALUES (
    NEW.id,
    DATE_TRUNC('month', NOW()),
    DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
  )
  ON CONFLICT DO NOTHING;

  -- 3. Create user profile with username (CRITICAL - uses user_profiles plural)
  INSERT INTO public.user_profiles (id, username, display_name, created_at, updated_at)
  VALUES (
    NEW.id,
    new_username,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'display_name',
      NEW.raw_user_meta_data->>'name',
      'Weave User'
    ),
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  )
  ON CONFLICT (id) DO NOTHING;

  -- 4. Create user progress row
  INSERT INTO public.user_progress (id, user_id, created_at, updated_at)
  VALUES (
    uuid_generate_v4(),
    NEW.id,
    EXTRACT(EPOCH FROM NOW()) * 1000,
    EXTRACT(EPOCH FROM NOW()) * 1000
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the auth transaction
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### 3.2 Remove Duplicate Migration File

**Delete:** `supabase/migrations/20260112_auto_assign_username.dump.sql`

### 3.3 Add Missing RLS Policies

Ensure `user_subscriptions` and `usage_tracking` have proper policies.

---

## Phase 4: Enhanced UX & Resilience (Medium Priority)

**Goal:** Improve user experience during slow/failed auth attempts.

### 4.1 Add Retry with Exponential Backoff

**File:** `src/modules/auth/services/auth-utils.ts`

```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    baseDelayMs?: number;
    shouldRetry?: (error: any) => boolean;
  } = {}
): Promise<T> {
  const { maxRetries = 2, baseDelayMs = 1000, shouldRetry = () => true } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !shouldRetry(error)) throw error;
      await new Promise(r => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
    }
  }
  throw new Error('Unreachable');
}
```

### 4.2 Add AbortController Support

**File:** `src/modules/auth/screens/PhoneAuthScreen.tsx`

Replace `authRequestActive.current` ref with proper AbortController:

```typescript
const abortControllerRef = useRef<AbortController | null>(null);

const handleSendOtp = async () => {
  // Cancel any pending request
  abortControllerRef.current?.abort();
  abortControllerRef.current = new AbortController();

  setLoading(true);
  try {
    const result = await signInWithPhone(formattedPhone, {
      signal: abortControllerRef.current.signal
    });
    // ... handle result
  } catch (err) {
    if (err.name === 'AbortError') return; // User cancelled
    // ... handle error
  } finally {
    setLoading(false);
  }
};

// Cleanup on unmount
useEffect(() => {
  return () => abortControllerRef.current?.abort();
}, []);
```

### 4.3 Add Loading State Feedback

Enhance the loading UI to show:
- "Sending code..." during OTP request
- Progress indicator after 5s: "Still working..."
- After 10s: "Taking longer than usual..."

---

## Files to Modify

### Phase 1 (Critical)
| File | Changes |
|------|---------|
| `src/modules/auth/services/supabase-auth.service.ts` | Add timeout to `signInWithPhone()` |
| `src/modules/auth/services/auth-utils.ts` | New file - timeout utilities |
| `src/modules/auth/screens/PhoneAuthScreen.tsx` | Remove duplicate `detectCountry()` |
| `src/modules/auth/index.ts` | Export new utilities |

### Phase 2 (High)
| File | Changes |
|------|---------|
| `src/shared/services/supabase-client.ts` | Add global fetch timeout |

### Phase 3 (High)
| File | Changes |
|------|---------|
| `supabase/migrations/20260114_consolidate_auth_trigger.sql` | New - consolidated trigger |
| `supabase/migrations/20260112_auto_assign_username.dump.sql` | Delete duplicate |

### Phase 4 (Medium)
| File | Changes |
|------|---------|
| `src/modules/auth/services/auth-utils.ts` | Add retry utility |
| `src/modules/auth/services/supabase-auth.service.ts` | Integrate AbortController |
| `src/modules/auth/screens/PhoneAuthScreen.tsx` | AbortController + enhanced UX |

---

## Verification Plan

### Phase 1 Testing
1. **Test timeout behavior:**
   - Temporarily set timeout to 1ms
   - Verify `TIMEOUT` error is returned
   - Verify UI shows timeout alert with retry option

2. **Test normal flow:**
   - Send OTP with valid phone
   - Verify code arrives within 15s
   - Verify OTP verification works

### Phase 2 Testing
1. **Test global timeout:**
   - Use network link conditioner to simulate slow network
   - Verify requests fail gracefully after 30s

### Phase 3 Testing
1. **Run migration on staging:**
   ```bash
   supabase db push --db-url $STAGING_URL
   ```

2. **Test new user signup:**
   - Create new account via phone auth
   - Verify `user_profiles` row created
   - Verify `user_subscriptions` row created
   - Verify `user_progress` row created

3. **Test trigger error handling:**
   - Temporarily break one INSERT
   - Verify auth still succeeds
   - Check Postgres logs for warning

### Phase 4 Testing
1. **Test cancellation:**
   - Start OTP request
   - Press back button immediately
   - Verify no lingering loading states

2. **Test retry:**
   - Simulate transient failure
   - Verify automatic retry occurs
   - Verify success on retry

---

## Rollback Plan

### Phase 1
- Revert `supabase-auth.service.ts` changes
- No database changes to rollback

### Phase 2
- Remove `global.fetch` option from Supabase client config

### Phase 3
- Run rollback migration:
```sql
-- Restore previous trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- Re-run previous migration version
```

### Phase 4
- Revert PhoneAuthScreen changes
- Remove retry utility if not used elsewhere

---

## Implementation Order

```
Week 1: Phase 1 (Critical - Timeout Fixes) ✅ COMPLETE
  ├── 1.1 Add timeout to signInWithPhone
  ├── 1.2 Create auth-utils.ts
  ├── 1.3 Refactor existing timeouts
  └── 1.4 Fix duplicate detectCountry

Week 1: Phase 2 (High - Global Timeout) ✅ COMPLETE
  └── 2.1 Add global fetch timeout

Week 1-2: Phase 3 (High - Database Triggers) ✅ COMPLETE
  ├── 3.1 Create consolidated migration
  ├── 3.2 Remove duplicate file
  └── 3.3 Test on staging

Week 2+: Phase 4 (Medium - Resilience) ✅ COMPLETE
  ├── 4.1 Add retry utility
  ├── 4.2 Add AbortController
  └── 4.3 Enhanced loading UX

Week 3+: Phase 5 (High - Phone Management UX) ← NEW
  ├── 5.1 Update AccountSettings to show linked phone
  ├── 5.2 Create PhoneSettingsScreen
  ├── 5.3 Add phone-settings route
  ├── 5.4 Add unlinkPhone service function
  ├── 5.5 Add formatPhoneDisplay utility
  └── 5.6 Update PhoneAuthScreen for change mode
```

---

## Success Metrics

1. **No UI hangs** - Loading spinner never stuck indefinitely
2. **Clear error messaging** - Users see actionable error within 15s
3. **Auth success rate** - Track via analytics, target >95%
4. **Trigger reliability** - No auth failures due to profile creation

---

## Phase 5: Phone Management UX (High Priority)

**Goal:** Provide users with visibility and control over their linked phone number.

### Current State (Problems)

| Location | Current Behavior | Issue |
|----------|-----------------|-------|
| `AccountSettings.tsx` (lines 278-292) | Shows "Link Phone Number" only when `!userInfo.phone`. If linked, section disappears | No indication phone is linked |
| `ProfileScreen.tsx` | No phone field - only username, display name, birthday, archetype | Can't view/change/remove phone |
| `ProfileCompletionSheet.tsx` | Prompts to link once, then never again | No feedback after linking |

### 5.1 Add Phone Display to AccountSettings

**File:** `src/modules/auth/components/settings/AccountSettings.tsx`

**Current (lines 278-292):**
```typescript
{!userInfo.phone && (
  <SettingsItem
    icon={Phone}
    title="Link Phone Number"
    subtitle="Enable contact matching & backup auth"
    onPress={() => router.push('/phone-auth?mode=link')}
  />
)}
```

**New:**
```typescript
{/* Phone Section - Always show */}
<>
  <View className="border-t border-border mx-4" style={{ borderColor: colors.border }} />
  {userInfo.phone ? (
    <SettingsItem
      icon={Phone}
      title="Phone Number"
      subtitle={formatPhoneDisplay(userInfo.phone)} // e.g., "+1 •••-•••-1234"
      rightElement={
        <View className="flex-row items-center gap-1">
          <CheckCircle size={16} color="#22c55e" />
          <Text variant="caption" style={{ color: '#22c55e' }}>Verified</Text>
        </View>
      }
      onPress={() => {
        onClose();
        setTimeout(() => router.push('/phone-settings'), 300);
      }}
    />
  ) : (
    <SettingsItem
      icon={Phone}
      title="Link Phone Number"
      subtitle="Enable contact matching & backup auth"
      onPress={() => {
        onClose();
        setTimeout(() => router.push('/phone-auth?mode=link'), 300);
      }}
    />
  )}
</>
```

### 5.2 Add Phone Management Screen

**File:** `src/modules/auth/screens/PhoneSettingsScreen.tsx` (new)

This screen will allow users to:
1. View their linked phone number (partially masked)
2. Change to a different phone number
3. Remove/unlink their phone number

```typescript
export function PhoneSettingsScreen() {
  const { colors } = useTheme();
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhone();
  }, []);

  const loadPhone = async () => {
    const client = getSupabaseClient();
    if (!client) return;

    const { data: { user } } = await client.auth.getUser();
    if (user?.phone) {
      setPhone(user.phone);
    }
    setLoading(false);
  };

  const handleChangePhone = () => {
    router.push('/phone-auth?mode=change');
  };

  const handleRemovePhone = () => {
    Alert.alert(
      'Remove Phone Number',
      'Are you sure? You won\'t be able to sign in with this phone number or be found by contacts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await unlinkPhone();
            router.back();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b" style={{ borderColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text variant="h2" className="ml-3">Phone Number</Text>
      </View>

      <View className="p-5">
        {/* Current Phone Display */}
        <Card className="p-4 mb-6">
          <View className="flex-row items-center gap-3">
            <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary + '20' }}>
              <Phone size={24} color={colors.primary} />
            </View>
            <View className="flex-1">
              <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                Verified Phone
              </Text>
              <Text variant="h3">{formatPhoneDisplay(phone)}</Text>
            </View>
            <CheckCircle size={20} color="#22c55e" />
          </View>
        </Card>

        {/* Actions */}
        <View className="gap-3">
          <Button
            variant="outline"
            label="Change Phone Number"
            icon={<Edit3 size={18} />}
            onPress={handleChangePhone}
          />
          <Button
            variant="ghost"
            label="Remove Phone Number"
            icon={<Trash2 size={18} color={colors.destructive} />}
            onPress={handleRemovePhone}
            style={{ borderColor: colors.destructive }}
          />
        </View>

        {/* Info */}
        <View className="mt-6 p-4 rounded-lg" style={{ backgroundColor: colors.muted }}>
          <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
            Your phone number is used for:
          </Text>
          <View className="mt-2 gap-1">
            <Text variant="caption">• Sign in to your account</Text>
            <Text variant="caption">• Let friends find you by phone</Text>
            <Text variant="caption">• Account recovery</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
```

### 5.3 Add Route for Phone Settings

**File:** `app/phone-settings.tsx` (new)

```typescript
import { PhoneSettingsScreen } from '@/modules/auth/screens/PhoneSettingsScreen';

export default function PhoneSettingsRoute() {
  return <PhoneSettingsScreen />;
}
```

### 5.4 Add `unlinkPhone` Service Function

**File:** `src/modules/auth/services/supabase-auth.service.ts`

```typescript
/**
 * Unlink phone number from user account
 */
export async function unlinkPhone(): Promise<AuthResult> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, error: 'Supabase not available', errorCode: 'NOT_CONFIGURED' };
  }

  try {
    // Clear phone from auth.users
    const { error: authError } = await client.auth.updateUser({ phone: '' });
    if (authError) {
      const classified = classifyAuthError(authError);
      return { success: false, error: classified.message, errorCode: classified.code };
    }

    // Clear phone from user_profiles
    const { data: { user } } = await client.auth.getUser();
    if (user) {
      await client
        .from('user_profiles')
        .update({ phone: null, phone_hash: null })
        .eq('id', user.id);
    }

    return { success: true };
  } catch (error: any) {
    const classified = classifyAuthError(error);
    return { success: false, error: classified.message, errorCode: classified.code };
  }
}
```

### 5.5 Add Phone Display Utility

**File:** `src/modules/auth/services/auth-utils.ts`

```typescript
/**
 * Format phone number for display with partial masking
 * "+14155551234" -> "+1 •••-•••-1234"
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return 'Not set';

  // Keep country code and last 4 digits visible
  const cleaned = phone.replace(/[^0-9+]/g, '');

  if (cleaned.length < 8) return phone; // Too short to mask meaningfully

  const countryCode = cleaned.startsWith('+')
    ? cleaned.slice(0, cleaned.length > 11 ? 3 : 2) // +1 or +44 etc
    : '';
  const lastFour = cleaned.slice(-4);

  return `${countryCode} •••-•••-${lastFour}`;
}
```

### 5.6 Update PhoneAuthScreen for "Change" Mode

**File:** `src/modules/auth/screens/PhoneAuthScreen.tsx`

Add support for `mode=change` which:
1. Shows current phone number
2. Requires re-verification of new number
3. Updates both `auth.users` and `user_profiles`

```typescript
type AuthMode = 'signin' | 'link' | 'change';

// In component:
const mode: AuthMode = (params.mode as AuthMode) || 'signin';

// Show different title based on mode
const getTitle = () => {
  switch (mode) {
    case 'change': return 'Change Phone Number';
    case 'link': return 'Verify Phone';
    default: return 'Welcome Back';
  }
};
```

---

## Files to Modify (Phase 5)

| File | Changes |
|------|---------|
| `src/modules/auth/components/settings/AccountSettings.tsx` | Show linked phone with "Verified" badge |
| `src/modules/auth/screens/PhoneSettingsScreen.tsx` | New - Phone management screen |
| `app/phone-settings.tsx` | New - Route wrapper |
| `src/modules/auth/services/supabase-auth.service.ts` | Add `unlinkPhone()` function |
| `src/modules/auth/services/auth-utils.ts` | Add `formatPhoneDisplay()` utility |
| `src/modules/auth/screens/PhoneAuthScreen.tsx` | Support `mode=change` |
| `src/modules/auth/index.ts` | Export new functions |

---

## Phase 5 Verification

1. **View linked phone:**
   - Link a phone number
   - Open Settings > Account
   - Verify phone shows with "Verified" badge and masked format

2. **Change phone:**
   - Tap on linked phone
   - Select "Change Phone Number"
   - Verify OTP flow works with new number
   - Verify old number is replaced

3. **Remove phone:**
   - Tap on linked phone
   - Select "Remove Phone Number"
   - Confirm removal
   - Verify phone no longer appears in settings
   - Verify user can still sign in via other methods

---

## Appendix: Root Cause Analysis

### Primary Issue: Missing Timeout in `signInWithPhone()`

The `signInWithPhone()` function at line 354 of `supabase-auth.service.ts` has NO timeout wrapper, unlike:
- `verifyPhoneOtp()` - has 30s timeout
- `linkPhoneToUser()` - has 30s timeout
- `verifyAndLinkPhone()` - has 30s timeout

If Supabase/Twilio is slow, the UI hangs indefinitely.

### Secondary Issue: Database Trigger Table Name Mismatch

Migration `20260112_auto_assign_username.sql` references `user_profile` (singular), but the table was renamed to `user_profiles` (plural) in `20260113_rename_user_profile.sql`. This can cause auth signup to fail if the trigger runs with the wrong table name.

### Tertiary Issue: Competing Trigger Definitions

Three files define `handle_new_user()`:
- `auto_create_profile_trigger.sql` - Creates profile only
- `schema.sql` - Creates subscription + usage_tracking only
- `20260112_auto_assign_username.sql` - Creates all 4 tables

The last one executed "wins", leading to inconsistent behavior.
