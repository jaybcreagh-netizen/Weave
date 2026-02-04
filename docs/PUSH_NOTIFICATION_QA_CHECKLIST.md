# Push Notification QA Checklist

Use this checklist before promoting builds that include push changes.

## 1) Preflight Config

- Apply latest DB migrations (including `20260204_harden_push_notification_triggers.sql`).
- Deploy `send-push` Edge Function with `PUSH_WEBHOOK_SECRET` set.
- Set DB settings (same project/secret pair):

```sql
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://<your-project-ref>.supabase.co';
ALTER DATABASE postgres SET app.settings.push_webhook_secret = '<same-as-PUSH_WEBHOOK_SECRET>';
```

- Verify at least one test user has a row in `user_push_tokens`.

## 2) Device Matrix

- iOS physical device (APNs does not work on iOS simulator).
- Android physical device or emulator with Google Play services.
- Test with app in:
  - foreground
  - background
  - terminated

## 3) Local Notification Flows

- **Smart suggestion tap routing**
  - Trigger a smart suggestion.
  - Tap notification.
  - Expected: opens `friend-profile` for the correct friend (no "Friend Not Found").
- **Battery check-in / weekly reflection / evening digest**
  - Trigger each channel.
  - Expected: tap opens intended destination/modal, no fallback errors.

## 4) Remote Social Push Flows

- **Shared weave invite**
  - User A shares weave with User B.
  - Expected on User B: push arrives; tap lands in app and pending weave data refreshes.
- **Link request**
  - User A sends link request to User B.
  - Expected on User B: `link_request` push arrives; tap opens app and link-request data refreshes.
- **Link accepted**
  - User B accepts.
  - Expected on User A: `link_accepted` push arrives; tap refreshes linked-friends/outgoing-link state.

## 5) Auth & Token Lifecycle

- Sign in as User A -> confirm push token registration.
- Sign out -> confirm unregister runs (token row removed for that user/device).
- Sign in as User B on same device -> confirm new registration occurs (no stale "already registered" skip).

## 6) Failure-Mode Checks

- Temporarily unset DB push settings.
  - Expected: triggers do not call placeholder URL; warning is emitted and app stays healthy.
- Restore settings and repeat one shared-weave and one link-request flow.

## 7) Ship Gate

Ship only if all of the following are true:
- No broken deep links on tap.
- All social push types (`shared_weave`, `link_request`, `link_accepted`) route correctly.
- Account switch/sign-out token behavior is correct.
- DB trigger path works with shared-secret auth (not service-role placeholder config).
