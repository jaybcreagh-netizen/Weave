import React, { useEffect, useState, useRef } from 'react';

import { HomeWidgetGrid, WidgetGridItem } from '@/modules/home/components/widgets/HomeWidgetGrid';
import { SocialSeasonWidgetV2 } from '@/modules/home/components/widgets/widgets/SocialSeasonWidgetV2';
import { YourEnergyWidget } from '@/modules/home/components/widgets/widgets/YourEnergyWidget';
import { TodaysFocusWidgetV2 } from '@/modules/home/components/widgets/widgets/TodaysFocusWidgetV2';
import { useTheme } from '@/shared/hooks/useTheme';
import { ReflectionReadyWidget } from '@/modules/home/components/widgets/widgets/ReflectionReadyWidget';
import { ReflectionReadyPrompt } from '@/modules/reflection/components/WeeklyReflection/ReflectionReadyPrompt';
import { YearInMoonsModal } from '@/modules/intelligence';
import { useUserProfileStore } from '@/modules/auth';
import { notificationStore } from '@/modules/notifications';
import { getUserAccountAge } from '@/modules/notifications';
import { useTutorialStore } from '@/shared/stores/tutorialStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { isSameWeek } from 'date-fns';

/**
 * The home screen of the application.
 * Displays a grid of widgets and handles modals for social battery check-ins and weekly reflections.
 * @returns {React.ReactElement} The rendered home screen.
 */
export default function Home() {
  const { observeProfile, profile, submitBatteryCheckin, updateProfile } = useUserProfileStore();
  const {
    openWeeklyReflection,
    isReflectionPromptOpen,
    openReflectionPrompt,
    closeReflectionPrompt,
    isSocialBatterySheetOpen,
    openSocialBatterySheet
  } = useUIStore();
  const theme = useTheme();
  const colors = theme?.colors || {};
  const [showYearInMoons, setShowYearInMoons] = useState(false);
  const [isWidgetVisible, setIsWidgetVisible] = useState(false);

  // Mounted state and timeout refs to prevent race conditions
  const isMountedRef = useRef(true);
  const batteryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reflectionPromptTimerRef = useRef<NodeJS.Timeout | null>(null);
  const moonsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Tutorial state - check if QuickWeave tutorial is done
  const hasPerformedQuickWeave = useTutorialStore((state) => state.hasPerformedQuickWeave);

  // Cleanup timeouts on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (batteryTimerRef.current) clearTimeout(batteryTimerRef.current);
      if (reflectionPromptTimerRef.current) clearTimeout(reflectionPromptTimerRef.current);
      if (moonsTimerRef.current) clearTimeout(moonsTimerRef.current);
    };
  }, []);

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
        console.log('[Home] No last check-in found, showing battery sheet');
        // Never checked in - show after brief delay
        batteryTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            openSocialBatterySheet();
          }
        }, 600);
        return () => {
          if (batteryTimerRef.current) {
            clearTimeout(batteryTimerRef.current);
          }
        };
      }

      // Check if last check-in was today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const lastCheckinDate = new Date(lastCheckin);
      lastCheckinDate.setHours(0, 0, 0, 0);

      const needsCheckin = lastCheckinDate < today;
      console.log(`[Home] Battery Check-in Status: Last=${lastCheckinDate.toDateString()}, Today=${today.toDateString()}, Needs=${needsCheckin}`);

      if (needsCheckin) {
        // Last check-in was before today - show after brief delay
        batteryTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            openSocialBatterySheet();
          }
        }, 600);
        return () => {
          if (batteryTimerRef.current) {
            clearTimeout(batteryTimerRef.current);
          }
        };
      }
    });
  }, [profile, hasPerformedQuickWeave]);

  // Check if weekly reflection should be shown
  useEffect(() => {
    const checkWeeklyReflection = async () => {
      if (!profile) return;

      const lastDate = await notificationStore.getLastReflectionDate();
      // Due if no last date, or if last date is NOT in the same week (Sunday start)
      const isDue = !lastDate || !isSameWeek(lastDate, new Date(), { weekStartsOn: 0 });

      // Check grace period: only show widget after 3+ days of app usage
      const accountAge = await getUserAccountAge();
      const meetsGracePeriod = accountAge !== null && accountAge >= 3;

      // Check days
      const today = new Date();
      const currentDay = today.getDay();
      const isSunday = currentDay === 0;
      const isMonday = currentDay === 1;

      // Widget Visibility: Sunday OR Monday, if due and meets grace period
      const widgetVisible = isDue && meetsGracePeriod && (isSunday || isMonday);
      setIsWidgetVisible(widgetVisible);

      // Prompt Logic: Sunday ONLY, if due and meets grace period
      if (!isDue || !meetsGracePeriod || !isSunday) return;

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

      // Only auto-show if it's the reflection day (Sunday), auto-show is enabled, and not snoozed
      if (currentDay === reflectionDay && autoShow && !isSnoozed) {
        // Wait longer than battery check-in so it doesn't conflict
        // Show after 2 seconds if battery sheet is dismissed or not shown
        reflectionPromptTimerRef.current = setTimeout(() => {
          // Use global open action
          if (isMountedRef.current && !isSocialBatterySheetOpen && !isReflectionPromptOpen) {
            openReflectionPrompt();
          }
        }, 2000);
        return () => {
          if (reflectionPromptTimerRef.current) {
            clearTimeout(reflectionPromptTimerRef.current);
          }
        };
      }
    };

    checkWeeklyReflection();
  }, [profile, isSocialBatterySheetOpen]);



  const handleReflectionStart = () => {
    closeReflectionPrompt();
    // Add small delay to ensure prompt closes before reflection opens (prevents iOS modal conflict)
    setTimeout(() => {
      openWeeklyReflection();
    }, 500);
  };

  const handleReflectionRemindLater = async () => {
    closeReflectionPrompt();
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
      component: TodaysFocusWidgetV2,
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
      component: SocialSeasonWidgetV2,
      config: {
        id: 'social-season',
        type: 'social-season',
        fullWidth: true,
      },
      position: 1,
      visible: true,
    },
    {
      id: 'your-energy',
      component: YourEnergyWidget,
      config: {
        id: 'your-energy',
        type: 'your-energy',
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
        onPress: openReflectionPrompt, // Use global action
      },
      position: 3,
      visible: isWidgetVisible,
    },
  ];

  return (
    <>
      <HomeWidgetGrid widgets={widgets} />


      <ReflectionReadyPrompt
        isVisible={isReflectionPromptOpen}
        onStart={handleReflectionStart}
        onRemindLater={handleReflectionRemindLater}
        onDismiss={closeReflectionPrompt}
      />

      <YearInMoonsModal
        isOpen={showYearInMoons}
        onClose={() => setShowYearInMoons(false)}
      />
    </>
  );
}