import React from 'react';
import { View, TouchableOpacity, Alert } from 'react-native';
import { Clock } from 'lucide-react-native';
import { differenceInDays } from 'date-fns';
import { useTheme } from '@/shared/hooks/useTheme';
import { useFriendPattern, getIntervalDescription } from '@/modules/insights';
import FriendModel from '@/db/models/Friend';
import { type Friend } from '@/shared/types/legacy-types';
import { Text } from '@/shared/ui/Text';

interface PatternBadgeProps {
    friend: FriendModel | Friend;
    style?: any;
}

export const PatternBadge: React.FC<PatternBadgeProps> = ({ friend, style }) => {
    const { colors } = useTheme();
    const { pattern, isReliable } = useFriendPattern(friend.id);

    if (!isReliable || !pattern) return null;

    const daysSince = differenceInDays(new Date(), friend.lastUpdated);
    const isOverdue = daysSince > pattern.averageIntervalDays * 1.2;
    const isApproaching = daysSince > pattern.averageIntervalDays * 0.8 && !isOverdue;

    // Determine badge color
    let badgeColor: string = colors.muted;
    let textColor: string = colors['muted-foreground'];

    if (isOverdue) {
        badgeColor = 'rgba(239, 68, 68, 0.15)'; // red
        textColor = '#EF4444';
    } else if (isApproaching) {
        badgeColor = 'rgba(251, 146, 60, 0.15)'; // yellow
        textColor = '#FB923C';
    } else {
        badgeColor = 'rgba(34, 197, 94, 0.15)'; // green
        textColor = '#22C55E';
    }

    // Format text
    const intervalText = getIntervalDescription(pattern.averageIntervalDays);

    let timeAgoText = `${daysSince} days ago`;
    if (daysSince === 0) timeAgoText = 'Today';
    else if (daysSince === 1) timeAgoText = 'Yesterday';

    const handlePress = () => {
        Alert.alert(
            "Interaction Pattern",
            `Weave analyzes your history to find your natural rhythm.\n\n• Usual: You tend to connect with ${friend.name} ${intervalText.toLowerCase()}.\n• Last: Your last interaction was ${timeAgoText.toLowerCase()}.`
        );
    };

    return (
        <TouchableOpacity
            onPress={handlePress}
            activeOpacity={0.7}
            className="flex-row items-center gap-1 px-2 py-1 rounded-lg"
            style={[{ backgroundColor: badgeColor }, style]}
        >
            <Clock size={11} color={textColor} />
            <Text
                variant="caption"
                className="font-inter-medium text-[11px]"
                style={{ color: textColor }}
            >
                You usually connect {intervalText.toLowerCase()}. Last weave: {timeAgoText}
            </Text>
        </TouchableOpacity>
    );
};
