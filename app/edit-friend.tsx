import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { FriendForm } from '../src/components/FriendForm';
import { useFriendStore } from '../src/stores/friendStore';
import { type FriendFormData } from '../src/components/types';
import { database } from '../src/db';
import FriendModel from '../src/db/models/Friend';

interface EditFriendProps {
    friend: FriendModel;
}

const EditFriendComponent = ({ friend }: EditFriendProps) => {
  const router = useRouter();
  const updateFriend = useFriendStore((state) => state.updateFriend);

  if (!friend) {
    return <Text>Friend not found.</Text>;
  }

  const handleSave = async (friendData: FriendFormData) => {
    await updateFriend(friend.id, friendData);
    if (router.canGoBack()) {
      router.back();
    }
  };

  return <FriendForm onSave={handleSave} friend={friend} />;
}

const enhance = withObservables<{ friendId: string }, EditFriendProps>(['friendId'], ({ friendId }) => ({
    friend: database.get<FriendModel>('friends').findAndObserve(friendId),
}));

const EnhancedEditFriend = enhance(EditFriendComponent);

const EditFriendScreen = () => {
    const { friendId } = useLocalSearchParams();
    if (!friendId || typeof friendId !== 'string') return <Text>Friend not found.</Text>;
    return <EnhancedEditFriend friendId={friendId} />;
}

export default EditFriendScreen;