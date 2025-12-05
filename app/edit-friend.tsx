import React from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import withObservables from '@nozbe/with-observables';
import { FriendForm, FriendFormData } from '@/modules/relationships';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';

interface EditFriendProps {
  friend: FriendModel;
}

const EditFriendComponent = ({ friend }: EditFriendProps) => {
  const router = useRouter();

  if (!friend) {
    return <Text>Friend not found.</Text>;
  }

  const handleSave = async (friendData: FriendFormData) => {
    try {
      await database.write(async () => {
        await friend.update(f => {
          f.name = friendData.name;
          // Map form tier to DB tier
          const tierMap: Record<string, string> = {
            inner: 'InnerCircle',
            close: 'CloseFriends',
            community: 'Community'
          };
          f.dunbarTier = tierMap[friendData.tier] || 'Community';
          f.archetype = friendData.archetype;
          f.notes = friendData.notes;
          f.photoUrl = friendData.photoUrl;
          f.birthday = friendData.birthday;
          f.anniversary = friendData.anniversary;
          f.relationshipType = friendData.relationshipType;
        });
      });

      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Error updating friend:', error);
      // Optionally show alert
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