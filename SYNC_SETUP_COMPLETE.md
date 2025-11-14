# ✅ Cloud Sync Setup Complete!

## What's Been Connected

### 1. ✅ Dependencies Installed
- `@supabase/supabase-js` - Supabase client library
- `expo-secure-store` - Secure token storage
- `expo-web-browser` - OAuth authentication support
- `expo-auth-session` - Auth session handling

### 2. ✅ Environment Configuration
Created `.env` file with your Supabase credentials:
- **URL**: https://pjqcqmefptmofhcuuqfr.supabase.co
- **Anon Key**: Configured ✓

### 3. ✅ Code Integration
- **Auth Store** (`src/stores/authStore.ts`): Ready to manage user authentication
- **Sync Engine** (`src/lib/sync-engine.ts`): Bidirectional sync logic implemented
- **App Layout** (`app/_layout.tsx`): Auth initialization and auto-sync on app foreground
- **Friend Store** (`src/stores/friendStore.ts`): Records marked as `pending` for sync
- **Weave Engine** (`src/lib/weave-engine.ts`): Interactions marked for sync

### 4. ✅ Sync Triggers
Sync automatically runs when:
- App becomes active (foreground)
- User signs in
- User creates/updates friends or interactions

---

## ⚠️ Required: Apply Database Schema

**Before sync will work**, you need to apply the Supabase schema to your project:

### Steps:

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard/project/pjqcqmefptmofhcuuqfr

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Copy & Run Schema**
   - Open `supabase/schema.sql` in this project
   - Copy the entire contents
   - Paste into the Supabase SQL editor
   - Click "Run" to execute

This will create:
- `user_subscriptions` table (for freemium tiers)
- `usage_tracking` table (for limits)
- `friends`, `interactions`, `intentions`, etc. (mirrors your local DB)
- Row Level Security (RLS) policies (users can only access their own data)

---

## 🎯 Next Steps (In Order)

### Option A: Test Without Authentication (Local-Only Mode)
The app will continue to work offline without authentication. No sync will occur, but all features remain functional.

```typescript
// Current state: Auth is initialized but user is null
// App works normally, just no cloud sync
```

### Option B: Build Auth UI & Enable Sync

To enable cloud sync, you need to build sign-in screens:

#### 1. Create Auth Screens
Create `app/auth/sign-in.tsx`:

```typescript
import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      // Auth store will auto-update via onAuthStateChange
      // Trigger initial sync for this user
      const user = useAuthStore.getState().user;
      if (user) {
        const { triggerAutoSync } = await import('@/lib/sync-engine');
        await triggerAutoSync(user.id);
      }
    }
    setLoading(false);
  };

  return (
    <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Sign In</Text>

      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 10, marginBottom: 10 }}
      />

      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={{ borderWidth: 1, padding: 10, marginBottom: 20 }}
      />

      <TouchableOpacity
        onPress={handleSignIn}
        disabled={loading}
        style={{ backgroundColor: '#007AFF', padding: 15, borderRadius: 8 }}
      >
        <Text style={{ color: 'white', textAlign: 'center' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

#### 2. Add Auth Entry Point
Add a "Sync & Backup" option in your Settings Modal:

```typescript
// In src/components/settings-modal.tsx
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'expo-router';

// Inside component:
const user = useAuthStore(state => state.user);
const router = useRouter();

// Add this option:
{!user ? (
  <TouchableOpacity onPress={() => router.push('/auth/sign-in')}>
    <Text>Enable Cloud Sync (Sign In)</Text>
  </TouchableOpacity>
) : (
  <View>
    <Text>Signed in as: {user.email}</Text>
    <TouchableOpacity onPress={() => useAuthStore.getState().signOut()}>
      <Text>Sign Out</Text>
    </TouchableOpacity>
  </View>
)}
```

#### 3. Migrate Existing Local Data
When a user signs in for the first time, migrate their existing data:

```typescript
// src/lib/account-migration.ts
import { database } from '../db';
import { createSyncEngine } from './sync-engine';

