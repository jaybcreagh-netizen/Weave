/**
 * Retention Notification Manager
 * Critical notifications for user retention, especially in early days
 *
 * Key Features:
 * - Onboarding sequence (days 1-14) to build habits
 * - At-risk user detection & re-engagement
 * - Decay warning alerts for critical friends
 * - Smart timing based on user behavior patterns
 */

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../db';
import UserProfile from '../db/models/UserProfile';
import Friend from '../db/models/Friend';
import Interaction from '../db/models/Interaction';
import { calculateCurrentScore } from './weave-engine';
import { trackEvent, AnalyticsEvents } from './analytics';
import { Q } from '@nozbe/watermelondb';

// AsyncStorage keys
const ONBOARDING_STATE_KEY = '@weave:onboarding_notifications';
const LAST_APP_OPEN_KEY = '@weave:last_app_open';
const LAST_WEAVE_LOGGED_KEY = '@weave:last_weave_logged';
const OPTIMAL_SEND_TIMES_KEY = '@weave:optimal_send_times';
const NOTIFICATION_ENGAGEMENT_KEY = '@weave:notification_engagement';

// Notification identifiers
const ONBOARDING_PREFIX = 'onboarding-';
const REENGAGEMENT_ID = 'reengagement';
const DECAY_WARNING_PREFIX = 'decay-warning-';
const MILESTONE_PREFIX = 'milestone-';

// ================================================================================
// TYPES & INTERFACES
// ================================================================================

interface OnboardingState {
  signupDate: number;
  completedSteps: string[];
  lastNotificationSent?: number;
}

interface OptimalSendTimes {
  morning: number; // Hour (0-23)
  afternoon: number;
  evening: number;
  preferredWindow: 'morning' | 'afternoon' | 'evening';
  lastUpdated: number;
}

interface NotificationEngagement {
  sent: number;
  opened: number;
  dismissed: number;
  lastEngagement?: number;
}

// ================================================================================
// ONBOARDING SEQUENCE (Days 1-14)
// ================================================================================

const ONBOARDING_NOTIFICATIONS = [
  {
    id: 'day1-welcome',
    dayOffset: 1,
    title: "Welcome to your Weave 🕸️",
    body: "Log your first connection to see the magic happen",
    data: { type: 'onboarding', step: 'first-weave' },
  },
  {
    id: 'day2-battery',
    dayOffset: 2,
    title: "How's your social energy? 🌙",
    body: "Quick check-in: tap to rate your battery level",
    data: { type: 'battery-checkin', onboarding: true },
  },
  {
    id: 'day3-archetypes',
    dayOffset: 3,
    title: "Did you know? ✨",
    body: "Your friends' archetypes help suggest meaningful connection ideas",
    data: { type: 'onboarding', step: 'learn-archetypes' },
  },
  {
    id: 'day5-momentum',
    dayOffset: 5,
    title: "You're building momentum 🚀",
    body: "Keep it up! Regular weaves strengthen your relationships",
    data: { type: 'onboarding', step: 'momentum-explained' },
  },
  {
    id: 'day7-reflection',
    dayOffset: 7,
    title: "One week in! 🎉",
    body: "Time to reflect on how your connections felt this week",
    data: { type: 'weekly-reflection', onboarding: true },
  },
  {
    id: 'day10-planning',
    dayOffset: 10,
    title: "Pro tip: Plan ahead 📅",
    body: "Schedule future weaves to stay consistent",
    data: { type: 'onboarding', step: 'learn-planning' },
  },
  {
    id: 'day14-graduate',
    dayOffset: 14,
    title: "You're a weaving pro! 🎓",
    body: "Two weeks of mindful connection—that's powerful",
    data: { type: 'onboarding', step: 'graduation' },
  },
];

/**
 * Get current onboarding state
 */
