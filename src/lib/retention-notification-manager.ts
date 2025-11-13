/**
 * Retention Notification Manager
 * Critical notifications for user retention, especially in early days
 *
 * Phase 1 Features:
 * - Onboarding sequence (days 1-14) to build habits
 * - At-risk user detection & re-engagement
 * - Decay warning alerts for critical friends
 * - Smart timing based on user behavior patterns
 * - Milestone celebrations (weaves & streaks)
 *
 * Phase 2 Features (Emotional Depth):
 * - Archetype-aware notification language
 * - Tier-specific relationship insights
 * - Gratitude prompts after positive weaves
 * - Birthday and anniversary reminders
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
import { archetypeData } from './constants';
import type { Archetype, Tier } from '../components/types';

// AsyncStorage keys
const ONBOARDING_STATE_KEY = '@weave:onboarding_notifications';
const LAST_APP_OPEN_KEY = '@weave:last_app_open';
const LAST_WEAVE_LOGGED_KEY = '@weave:last_weave_logged';
const OPTIMAL_SEND_TIMES_KEY = '@weave:optimal_send_times';
const NOTIFICATION_ENGAGEMENT_KEY = '@weave:notification_engagement';
const LAST_GRATITUDE_PROMPT_KEY = '@weave:last_gratitude_prompt';
const BIRTHDAY_CHECK_KEY = '@weave:last_birthday_check';

// Notification identifiers
const ONBOARDING_PREFIX = 'onboarding-';
const REENGAGEMENT_ID = 'reengagement';
const DECAY_WARNING_PREFIX = 'decay-warning-';
const MILESTONE_PREFIX = 'milestone-';
const GRATITUDE_PROMPT_PREFIX = 'gratitude-';
const BIRTHDAY_PREFIX = 'birthday-';
const ANNIVERSARY_PREFIX = 'anniversary-';
const TIER_INSIGHT_PREFIX = 'tier-insight-';

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
      // Use archetype-aware messaging (Phase 2)
      const message = getArchetypeReengagementMessage(needsAttention);
      title = message.title;
      body = message.body;
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

  // Use archetype-aware messaging (Phase 2)
  const message = getArchetypeDecayWarning(friend, scorePercent);
  const { title, body } = message;

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
// PHASE 2: ARCHETYPE-AWARE NOTIFICATIONS
// ================================================================================

/**
 * Get archetype-specific message for re-engagement
 */
function getArchetypeReengagementMessage(friend: Friend): { title: string; body: string } {
  const archetype = friend.archetype as Archetype;
  const data = archetypeData[archetype];
  const icon = data.icon;

  const messages: Record<Archetype, Array<{ title: string; body: string }>> = {
    Emperor: [
      {
        title: `${friend.name} values your consistency ${icon}`,
        body: `Time for a structured check-in?`,
      },
      {
        title: `Keep your commitment to ${friend.name} ${icon}`,
        body: `They appreciate when you show up reliably`,
      },
    ],
    Empress: [
      {
        title: `${friend.name} would love some cozy time ${icon}`,
        body: `A meal together? A warm chat?`,
      },
      {
        title: `Nurture your bond with ${friend.name} ${icon}`,
        body: `They thrive on comfort and care`,
      },
    ],
    HighPriestess: [
      {
        title: `${friend.name} might need depth right now ${icon}`,
        body: `A meaningful conversation could be perfect`,
      },
      {
        title: `Connect intuitively with ${friend.name} ${icon}`,
        body: `They value privacy and deep understanding`,
      },
    ],
    Fool: [
      {
        title: `${friend.name} is probably ready for fun ${icon}`,
        body: `Something spontaneous? They'd be in!`,
      },
      {
        title: `Adventure awaits with ${friend.name} ${icon}`,
        body: `Keep things light and playful`,
      },
    ],
    Sun: [
      {
        title: `${friend.name} loves celebration ${icon}`,
        body: `Time to gather and share some joy?`,
      },
      {
        title: `Bring energy to ${friend.name}'s day ${icon}`,
        body: `They thrive in vibrant connection`,
      },
    ],
    Hermit: [
      {
        title: `${friend.name} values quiet connection ${icon}`,
        body: `A peaceful walk or call might be ideal`,
      },
      {
        title: `Meaningful time with ${friend.name} ${icon}`,
        body: `They prefer depth over frequency`,
      },
    ],
    Magician: [
      {
        title: `Create something with ${friend.name} ${icon}`,
        body: `They love collaboration and growth`,
      },
      {
        title: `${friend.name} enjoys building together ${icon}`,
        body: `A project or creative session?`,
      },
    ],
    Lovers: [
      {
        title: `${friend.name} values reciprocity ${icon}`,
        body: `Time for mutual connection and balance`,
      },
      {
        title: `Restore harmony with ${friend.name} ${icon}`,
        body: `They notice when things feel one-sided`,
      },
    ],
    Unknown: [
      {
        title: `Check in with ${friend.name}`,
        body: `Your friendship needs attention`,
      },
    ],
  };

  const options = messages[archetype] || messages.Unknown;
  return options[Math.floor(Math.random() * options.length)];
}

