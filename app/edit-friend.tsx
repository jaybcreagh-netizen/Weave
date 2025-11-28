import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import withObservables from '@nozbe/with-observables';
import { FriendForm, useRelationshipsStore, FriendFormData } from '@/modules/relationships';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';

interface EditFriendProps {
  friend: FriendModel;
}

const EditFriendComponent = ({ friend }: EditFriendProps) => {
  const router = useRouter();
  const updateFriend = useRelationshipsStore((state) => state.updateFriend);

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

const enhance = withObservables(['friendId'], ({ friendId }: { friendId: string }) => ({
  friend: database.get<FriendModel>('friends').findAndObserve(friendId),
}));

const EnhancedEditFriend = enhance(EditFriendComponent);

const EditFriendScreen = () => {
  const { friendId } = useLocalSearchParams();
  if (!friendId || typeof friendId !== 'string') return <Text>Friend not found.</Text>;
  return <EnhancedEditFriend friendId={friendId} />;
}

export default EditFriendScreen;