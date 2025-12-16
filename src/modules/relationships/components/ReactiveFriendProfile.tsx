import React, { ReactNode } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import withObservables from '@nozbe/with-observables';
import { database } from '@/db';
import FriendModel from '@/db/models/Friend';

interface ReactiveFriendProfileProps {
    friend: FriendModel;
    children: (friend: FriendModel) => ReactNode;
}

const ReactiveFriendProfileContent = ({ friend, children }: ReactiveFriendProfileProps) => {
    if (!friend) {
        return (
            <View className="flex-1 justify-center items-center">
                <Text className="text-base text-red-500">Friend not found</Text>
            </View>
        );
    }

    return <>{children(friend)}</>;
};

const enhance = withObservables(['friendId'], ({ friendId }: { friendId: string }) => ({
    friend: database.get<FriendModel>('friends').findAndObserve(friendId),
}));

export const ReactiveFriendProfile = enhance(ReactiveFriendProfileContent);
