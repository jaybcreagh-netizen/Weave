# Accounts System Setup Guide

## Overview

This backend infrastructure enables:
- **User authentication** (email, Google, Apple)
- **Cloud sync** across devices
- **Freemium model** with tiered subscriptions
- **Feature gating** based on subscription tier
- **Usage tracking** and limits

---

## Setup Steps

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon key
3. Add to `.env` file:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 2. Apply Database Schema

1. Go to Supabase Dashboard → SQL Editor
2. Copy contents of `supabase/schema.sql`
3. Run the SQL to create tables, policies, and triggers

This will create:
- User subscription tables
- Usage tracking tables
- Mirrored WatermelonDB tables
- Row Level Security policies
- Auto-sync triggers

### 3. Configure OAuth Providers

#### Google Sign-In

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials:
   - **Web application** (for Supabase)
   - **iOS** application
   - **Android** application
3. Add authorized redirect URI: `https://[your-project].supabase.co/auth/v1/callback`
4. Copy Client ID and Secret to Supabase Dashboard → Authentication → Providers → Google

#### Apple Sign-In

1. Go to [Apple Developer Console](https://developer.apple.com)
2. Create a Service ID for "Sign in with Apple"
3. Download the .p8 key file
4. Add to Supabase Dashboard → Authentication → Providers → Apple:
   - Service ID
   - Team ID
   - Key ID
   - Private Key (.p8 contents)

### 4. Install Dependencies

```bash
npm install @supabase/supabase-js expo-secure-store expo-web-browser expo-auth-session expo-apple-authentication
```

### 5. Update app.json

```json
{
  "expo": {
    "scheme": "weave",
    "ios": {
      "bundleIdentifier": "com.yourcompany.weave",
      "infoPlist": {
        "CFBundleURLTypes": [
          {
            "CFBundleURLSchemes": ["weave"]
          }
        ]
      }
    },
    "android": {
      "package": "com.yourcompany.weave",
      "intentFilters": [
        {
          "action": "VIEW",
          "data": [{ "scheme": "weave" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "plugins": [
      "expo-apple-authentication"
    ]
  }
}
```

### 6. Initialize Auth on App Startup

```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export default function RootLayout() {
  const initialize = useAuthStore(state => state.initialize);

  useEffect(() => {
    initialize();
  }, []);

  // ... rest of layout
}
```

---

## Usage Examples

### Feature Gating in Components

```typescript
// Example: Limit friends based on tier
import { useAuthStore } from '@/stores/authStore';
import { TIER_LIMITS, isAtLimit } from '@/lib/subscription-tiers';

export function AddFriendButton() {
  const tier = useAuthStore(state => state.getTier());
  const usage = useAuthStore(state => state.usage);

  const canAddFriend = !isAtLimit(
    tier,
    'maxFriends',
    usage?.friendsCount ?? 0
  );

  const handlePress = () => {
    if (!canAddFriend) {
      // Show upgrade prompt
      Alert.alert(
        'Friend Limit Reached',
        `You've reached the ${TIER_LIMITS[tier].maxFriends} friend limit for ${tier} tier. Upgrade to add more friends!`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => router.push('/upgrade') }
        ]
      );
      return;
    }

    // Proceed with adding friend
    router.push('/add-friend');
  };

  return (
    <TouchableOpacity onPress={handlePress}>
      <Text>Add Friend</Text>
    </TouchableOpacity>
  );
}
```

### Conditional Feature Access

```typescript
// Example: Hide journal for free users
import { useAuthStore } from '@/stores/authStore';
import { hasFeatureAccess } from '@/lib/subscription-tiers';

