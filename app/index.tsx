import { Redirect } from 'expo-router';
import React from 'react';

export default function StartPage() {
  // Onboarding disabled for now - will be adapted after homescreen
  return <Redirect href="/(tabs)" />;
}