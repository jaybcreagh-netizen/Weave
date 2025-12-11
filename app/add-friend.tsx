import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FriendForm, FriendFormData, createFriend } from '@/modules/relationships';

function AddFriend() {
  const router = useRouter();
  const { tier, fromOnboarding } = useLocalSearchParams<{
    tier?: 'inner' | 'close' | 'community';
    fromOnboarding?: string;
  }>();

  const handleSave = async (friendData: FriendFormData) => {
    try {
      await createFriend(
        friendData,
        fromOnboarding === 'true' ? 'onboarding' : 'manual'
      );

      if (fromOnboarding === 'true') {
        router.replace('/dashboard');
      } else if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Error adding friend:', error);
      // Optionally show alert
    }
  };

  const handleSkip = () => {
    router.replace('/dashboard');
  };

  return (
    <FriendForm
      onSave={handleSave}
      initialTier={tier}
      fromOnboarding={fromOnboarding === 'true'}
      onSkip={handleSkip}
    />
  );
}

export default AddFriend;