async function getOnboardingState(): Promise<OnboardingState | null> {
  try {
    const stored = await AsyncStorage.getItem(ONBOARDING_STATE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error getting onboarding state:', error);
    return null;
  }
}

/**
 * Initialize onboarding notifications for new user
 */
export async function initializeOnboardingSequence(): Promise<void> {
  try {
    // Check if already initialized
    const existing = await getOnboardingState();
    if (existing) {
      console.log('[Retention] Onboarding sequence already initialized');
      return;
    }

    const now = Date.now();
    const state: OnboardingState = {
      signupDate: now,
      completedSteps: [],
    };

    await AsyncStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(state));

    // Schedule all onboarding notifications
    await scheduleOnboardingNotifications(state);

    trackEvent(AnalyticsEvents.ONBOARDING_STARTED);
    console.log('[Retention] Onboarding sequence initialized');
  } catch (error) {
    console.error('Error initializing onboarding sequence:', error);
  }
}

/**
 * Schedule all onboarding notifications based on signup date
 */
async function scheduleOnboardingNotifications(state: OnboardingState): Promise<void> {
  const signupDate = new Date(state.signupDate);
  const optimalTime = await getOptimalSendTime('evening'); // Default to evening for onboarding

  for (const notification of ONBOARDING_NOTIFICATIONS) {
    // Skip if already completed
    if (state.completedSteps.includes(notification.id)) {
      continue;
    }

    // Calculate send time
    const sendDate = new Date(signupDate);
    sendDate.setDate(sendDate.getDate() + notification.dayOffset);
    sendDate.setHours(optimalTime, 0, 0, 0);

    // Don't schedule if in the past
    if (sendDate.getTime() <= Date.now()) {
      continue;
    }

    await Notifications.scheduleNotificationAsync({
      identifier: `${ONBOARDING_PREFIX}${notification.id}`,
      content: {
        title: notification.title,
        body: notification.body,
        data: notification.data,
      },
      trigger: sendDate,
    });

    console.log(`[Retention] Scheduled: ${notification.title} for ${sendDate.toLocaleString()}`);
  }
}

/**
 * Mark onboarding step as complete
 */
export async function completeOnboardingStep(stepId: string): Promise<void> {
  try {
    const state = await getOnboardingState();
    if (!state) return;

    if (!state.completedSteps.includes(stepId)) {
      state.completedSteps.push(stepId);
      await AsyncStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify(state));

      // Cancel the notification for this step
      await Notifications.cancelScheduledNotificationAsync(`${ONBOARDING_PREFIX}${stepId}`);

      trackEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, { step: stepId });
    }
  } catch (error) {
    console.error('Error completing onboarding step:', error);
  }
}

/**
 * Check if user is still in onboarding period
 */
export async function isInOnboardingPeriod(): Promise<boolean> {
  const state = await getOnboardingState();
  if (!state) return false;

  const daysSinceSignup = (Date.now() - state.signupDate) / 86400000;
  return daysSinceSignup < 14;
}

// ================================================================================
// AT-RISK USER DETECTION & RE-ENGAGEMENT
// ================================================================================

/**
 * Update last app open timestamp
 * Call this in app/_layout.tsx on mount
 */
export async function recordAppOpen(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_APP_OPEN_KEY, Date.now().toString());

    // Also update optimal send times based on when user opens app
    await updateOptimalSendTimes();
  } catch (error) {
    console.error('Error recording app open:', error);
  }
}

/**
 * Update last weave logged timestamp
 * Call this after logging any weave
 */
export async function recordWeaveLogged(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_WEAVE_LOGGED_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error recording weave logged:', error);
  }
}

/**
 * Check if user is at risk and send re-engagement notification
 */
export async function checkAtRiskUsers(): Promise<void> {
  try {
    const lastOpenStr = await AsyncStorage.getItem(LAST_APP_OPEN_KEY);
    const lastWeaveStr = await AsyncStorage.getItem(LAST_WEAVE_LOGGED_KEY);

    const now = Date.now();
    const lastOpen = lastOpenStr ? parseInt(lastOpenStr, 10) : now;
    const lastWeave = lastWeaveStr ? parseInt(lastWeaveStr, 10) : now;

    const hoursSinceOpen = (now - lastOpen) / 3600000;
    const daysSinceWeave = (now - lastWeave) / 86400000;

    // At risk scenarios
    const noAppIn48Hours = hoursSinceOpen >= 48;
    const noWeaveIn3Days = daysSinceWeave >= 3;
    const inOnboarding = await isInOnboardingPeriod();

    // More aggressive re-engagement during onboarding
    const threshold = inOnboarding ? 36 : 48;

    if (hoursSinceOpen >= threshold) {
      await scheduleReengagementNotification('app-absence', hoursSinceOpen);
    } else if (noWeaveIn3Days && !inOnboarding) {
      await scheduleReengagementNotification('weave-absence', daysSinceWeave);
    }
  } catch (error) {
    console.error('Error checking at-risk users:', error);
  }
}