export async function migrateLocalDataToAccount(userId: string) {
  console.log('[Migration] Starting local data migration for user:', userId);

  await database.write(async () => {
    // Mark all existing friends for sync
    const friends = await database.get('friends').query().fetch();
    for (const friend of friends) {
      await friend.update((f: any) => {
        f.userId = userId;
        f.syncStatus = 'pending';
      });
    }

    // Mark all existing interactions for sync
    const interactions = await database.get('interactions').query().fetch();
    for (const interaction of interactions) {
      await interaction.update((i: any) => {
        i.userId = userId;
        i.syncStatus = 'pending';
      });
    }

    // ... repeat for other tables
  });

  // Trigger initial sync to upload all data
  const syncEngine = createSyncEngine(userId);
  const result = await syncEngine.sync();

  console.log('[Migration] Migration complete!', result);
  return result;
}
```

Call this in your sign-in flow:
```typescript
// After successful sign-in
const hasLocalData = (await database.get('friends').query().fetch()).length > 0;
if (hasLocalData) {
  await migrateLocalDataToAccount(user.id);
}
```

---

## 🔍 Testing Sync

### Manual Sync Test
Once you have auth set up, test sync manually:

```typescript
import { createSyncEngine } from '@/lib/sync-engine';

// In a component or debug screen:
const testSync = async () => {
  const user = useAuthStore.getState().user;
  if (!user) {
    console.log('No user signed in');
    return;
  }

  const engine = createSyncEngine(user.id);
  const result = await engine.sync();
  console.log('Sync result:', result);

  if (result.success) {
    alert(`Sync complete! Pushed: ${result.pushedRecords}, Pulled: ${result.pulledRecords}`);
  } else {
    alert(`Sync failed: ${result.errors.join(', ')}`);
  }
};
```

### Multi-Device Test
1. Sign in on Device A
2. Create a friend on Device A
3. Sign in with same account on Device B
4. Pull to refresh or trigger sync
5. Friend should appear on Device B ✓

---

## 🚨 Important Notes

### Security
- ✅ RLS policies ensure users can only see their own data
- ✅ Anon key is safe to expose in client code
- ⚠️ Never expose your **service role key**

### Sync Behavior
- **Conflict Resolution**: Server wins (last-write-wins)
- **Offline Support**: App works fully offline, syncs when online
- **Auto-Sync**: Triggers on app foreground (when authenticated)

### Current State
- ✅ Auth system initialized (but no user signed in)
- ✅ Sync engine ready (waiting for user to sign in)
- ✅ Records marked for sync on create/update
- ⚠️ Database schema needs to be applied in Supabase
- ⚠️ Auth UI screens need to be created

---

## 📊 What This Solves

✅ **Data Loss Prevention**: User data is backed up to cloud
✅ **Multi-Device Support**: Sync across multiple devices
✅ **Account System**: Ready for freemium/subscription features
✅ **Offline-First**: App works without internet, syncs when available

---

## 🆘 Troubleshooting

### Sync Not Working
1. Check `.env` file exists and has correct credentials
2. Verify Supabase schema has been applied
3. Confirm user is signed in: `useAuthStore.getState().user`
4. Check network connectivity
5. Review console logs for sync errors

### Auth Issues
- Verify redirect URIs in Supabase dashboard
- Check email confirmation is disabled (or handle confirmation flow)
- Test with a real email address (not a temp email)

### TypeScript Errors
If you see import errors, run:
```bash
npm start -- --clear
```

---

## 🎉 You're Ready!

Your app now has:
- ✅ Cloud sync infrastructure
- ✅ Account system foundation
- ✅ Freemium/subscription architecture

Next steps:
1. Apply Supabase schema
2. Build auth UI
3. Test sync with a test account
4. (Optional) Add OAuth providers (Google, Apple)
5. (Optional) Implement freemium limits and upgrade flow

Good luck! 🚀
