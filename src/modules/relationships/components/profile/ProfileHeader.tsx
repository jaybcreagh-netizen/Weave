import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { ArrowLeft, Edit, Trash2, Calendar } from 'lucide-react-native';
import { FriendListRow, FriendListRowContent } from '@/modules/relationships';
import { PatternBadge } from '@/modules/gamification';
import { TierFitCard } from '@/modules/insights';
import { useTheme } from '@/shared/hooks/useTheme';
import FriendModel from '@/db/models/Friend';

interface ProfileHeaderProps {
    friend: FriendModel;
    headerOpacity: SharedValue<number>;
    onBack: () => void;
    onEdit: () => void;
    onDelete: () => void;
    onGlobalCalendar: () => void;
    onShowBadgePopup: () => void;
    onShowTierFit: () => void;
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
        opacity: headerOpacity.value,
    }));

    return (
        <View>
            <View style={[styles.header, { borderColor: colors.border }]}>
                <TouchableOpacity onPress={onBack} style={styles.backButton}>
                    <ArrowLeft size={20} color={colors['muted-foreground']} />
                    <Text style={{ color: colors.foreground }}>Back</Text>
                </TouchableOpacity>
                <View style={styles.headerActions}>
                    <TouchableOpacity onPress={onGlobalCalendar} style={{ padding: 8 }}>
                        <Calendar size={20} color={colors['muted-foreground']} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onEdit} style={{ padding: 8 }}>
                        <Edit size={20} color={colors['muted-foreground']} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onDelete} style={{ padding: 8 }}>
                        <Trash2 size={20} color={colors.destructive} />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.contentContainer}>
                <Animated.View style={headerAnimatedStyle}>
                    <TouchableOpacity
                        activeOpacity={0.95}
                        onLongPress={onShowBadgePopup}
                    >
                        <View style={{ flex: 1 }}>
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

const styles = StyleSheet.create({
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
    backButton: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    contentContainer: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 12 },
});
