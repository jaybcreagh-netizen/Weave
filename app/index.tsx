import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useTutorialStore } from '@/shared/stores/tutorialStore';

export default function StartPage() {
  const [isLoading, setIsLoading] = useState(true);
  const hasCompletedOnboarding = useTutorialStore(state => state.hasCompletedOnboarding);
  const loadTutorialState = useTutorialStore(state => state.loadTutorialState);

  useEffect(() => {
    // Load tutorial state from AsyncStorage on mount
    loadTutorialState().then(() => {
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return null; // Or a loading screen
  }

  return <Redirect href={hasCompletedOnboarding ? "/dashboard" : "/onboarding"} />;
}