/**
 * Get archetype-specific decay warning
 */
function getArchetypeDecayWarning(friend: Friend, scorePercent: number): { title: string; body: string } {
  const archetype = friend.archetype as Archetype;
  const data = archetypeData[archetype];
  const icon = data.icon;
  const tierLabel = {
    InnerCircle: 'Inner Circle',
    CloseFriends: 'Close Friend',
    Community: 'Community',
  }[friend.dunbarTier];

  const messages: Record<Archetype, Array<{ title: string; body: string }>> = {
    Emperor: [
      {
        title: `${friend.name} expects consistency ${icon}`,
        body: `${tierLabel} • ${scorePercent}% • Structure matters to them`,
      },
    ],
    Empress: [
      {
        title: `${friend.name} needs nurturing ${icon}`,
        body: `${tierLabel} • ${scorePercent}% • Show them comfort and care`,
      },
    ],
    HighPriestess: [
      {
        title: `${friend.name} values depth ${icon}`,
        body: `${tierLabel} • ${scorePercent}% • A meaningful reach out?`,
      },
    ],
    Fool: [
      {
        title: `Keep the fun alive with ${friend.name} ${icon}`,
        body: `${tierLabel} • ${scorePercent}% • Something spontaneous?`,
      },
    ],
    Sun: [
      {
        title: `${friend.name} thrives on celebration ${icon}`,
        body: `${tierLabel} • ${scorePercent}% • Bring some energy back`,
      },
    ],
    Hermit: [
      {
        title: `${friend.name} prefers quiet quality ${icon}`,
        body: `${tierLabel} • ${scorePercent}% • One-on-one time?`,
      },
    ],
    Magician: [
      {
        title: `Build with ${friend.name} ${icon}`,
        body: `${tierLabel} • ${scorePercent}% • Collaborate and create`,
      },
    ],
    Lovers: [
      {
        title: `Balance matters to ${friend.name} ${icon}`,
        body: `${tierLabel} • ${scorePercent}% • Restore reciprocity`,
      },
    ],
    Unknown: [
      {
        title: `${friend.name} needs attention`,
        body: `${tierLabel} • ${scorePercent}% • Time to reconnect`,
      },
    ],
  };

  const options = messages[archetype] || messages.Unknown;
  return options[Math.floor(Math.random() * options.length)];
}

// ================================================================================
// PHASE 2: GRATITUDE PROMPTS
// ================================================================================

/**
 * Check retention preferences
 */
export interface RetentionPreferences {
  gratitudePromptsEnabled: boolean;
  birthdayRemindersEnabled: boolean;
  anniversaryRemindersEnabled: boolean;
  tierInsightsEnabled: boolean;
}

const DEFAULT_RETENTION_PREFS: RetentionPreferences = {
  gratitudePromptsEnabled: true,
  birthdayRemindersEnabled: true,
  anniversaryRemindersEnabled: true,
  tierInsightsEnabled: true,
};

/**
 * Get retention preferences
 */
export async function getRetentionPreferences(): Promise<RetentionPreferences> {
  try {
    const stored = await AsyncStorage.getItem('@weave:retention_preferences');
    if (stored) {
      return { ...DEFAULT_RETENTION_PREFS, ...JSON.parse(stored) };
    }
  } catch (error) {
    console.error('Error loading retention preferences:', error);
  }
  return DEFAULT_RETENTION_PREFS;
}

