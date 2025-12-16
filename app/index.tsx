import { Redirect } from 'expo-router';
import React from 'react';
import { useTutorial } from '@/shared/context/TutorialContext';

export default function StartPage() {
  const { hasCompletedOnboarding, isLoaded } = useTutorial();

  // Wait for tutorial state to load from AsyncStorage
  if (!isLoaded) {
    return null; // Or a loading screen
  }

  return <Redirect href={hasCompletedOnboarding ? "/dashboard" : "/onboarding"} />;
}