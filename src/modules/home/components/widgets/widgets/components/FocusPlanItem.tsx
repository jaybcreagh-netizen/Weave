/**
 * FocusPlanItem - Plan/Interaction list item
 * 
 * OPTIMIZATION: Removed withObservables HOC that created 2 observables per item.
 * Now accepts data directly from parent, which should use centralized contexts.
 * This eliminates N*2 subscriptions for N items in a list.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { format } from 'date-fns';
import { Check, Sparkles, Clock, Phone, Mic, Utensils, Users, MessageSquare, PartyPopper, Heart, Activity } from 'lucide-react-native';

import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import InteractionFriend from '@/db/models/InteractionFriend';
import { useTheme } from '@/shared/hooks/useTheme';
import { ListItem } from '@/shared/ui/ListItem';
import { getCategoryLabel } from '@/modules/interactions';
import { groupService } from '@/modules/groups';

const getCategoryIcon = (category: string | null | undefined, size: number, color: string) => {
    switch (category) {
        case 'text-call': return <Phone size={size} color={color} />;
        case 'voice-note': return <Mic size={size} color={color} />;
        case 'meal-drink': return <Utensils size={size} color={color} />;
        case 'hangout': return <Users size={size} color={color} />;
        case 'deep-talk': return <MessageSquare size={size} color={color} />;
        case 'event-party': return <PartyPopper size={size} color={color} />;
        case 'celebration': return <PartyPopper size={size} color={color} />;
        case 'activity-hobby': return <Activity size={size} color={color} />;
        case 'favor-support': return <Heart size={size} color={color} />;
        default: return <Sparkles size={size} color={color} />;
    }
};

interface FocusPlanItemProps {
    interaction: Interaction;
    friends: FriendModel[]; // All friends from context - we filter to participants
    interactionFriends?: InteractionFriend[]; // Optional: pre-fetched join records
    onReschedule?: (plan: Interaction) => void;
    onDeepen?: (plan: Interaction) => void;
    isCompletedSection?: boolean;
}

/**
 * FocusPlanItem - Displays a single plan or completed interaction
 * 
 * Now uses data passed from parent instead of creating per-item observables.
 * Parent should pre-fetch interactionFriends where possible.
 */
export const FocusPlanItem: React.FC<FocusPlanItemProps> = ({
    interaction,
    friends,
    interactionFriends,
    onReschedule,
    onDeepen,
    isCompletedSection = false,
}) => {
    const { tokens } = useTheme();
    const [groupName, setGroupName] = useState<string | null>(null);
    const [planFriends, setPlanFriends] = useState<FriendModel[]>([]);
    const [isLoading, setIsLoading] = useState(!interactionFriends);

    // Fetch interaction friends if not provided
    useEffect(() => {
        let isActive = true;

        const fetchPlanFriends = async () => {
            try {
                let friendIds: string[];

                if (interactionFriends) {
                    // Use pre-fetched data
                    friendIds = interactionFriends.map(iF => iF.friendId);
                } else {
                    // Fallback: fetch from relation (avoids per-item observable)
                    const iFriends = await interaction.interactionFriends.fetch();
                    friendIds = iFriends.map((iF: InteractionFriend) => iF.friendId);
                }

                // Map to friend models from the passed-in friends array
                const matchedFriends = friendIds
                    .map(id => friends.find(f => f.id === id))
                    .filter((f): f is FriendModel => !!f);

                if (isActive) {
                    setPlanFriends(matchedFriends);
                    setIsLoading(false);
                }
            } catch (e) {
                console.warn('Error fetching plan friends:', e);
                if (isActive) setIsLoading(false);
            }
        };

        fetchPlanFriends();

        return () => { isActive = false; };
    }, [interaction.id, interactionFriends, friends]);

    // Check for group match
    useEffect(() => {
        let isActive = true;

        const checkGroupMatch = async () => {
            if (planFriends.length < 2) {
                if (isActive) setGroupName(null);
                return;
            }

            try {
                const groups = await groupService.getGroupsForFriend(planFriends[0].id);
                const planFriendIds = planFriends.map(f => f.id).sort();

                for (const group of groups) {
                    const members = await group.members.fetch();
                    const memberIds = members.map((m: any) => m.friendId).sort();

                    if (memberIds.length === planFriendIds.length &&
                        memberIds.every((id: string, index: number) => id === planFriendIds[index])) {
                        if (isActive) setGroupName(group.name);
                        return;
                    }
                }

                if (isActive) setGroupName(null);
            } catch (e) {
                console.warn('Error checking group match:', e);
                if (isActive) setGroupName(null);
            }
        };

        checkGroupMatch();

        return () => { isActive = false; };
    }, [planFriends]);

    const displayNames = useMemo(() => {
        if (groupName) return groupName;
        if (planFriends.length === 0) return '';
        if (planFriends.length === 1) return planFriends[0].name;
        if (planFriends.length === 2) return `${planFriends[0].name} & ${planFriends[1].name}`;
        return `${planFriends[0].name} and ${planFriends.length - 1} more`;
    }, [planFriends, groupName]);

    const subtitle = `${displayNames ? `with ${displayNames} • ` : ''}${format(new Date(interaction.interactionDate), 'h:mm a')}`;
    const categoryLabel = getCategoryLabel(interaction.interactionCategory ?? undefined);
    const isReflected = interaction.reflectionJSON || interaction.reflection;

    return (
        <View className="px-4">
            <ListItem
                title={interaction.title || `${categoryLabel}${displayNames ? ` with ${displayNames}` : ''}`}
                subtitle={subtitle}
                trailing={
                    <View className="flex-row">
                        {isCompletedSection ? (
                            <TouchableOpacity
                                onPress={() => onDeepen?.(interaction)}
                                className="w-8 h-8 rounded-full items-center justify-center"
                                style={{
                                    backgroundColor: isReflected
                                        ? tokens.success + '15'
                                        : tokens.primary + '15'
                                }}
                            >
                                {isReflected ? (
                                    <Check size={18} color={tokens.success} />
                                ) : (
                                    getCategoryIcon(interaction.interactionCategory, 18, tokens.primary)
                                )}
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={() => onReschedule?.(interaction)}
                                className="w-8 h-8 rounded-full items-center justify-center"
                                style={{ backgroundColor: tokens.primary + '20' }}
                            >
                                <Clock size={18} color={tokens.primary} />
                            </TouchableOpacity>
                        )}
                    </View>
                }
            />
        </View>
    );
};