/**
 * Update retention preferences
 */
export async function updateRetentionPreferences(prefs: Partial<RetentionPreferences>): Promise<void> {
  try {
    const current = await getRetentionPreferences();
    const updated = { ...current, ...prefs };
    await AsyncStorage.setItem('@weave:retention_preferences', JSON.stringify(updated));
    console.log('[Retention] Preferences updated:', updated);
  } catch (error) {
    console.error('Error updating retention preferences:', error);
  }
}

/**
 * Schedule gratitude prompt after a highly-rated weave
 * Call this after logging a weave with positive vibe
 */
export async function scheduleGratitudePrompt(
  interaction: Interaction,
  friends: Friend[]
): Promise<void> {
  try {
    // Check preferences
    const prefs = await getRetentionPreferences();
    if (!prefs.gratitudePromptsEnabled) return;

    // Only for FullMoon or WaxingGibbous vibes
    if (interaction.vibe !== 'FullMoon' && interaction.vibe !== 'WaxingGibbous') return;

    // Check if we already sent a gratitude prompt recently
    const lastPromptStr = await AsyncStorage.getItem(LAST_GRATITUDE_PROMPT_KEY);
    if (lastPromptStr) {
      const lastPrompt = parseInt(lastPromptStr, 10);
      const hoursSince = (Date.now() - lastPrompt) / 3600000;
      if (hoursSince < 24) {
        console.log('[Retention] Gratitude prompt sent recently, skipping');
        return;
      }
    }

    const friendNames = friends.map(f => f.name).join(', ');
    const primaryFriend = friends[0];

    // Schedule for 2-4 hours after the weave (while the feeling is fresh)
    const delayHours = 2 + Math.random() * 2;
    const sendTime = new Date(Date.now() + delayHours * 60 * 60 * 1000);

    const messages = [
      {
        title: `That connection with ${friendNames} ✨`,
        body: `What are you grateful for from that time together?`,
      },
      {
        title: `Reflecting on ${friendNames} 🌙`,
        body: `What made that weave special for you?`,
      },
      {
        title: `Savoring your time with ${friendNames} 💫`,
        body: `Take a moment to appreciate what you shared`,
      },
    ];

    const message = messages[Math.floor(Math.random() * messages.length)];

    await Notifications.scheduleNotificationAsync({
      identifier: `${GRATITUDE_PROMPT_PREFIX}${interaction.id}`,
      content: {
        title: message.title,
        body: message.body,
        data: {
          type: 'deepening-nudge', // Reuse deepening nudge flow
          interactionId: interaction.id,
          friendId: primaryFriend.id,
          friendName: primaryFriend.name,
        },
      },
      trigger: sendTime,
    });

    // Mark as sent
    await AsyncStorage.setItem(LAST_GRATITUDE_PROMPT_KEY, Date.now().toString());

    console.log(`[Retention] Gratitude prompt scheduled for ${sendTime.toLocaleString()}`);
  } catch (error) {
    console.error('Error scheduling gratitude prompt:', error);
  }
}

// ================================================================================
// PHASE 2: BIRTHDAY & ANNIVERSARY REMINDERS
// ================================================================================

/**
 * Check for upcoming birthdays and anniversaries
 */
