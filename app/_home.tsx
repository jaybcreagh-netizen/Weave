import React, { useEffect, useState } from 'react';

import { HomeWidgetGrid, WidgetGridItem } from '@/components/home/HomeWidgetGrid';
import { SocialSeasonWidget } from '@/components/home/widgets/SocialSeasonWidget';
import { NetworkBalanceWidget } from '@/components/home/widgets/NetworkBalanceWidget';
import { YearInMoonsWidget } from '@/components/home/widgets/YearInMoonsWidget';
import { TodaysFocusWidget } from '@/components/home/widgets/TodaysFocusWidget';
import { forecastNetworkHealth } from '@/modules/insights';
import { TrendingDown, TrendingUp, CheckCircle2 } from 'lucide-react-native';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import FriendModel from '@/db/models/Friend';
import { ReflectionReadyWidget } from '@/components/home/widgets/ReflectionReadyWidget';
import { FocusPill } from '@/components/home/widgets/FocusPill';
import { SocialBatterySheet } from '@/components/home/SocialBatterySheet';
import { WeeklyReflectionModal } from '@/components/WeeklyReflection/WeeklyReflectionModal';
import { ReflectionReadyPrompt } from '@/components/WeeklyReflection/ReflectionReadyPrompt';
import { YearInMoonsModal } from '@/components/YearInMoons/YearInMoonsModal';
import { SuggestedWeaves } from '@/components/SuggestedWeaves';
import { useUserProfileStore } from '@/modules/auth';
import { useRelationshipsStore } from '@/modules/relationships';
import { getLastReflectionDate, shouldShowReflection } from '@/modules/notifications';
import { getUserAccountAge } from '@/modules/notifications';
import { useTutorialStore } from '@/stores/tutorialStore';

/**
 * The home screen of the application.
 * Displays a grid of widgets and handles modals for social battery check-ins and weekly reflections.
 * @returns {React.ReactElement} The rendered home screen.
 */
