import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { differenceInDays } from 'date-fns';
import { useTheme } from '@/shared/hooks/useTheme';
import { useFriendPattern } from '@/modules/insights';
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

    return (
        <View style={[styles.badge, { backgroundColor: badgeColor }, style]}>
            <Clock size={11} color={textColor} />
            <Text style={[styles.badgeText, { color: textColor }]}>
                Usually {pattern.averageIntervalDays}d · {daysSince}d ago
            </Text>
        </View>
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
