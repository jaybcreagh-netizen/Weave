import React from 'react';
import { useRouter } from 'expo-router';
import { FriendForm } from '../src/components/FriendForm';
import { useFriendStore, type FriendFormData } from '../src/stores/friendStore';

function AddFriend() {
  const router = useRouter();
  const addFriend = useFriendStore((state) => state.addFriend);

  const handleSave = async (friendData: FriendFormData) => {
    await addFriend(friendData);
    router.back();
  };

  return <FriendForm onSave={handleSave} />;
}

export default AddFriend;