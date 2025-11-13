# Monitoring & Debug Setup Guide

This guide explains how to set up error monitoring and analytics for Weave before launching to beta testers.

## 🎯 What's Been Added

### ✅ Phase 1 Complete

1. **Local Error Logging** - All errors stored locally with timestamps, stack traces, and context
2. **Sentry Integration** - Production-ready error monitoring (setup required)
3. **PostHog Analytics** - Privacy-friendly product analytics (setup required)
4. **Debug Panel** - Comprehensive debugging interface in Settings
5. **Database Reset** - Fixed and working data wipe functionality
6. **React Error Boundary** - Catches and logs React errors gracefully

## 📱 Debug Panel Features

Access via: **Settings → Debug & Support**

The debug panel includes:

- **App Info**: Version, build number, platform, device
- **Database Stats**: Friend count, interaction count, achievement count, etc.
- **Error Log Viewer**:
  - View last 50 errors with full stack traces
  - Expandable details with copy-to-clipboard
  - Clear error logs button
  - Unseen error badge
- **Export Debug Report**:
  - Shares formatted report with all debug info
  - Includes app info, database stats, and error logs
  - Can be sent via email/messages to you for support
- **Data Wipe**:
  - Complete reset with confirmation dialog
  - Clears all database records and AsyncStorage
  - Reinitializes user profile

## 🔧 Setup Instructions

### 1. Sentry Setup (Error Monitoring)

**Free tier available** - Highly recommended for production

1. Create account at [https://sentry.io](https://sentry.io)
2. Create a new **React Native** project
3. Copy your **DSN** (looks like: `https://xxx@xxx.ingest.sentry.io/xxx`)
4. Open `src/lib/sentry.ts`
5. Replace `SENTRY_DSN = ''` with your DSN:
   ```typescript
   const SENTRY_DSN = 'https://your-actual-dsn-here';
   ```
6. Deploy and test - errors will appear in Sentry dashboard

**What you get:**
- Real-time error alerts
- Stack traces with source maps
- User impact metrics (how many users affected)
- Performance monitoring
- Release tracking
- Error grouping and deduplication

### 2. PostHog Setup (Product Analytics)

**Free tier available** - Optional but recommended

1. Create account at [https://posthog.com](https://posthog.com)
2. Create a new project
3. Copy your **Project API Key** and **Host URL**
4. Open `src/lib/posthog.ts`
5. Replace the constants:
   ```typescript
   const POSTHOG_API_KEY = 'phc_your_api_key_here';
   const POSTHOG_HOST = 'https://app.posthog.com'; // Or your instance
   ```

**What you get:**
- User behavior analytics
- Screen view tracking
- Custom event tracking
- Funnel analysis
- Retention metrics
- Session recordings (optional)
- Feature flags (optional)

**Pre-configured Events:**
- Onboarding flow completion
- Friend additions/edits
- Interaction logging
- Quick Weave usage
- Achievement unlocks
- Settings changes
- Suggestion engagement

### 3. Local Testing

Even without Sentry/PostHog configured, you have full local debugging:

1. **Start the app**: `npm start`
2. **Open Settings** → **Debug & Support**
3. **Trigger an error** to test logging (or wait for natural errors)
4. **View error logs** in the debug panel
5. **Export debug report** to see formatted output

## 🚀 Pre-Launch Checklist

Before sending to testers:

- [ ] Sentry DSN configured and tested
- [ ] PostHog API key configured (optional)
- [ ] Test debug panel works
- [ ] Test "Export Debug Report" shares correctly
- [ ] Test database reset works
- [ ] Verify error boundary catches React errors
- [ ] Check that errors appear in Sentry dashboard
- [ ] Set up Sentry email alerts for critical errors

## 📊 What to Monitor

### Critical Errors (Act Immediately)
- App crashes
- Database errors
- Navigation failures
- Authentication/permission issues

### Important Metrics
- Onboarding completion rate
- Daily active users
- Friend add rate
- Interaction logging frequency
- Feature adoption (Quick Weave, Intentions, etc.)
- Error rate per session

### Nice to Know
- Popular interaction types
- Average weave score
- Achievement unlock rates
- Settings preferences
- Time of day usage patterns

## 🔒 Privacy Considerations

**What's Tracked:**
- Error messages and stack traces (no user data in errors)
- Anonymous usage patterns
- Screen views and interactions
- Device/platform information

**What's NOT Tracked:**
- Friend names or personal information
- Interaction details or content
- User email or phone numbers
- Location data
- Any PII (Personally Identifiable Information)

Both Sentry and PostHog are configured with `beforeSend` filters to strip sensitive data.

## 🐛 Getting Tester Feedback

Instruct your testers to:

1. **When something breaks**:
   - Open **Settings → Debug & Support**
   - Tap **Export Debug Report**
   - Share it with you via email/message

2. **Before reporting a bug**:
   - Check the error logs in Debug Panel
   - Note what they were doing when it happened
   - Include device/OS information (shown in App Info)

## 📝 Example Tester Instructions

> **Experiencing an issue?**
>
> 1. Open the app
> 2. Go to Settings (gear icon)
> 3. Scroll down and tap "Debug & Support"
> 4. Tap "Export Debug Report"
> 5. Send the report to [your-email@example.com]
>
> This helps us fix bugs faster!

## 🛠 Advanced Usage

### Track Custom Events

In your code:

```typescript
import { trackEvent, AnalyticsEvents } from '../src/lib/posthog';

// Track custom event
trackEvent(AnalyticsEvents.FRIEND_ADDED, {
  archetype: 'Hermit',
  tier: 'InnerCircle',
  source: 'manual',
});
```

### Log Custom Errors

```typescript
import { logError } from '../src/lib/error-logger';

try {
  // Some operation
} catch (error) {
  await logError(error, {
    context: 'user_action',
    operation: 'save_friend',
  });
}
```

## 🎓 Next Steps (Phase 2 - Optional)

Consider adding:

- [ ] **In-app feedback form** with screenshot capture
- [ ] **Crash-free rate dashboard** for monitoring app stability
- [ ] **A/B testing** via PostHog feature flags
- [ ] **Performance monitoring** (network requests, render times)
- [ ] **User session recordings** (PostHog feature)
- [ ] **Remote config** for feature toggles
- [ ] **Push notification tracking**

## 📚 Resources

- [Sentry React Native Docs](https://docs.sentry.io/platforms/react-native/)
- [PostHog React Native Docs](https://posthog.com/docs/libraries/react-native)
- [React Error Boundary Guide](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)

---

**Questions?** Check the inline comments in:
- `src/lib/sentry.ts`
- `src/lib/posthog.ts`
- `src/lib/error-logger.ts`
- `src/components/DebugPanel.tsx`
