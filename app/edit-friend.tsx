import React, { useMemo } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { FriendForm, useRelationshipsStore, FriendFormData } from '@/modules/relationships';
import { useObservable } from '@/shared/hooks/useObservable';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';

const EditFriendScreen = () => {
  const { friendId } = useLocalSearchParams();
  const router = useRouter();
  const updateFriend = useRelationshipsStore((state) => state.updateFriend);

  // Create observable for friend
  const friendObservable = useMemo(() => {
    if (!friendId || typeof friendId !== 'string') return null;
    return database.get<FriendModel>('friends').findAndObserve(friendId);
  }, [friendId]);

  // Subscribe to friend changes
  const friend = useObservable(friendObservable!, null as FriendModel | null);

  if (!friendId || typeof friendId !== 'string') {
    return <Text>Friend not found.</Text>;
  }

  if (!friend) {
    return <Text>Loading...</Text>;
  }

  const handleSave = async (friendData: FriendFormData) => {
    await updateFriend(friend.id, friendData);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  return <FriendForm onSave={handleSave} friend={friend} />;
}

export default EditFriendScreen;