/**
 * Schedule re-engagement notification
 */
async function scheduleReengagementNotification(
  reason: 'app-absence' | 'weave-absence',
  timeSince: number
): Promise<void> {
  // Cancel existing re-engagement notification
  await Notifications.cancelScheduledNotificationAsync(REENGAGEMENT_ID);

  let title: string;
  let body: string;

  if (reason === 'app-absence') {
    const messages = [
      {
        title: "We miss you 🌙",
        body: "Your friendships are waiting—check in on your weave",
      },
      {
        title: "Your connections need you ✨",
        body: "A few minutes can strengthen the bonds that matter",
      },
      {
        title: "How are your friends doing? 🕸️",
        body: "Quick check: some relationships might need attention",
      },
    ];
    const random = messages[Math.floor(Math.random() * messages.length)];
    title = random.title;
    body = random.body;
  } else {
    // Get a friend who needs attention
    const needsAttention = await getFriendNeedingAttention();
    if (needsAttention) {
      title = `${needsAttention.name} misses you 💭`;
      body = `It's been ${Math.floor(timeSince)} days—time to reconnect?`;
    } else {
      title = "Time to weave? 🕸️";
      body = "Your friendships thrive with regular connection";
    }
  }

  // Schedule for optimal time (or immediately if urgent)
  const optimalTime = await getOptimalSendTime();
  const sendDate = new Date();
  sendDate.setHours(optimalTime, 0, 0, 0);

  // If optimal time is in past today, send tomorrow
  if (sendDate.getTime() <= Date.now()) {
    sendDate.setDate(sendDate.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    identifier: REENGAGEMENT_ID,
    content: {
      title,
      body,
      data: {
        type: 'reengagement',
        reason,
      },
    },
    trigger: sendDate,
  });

  trackEvent(AnalyticsEvents.REENGAGEMENT_NOTIFICATION_SENT, { reason });
  console.log(`[Retention] Re-engagement notification scheduled: ${reason}`);
}

// ================================================================================
// DECAY WARNING ALERTS
// ================================================================================

/**
 * Check for friends with critically decaying scores and send alerts
 */
export async function checkDecayWarnings(): Promise<void> {
  try {
    const friends = await database
      .get<Friend>('friends')
      .query(Q.where('is_dormant', false))
      .fetch();

    const warnings: Array<{ friend: Friend; currentScore: number }> = [];

    for (const friend of friends) {
      const currentScore = calculateCurrentScore(friend);

      // Critical thresholds based on tier
      const criticalThreshold = {
        InnerCircle: 50, // Inner circle dropping below 50 is critical
        CloseFriends: 40,
        Community: 30,
      }[friend.dunbarTier] || 40;

      // Only warn if:
      // 1. Score is below critical threshold
      // 2. Friend was previously healthy (weaveScore was above threshold + 20)
      if (currentScore < criticalThreshold && friend.weaveScore > criticalThreshold + 20) {
        warnings.push({ friend, currentScore });
      }
    }

    // Sort by tier priority (Inner Circle first) and score (lowest first)
    warnings.sort((a, b) => {
      const tierPriority = { InnerCircle: 0, CloseFriends: 1, Community: 2 };
      const tierDiff = tierPriority[a.friend.dunbarTier] - tierPriority[b.friend.dunbarTier];
      if (tierDiff !== 0) return tierDiff;
      return a.currentScore - b.currentScore;
    });

    // Send warnings (limit to top 2 most critical)
    for (const warning of warnings.slice(0, 2)) {
      await scheduleDecayWarning(warning.friend, warning.currentScore);
    }
  } catch (error) {
    console.error('Error checking decay warnings:', error);
  }
}

/**
 * Schedule decay warning notification for a friend
 */
