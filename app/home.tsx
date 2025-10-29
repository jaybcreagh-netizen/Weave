import React, { useEffect } from 'react';
import { View } from 'react-native';

import { HomeWidgetGrid, WidgetGridItem } from '../src/components/home/HomeWidgetGrid';
import { SocialSeasonWidget } from '../src/components/home/widgets/SocialSeasonWidget';
import { TodaysFocusWidget } from '../src/components/home/widgets/TodaysFocusWidget';
import { CelebrationDataWidget } from '../src/components/home/widgets/CelebrationDataWidget';
import { useUserProfileStore } from '../src/stores/userProfileStore';

export default function Home() {
  const { observeProfile } = useUserProfileStore();

  // Initialize user profile observable on mount
  useEffect(() => {
    const cleanup = observeProfile();
    return cleanup;
  }, []);

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

  return <HomeWidgetGrid widgets={widgets} />;
}
