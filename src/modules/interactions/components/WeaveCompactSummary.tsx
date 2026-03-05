import React from 'react';
import { View, ScrollView } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Icon } from '@/shared/ui/Icon';
import { useTheme } from '@/shared/hooks/useTheme';
import { format } from 'date-fns';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { InteractionCategory } from '@/shared/types/legacy-types';
import Interaction from '@/db/models/Interaction';
import FriendModel from '@/db/models/Friend';

interface WeaveCompactSummaryProps {
    interaction: Interaction;
    friends: FriendModel[];
}

const VIBE_DISPLAY: Record<string, { icon: string; label: string }> = {
    FullMoon: { icon: 'Sun', label: 'Full moon' },
    WaxingGibbous: { icon: 'Sparkles', label: 'Bright' },
    FirstQuarter: { icon: 'Moon', label: 'Balanced' },
    WaxingCrescent: { icon: 'CloudMoon', label: 'Quiet' },
    NewMoon: { icon: 'Cloud', label: 'Low' },
};

export const WeaveCompactSummary: React.FC<WeaveCompactSummaryProps> = ({
    interaction,
    friends
}) => {
    const { colors } = useTheme();

    const categoryResult = interaction.interactionCategory
        ? getCategoryMetadata(interaction.interactionCategory as InteractionCategory)
        : null;

    const hasRange = !!interaction.endDate && new Date(interaction.endDate).getTime() > new Date(interaction.interactionDate).getTime();
    const formattedDate = hasRange
        ? `${format(interaction.interactionDate, 'MMM d')} - ${format(new Date(interaction.endDate!), 'MMM d')}`
        : format(interaction.interactionDate, 'MMM d');
    const vibeInfo = interaction.vibe ? VIBE_DISPLAY[interaction.vibe] : null;

    const friendLabel = friends.length <= 2
        ? friends.map(f => f.name.split(' ')[0]).join(' & ')
        : `${friends[0].name.split(' ')[0]} & ${friends.length - 1} others`;

    return (
        <View
            className="px-5 py-3"
            style={{ backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }}
        >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row items-center gap-2.5">
                    {/* Stacked friend avatars */}
                    <View className="flex-row" style={{ marginRight: friends.length > 1 ? -4 : 0 }}>
                        {friends.slice(0, 3).map((friend, index) => (
                            <View
                                key={friend.id}
                                className="w-7 h-7 rounded-full items-center justify-center"
                                style={{
                                    backgroundColor: colors.primary + '15',
                                    borderWidth: 2,
                                    borderColor: colors.card,
                                    marginLeft: index > 0 ? -8 : 0,
                                    zIndex: friends.length - index,
                                }}
                            >
                                <Text
                                    variant="caption"
                                    style={{ color: colors.primary, fontSize: 10, fontWeight: '700' }}
                                >
                                    {friend.name.charAt(0)}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Friend name(s) */}
                    <Text
                        variant="caption"
                        weight="medium"
                        style={{ color: colors.foreground }}
                    >
                        {friendLabel}
                    </Text>

                    <View className="w-0.5 h-3 rounded-full" style={{ backgroundColor: colors.border }} />

                    {/* Category pill */}
                    {categoryResult && (
                        <View
                            className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <Icon name={categoryResult.icon as any} size={11} color={colors['muted-foreground']} />
                            <Text
                                variant="caption"
                                style={{ color: colors['muted-foreground'], fontSize: 11 }}
                            >
                                {categoryResult.label}
                            </Text>
                        </View>
                    )}

                    {/* Vibe pill */}
                    {vibeInfo && (
                        <View
                            className="flex-row items-center gap-1 px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <Icon name={vibeInfo.icon as any} size={11} color={colors['muted-foreground']} />
                            <Text
                                variant="caption"
                                style={{ color: colors['muted-foreground'], fontSize: 11 }}
                            >
                                {vibeInfo.label}
                            </Text>
                        </View>
                    )}

                    <View className="w-0.5 h-3 rounded-full" style={{ backgroundColor: colors.border }} />

                    {/* Date */}
                    <Text
                        variant="caption"
                        style={{ color: colors['muted-foreground'] }}
                    >
                        {formattedDate}
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};
