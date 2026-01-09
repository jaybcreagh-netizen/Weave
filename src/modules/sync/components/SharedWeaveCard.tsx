/**
 * SharedWeaveCard
 * 
 * Card component displaying an incoming shared weave from another user.
 * Shows weave details and accept/decline actions.
 */

import React from 'react';
import { View, TouchableOpacity, Image } from 'react-native';
import { Check, X, Calendar, MapPin, User } from 'lucide-react-native';
import { format } from 'date-fns';

import { Text } from '@/shared/ui';
import { useTheme } from '@/shared/hooks/useTheme';
import { getCategoryMetadata } from '@/shared/constants/interaction-categories';
import { type InteractionCategory } from '@/shared/types/legacy-types';

export interface SharedWeaveData {
    id: string; // server shared_weave_id
    creatorUserId: string;
    creatorName: string;
    creatorAvatarUrl?: string;
    weaveDate: Date;
    title?: string;
    location?: string;
    category: string;
    duration?: string;
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    sharedAt: Date;
}

interface SharedWeaveCardProps {
    weave: SharedWeaveData;
    onAccept?: (weaveId: string) => void;
    onDecline?: (weaveId: string) => void;
    isProcessing?: boolean;
}

export function SharedWeaveCard({
    weave,
    onAccept,
    onDecline,
    isProcessing = false
}: SharedWeaveCardProps) {
    const { colors } = useTheme();

    const categoryMeta = getCategoryMetadata(weave.category as InteractionCategory);
    const categoryIcon = categoryMeta?.icon || '📅';
    const categoryLabel = categoryMeta?.label || weave.category;

    const isPending = weave.status === 'pending';

    return (
        <View
            className="rounded-2xl p-4 mb-3"
            style={{
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
            }}
        >
            {/* Header - Creator info */}
            <View className="flex-row items-center gap-2 mb-3">
                {weave.creatorAvatarUrl ? (
                    <Image
                        source={{ uri: weave.creatorAvatarUrl }}
                        className="w-8 h-8 rounded-full"
                        style={{ backgroundColor: colors.muted }}
                    />
                ) : (
                    <View
                        className="w-8 h-8 rounded-full items-center justify-center"
                        style={{ backgroundColor: colors.primary + '20' }}
                    >
                        <User size={16} color={colors.primary} />
                    </View>
                )}
                <View className="flex-1">
                    <Text
                        className="font-semibold"
                        style={{ color: colors.foreground }}
                    >
                        {weave.creatorName}
                    </Text>
                    <Text
                        className="text-xs"
                        style={{ color: colors['muted-foreground'] }}
                    >
                        shared {format(weave.sharedAt, 'MMM d')} at {format(weave.sharedAt, 'h:mm a')}
                    </Text>
                </View>
            </View>

            {/* Weave Details */}
            <View
                className="rounded-xl p-3 mb-3"
                style={{ backgroundColor: colors.muted }}
            >
                <View className="flex-row items-center gap-2 mb-2">
                    <Text className="text-xl">{categoryIcon}</Text>
                    <Text
                        className="font-semibold flex-1"
                        style={{ color: colors.foreground }}
                    >
                        {weave.title || categoryLabel}
                    </Text>
                </View>

                <View className="flex-row items-center gap-4">
                    <View className="flex-row items-center gap-1">
                        <Calendar size={14} color={colors['muted-foreground']} />
                        <Text
                            className="text-sm"
                            style={{ color: colors['muted-foreground'] }}
                        >
                            {format(weave.weaveDate, 'EEE, MMM d')}
                        </Text>
                    </View>

                    {weave.location && (
                        <View className="flex-row items-center gap-1">
                            <MapPin size={14} color={colors['muted-foreground']} />
                            <Text
                                className="text-sm"
                                style={{ color: colors['muted-foreground'] }}
                                numberOfLines={1}
                            >
                                {weave.location}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Action Buttons - Only show for pending */}
            {isPending && onAccept && onDecline && (
                <View className="flex-row gap-2">
                    <TouchableOpacity
                        className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl"
                        style={{
                            backgroundColor: colors.destructive + '15',
                            opacity: isProcessing ? 0.5 : 1,
                        }}
                        onPress={() => onDecline(weave.id)}
                        disabled={isProcessing}
                    >
                        <X size={18} color={colors.destructive} />
                        <Text
                            className="font-medium"
                            style={{ color: colors.destructive }}
                        >
                            Decline
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl"
                        style={{
                            backgroundColor: colors.primary,
                            opacity: isProcessing ? 0.5 : 1,
                        }}
                        onPress={() => onAccept(weave.id)}
                        disabled={isProcessing}
                    >
                        <Check size={18} color={colors['primary-foreground']} />
                        <Text
                            className="font-medium"
                            style={{ color: colors['primary-foreground'] }}
                        >
                            Accept
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Status indicator for non-pending */}
            {!isPending && (
                <View
                    className="flex-row items-center justify-center gap-2 py-2 rounded-xl"
                    style={{
                        backgroundColor: weave.status === 'accepted' ? '#dcfce7' : colors.muted,
                    }}
                >
                    <Text
                        className="text-sm font-medium"
                        style={{
                            color: weave.status === 'accepted' ? '#166534' : colors['muted-foreground'],
                        }}
                    >
                        {weave.status === 'accepted' ? '✓ Added to your weaves' :
                            weave.status === 'declined' ? 'Declined' : 'Expired'}
                    </Text>
                </View>
            )}
        </View>
    );
}
