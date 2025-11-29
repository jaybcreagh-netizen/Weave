import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Calendar, CheckCircle2 } from 'lucide-react-native';
import { differenceInDays, format } from 'date-fns';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { InteractionCategory } from '@/components/types';
import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import InteractionFriend from '@/db/models/InteractionFriend';
import { database } from '@/db';
import { Q } from '@nozbe/watermelondb';

interface PendingPlanItemProps {
    plan: Interaction;
    onConfirm: (id: string) => void;
    onReschedule: (plan: any) => void;
}

export const PendingPlanItem: React.FC<PendingPlanItemProps> = ({ plan, onConfirm, onReschedule }) => {
    const [friends, setFriends] = useState<FriendModel[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadFriends = async () => {
            try {
                // Fetch friends through the join table
                const linkedFriends = await plan.interactionFriends.fetch();
                const friendIds = linkedFriends.map((link: InteractionFriend) => link.friendId);

                if (friendIds.length > 0) {
                    const friendsList = await database.get<FriendModel>('friends')
                        .query(Q.where('id', Q.oneOf(friendIds)))
                        .fetch();
                    setFriends(friendsList);
                }
            } catch (error) {
                console.error('Error loading friends for plan:', error);
            } finally {
                setLoading(false);
            }
        };

        loadFriends();
    }, [plan]);

    // Helper for date text
    const getDaysText = (days: number) => {
        if (days === 0) return 'Today';
        if (days === 1) return 'Tomorrow';
        return `${days}d`;
    };

    const friendName = friends.map(f => f.name).join(', ');
    const dateText = getDaysText(differenceInDays(new Date(), plan.interactionDate));
    const timeText = format(plan.interactionDate, 'h:mm a');
    const categoryData = plan.interactionCategory
        ? getCategoryMetadata(plan.interactionCategory as InteractionCategory)
        : null;
    const displayTitle = plan.title || categoryData?.label || plan.activity;

    return (
        <View style={styles.planCard}>
            <View style={styles.planHeader}>
                <Calendar size={18} color="rgba(255, 255, 255, 0.9)" />
                <View style={styles.planContent}>
                    <Text style={styles.planTitle}>
                        {displayTitle}
                    </Text>
                    <Text style={styles.planSubtitle}>
                        {loading ? 'Loading...' : `${friendName} · ${timeText} · ${dateText}`}
                    </Text>
                </View>
            </View>
            <View style={styles.planActions}>
                {plan.status === 'completed' ? (
                    <View style={[styles.confirmButton, { backgroundColor: 'rgba(16, 185, 129, 0.2)', opacity: 1 }]}>
                        <CheckCircle2 size={14} color="#34D399" />
                        <Text style={[styles.confirmButtonText, { color: '#34D399' }]}>Confirmed</Text>
                    </View>
                ) : (
                    <>
                        <TouchableOpacity
                            style={styles.confirmButton}
                            onPress={() => onConfirm(plan.id)}
                        >
                            <CheckCircle2 size={14} color="#FFFFFF" />
                            <Text style={styles.confirmButtonText}>Confirm</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.rescheduleButton}
                            onPress={() => onReschedule({ interaction: plan, friends: { fetch: async () => friends } })}
                        >
                            <Text style={styles.rescheduleButtonText}>
                                Reschedule
                            </Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    planCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
    },
    planHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    planContent: {
        marginLeft: 10,
        flex: 1,
    },
    planTitle: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    planSubtitle: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 13,
    },
    planActions: {
        flexDirection: 'row',
        gap: 8,
    },
    confirmButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 8,
        borderRadius: 8,
        gap: 6,
    },
    confirmButtonText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
    },
    rescheduleButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        paddingVertical: 8,
        borderRadius: 8,
    },
    rescheduleButtonText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 13,
        fontWeight: '500',
    },
});
