import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

import { HomeWidgetGrid, WidgetGridItem } from '../src/components/home/HomeWidgetGrid';
import { SocialSeasonWidget } from '../src/components/home/widgets/SocialSeasonWidget';
import { TodaysFocusWidget } from '../src/components/home/widgets/TodaysFocusWidget';
import { CelebrationDataWidget } from '../src/components/home/widgets/CelebrationDataWidget';
import { SocialBatterySheet } from '../src/components/home/SocialBatterySheet';
import { useUserProfileStore } from '../src/stores/userProfileStore';
import { useFriendStore } from '../src/stores/friendStore';

export default function Home() {
  const { observeProfile, profile, submitBatteryCheckin } = useUserProfileStore();
  const { observeFriends } = useFriendStore();
  const [showBatterySheet, setShowBatterySheet] = useState(false);

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

  const handleBatterySubmit = async (value: number, note?: string) => {
    await submitBatteryCheckin(value, note);
    setShowBatterySheet(false);
  };

  // Define widget grid
  const widgets: WidgetGridItem[] = [
    {
      id: 'social-season',
      component: SocialSeasonWidget,
      config: {
        id: 'social-season',
        type: 'social-season',
        fullWidth: true,
      },
      position: 0,
      visible: true,
    },
    {
      id: 'todays-focus',
      component: TodaysFocusWidget,
      config: {
        id: 'todays-focus',
        type: 'todays-focus',
        fullWidth: true,
      },
      position: 1,
      visible: true,
    },
    {
      id: 'celebration-data',
      component: CelebrationDataWidget,
      config: {
        id: 'celebration-data',
        type: 'celebration-data',
        fullWidth: false,
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
      />
    </>
  );
}