export async function checkBirthdaysAndAnniversaries(): Promise<void> {
  try {
    // Check preferences
    const prefs = await getRetentionPreferences();
    if (!prefs.birthdayRemindersEnabled && !prefs.anniversaryRemindersEnabled) return;

    // Check if we already checked today
    const lastCheckStr = await AsyncStorage.getItem(BIRTHDAY_CHECK_KEY);
    if (lastCheckStr) {
      const lastCheck = new Date(parseInt(lastCheckStr, 10));
      const today = new Date();
      if (
        lastCheck.getFullYear() === today.getFullYear() &&
        lastCheck.getMonth() === today.getMonth() &&
        lastCheck.getDate() === today.getDate()
      ) {
        return; // Already checked today
      }
    }

    const friends = await database
      .get<Friend>('friends')
      .query(Q.where('is_dormant', false))
      .fetch();

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const friend of friends) {
      // Check birthday
      if (prefs.birthdayRemindersEnabled && friend.birthday) {
        const birthday = new Date(friend.birthday);
        if (
          birthday.getMonth() === tomorrow.getMonth() &&
          birthday.getDate() === tomorrow.getDate()
        ) {
          await scheduleBirthdayReminder(friend);
        }
      }

      // Check anniversary
      if (prefs.anniversaryRemindersEnabled && friend.anniversary) {
        const anniversary = new Date(friend.anniversary);
        if (
          anniversary.getMonth() === tomorrow.getMonth() &&
          anniversary.getDate() === tomorrow.getDate()
        ) {
          await scheduleAnniversaryReminder(friend);
        }
      }
    }

    // Mark as checked
    await AsyncStorage.setItem(BIRTHDAY_CHECK_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error checking birthdays and anniversaries:', error);
  }
}

/**
 * Schedule birthday reminder
 */
async function scheduleBirthdayReminder(friend: Friend): Promise<void> {
  const notificationId = `${BIRTHDAY_PREFIX}${friend.id}`;

  // Check if already scheduled
  const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
  if (existingNotifications.some(n => n.identifier === notificationId)) {
    return;
  }

  const archetype = friend.archetype as Archetype;
  const icon = archetypeData[archetype].icon;

  // Send notification tomorrow morning at 9am
  const sendTime = new Date();
  sendTime.setDate(sendTime.getDate() + 1);
  sendTime.setHours(9, 0, 0, 0);

  await Notifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      title: `${friend.name}'s birthday is today! 🎂`,
      body: `They'll appreciate you remembering ${icon}`,
      data: {
        type: 'life-event',
        friendId: friend.id,
        friendName: friend.name,
      },
    },
    trigger: sendTime,
  });

  trackEvent(AnalyticsEvents.NOTIFICATION_ENGAGEMENT, {
    type: 'birthday-reminder',
    friendId: friend.id,
  });

  console.log(`[Retention] Birthday reminder scheduled for ${friend.name}`);
}

/**
 * Schedule anniversary reminder
 */
async function scheduleAnniversaryReminder(friend: Friend): Promise<void> {
  const notificationId = `${ANNIVERSARY_PREFIX}${friend.id}`;

  // Check if already scheduled
  const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
  if (existingNotifications.some(n => n.identifier === notificationId)) {
    return;
  }

  const archetype = friend.archetype as Archetype;
  const icon = archetypeData[archetype].icon;

  // Send notification tomorrow morning at 9am
  const sendTime = new Date();
  sendTime.setDate(sendTime.getDate() + 1);
  sendTime.setHours(9, 0, 0, 0);

  // Calculate years (if anniversary date has year)
  let yearsText = '';
  if (friend.anniversary) {
    const anniversary = new Date(friend.anniversary);
    const years = new Date().getFullYear() - anniversary.getFullYear();
    if (years > 0) {
      yearsText = ` (${years} ${years === 1 ? 'year' : 'years'})`;
    }
  }

  await Notifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      title: `Your friendship anniversary with ${friend.name}${yearsText} 💫`,
      body: `A special day worth celebrating ${icon}`,
      data: {
        type: 'life-event',
        friendId: friend.id,
        friendName: friend.name,
      },
    },
    trigger: sendTime,
  });

  trackEvent(AnalyticsEvents.NOTIFICATION_ENGAGEMENT, {
    type: 'anniversary-reminder',
    friendId: friend.id,
  });

  console.log(`[Retention] Anniversary reminder scheduled for ${friend.name}`);
}

// ================================================================================
// PHASE 2: TIER-SPECIFIC INSIGHTS
// ================================================================================

/**
 * Check for tier-specific insights and schedule notifications
 */
