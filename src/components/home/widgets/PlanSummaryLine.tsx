import React, { useEffect, useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
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
                const friends = await plan.interactionFriends.fetch();
                setFriendNames(friends.map((f: FriendModel) => f.name).join(', '));
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

    return (
        <Text style={style}>
            • {title} - {friendNames}
        </Text>
    );
};
