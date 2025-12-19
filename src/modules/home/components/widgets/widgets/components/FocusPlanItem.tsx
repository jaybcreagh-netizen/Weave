
import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { format } from 'date-fns';
import { Check, Sparkles, Clock, Phone, Mic, Utensils, Users, MessageSquare, PartyPopper, Heart, Activity } from 'lucide-react-native';
import { map } from 'rxjs/operators';

import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
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
    friends: FriendModel[];
    onReschedule?: (plan: Interaction) => void;
    onDeepen?: (plan: Interaction) => void;
    isCompletedSection?: boolean;
}

const FocusPlanItemComponent: React.FC<FocusPlanItemProps> = ({
    interaction,
    friends,
    onReschedule,
    onDeepen,
    isCompletedSection = false,
}) => {
    return (
        <EnhancedPlanItem
            interaction={interaction}
            friends={friends}
            onReschedule={onReschedule}
            onDeepen={onDeepen}
            isCompletedSection={isCompletedSection}
        />
    );
};

// Inner component to handle the rendering with observed props
const PlanItemView: React.FC<{
    interaction: Interaction;
    planFriends: FriendModel[];
    onReschedule?: (plan: Interaction) => void;
    onDeepen?: (plan: Interaction) => void;
    isCompletedSection: boolean;
}> = ({ interaction, planFriends, onReschedule, onDeepen, isCompletedSection }) => {
    const { tokens } = useTheme();
    const [groupName, setGroupName] = React.useState<string | null>(null);

    React.useEffect(() => {
        let isActive = true;

        const checkGroupMatch = async () => {
            if (planFriends.length < 2) {
                if (isActive) setGroupName(null);
                return;
            }

            try {
                // Optimization: get groups for the first friend
                const groups = await groupService.getGroupsForFriend(planFriends[0].id);

                // Sort plan friend IDs for comparison
                const planFriendIds = planFriends.map(f => f.id).sort();

                for (const group of groups) {
                    const members = await group.members.fetch();
                    const memberIds = members.map((m: any) => m.friendId).sort();

                    // Check for exact match
                    if (memberIds.length === planFriendIds.length &&
                        memberIds.every((id: string, index: number) => id === planFriendIds[index])) {
                        if (isActive) {
                            setGroupName(group.name);
                        }
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

        return () => {
            isActive = false;
        };
    }, [planFriends]);

    const displayNames = React.useMemo(() => {
        if (groupName) return groupName;
        if (planFriends.length === 0) return '';
        if (planFriends.length === 1) return planFriends[0].name;
        if (planFriends.length === 2) return `${planFriends[0].name} & ${planFriends[1].name} `;
        return `${planFriends[0].name} and ${planFriends.length - 1} more`;
    }, [planFriends, groupName]);

    const subtitle = `${displayNames ? `with ${displayNames} • ` : ''}${format(new Date(interaction.interactionDate), 'h:mm a')} `;
    const categoryLabel = getCategoryLabel(interaction.interactionCategory ?? undefined);

    const isReflected = interaction.reflectionJSON || interaction.reflection;

    return (
        <View className="px-4">
            <ListItem
                title={interaction.title || `${categoryLabel}${displayNames ? ` with ${displayNames}` : ''} `}
                subtitle={subtitle}
                // showDivider handled by parent usually? We'll leave it simple for now or pass index.
                // Replicating parent behavior:
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
}

// The magic: Observing the interaction
const enhance = withObservables(['interaction'], ({ interaction, friends }: FocusPlanItemProps) => ({
    interaction: interaction.observe(),
    planFriends: interaction.interactionFriends.observe().pipe(
        map((iFriends: any[]) => {
            return iFriends.map((iF: any) => friends.find(f => f.id === iF.friendId)).filter((f): f is FriendModel => !!f);
        })
    ),
}));

const EnhancedPlanItem = enhance(PlanItemView);

export const FocusPlanItem = EnhancedPlanItem;
