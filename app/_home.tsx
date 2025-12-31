import React, { useEffect, useState, useRef, useCallback } from 'react';

import { HomeWidgetGrid, WidgetGridItem } from '@/modules/home/components/widgets/HomeWidgetGrid';
import { SocialSeasonWidgetV2 } from '@/modules/home/components/widgets/widgets/SocialSeasonWidgetV2';
import { YourEnergyWidget } from '@/modules/home/components/widgets/widgets/YourEnergyWidget';
import { TodaysFocusWidgetV2 } from '@/modules/home/components/widgets/widgets/TodaysFocusWidgetV2';
import { JournalWidget } from '@/modules/home/components/widgets/widgets/JournalWidget';
import { useTheme } from '@/shared/hooks/useTheme';
import { ReflectionReadyPrompt } from '@/modules/reflection/components/WeeklyReflection/ReflectionReadyPrompt';
import { YearInMoonsModal } from '@/modules/intelligence';
import { useUserProfileStore } from '@/modules/auth';
import { notificationStore, shouldSendWeeklyReflectionNotification } from '@/modules/notifications';
import { useTutorialStore } from '@/shared/stores/tutorialStore';
import { useUIStore } from '@/shared/stores/uiStore';
import { isSameWeek } from 'date-fns';

/**
 * The home screen of the application.
 * Displays a grid of widgets and handles modals for social battery check-ins and weekly reflections.
 * @returns {React.ReactElement} The rendered home screen.
 */
interface HomeProps {
  onReady?: () => void;
}

export default function Home({ onReady }: HomeProps) {
  const { profile, updateProfile } = useUserProfileStore();
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

  // Mounted state and timeout refs to prevent race conditions
  const isMountedRef = useRef(true);
  const reflectionPromptTimerRef = useRef<NodeJS.Timeout | null>(null);
  const moonsTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Tutorial state - check if QuickWeave tutorial is done
  const hasPerformedQuickWeave = useTutorialStore((state) => state.hasPerformedQuickWeave);

  // Cleanup timeouts on unmount to prevent setState on unmounted component
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (reflectionPromptTimerRef.current) clearTimeout(reflectionPromptTimerRef.current);
      if (moonsTimerRef.current) clearTimeout(moonsTimerRef.current);
    };
  }, []);

  // Signal ready after initial render (use InteractionManager for true idle callback)
  useEffect(() => {
    // Small delay to ensure first paint has occurred
    const timer = setTimeout(() => {
      if (isMountedRef.current && onReady) {
        onReady();
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [onReady]);



  // Check if weekly reflection should be shown
  useEffect(() => {
    const checkWeeklyReflection = async () => {
      if (!profile) return;

      const lastDate = await notificationStore.getLastReflectionDate();
      // Due if no last date, or if last date is NOT in the same week (Sunday start)
      const isDue = !lastDate || !isSameWeek(lastDate, new Date(), { weekStartsOn: 0 });

      // Check grace period: only show widget if interactions met
      const { shouldSend: meetsGracePeriod } = await shouldSendWeeklyReflectionNotification();

      // Check days
      const today = new Date();
      const currentDay = today.getDay();
      const isSunday = currentDay === 0;
      const isMonday = currentDay === 1;

      // Widget Visibility no longer needed - JournalWidget handles this internally

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
        // Show after 35 seconds if battery sheet is dismissed or not shown
        reflectionPromptTimerRef.current = setTimeout(() => {
          // Use global open action
          if (isMountedRef.current && !isSocialBatterySheetOpen && !isReflectionPromptOpen) {
            openReflectionPrompt();
          }
        }, 35000);
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
      id: 'journal',
      component: JournalWidget,
      config: {
        id: 'journal',
        type: 'journal',
        fullWidth: true,
      },
      position: 3,
      visible: true,
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