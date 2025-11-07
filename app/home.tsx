import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { HomeWidgetGrid, WidgetGridItem } from '../src/components/home/HomeWidgetGrid';
import { StatePillsWidget } from '../src/components/home/widgets/StatePillsWidget';
import { FocusCardWidget } from '../src/components/home/widgets/FocusCardWidget';
import { WeavingPracticeWidget } from '../src/components/home/widgets/WeavingPracticeWidget';
import { SocialBatterySheet } from '../src/components/home/SocialBatterySheet';
import { WeeklyReflectionModal } from '../src/components/WeeklyReflection/WeeklyReflectionModal';
import { YearInMoonsModal } from '../src/components/YearInMoons/YearInMoonsModal';
import { useUserProfileStore } from '../src/stores/userProfileStore';
import { useFriendStore } from '../src/stores/friendStore';
import { getLastReflectionDate, shouldShowReflection } from '../src/lib/notification-manager';

export default function Home() {
  const { observeProfile, profile, submitBatteryCheckin } = useUserProfileStore();
  const { observeFriends } = useFriendStore();
  const [showBatterySheet, setShowBatterySheet] = useState(false);
  const [showWeeklyReflection, setShowWeeklyReflection] = useState(false);
  const [showYearInMoons, setShowYearInMoons] = useState(false);

  // Initialize user profile observable on mount
  useEffect(() => {
    const cleanup = observeProfile();
    return cleanup;
  }, []);

  // Initialize friends observable on mount (needed for Life Events widget)
  useEffect(() => {
    observeFriends();
    // Note: observeFriends doesn't return cleanup, it manages its own subscription
  }, []);

  // Check if user should be prompted for battery check-in
  useEffect(() => {
    // Default to enabled if not explicitly set
    if (!profile) return;
    const isEnabled = profile.batteryCheckinEnabled ?? true;
    if (!isEnabled) return;

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
  }, [profile]);

  // Check if weekly reflection should be shown
  useEffect(() => {
    const checkWeeklyReflection = async () => {
      const lastDate = await getLastReflectionDate();
      if (shouldShowReflection(lastDate)) {
        // Wait longer than battery check-in so it doesn't conflict
        // Show after 2 seconds if battery sheet is dismissed or not shown
        const timer = setTimeout(() => {
          if (!showBatterySheet) {
            setShowWeeklyReflection(true);
          }
        }, 2000);
        return () => clearTimeout(timer);
      }
    };

    checkWeeklyReflection();
  }, [showBatterySheet]);

  const handleBatterySubmit = async (value: number, note?: string) => {
    await submitBatteryCheckin(value, note);
    setShowBatterySheet(false);
  };

  // Define widget grid - Compass Hub design
  const widgets: WidgetGridItem[] = [
    {
      id: 'state-pills',
      component: StatePillsWidget,
      config: {
        id: 'state-pills',
        type: 'state-pills',
        fullWidth: true,
      },
      position: 0,
      visible: true,
    },
    {
      id: 'focus-card',
      component: FocusCardWidget,
      config: {
        id: 'focus-card',
        type: 'focus-card',
        fullWidth: true,
      },
      position: 1,
      visible: true,
    },
    {
      id: 'weaving-practice',
      component: WeavingPracticeWidget,
      config: {
        id: 'weaving-practice',
        type: 'weaving-practice',
        fullWidth: true,
      },
      position: 2,
      visible: true,
    },
  ];

  return (
    <>
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
