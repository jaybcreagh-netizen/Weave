import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Clock } from 'lucide-react-native';
import { differenceInDays } from 'date-fns';
import { useTheme } from '@/shared/hooks/useTheme';
import { useFriendPattern } from '@/modules/insights';
import { getIntervalDescription } from '@/modules/insights/services/pattern.service';
import FriendModel from '@/db/models/Friend';

interface PatternBadgeProps {
    friend: FriendModel;
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
    let badgeColor = colors.muted;
    let textColor = colors['muted-foreground'];

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
            style={[styles.badge, { backgroundColor: badgeColor }, style]}
        >
            <Clock size={11} color={textColor} />
            <Text style={[styles.badgeText, { color: textColor }]}>
                You usually connect {intervalText.toLowerCase()}. Last weave: {timeAgoText}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontFamily: 'Inter_500Medium',
        fontSize: 11,
    },
});
