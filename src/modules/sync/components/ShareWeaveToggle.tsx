/**
 * ShareWeaveToggle
 * 
 * Toggle component that appears when logging a weave with linked friends.
 * Allows user to share the weave with linked Weave users.
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Link, Send } from 'lucide-react-native';

import { Text } from '@/shared/ui';
import { useTheme } from '@/shared/hooks/useTheme';
import Friend from '@/db/models/Friend';

interface ShareWeaveToggleProps {
    linkedFriends: Friend[];
    shareEnabled: boolean;
    onShareChange: (share: boolean) => void;
}

export function ShareWeaveToggle({
    linkedFriends,
    shareEnabled,
    onShareChange
}: ShareWeaveToggleProps) {
    const { colors } = useTheme();

    if (linkedFriends.length === 0) {
        return null;
    }

    const friendNames = linkedFriends
        .map(f => f.name.split(' ')[0]) // First name only
        .slice(0, 2)
        .join(' & ');

    const hasMore = linkedFriends.length > 2;
    const displayName = hasMore
        ? `${friendNames} +${linkedFriends.length - 2}`
        : friendNames;

    return (
        <View
            className="mx-4 p-4 rounded-xl mt-4"
            style={{ backgroundColor: shareEnabled ? colors.primary + '15' : colors.muted }}
        >
            <TouchableOpacity
                className="flex-row items-center justify-between"
                onPress={() => onShareChange(!shareEnabled)}
                activeOpacity={0.7}
            >
                <View className="flex-row items-center gap-3 flex-1">
                    <View
                        className="w-10 h-10 rounded-full items-center justify-center"
                        style={{ backgroundColor: shareEnabled ? colors.primary : colors['muted-foreground'] + '30' }}
                    >
                        <Send size={18} color={shareEnabled ? colors['primary-foreground'] : colors['muted-foreground']} />
                    </View>
                    <View className="flex-1">
                        <Text
                            className="font-semibold"
                            style={{ color: colors.foreground }}
                        >
                            Share with {displayName}
                        </Text>
                        <Text
                            className="text-sm"
                            style={{ color: colors['muted-foreground'] }}
                        >
                            They'll see the date, location & activity
                        </Text>
                    </View>
                </View>

                {/* Toggle indicator */}
                <View
                    className="w-12 h-7 rounded-full justify-center px-1"
                    style={{
                        backgroundColor: shareEnabled ? colors.primary : colors['muted-foreground'] + '40'
                    }}
                >
                    <View
                        className="w-5 h-5 rounded-full"
                        style={{
                            backgroundColor: colors.card,
                            marginLeft: shareEnabled ? 'auto' : 0
                        }}
                    />
                </View>
            </TouchableOpacity>
        </View>
    );
}