export async function checkTierInsights(): Promise<void> {
  try {
    // Check preferences
    const prefs = await getRetentionPreferences();
    if (!prefs.tierInsightsEnabled) return;

    const friends = await database
      .get<Friend>('friends')
      .query(Q.where('is_dormant', false))
      .fetch();

    // Group by tier
    const tierCounts = {
      InnerCircle: 0,
      CloseFriends: 0,
      Community: 0,
    };

    for (const friend of friends) {
      tierCounts[friend.dunbarTier as Tier]++;
    }

    // Check if Inner Circle needs attention
    const innerCircleFriends = friends.filter(f => f.dunbarTier === 'InnerCircle');
    if (innerCircleFriends.length > 0) {
      const avgScore =
        innerCircleFriends.reduce((sum, f) => sum + calculateCurrentScore(f), 0) /
        innerCircleFriends.length;

      // If average Inner Circle score is below 60, send insight
      if (avgScore < 60) {
        await scheduleTierInsight('InnerCircle', avgScore, tierCounts.InnerCircle);
      }
    }

    // Check if user has unbalanced portfolio (e.g., too many Community, not enough Close Friends)
    if (tierCounts.Community > 20 && tierCounts.CloseFriends < 5) {
      await schedulePortfolioInsight(tierCounts);
    }
  } catch (error) {
    console.error('Error checking tier insights:', error);
  }
}

/**
 * Schedule tier-specific insight notification
 */
async function scheduleTierInsight(tier: Tier, avgScore: number, count: number): Promise<void> {
  const notificationId = `${TIER_INSIGHT_PREFIX}${tier}`;

  // Don't spam - check if we already sent this insight in the last 7 days
  const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
  if (existingNotifications.some(n => n.identifier === notificationId)) {
    return;
  }

  const scorePercent = Math.round(avgScore);

  const messages = {
    InnerCircle: {
      title: `Your Inner Circle needs attention 🌙`,
      body: `Average health: ${scorePercent}% across ${count} ${count === 1 ? 'person' : 'people'}—time to prioritize?`,
    },
    CloseFriends: {
      title: `Your Close Friends could use care 💫`,
      body: `Average health: ${scorePercent}% across ${count} friends—small efforts add up`,
    },
    Community: {
      title: `Your Community is drifting ✨`,
      body: `Average health: ${scorePercent}%—even brief check-ins matter`,
    },
  };

  const message = messages[tier];

  // Schedule for optimal time
  const optimalTime = await getOptimalSendTime();
  const sendTime = new Date();
  sendTime.setHours(optimalTime, 15, 0, 0); // +15 min offset

  if (sendTime.getTime() <= Date.now()) {
    sendTime.setDate(sendTime.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      title: message.title,
      body: message.body,
      data: {
        type: 'portfolio-insight',
        tier,
        avgScore: scorePercent,
      },
    },
    trigger: sendTime,
  });

  trackEvent(AnalyticsEvents.NOTIFICATION_ENGAGEMENT, {
    type: 'tier-insight',
    tier,
    avgScore: scorePercent,
  });

  console.log(`[Retention] Tier insight scheduled for ${tier}`);
}

/**
 * Schedule portfolio balance insight
 */
async function schedulePortfolioInsight(tierCounts: Record<Tier, number>): Promise<void> {
  const notificationId = `${TIER_INSIGHT_PREFIX}portfolio-balance`;

  // Don't spam - check if we already sent this in the last 14 days
  const existingNotifications = await Notifications.getAllScheduledNotificationsAsync();
  if (existingNotifications.some(n => n.identifier === notificationId)) {
    return;
  }

  // Schedule for optimal time
  const optimalTime = await getOptimalSendTime();
  const sendTime = new Date();
  sendTime.setHours(optimalTime, 20, 0, 0); // +20 min offset

  if (sendTime.getTime() <= Date.now()) {
    sendTime.setDate(sendTime.getDate() + 1);
  }

  await Notifications.scheduleNotificationAsync({
    identifier: notificationId,
    content: {
      title: `Consider your relationship portfolio 🌿`,
      body: `You have ${tierCounts.Community} Community members but only ${tierCounts.CloseFriends} Close Friends—quality over quantity?`,
      data: {
        type: 'portfolio-insight',
      },
    },
    trigger: sendTime,
  });

  trackEvent(AnalyticsEvents.NOTIFICATION_ENGAGEMENT, {
    type: 'portfolio-balance',
    tierCounts,
  });

  console.log('[Retention] Portfolio balance insight scheduled');
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
      checkBirthdaysAndAnniversaries(), // Phase 2
      checkTierInsights(), // Phase 2
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
