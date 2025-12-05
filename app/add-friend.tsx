import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { FriendForm, FriendFormData } from '@/modules/relationships';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';

function AddFriend() {
  const router = useRouter();
  const { tier, fromOnboarding } = useLocalSearchParams<{
    tier?: 'inner' | 'close' | 'community';
    fromOnboarding?: string;
  }>();

  const handleSave = async (friendData: FriendFormData) => {
    try {
      await database.write(async () => {
        await database.get<FriendModel>('friends').create(friend => {
          friend.name = friendData.name;
          // Map form tier to DB tier
          const tierMap: Record<string, string> = {
            inner: 'InnerCircle',
            close: 'CloseFriends',
            community: 'Community'
          };
          friend.dunbarTier = tierMap[friendData.tier] || 'Community';
          friend.archetype = friendData.archetype;
          friend.notes = friendData.notes;
          friend.photoUrl = friendData.photoUrl;
          friend.birthday = friendData.birthday;
          friend.anniversary = friendData.anniversary;
          friend.relationshipType = friendData.relationshipType;
          friend.isDormant = false;
          friend.weaveScore = 50; // Default score
        });
      });

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