async function scheduleDecayWarning(friend: Friend, currentScore: number): Promise<void> {
  const notificationId = `${DECAY_WARNING_PREFIX}${friend.id}`;

  // Don't spam - check if we already sent a warning recently
  const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
  const existingWarning = existingNotifications.find(n => n.identifier === notificationId);
  if (existingWarning) {
    console.log(`[Retention] Decay warning already scheduled for ${friend.name}`);
    return;
  }

  const scorePercent = Math.round(currentScore);
  const tierLabel = {
    InnerCircle: 'Inner Circle',
    CloseFriends: 'Close Friend',
    Community: 'Community',
  }[friend.dunbarTier];

  const messages = [
    {
      title: `${friend.name} needs attention 🌙`,
      body: `Your ${tierLabel} connection is fading (${scorePercent}%)—reach out soon?`,
    },
    {
      title: `Don't lose touch with ${friend.name} 💭`,
      body: `${tierLabel} • ${scorePercent}% strength • Time to reconnect?`,
    },
    {
      title: `${friend.name} is drifting 🕸️`,
      body: `Your bond is weakening (${scorePercent}%)—a small gesture goes a long way`,
    },
  ];

  const random = messages[Math.floor(Math.random() * messages.length)];

  // Schedule for optimal time
  const optimalTime = await getOptimalSendTime();
  const sendDate = new Date();
  sendDate.setHours(optimalTime, 30, 0, 0); // +30 min offset from primary notifications

  if (sendDate.getTime() <= Date.now()) {
    sendDate.setDate(sendDate.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      title: random.title,
      body: random.body,
      data: {
        type: 'decay-warning',
        friendId: friend.id,
        friendName: friend.name,
        currentScore: scorePercent,
      },
    },
    trigger: sendDate,
  });

  trackEvent(AnalyticsEvents.DECAY_WARNING_SENT, {
    friendId: friend.id,
    tier: friend.dunbarTier,
    score: scorePercent,
  });

  console.log(`[Retention] Decay warning scheduled for ${friend.name} (${scorePercent}%)`);
}

/**
 * Cancel decay warning for a friend (call after logging weave)
 */
export async function cancelDecayWarning(friendId: string): Promise<void> {
  const notificationId = `${DECAY_WARNING_PREFIX}${friendId}`;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

// ================================================================================
// SMART TIMING BASED ON USER BEHAVIOR
// ================================================================================

/**
 * Update optimal send times based on when user engages with app
 */
async function updateOptimalSendTimes(): Promise<void> {
  try {
    const now = new Date();
    const currentHour = now.getHours();

    // Load existing times
    const stored = await AsyncStorage.getItem(OPTIMAL_SEND_TIMES_KEY);
    let times: OptimalSendTimes = stored
      ? JSON.parse(stored)
      : {
          morning: 9,
          afternoon: 14,
          evening: 19,
          preferredWindow: 'evening',
          lastUpdated: Date.now(),
        };

    // Determine which window this engagement falls into
    let window: 'morning' | 'afternoon' | 'evening';
    if (currentHour >= 6 && currentHour < 12) {
      window = 'morning';
      times.morning = Math.round((times.morning * 0.7 + currentHour * 0.3)); // Weighted average
    } else if (currentHour >= 12 && currentHour < 17) {
      window = 'afternoon';
      times.afternoon = Math.round((times.afternoon * 0.7 + currentHour * 0.3));
    } else if (currentHour >= 17 && currentHour < 22) {
      window = 'evening';
      times.evening = Math.round((times.evening * 0.7 + currentHour * 0.3));
    } else {
      // Late night or early morning - don't update
      return;
    }

    // Update preferred window based on most recent engagement
    times.preferredWindow = window;
    times.lastUpdated = Date.now();

    await AsyncStorage.setItem(OPTIMAL_SEND_TIMES_KEY, JSON.stringify(times));
  } catch (error) {
    console.error('Error updating optimal send times:', error);
  }
}

/**
 * Get optimal send time for notifications
 */
async function getOptimalSendTime(
  preferredWindow?: 'morning' | 'afternoon' | 'evening'
): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(OPTIMAL_SEND_TIMES_KEY);
    if (!stored) {
      // Defaults
      return { morning: 9, afternoon: 14, evening: 19 }[preferredWindow || 'evening'];
    }

    const times: OptimalSendTimes = JSON.parse(stored);
    const window = preferredWindow || times.preferredWindow;

    return times[window];
  } catch (error) {
    console.error('Error getting optimal send time:', error);
    return 19; // Default to 7 PM
  }
}