export function SettingsScreen() {
  const tier = useAuthStore(state => state.getTier());
  const canAccessJournal = hasFeatureAccess(tier, 'canAccessJournal');

  return (
    <View>
      {canAccessJournal ? (
        <TouchableOpacity onPress={() => router.push('/journal')}>
          <Text>Journal</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => router.push('/upgrade')}>
          <View className="opacity-50">
            <Text>Journal (Plus only)</Text>
            <Lock size={16} />
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

### Sync on App State Changes

```typescript
// Example: Auto-sync when app becomes active
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useAuthStore } from '@/stores/authStore';
import { triggerAutoSync } from '@/lib/sync-engine';

export function useSyncOnActive() {
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && user) {
        triggerAutoSync(user.id);
      }
    });

    return () => subscription.remove();
  }, [user]);
}
```

### Usage Tracking

```typescript
// Example: Track weave creation
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

export async function logNewWeave(weaveData) {
  // ... create weave in WatermelonDB

  // Update usage tracking
  const userId = useAuthStore.getState().user?.id;
  if (userId) {
    const { error } = await supabase.rpc('increment_weaves_count', {
      p_user_id: userId
    });

    if (!error) {
      // Refresh usage stats
      await useAuthStore.getState().refreshUsage();
    }
  }
}
```

---

## Subscription Tiers

### Free Tier
- 20 friends max
- 50 weaves per month
- Basic dashboard
- Cloud sync (2 devices)

### Plus Tier ($4.99/month)
- 100 friends max
- 200 weaves per month
- Advanced analytics
- Journal access
- Custom reminders
- Cloud sync (5 devices)
- Data export

### Premium Tier ($9.99/month)
- Unlimited friends
- Unlimited weaves
- AI-powered insights
- Priority support
- Unlimited devices
- All Plus features

---

## Testing

### Test User Flow

1. **Local-only user** (no account):
   - App works fully offline
   - No sync, no limits (for now)

2. **Create account**:
   - Sign up with email/Google/Apple
   - Local data migrates to cloud
   - Free tier limits apply
   - Sync enabled

3. **Upgrade to Plus**:
   - Limits increase
   - New features unlock
   - Billing via Stripe/RevenueCat

### Test Sync

```typescript
// Manual sync trigger for testing
import { createSyncEngine } from '@/lib/sync-engine';

const engine = createSyncEngine(userId);
const result = await engine.sync();
console.log('Sync result:', result);
```

---

## Migration Strategy for Existing Users

When you launch accounts:

```typescript
// src/lib/account-migration.ts
export async function migrateLocalDataToAccount(userId: string) {
  console.log('Migrating local data to account...');

  // Mark all local records with user_id
  await database.write(async () => {
    const collections = [
      'friends',
      'interactions',
      'intentions',
      // ... all tables
    ];

    for (const collectionName of collections) {
      const records = await database.get(collectionName).query().fetch();

      for (const record of records) {
        await record.update((r: any) => {
          r.userId = userId;
          r.syncStatus = 'pending'; // Mark for upload
        });
      }
    }
  });

  // Trigger initial sync
  const syncEngine = createSyncEngine(userId);
  await syncEngine.sync();

  console.log('Migration complete!');
}

// Call this after first sign-in
if (isFirstTimeLogin && hasLocalData) {
  await migrateLocalDataToAccount(user.id);
}
```

---

## Revenue Integration

### Stripe Integration (Web/Backend)

```typescript
// Server-side webhook handler
import Stripe from 'stripe';

export async function handleStripeWebhook(event: Stripe.Event) {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription;

      await supabase
        .from('user_subscriptions')
        .update({
          tier: mapStripePriceToTier(subscription.items.data[0].price.id),
          status: subscription.status,
          current_period_end: new Date(subscription.current_period_end * 1000),
        })
        .eq('stripe_customer_id', subscription.customer);
      break;

    case 'customer.subscription.deleted':
      // Downgrade to free
      await supabase
        .from('user_subscriptions')
        .update({ tier: 'free', status: 'canceled' })
        .eq('stripe_subscription_id', event.data.object.id);
      break;
  }
}
```

### RevenueCat Integration (Mobile)

```typescript
import Purchases from 'react-native-purchases';

// Initialize RevenueCat
await Purchases.configure({ apiKey: REVENUECAT_API_KEY });

// Handle purchase
const { customerInfo } = await Purchases.purchasePackage(package);

// Update Supabase with entitlement
if (customerInfo.entitlements.active['plus']) {
  await supabase
    .from('user_subscriptions')
    .update({ tier: 'plus', status: 'active' })
    .eq('user_id', userId);
}
```

---

## Security Notes

1. **Never expose service role key** - only use in server-side functions
2. **RLS policies enforce data isolation** - users can only access their own data
3. **Validate all inputs** on server-side
4. **Rate limit auth endpoints** to prevent abuse
5. **Enable MFA** for admin accounts

---

## Troubleshooting

### Sync not working
- Check network connectivity
- Verify Supabase credentials in `.env`
- Check user is authenticated: `useAuthStore.getState().isAuthenticated`
- Review logs for sync errors

### RLS policy errors
- Ensure user_id is set on all records
- Check auth.uid() matches user_id in policies
- Test policies in Supabase SQL Editor

### OAuth redirect issues
- Verify redirect URIs match exactly
- Check app.json scheme configuration
- Test deep linking: `npx uri-scheme open weave://auth/callback`

---

## Next Steps

1. **Launch auth UI**: Build sign-up/sign-in screens
2. **Test sync**: Create records on device A, verify they appear on device B
3. **Implement upgrade flow**: Add payment integration
4. **Monitor usage**: Set up analytics to track tier conversions
5. **Iterate on limits**: Adjust based on user feedback

---

## Support

For issues with:
- **Supabase**: Check [Supabase docs](https://supabase.com/docs)
- **OAuth**: Review provider-specific setup guides
- **Sync conflicts**: See `src/lib/sync-engine.ts` for conflict resolution logic
