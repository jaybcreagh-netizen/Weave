import React, { useEffect, useState, useRef } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { HomeWidgetGrid, WidgetGridItem } from '../src/components/home/HomeWidgetGrid';
import { SocialSeasonWidget } from '../src/components/home/widgets/SocialSeasonWidget';
import { YearInMoonsWidget } from '../src/components/home/widgets/YearInMoonsWidget';
import { TodaysFocusWidget } from '../src/components/home/widgets/TodaysFocusWidget';
import { FocusPill } from '../src/components/home/widgets/FocusPill';
import { SocialBatterySheet } from '../src/components/home/SocialBatterySheet';
import { WeeklyReflectionModal } from '../src/components/WeeklyReflection/WeeklyReflectionModal';
import { YearInMoonsModal } from '../src/components/YearInMoons/YearInMoonsModal';
import { useUserProfileStore } from '../src/stores/userProfileStore';
import { useFriendStore } from '../src/stores/friendStore';
import { getLastReflectionDate, shouldShowReflection } from '../src/lib/notification-manager';
import { TutorialOverlay } from '../src/components/TutorialOverlay';
import { useTutorialStore } from '../src/stores/tutorialStore';

export default function Home() {
  const { observeProfile, profile, submitBatteryCheckin } = useUserProfileStore();
  const { observeFriends } = useFriendStore();
  const [showBatterySheet, setShowBatterySheet] = useState(false);
  const [showWeeklyReflection, setShowWeeklyReflection] = useState(false);
  const [showYearInMoons, setShowYearInMoons] = useState(false);

  // Listen for URL parameters from notification deep links
  const params = useLocalSearchParams();
  const router = useRouter();

  // Today's Focus tutorial state
  const hasCompletedOnboarding = useTutorialStore((state) => state.hasCompletedOnboarding);
  const hasSeenTodaysFocus = useTutorialStore((state) => state.hasSeenTodaysFocus);
  const markTodaysFocusSeen = useTutorialStore((state) => state.markTodaysFocusSeen);
  const [showTodaysFocusTutorial, setShowTodaysFocusTutorial] = useState(false);
  const [focusWidgetPosition, setFocusWidgetPosition] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const focusWidgetRef = useRef<View>(null);

  // Social Battery tutorial state
  const hasSeenSocialBattery = useTutorialStore((state) => state.hasSeenSocialBattery);
  const markSocialBatterySeen = useTutorialStore((state) => state.markSocialBatterySeen);
  const [showSocialBatteryTutorial, setShowSocialBatteryTutorial] = useState(false);

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

  // Show Today's Focus tutorial on first visit after onboarding
  useEffect(() => {
    if (hasCompletedOnboarding && !hasSeenTodaysFocus) {
      // Wait for UI to settle and battery sheet to potentially appear
      const timer = setTimeout(() => {
        if (!showBatterySheet) {
          setShowTodaysFocusTutorial(true);
          // Try to measure the widget position
          if (focusWidgetRef.current) {
            focusWidgetRef.current.measure((x, y, width, height, pageX, pageY) => {
              setFocusWidgetPosition({ x: pageX, y: pageY, width, height });
            });
          }
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasCompletedOnboarding, hasSeenTodaysFocus, showBatterySheet]);

  const handleBatterySubmit = async (value: number, note?: string) => {
    await submitBatteryCheckin(value, note);
    setShowBatterySheet(false);
  };

  const handleTodaysFocusTutorialClose = async () => {
    await markTodaysFocusSeen();
    setShowTodaysFocusTutorial(false);
  };

  // Show Social Battery tutorial when battery sheet first appears
  useEffect(() => {
    if (showBatterySheet && !hasSeenSocialBattery) {
      // Wait for battery sheet animation to complete
      const timer = setTimeout(() => {
        setShowSocialBatteryTutorial(true);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setShowSocialBatteryTutorial(false);
    }
  }, [showBatterySheet, hasSeenSocialBattery]);

  const handleSocialBatteryTutorialClose = async () => {
    await markSocialBatterySeen();
    setShowSocialBatteryTutorial(false);
  };

  // Define widget grid - Compass Hub design
  // Order: Context (Season) → Celebration (Practice) → Action (Focus)
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
      id: 'year-in-moons',
      component: YearInMoonsWidget,
      config: {
        id: 'year-in-moons',
        type: 'year-in-moons',
        fullWidth: true,
      },
      position: 1,
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
      position: 2,
      visible: true,
    },
  ];

  return (
    <>
      <FocusPill />
      <View ref={focusWidgetRef} onLayout={() => {
        // Measure position when layout is complete
        if (showTodaysFocusTutorial && focusWidgetRef.current) {
          setTimeout(() => {
            focusWidgetRef.current?.measure((x, y, width, height, pageX, pageY) => {
              setFocusWidgetPosition({ x: pageX, y: pageY, width, height });
            });
          }, 100);
        }
      }}>
        <HomeWidgetGrid widgets={widgets} />
      </View>

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

      {/* Today's Focus Tutorial */}
      {showTodaysFocusTutorial && (
        <TutorialOverlay
          visible={true}
          step={{
            id: 'todays-focus-intro',
            title: 'Your compass for connection',
            description: "Today's Focus shows what matters most right now: plans for today, friends who need attention, and upcoming celebrations. Check here daily to stay grounded.",
            targetPosition: focusWidgetPosition || undefined,
            tooltipPosition: 'bottom',
          }}
          onNext={handleTodaysFocusTutorialClose}
          onSkip={handleTodaysFocusTutorialClose}
        />
      )}

      {/* Social Battery Tutorial */}
      {showSocialBatteryTutorial && (
        <TutorialOverlay
          visible={true}
          step={{
            id: 'social-battery-intro',
            title: 'Track your social energy',
            description: 'Your Social Battery helps you stay mindful of your capacity for connection. Check in daily to track patterns, or disable this in Settings if you prefer.',
            tooltipPosition: 'bottom',
          }}
          onNext={handleSocialBatteryTutorialClose}
          onSkip={handleSocialBatteryTutorialClose}
        />
      )}
    </>
  );
}