/**
 * Get user's preferred notification window
 */
export async function getPreferredNotificationWindow(): Promise<'morning' | 'afternoon' | 'evening'> {
  try {
    const stored = await AsyncStorage.getItem(OPTIMAL_SEND_TIMES_KEY);
    if (!stored) return 'evening';

    const times: OptimalSendTimes = JSON.parse(stored);
    return times.preferredWindow;
  } catch (error) {
    console.error('Error getting preferred window:', error);
    return 'evening';
  }
}

// ================================================================================
// MILESTONE CELEBRATIONS
// ================================================================================

/**
 * Check and celebrate user milestones
 */
export async function checkMilestoneCelebrations(): Promise<void> {
  try {
    const interactions = await database
      .get<Interaction>('interactions')
      .query(Q.where('status', 'completed'))
      .fetch();

    const totalWeaves = interactions.length;

    // Milestones to celebrate
    const milestones = [1, 5, 10, 25, 50, 100, 250, 500];

    for (const milestone of milestones) {
      if (totalWeaves === milestone) {
        await scheduleMilestoneCelebration(milestone);
      }
    }

    // Check for consecutive days streak
    await checkStreakMilestone(interactions);
  } catch (error) {
    console.error('Error checking milestone celebrations:', error);
  }
}

/**
 * Schedule milestone celebration notification
 */
async function scheduleMilestoneCelebration(count: number): Promise<void> {
  const messages = {
    1: {
      title: "Your first weave! 🎉",
      body: "This is the beginning of something beautiful",
    },
    5: {
      title: "5 weaves logged! 🌟",
      body: "You're building a practice of mindful connection",
    },
    10: {
      title: "10 weaves! Double digits! 🚀",
      body: "Your commitment to relationships is showing",
    },
    25: {
      title: "25 weaves—you're on fire! 🔥",
      body: "Your friendships are thriving because of you",
    },
    50: {
      title: "50 weaves! Half a century! 🎊",
      body: "You're a relationship cultivation master",
    },
    100: {
      title: "100 weaves!!! 💯",
      body: "This is extraordinary—you're redefining friendship",
    },
    250: {
      title: "250 weaves! Legendary! 👑",
      body: "You're an inspiration to meaningful connection",
    },
    500: {
      title: "500 weaves! INCREDIBLE! 🏆",
      body: "You've built something truly special",
    },
  };

  const message = messages[count as keyof typeof messages];
  if (!message) return;

  // Send immediately for milestone celebrations
  await Notifications.scheduleNotificationAsync({
    identifier: `${MILESTONE_PREFIX}weaves-${count}`,
    content: {
      title: message.title,
      body: message.body,
      data: {
        type: 'milestone',
        milestone: 'weaves',
        count,
      },
    },
    trigger: null, // Immediate
  });

  trackEvent(AnalyticsEvents.MILESTONE_REACHED, {
    type: 'weaves',
    count,
  });

  console.log(`[Retention] Milestone celebration: ${count} weaves`);
}

/**
 * Check for streak milestones
 */
async function checkStreakMilestone(interactions: Interaction[]): Promise<void> {
  if (interactions.length === 0) return;

  // Sort by date descending
  const sorted = interactions.sort(
    (a, b) => b.interactionDate.getTime() - a.interactionDate.getTime()
  );

  // Calculate current streak
  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (const interaction of sorted) {
    const interactionDate = new Date(interaction.interactionDate);
    interactionDate.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor(
      (currentDate.getTime() - interactionDate.getTime()) / 86400000
    );

    if (daysDiff === 0 || daysDiff === 1) {
      streak++;
      currentDate = interactionDate;
    } else if (daysDiff > 1) {
      break;
    }
  }

  // Celebrate streak milestones
  const streakMilestones = [7, 14, 30, 60, 90, 180, 365];
  if (streakMilestones.includes(streak)) {
    await scheduleStreakCelebration(streak);
  }
}

