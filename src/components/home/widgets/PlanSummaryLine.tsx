import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { Q } from '@nozbe/watermelondb';
import { database } from '@/db';
import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import InteractionFriend from '@/db/models/InteractionFriend';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { InteractionCategory } from '@/components/types';

interface PlanSummaryLineProps {
    plan: Interaction;
    style?: any;
}

export const PlanSummaryLine: React.FC<PlanSummaryLineProps> = ({ plan, style }) => {
    const [friendNames, setFriendNames] = useState<string>('');

    useEffect(() => {
        const loadFriends = async () => {
            try {
                const linkedFriends = await plan.interactionFriends.fetch();
                const friendIds = linkedFriends.map((link: InteractionFriend) => link.friendId);

                if (friendIds.length > 0) {
                    const friends = await database.get<FriendModel>('friends')
                        .query(Q.where('id', Q.oneOf(friendIds)))
                        .fetch();
                    setFriendNames(friends.map(f => f.name).join(', '));
                }
            } catch (e) {
                console.error('Error loading friends for summary:', e);
            }
        };
        loadFriends();
    }, [plan]);

    const categoryData = plan.interactionCategory
        ? getCategoryMetadata(plan.interactionCategory as InteractionCategory)
        : null;
    const title = plan.title || categoryData?.label || plan.activity;
    const timeText = format(plan.interactionDate, 'h:mm a');

    return (
        <Text style={style}>
            • {friendNames} - {timeText} - {title}
        </Text>
    );
};
