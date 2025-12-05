/**
 * Feature Gating Hook
 * Easy-to-use React hook for checking feature access and limits
 */

import { useAuthStore } from '../store/auth.store';
import {
  hasFeatureAccess,
  isAtLimit,
  getRemainingQuota,
  getUpgradeMessage,
  TIER_LIMITS,
  type SubscriptionTier,
} from '../services/subscription-tiers';
import { Alert } from 'react-native';
import { router } from 'expo-router';

interface FeatureGateResult {
  // Access checks
  hasAccess: boolean;
  tier: SubscriptionTier;

  // Quota checks
  isAtLimit: boolean;
  remaining: number;
  limit: number;

  // Actions
  showUpgradePrompt: (customMessage?: string) => void;
  navigateToUpgrade: () => void;
}

/**
 * Hook to check feature access for boolean features
 */
export function useFeatureGate(
  feature: keyof typeof TIER_LIMITS.free
): FeatureGateResult {
  const tier = useAuthStore(state => state.getTier());
  const usage = useAuthStore(state => state.usage);

  const access = hasFeatureAccess(tier, feature);

  const showUpgradePrompt = (customMessage?: string) => {
    const message = customMessage || getUpgradeMessage(tier, feature as any);

    Alert.alert(
      'Upgrade Required',
      message,
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Upgrade',
          onPress: () => router.push('/(tabs)/settings?showUpgrade=true'),
        },
      ]
    );
  };

  const navigateToUpgrade = () => {
    router.push('/(tabs)/settings?showUpgrade=true');
  };

  return {
    hasAccess: access,
    tier,
    isAtLimit: false,
    remaining: Infinity,
    limit: Infinity,
    showUpgradePrompt,
    navigateToUpgrade,
  };
}

/**
 * Hook to check quota-based features (friends, weaves, etc.)
 */
export function useQuotaGate(
  feature: 'maxFriends' | 'maxWeavesPerMonth' | 'maxPhotosPerFriend' | 'maxDevices'
): FeatureGateResult {
  const tier = useAuthStore(state => state.getTier());
  const usage = useAuthStore(state => state.usage);

  const limit = TIER_LIMITS[tier][feature];
  let currentUsage = 0;

  // Map feature to usage stat
  if (feature === 'maxFriends') {
    currentUsage = usage?.friendsCount ?? 0;
  } else if (feature === 'maxWeavesPerMonth') {
    currentUsage = usage?.weavesThisMonth ?? 0;
  }

  const atLimit = isAtLimit(tier, feature, currentUsage);
  const remaining = getRemainingQuota(tier, feature, currentUsage);

  const showUpgradePrompt = (customMessage?: string) => {
    const defaultMessage = `You've reached your ${feature} limit (${limit}). Upgrade to increase your limit!`;
    const message = customMessage || defaultMessage;

    Alert.alert(
      'Limit Reached',
      message,
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Upgrade',
          onPress: () => router.push('/(tabs)/settings?showUpgrade=true'),
        },
      ]
    );
  };

  const navigateToUpgrade = () => {
    router.push('/(tabs)/settings?showUpgrade=true');
  };

  return {
    hasAccess: !atLimit,
    tier,
    isAtLimit: atLimit,
    remaining,
    limit: limit === Infinity ? Infinity : limit,
    showUpgradePrompt,
    navigateToUpgrade,
  };
}

/**
 * Hook to check if user can perform an action
 * Combines access check + quota check
 */
export function useCanPerformAction(
  action: 'addFriend' | 'logWeave' | 'accessJournal' | 'exportData' | 'useAI'
): {
  canPerform: boolean;
  reason?: string;
  showBlocker: () => void;
} {
  const tier = useAuthStore(state => state.getTier());
  const friendsGate = useQuotaGate('maxFriends');
  const weavesGate = useQuotaGate('maxWeavesPerMonth');
  const journalAccess = useFeatureGate('canAccessJournal');
  const exportAccess = useFeatureGate('canExportData');
  const aiAccess = useFeatureGate('canUseAIInsights');

  switch (action) {
    case 'addFriend':
      return {
        canPerform: !friendsGate.isAtLimit,
        reason: friendsGate.isAtLimit
          ? `Friend limit reached (${friendsGate.limit})`
          : undefined,
        showBlocker: () => friendsGate.showUpgradePrompt(),
      };

    case 'logWeave':
      return {
        canPerform: !weavesGate.isAtLimit,
        reason: weavesGate.isAtLimit
          ? `Monthly weave limit reached (${weavesGate.limit})`
          : undefined,
        showBlocker: () => weavesGate.showUpgradePrompt(),
      };

    case 'accessJournal':
      return {
        canPerform: journalAccess.hasAccess,
        reason: !journalAccess.hasAccess
          ? 'Journal is only available for Plus and Premium tiers'
          : undefined,
        showBlocker: () => journalAccess.showUpgradePrompt(),
      };

    case 'exportData':
      return {
        canPerform: exportAccess.hasAccess,
        reason: !exportAccess.hasAccess
          ? 'Data export is only available for Plus and Premium tiers'
          : undefined,
        showBlocker: () => exportAccess.showUpgradePrompt(),
      };

    case 'useAI':
      return {
        canPerform: aiAccess.hasAccess,
        reason: !aiAccess.hasAccess
          ? 'AI Insights are only available for Premium tier'
          : undefined,
        showBlocker: () => aiAccess.showUpgradePrompt(),
      };

    default:
      return {
        canPerform: true,
        showBlocker: () => { },
      };
  }
}

/**
 * Hook to get current tier display info
 */
export function useTierInfo() {
  const tier = useAuthStore(state => state.getTier());
  const subscription = useAuthStore(state => state.subscription);

  const tierDisplay = {
    free: { name: 'Free', color: '#6B7280', icon: '🌱' },
    plus: { name: 'Plus', color: '#8B5CF6', icon: '⭐' },
    premium: { name: 'Premium', color: '#F59E0B', icon: '👑' },
  };

  return {
    tier,
    display: tierDisplay[tier],
    isActive: subscription?.status === 'active' || subscription?.status === 'trialing',
    isTrial: subscription?.status === 'trialing',
    trialEndsAt: subscription?.trialEndsAt,
  };
}
