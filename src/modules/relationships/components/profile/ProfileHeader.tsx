import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { ArrowLeft, Edit, Trash2, Calendar } from 'lucide-react-native';
import { FriendListRow, FriendListRowContent } from '@/modules/relationships';
import { PatternBadge } from '@/modules/gamification';
import { TierFitCard } from '@/modules/insights';
import { useTheme } from '@/shared/hooks/useTheme';
import FriendModel from '@/db/models/Friend';

interface ProfileHeaderProps {
    friend: FriendModel;
    headerOpacity?: SharedValue<number>;
    onBack: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onGlobalCalendar?: () => void;
    onShowBadgePopup?: () => void;
    onShowTierFit?: () => void;
}

export function ProfileHeader({
    friend,
    headerOpacity,
    onBack,
    onEdit,
    onDelete,
    onGlobalCalendar,
    onShowBadgePopup,
    onShowTierFit,
}: ProfileHeaderProps) {
    const { colors } = useTheme();

    const headerAnimatedStyle = useAnimatedStyle(() => ({
        opacity: headerOpacity?.value ?? 1,
    }));

    return (
        <View>
            <View className="flex-row justify-between items-center px-5 py-3 border-b" style={{ borderColor: colors.border }}>
                <TouchableOpacity onPress={onBack} className="flex-row items-center gap-2">
                    <ArrowLeft size={20} color={colors['muted-foreground']} />
                    <Text style={{ color: colors.foreground }}>Back</Text>
                </TouchableOpacity>
                <View className="flex-row items-center gap-2">
                    <TouchableOpacity onPress={onGlobalCalendar} className="p-2">
                        <Calendar size={20} color={colors['muted-foreground']} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onEdit} className="p-2">
                        <Edit size={20} color={colors['muted-foreground']} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDelete} className="p-2">
                        <Trash2 size={20} color={colors.destructive} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 }}>
                <Animated.View style={headerAnimatedStyle}>
                    <TouchableOpacity
                        activeOpacity={0.95}
                        onLongPress={onShowBadgePopup}
                    >
                        {/* Wrapper View to ensure flex behavior */}
                        <View>
                            <FriendListRowContent friend={friend} variant="full" />
                        </View>
                    </TouchableOpacity>
                    <PatternBadge friend={friend as any} style={{ marginTop: 4, marginLeft: 4 }} />

                    {/* Tier Fit Card */}
                    <TierFitCard
                        friendId={friend.id}
                        onPress={onShowTierFit}
                    />
                </Animated.View>
            </View>
        </View>
    );
}