export default function Home() {
  const { observeProfile, profile, submitBatteryCheckin, updateProfile } = useUserProfileStore();
  const { observeFriends, friends } = useRelationshipsStore();
  const theme = useTheme();
  const colors = theme?.colors || {};
  const [showBatterySheet, setShowBatterySheet] = useState(false);
  const [showReflectionPrompt, setShowReflectionPrompt] = useState(false);
  const [showWeeklyReflection, setShowWeeklyReflection] = useState(false);
  const [showYearInMoons, setShowYearInMoons] = useState(false);
  const [isReflectionDue, setIsReflectionDue] = useState(false);

  const [networkForecast, setNetworkForecast] = useState<{
    forecastedHealth: number;
    friendsNeedingAttention: FriendModel[];
    trend: 'up' | 'down' | 'stable';
  } | null>(null);

  useEffect(() => {
    if (!friends || friends.length === 0) return;

    const forecast = forecastNetworkHealth(friends, 7); // 7 days ahead
    const currentHealth = friends.reduce((sum, f) => sum + f.weaveScore, 0) / friends.length;

    const trend =
      forecast.forecastedHealth > currentHealth + 5 ? 'up' :
        forecast.forecastedHealth < currentHealth - 5 ? 'down' : 'stable';

    setNetworkForecast({
      forecastedHealth: forecast.forecastedHealth,
      friendsNeedingAttention: forecast.friendsNeedingAttention,
      trend,
    });
  }, [friends]);

  // Tutorial state - check if QuickWeave tutorial is done
  const hasPerformedQuickWeave = useTutorialStore((state) => state.hasPerformedQuickWeave);

  // Initialize user profile observable on mount
  useEffect(() => {
    try {
      const cleanup = observeProfile();
      return cleanup;
    } catch (error) {
      console.error('[Home] Failed to observe profile:', error);
      // Optionally show error toast to user
    }
  }, []);

  // Initialize friends observable on mount (needed for Life Events widget)
  useEffect(() => {
    try {
      observeFriends();
      // Note: observeFriends doesn't return cleanup, it manages its own subscription
    } catch (error) {
      console.error('[Home] Failed to observe friends:', error);
      // Optionally show error toast to user
    }
  }, []);



  // Check if user should be prompted for battery check-in
  // Wait until QuickWeave tutorial is complete before showing (avoid conflicts)
  useEffect(() => {
    // Default to enabled if not explicitly set
    if (!profile) return;
    const isEnabled = profile.batteryCheckinEnabled ?? true;
    if (!isEnabled) return;

    // Don't show battery sheet during onboarding flow
    // Wait until user has completed their first QuickWeave OR has been using the app for a while
    const checkEligibility = async () => {
      if (hasPerformedQuickWeave) return true;

      // Fallback for existing users: check account age
      const age = await getUserAccountAge();
      return age !== null && age >= 3;
    };

    checkEligibility().then(isEligible => {
      if (!isEligible) return;

      const lastCheckin = profile.socialBatteryLastCheckin;
      if (!lastCheckin) {
        // Never checked in - show after brief delay
        const timer = setTimeout(() => setShowBatterySheet(true), 600);
        return () => clearTimeout(timer);
      }

      // Check if last check-in was today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastCheckinDate = new Date(lastCheckin);
      lastCheckinDate.setHours(0, 0, 0, 0);

      if (lastCheckinDate < today) {
        // Last check-in was before today - show after brief delay
        const timer = setTimeout(() => setShowBatterySheet(true), 600);
        return () => clearTimeout(timer);
      }
    });
  }, [profile, hasPerformedQuickWeave]);

  // Check if weekly reflection should be shown
  useEffect(() => {
    const checkWeeklyReflection = async () => {
      if (!profile) return;

      const lastDate = await getLastReflectionDate();
      const isDue = shouldShowReflection(lastDate);

      // Check grace period: only show widget after 3+ days of app usage
      const accountAge = await getUserAccountAge();
      const meetsGracePeriod = accountAge !== null && accountAge >= 3;

      // Check if today is Sunday (reflection day)
      const today = new Date();
      const currentDay = today.getDay();
      const isSunday = currentDay === 0;

      // Widget should only be visible if reflection is due, account is 3+ days old, and it's Sunday
      setIsReflectionDue(isDue && meetsGracePeriod && isSunday);

      if (!isDue || !meetsGracePeriod) return;

      // Get user preferences (defaults: Sunday, auto-show enabled)
      const reflectionDay = profile.reflectionDay ?? 0; // 0 = Sunday
      const autoShow = profile.reflectionAutoShow ?? true;
      const lastSnoozed = profile.reflectionLastSnoozed;

      // Check if snoozed (snooze lasts until next day at 9 AM)
      let isSnoozed = false;
      if (lastSnoozed) {
        const snoozeUntil = new Date(lastSnoozed);
        snoozeUntil.setDate(snoozeUntil.getDate() + 1);
        snoozeUntil.setHours(9, 0, 0, 0);
        isSnoozed = today < snoozeUntil;
      }

      // Only auto-show if it's the reflection day, auto-show is enabled, and not snoozed
      if (currentDay === reflectionDay && autoShow && !isSnoozed) {
        // Wait longer than battery check-in so it doesn't conflict
        // Show after 2 seconds if battery sheet is dismissed or not shown
        const timer = setTimeout(() => {
          if (!showBatterySheet) {
            setShowReflectionPrompt(true);
          }
        }, 2000);
        return () => clearTimeout(timer);
      }
    };

    checkWeeklyReflection();
  }, [profile, showBatterySheet]);

  const handleBatterySubmit = async (value: number, note?: string) => {
    await submitBatteryCheckin(value, note);
    setShowBatterySheet(false);
  };

  const handleReflectionStart = () => {
    setShowReflectionPrompt(false);
    setShowWeeklyReflection(true);
  };

  const handleReflectionRemindLater = async () => {
    setShowReflectionPrompt(false);
    // Save snooze timestamp to profile
    if (profile) {
      await updateProfile({
        reflectionLastSnoozed: Date.now(),
      });
    }
  };

  // Define widget grid - Compass Hub design
  // Order: Action (Focus) → Context (Season) → Reflection (Moons) → Reflection Ready (if due)
  const widgets: WidgetGridItem[] = [
    {
      id: 'todays-focus',
      component: TodaysFocusWidget,
      config: {
        id: 'todays-focus',
        type: 'todays-focus',
        fullWidth: true,
      },
      position: 0,
      visible: true,
    },
    {
      id: 'network-balance',
      component: NetworkBalanceWidget,
      config: {
        id: 'network-balance',
        type: 'network-balance',
        fullWidth: true,
      },
      position: 2.5,
      visible: true,
    },
    {
      id: 'social-season',
      component: SocialSeasonWidget,
      config: {
        id: 'social-season',
        type: 'social-season',
        fullWidth: true,
      },
      position: 1,
      visible: true,
    },
    {
      id: 'year-in-moons',
      component: YearInMoonsWidget,
      config: {
        id: 'year-in-moons',
        type: 'year-in-moons',
        fullWidth: true,
      },
      position: 2,
      visible: true,
    },
    {
      id: 'reflection-ready',
      component: ReflectionReadyWidget,
      config: {
        id: 'reflection-ready',
        type: 'reflection-ready',
        fullWidth: true,
      },
      props: {
        onPress: () => setShowReflectionPrompt(true),
      },
      position: 3,
      visible: isReflectionDue,
    },
  ];

  return (
    <>
      {networkForecast && networkForecast.friendsNeedingAttention && networkForecast.friendsNeedingAttention.length > 0 && (
        <View style={[styles.forecastBanner, { backgroundColor: colors?.muted || '#FFF8ED' }]}>
          <View style={styles.forecastIcon}>
            {networkForecast.trend === 'down' && <TrendingDown size={16} color={colors?.['muted-foreground'] || '#8A8A8A'} />}
            {networkForecast.trend === 'up' && <TrendingUp size={16} color={colors?.primary || '#3C2415'} />}
            {networkForecast.trend === 'stable' && <CheckCircle2 size={16} color={colors?.primary || '#3C2415'} />}
          </View>
          <Text style={[styles.forecastText, { color: colors?.foreground || '#3C3C3C' }]}>
            {networkForecast.trend === 'down'
              ? `${networkForecast.friendsNeedingAttention.length} ${networkForecast.friendsNeedingAttention.length === 1 ? 'friend' : 'friends'} will need attention this week`
              : `Your network is ${networkForecast.trend === 'stable' ? 'stable' : 'thriving'} this week`
            }
          </Text>
        </View>
      )}
      <FocusPill />
      {/* Event suggestions from calendar */}
      <SuggestedWeaves />
      <HomeWidgetGrid widgets={widgets} />

      <SocialBatterySheet
        isVisible={showBatterySheet}
        onSubmit={handleBatterySubmit}
        onDismiss={() => setShowBatterySheet(false)}
        onViewYearInMoons={() => {
          setShowBatterySheet(false);
          setShowYearInMoons(true);
        }}
      />

      <ReflectionReadyPrompt
        isVisible={showReflectionPrompt}
        onStart={handleReflectionStart}
        onRemindLater={handleReflectionRemindLater}
        onDismiss={() => setShowReflectionPrompt(false)}
      />

      <WeeklyReflectionModal
        isOpen={showWeeklyReflection}
        onClose={() => setShowWeeklyReflection(false)}
      />

      <YearInMoonsModal
        isOpen={showYearInMoons}
        onClose={() => setShowYearInMoons(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  forecastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
    borderRadius: 8,
    marginHorizontal: 20,
    marginTop: 10,
  },
  forecastIcon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forecastText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
  },
});