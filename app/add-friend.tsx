import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FriendForm } from '../src/components/FriendForm';
import { useFriendStore } from '../src/stores/friendStore';
import { type FriendFormData } from '../src/components/types';

function AddFriend() {
  const router = useRouter();
  const { tier } = useLocalSearchParams<{ tier: 'inner' | 'close' | 'community' }>();
  const addFriend = useFriendStore((state) => state.addFriend);

  const handleSave = async (friendData: FriendFormData) => {
    await addFriend(friendData);
    if (router.canGoBack()) {
      router.back();
    }
  };

  return <FriendForm onSave={handleSave} initialTier={tier} />;
}

export default AddFriend;