/**
 * Schedule streak celebration
 */
async function scheduleStreakCelebration(days: number): Promise<void> {
  const messages = {
    7: "7-day streak! 🔥",
    14: "2 weeks strong! 💪",
    30: "30 days! One month of commitment! 🎯",
    60: "60 days! This is a lifestyle! 🌟",
    90: "90 days! A true habit! ✨",
    180: "Half a year! Unstoppable! 🚀",
    365: "ONE YEAR! You're a legend! 👑",
  };

  const title = messages[days as keyof typeof messages];
  if (!title) return;

  await Notifications.scheduleNotificationAsync({
    identifier: `${MILESTONE_PREFIX}streak-${days}`,
    content: {
      title,
      body: "Your consistency is building lasting connections",
      data: {
        type: 'milestone',
        milestone: 'streak',
        days,
      },
    },
    trigger: null, // Immediate
  });

  trackEvent(AnalyticsEvents.MILESTONE_REACHED, {
    type: 'streak',
    days,
  });
}

// ================================================================================
// HELPER FUNCTIONS
// ================================================================================

/**
 * Get a friend who needs attention (for personalized re-engagement)
 */
async function getFriendNeedingAttention(): Promise<Friend | null> {
  try {
    const friends = await database
      .get<Friend>('friends')
      .query(
        Q.where('is_dormant', false),
        Q.sortBy('last_updated', Q.asc)
      )
      .fetch();

    if (friends.length === 0) return null;

    // Prioritize Inner Circle
    const innerCircle = friends.filter(f => f.dunbarTier === 'InnerCircle');
    if (innerCircle.length > 0) return innerCircle[0];

    return friends[0];
  } catch (error) {
    console.error('Error getting friend needing attention:', error);
    return null;
  }
}

/**
 * Track notification engagement (for analytics)
 */
export async function trackNotificationEngagement(
  action: 'sent' | 'opened' | 'dismissed'
): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_ENGAGEMENT_KEY);
    let engagement: NotificationEngagement = stored
      ? JSON.parse(stored)
      : { sent: 0, opened: 0, dismissed: 0 };

    engagement[action]++;
    if (action === 'opened') {
      engagement.lastEngagement = Date.now();
    }

    await AsyncStorage.setItem(NOTIFICATION_ENGAGEMENT_KEY, JSON.stringify(engagement));

    // Track in analytics
    trackEvent(AnalyticsEvents.NOTIFICATION_ENGAGEMENT, { action });
  } catch (error) {
    console.error('Error tracking notification engagement:', error);
  }
}

/**
 * Get notification engagement metrics
 */
export async function getNotificationEngagement(): Promise<NotificationEngagement> {
  try {
    const stored = await AsyncStorage.getItem(NOTIFICATION_ENGAGEMENT_KEY);
    return stored
      ? JSON.parse(stored)
      : { sent: 0, opened: 0, dismissed: 0 };
  } catch (error) {
    console.error('Error getting notification engagement:', error);
    return { sent: 0, opened: 0, dismissed: 0 };
  }
}

// ================================================================================
// MASTER RETENTION CHECK
// ================================================================================

/**
 * Run all retention checks
 * Call this daily (e.g., morning check)
 */
export async function runRetentionChecks(): Promise<void> {
  console.log('[Retention] Running retention checks...');

  try {
    await Promise.all([
      checkAtRiskUsers(),
      checkDecayWarnings(),
      checkMilestoneCelebrations(),
    ]);

    console.log('[Retention] All checks complete');
  } catch (error) {
    console.error('Error running retention checks:', error);
  }
}

/**
 * Initialize retention system
 * Call this on app launch after user is authenticated
 */
export async function initializeRetentionSystem(): Promise<void> {
  console.log('[Retention] Initializing retention system...');

  try {
    // Record app open
    await recordAppOpen();

    // Check if user needs onboarding sequence
    const state = await getOnboardingState();
    if (!state) {
      // New user - initialize onboarding
      await initializeOnboardingSequence();
    } else {
      // Existing user - run retention checks
      await runRetentionChecks();
    }

    console.log('[Retention] Retention system initialized');
  } catch (error) {
    console.error('Error initializing retention system:', error);
  }
}
