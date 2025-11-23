/**
 * Subscription Tiers & Feature Gating
 * Defines what features are available at each tier
 */

export type SubscriptionTier = 'free' | 'plus' | 'premium';

/**
 * Feature limits for each subscription tier
 */
export const TIER_LIMITS = {
  free: {
    maxFriends: 20,
    maxWeavesPerMonth: 50,
    canExportData: false,
    canCustomizeArchetypes: false,
    canAccessAdvancedAnalytics: false,
    canUseAIInsights: false,
    maxPhotosPerFriend: 1,
    canAccessJournal: false,
    canSetCustomReminders: false,
    syncEnabled: true, // Free users can sync across devices
    maxDevices: 2,
  },
  plus: {
    maxFriends: 100,
    maxWeavesPerMonth: 200,
    canExportData: true,
    canCustomizeArchetypes: true,
    canAccessAdvancedAnalytics: true,
    canUseAIInsights: false,
    maxPhotosPerFriend: 5,
    canAccessJournal: true,
    canSetCustomReminders: true,
    syncEnabled: true,
    maxDevices: 5,
  },
  premium: {
    maxFriends: Infinity,
    maxWeavesPerMonth: Infinity,
    canExportData: true,
    canCustomizeArchetypes: true,
    canAccessAdvancedAnalytics: true,
    canUseAIInsights: true,
    maxPhotosPerFriend: Infinity,
    canAccessJournal: true,
    canSetCustomReminders: true,
    syncEnabled: true,
    maxDevices: Infinity,
  },
} as const;

/**
 * Feature descriptions for upgrade prompts
 */
export const FEATURE_DESCRIPTIONS = {
  maxFriends: {
    name: 'Friend Limit',
    description: 'Track more meaningful relationships',
    free: '20 friends',
    plus: '100 friends',
    premium: 'Unlimited friends',
  },
  maxWeavesPerMonth: {
    name: 'Monthly Interactions',
    description: 'Log more interactions each month',
    free: '50 weaves/month',
    plus: '200 weaves/month',
    premium: 'Unlimited weaves',
  },
  exportData: {
    name: 'Data Export',
    description: 'Export your relationship data as CSV or JSON',
    free: 'Not available',
    plus: 'Available',
    premium: 'Available',
  },
  advancedAnalytics: {
    name: 'Advanced Analytics',
    description: 'Deep insights into your relationship patterns',
    free: 'Basic stats only',
    plus: 'Full analytics',
    premium: 'Full analytics + AI insights',
  },
  journal: {
    name: 'Personal Journal',
    description: 'Private journaling with friend tagging',
    free: 'Not available',
    plus: 'Full access',
    premium: 'Full access',
  },
  aiInsights: {
    name: 'AI-Powered Insights',
    description: 'Personalized suggestions based on your patterns',
    free: 'Not available',
    plus: 'Not available',
    premium: 'Full access',
  },
} as const;

/**
 * Check if a feature is available for a given tier
 */
export function hasFeatureAccess(
  tier: SubscriptionTier,
  feature: keyof typeof TIER_LIMITS.free
): boolean {
  const limits = TIER_LIMITS[tier];
  const value = limits[feature];

  // Boolean features
  if (typeof value === 'boolean') {
    return value;
  }

  // Numeric features (Infinity means unlimited)
  return value === Infinity || value > 0;
}

/**
 * Check if user is at limit for a numeric feature
 */
export function isAtLimit(
  tier: SubscriptionTier,
  feature: 'maxFriends' | 'maxWeavesPerMonth' | 'maxPhotosPerFriend' | 'maxDevices',
  currentUsage: number
): boolean {
  const limit = TIER_LIMITS[tier][feature];

  if (limit === Infinity) {
    return false;
  }

  return currentUsage >= limit;
}

/**
 * Get remaining quota for a feature
 */
export function getRemainingQuota(
  tier: SubscriptionTier,
  feature: 'maxFriends' | 'maxWeavesPerMonth' | 'maxPhotosPerFriend' | 'maxDevices',
  currentUsage: number
): number {
  const limit = TIER_LIMITS[tier][feature];

  if (limit === Infinity) {
    return Infinity;
  }

  return Math.max(0, limit - currentUsage);
}

/**
 * Get upgrade CTA message for a feature
 */
export function getUpgradeMessage(
  currentTier: SubscriptionTier,
  feature: keyof typeof FEATURE_DESCRIPTIONS
): string {
  const featureInfo = FEATURE_DESCRIPTIONS[feature];

  if (currentTier === 'free') {
    return `Upgrade to Plus to unlock ${featureInfo.name}: ${featureInfo.description}`;
  } else if (currentTier === 'plus') {
    return `Upgrade to Premium for ${featureInfo.name}: ${featureInfo.description}`;
  }

  return '';
}

/**
 * Suggested tier based on usage
 */
export function suggestTier(friendsCount: number, weavesPerMonth: number): SubscriptionTier {
  if (friendsCount > TIER_LIMITS.plus.maxFriends || weavesPerMonth > TIER_LIMITS.plus.maxWeavesPerMonth) {
    return 'premium';
  }

  if (friendsCount > TIER_LIMITS.free.maxFriends || weavesPerMonth > TIER_LIMITS.free.maxWeavesPerMonth) {
    return 'plus';
  }

  return 'free';
}
