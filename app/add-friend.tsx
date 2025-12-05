import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FriendForm, useRelationshipsStore, FriendFormData } from '@/modules/relationships';

function AddFriend() {
  const router = useRouter();
  const { tier, fromOnboarding } = useLocalSearchParams<{
    tier?: 'inner' | 'close' | 'community';
    fromOnboarding?: string;
  }>();
  const addFriend = useRelationshipsStore((state) => state.addFriend);

  const handleSave = async (friendData: FriendFormData) => {
    await addFriend(friendData);
    if (fromOnboarding === 'true') {
      router.replace('/dashboard');
    } else if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
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
