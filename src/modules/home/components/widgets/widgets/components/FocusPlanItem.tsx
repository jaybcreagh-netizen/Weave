import React from 'react';
import { View, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { withObservables } from '@nozbe/watermelondb/react';
import { format } from 'date-fns';
import { Check, Sparkles, Clock } from 'lucide-react-native';

import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';
import { useTheme } from '@/shared/hooks/useTheme';
import { ListItem } from '@/shared/ui/ListItem';
import { getCategoryLabel } from '@/modules/interactions';
import { groupService } from '@/modules/groups';
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
    const { tokens } = useTheme();

    // We can't easily get the specific friends for this interaction without an async call or passing them in.
    // The parent (TodaysFocusWidgetV2) was doing this via a map. 
    // Ideally, we observe interaction.interactionFriends, but that requires another HOC or logic.
    // For now, let's rely on the parent passing the *relevant* friends, OR we just trust the parent passes the right friends list 
    // and we filter? No, that's inefficient. 
    // Let's assume the parent deals with finding the friend for the nickname for now, 
    // OR we can make this component responsible for fetching its friends?
    // WatermelonDB 'Best Practice' is to observe the children.

    // Let's stick to the current pattern where parent knows the friends, but wait, 
    // the parent `friends` prop is ALL friends.
    // We need to know WHICH friends are in this interaction.
    // We can observe `interaction.interactionFriends`.

    // However, to keep it simple and fix the REACTIVITY of the interaction status/reflection first:
    // We will assume the parent passes the ALL friends list and we might need to look up.
    // Actually, `TodaysFocusWidgetV2` did a complex map lookup. 
    // To minimize refactor risk, let's accept `planFriends` as a prop?
    // But `planFriends` changes if `interactionFriends` changes (rare).
    // The main issue is `interaction` properties changing.

    // Let's try to just use the props passed from parent for friends to avoid async complexity here,
    // provided the parent handles that matching. 
    // BUT, the parent's matching was async `useEffect`.
    // If we want this item to be self-contained, it should probably observe its friends.
    // Let's Stick to checking `interaction` fields first.

    // We'll filter `friends` (all friends) by finding who is in this interaction? 
    // Identifying friends solely by ID from `interaction_friends` table requires async lookup usually.
    // Let's rely on parent passing `friendIds` or `planFriends` for now.

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
        if (planFriends.length === 2) return `${planFriends[0].name} & ${planFriends[1].name}`;
        return `${planFriends[0].name} and ${planFriends.length - 1} more`;
    }, [planFriends, groupName]);

    const subtitle = `${displayNames ? `with ${displayNames} • ` : ''}${format(new Date(interaction.interactionDate), 'h:mm a')}`;
    const categoryLabel = getCategoryLabel(interaction.interactionCategory ?? undefined);

    const isReflected = interaction.reflectionJSON || interaction.reflection;

    return (
        <View style={{ paddingHorizontal: 16 }}>
            <ListItem
                title={interaction.title || `${categoryLabel}${displayNames ? ` with ${displayNames}` : ''}`}
                subtitle={subtitle}
                // showDivider handled by parent usually? We'll leave it simple for now or pass index.
                // Replicating parent behavior:
                trailing={
                    <View style={styles.actions}>
                        {isCompletedSection ? (
                            <TouchableOpacity
                                onPress={() => onDeepen?.(interaction)}
                                style={[styles.iconBtn, {
                                    backgroundColor: isReflected
                                        ? tokens.success + '15'
                                        : tokens.primary + '15'
                                }]}
                            >
                                {isReflected ? (
                                    <Check size={18} color={tokens.success} />
                                ) : (
                                    <Sparkles size={18} color={tokens.primary} />
                                )}
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={() => onReschedule?.(interaction)}
                                style={[styles.iconBtn, { backgroundColor: tokens.primary + '20' }]}
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

const styles = StyleSheet.create({
    actions: {
        flexDirection: 'row',
    },
    iconBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
});

import { map } from 'rxjs/operators';

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
