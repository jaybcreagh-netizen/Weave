import React, { ReactNode } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
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
            <View style={styles.center}>
                <Text style={styles.errorText}>Friend not found</Text>
            </View>
        );
    }

    return <>{children(friend)}</>;
};

const enhance = withObservables(['friendId'], ({ friendId }: { friendId: string }) => ({
    friend: database.get<FriendModel>('friends').findAndObserve(friendId),
}));

export const ReactiveFriendProfile = enhance(ReactiveFriendProfileContent);

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    errorText: {
        fontSize: 16,
        color: '#EF4444', // Red-500
    },
});
