import React, { useEffect, useState, useRef } from 'react';
import { View, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { HomeWidgetGrid, WidgetGridItem } from '../src/components/home/HomeWidgetGrid';
import { SocialSeasonWidget } from '../src/components/home/widgets/SocialSeasonWidget';
import { YearInMoonsWidget } from '../src/components/home/widgets/YearInMoonsWidget';
import { TodaysFocusWidget } from '../src/components/home/widgets/TodaysFocusWidget';
import { ReflectionReadyWidget } from '../src/components/home/widgets/ReflectionReadyWidget';
import { FocusPill } from '../src/components/home/widgets/FocusPill';
import { SocialBatterySheet } from '../src/components/home/SocialBatterySheet';
import { WeeklyReflectionModal } from '../src/components/WeeklyReflection/WeeklyReflectionModal';
import { ReflectionReadyPrompt } from '../src/components/WeeklyReflection/ReflectionReadyPrompt';
import { YearInMoonsModal } from '../src/components/YearInMoons/YearInMoonsModal';
import { SuggestedWeaves } from '../src/components/SuggestedWeaves';
import { useUserProfileStore } from '../src/stores/userProfileStore';
import { useRelationshipsStore } from '../src/modules/relationships';
import { getLastReflectionDate, shouldShowReflection } from '../src/lib/notification-manager-enhanced';
import { getUserAccountAge } from '../src/lib/notification-grace-periods';
import { useTutorialStore } from '../src/stores/tutorialStore';

/**
 * The home screen of the application.
 * Displays a grid of widgets and handles modals for social battery check-ins and weekly reflections.
 * @returns {React.ReactElement} The rendered home screen.
 */
export default function Home() {
  const { observeProfile, profile, submitBatteryCheckin, updateProfile } = useUserProfileStore();
  const { observeFriends } = useRelationshipsStore();
  const [showBatterySheet, setShowBatterySheet] = useState(false);
  const [showReflectionPrompt, setShowReflectionPrompt] = useState(false);
  const [showWeeklyReflection, setShowWeeklyReflection] = useState(false);
  const [showYearInMoons, setShowYearInMoons] = useState(false);
  const [isReflectionDue, setIsReflectionDue] = useState(false);

  // Tutorial state - check if QuickWeave tutorial is done
  const hasPerformedQuickWeave = useTutorialStore((state) => state.hasPerformedQuickWeave);

  // Listen for URL parameters from notification deep links
  const params = useLocalSearchParams();
  const router = useRouter();

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

  // Handle notification deep links via URL parameters
  useEffect(() => {
    if (params.showBattery === 'true') {
      setShowBatterySheet(true);
      // Clear the parameter to prevent re-triggering
      router.setParams({ showBattery: undefined });
    }

    if (params.showReflection === 'true') {
      setShowWeeklyReflection(true);
      // Clear the parameter to prevent re-triggering
      router.setParams({ showReflection: undefined });
    }
  }, [params.showBattery, params.showReflection]);

  // Check if user should be prompted for battery check-in
  // Wait until QuickWeave tutorial is complete before showing (avoid conflicts)
  useEffect(() => {
    // Default to enabled if not explicitly set
    if (!profile) return;
    const isEnabled = profile.batteryCheckinEnabled ?? true;
    if (!isEnabled) return;

    // Don't show battery sheet during onboarding flow
    // Wait until user has completed their first QuickWeave
    if (!hasPerformedQuickWeave) return;

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