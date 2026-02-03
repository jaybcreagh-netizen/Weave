import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTutorialStore } from '@/shared/stores/tutorialStore';

const FIRST_RUN_COMPLETED_KEY = '@weave:first_run_completed';
const PERMISSIONS_COMPLETED_KEY = '@weave:permissions_completed';

export default function StartPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [hasCompletedFirstRunSetup, setHasCompletedFirstRunSetup] = useState<boolean | null>(null);
  const hasCompletedOnboarding = useTutorialStore(state => state.hasCompletedOnboarding);
  const loadTutorialState = useTutorialStore(state => state.loadTutorialState);

  useEffect(() => {
    let isMounted = true;

    const initializeStartRoute = async () => {
      try {
        // Load tutorial state from AsyncStorage on mount
        await loadTutorialState();

        // Backward-compatible setup completion:
        // - New key is set after social battery intro completes
        // - Legacy key is used as fallback for existing installs
        const [setupCompleted, legacyPermissionsCompleted] = await Promise.all([
          AsyncStorage.getItem(FIRST_RUN_COMPLETED_KEY),
          AsyncStorage.getItem(PERMISSIONS_COMPLETED_KEY),
        ]);

        if (!isMounted) return;
        setHasCompletedFirstRunSetup(
          setupCompleted === 'true' || legacyPermissionsCompleted === 'true'
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    initializeStartRoute();

    return () => {
      isMounted = false;
    };
  }, []);

  if (isLoading || hasCompletedFirstRunSetup === null) {
    return null; // Or a loading screen
  }

  if (!hasCompletedOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  if (!hasCompletedFirstRunSetup) {
    // Auth is optional; prioritize finishing the first-run setup funnel.
    return <Redirect href="/permissions" />;
  }

  return <Redirect href="/dashboard" />;
}
