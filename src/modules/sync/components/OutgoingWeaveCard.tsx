/**
 * OutgoingWeaveCard
 * 
 * Card component for displaying an outgoing (sent) shared weave.
 * Shows sync status and retry button for failed items.
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Send, CheckCircle2, AlertCircle, Loader2, RefreshCw, Calendar, MapPin } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { Text } from '@/shared/ui';
import { useTheme } from '@/shared/hooks/useTheme';
import { OutgoingWeave } from '../hooks/useOutgoingWeaves';

interface OutgoingWeaveCardProps {
    weave: OutgoingWeave;
    onRetry?: (weave: OutgoingWeave) => void;
}

export function OutgoingWeaveCard({ weave, onRetry }: OutgoingWeaveCardProps) {
    const { colors } = useTheme();

    const getStatusConfig = () => {
        switch (weave.status) {
            case 'synced':
                return {
                    icon: CheckCircle2,
                    color: colors.success || '#22c55e',
                    label: 'Sent',
                    bgColor: (colors.success || '#22c55e') + '15',
                };
            case 'syncing':
                return {
                    icon: Loader2,
                    color: colors.primary,
                    label: 'Syncing...',
                    bgColor: colors.primary + '15',
                };
            case 'failed':
                return {
                    icon: AlertCircle,
                    color: colors.destructive,
                    label: 'Failed',
                    bgColor: colors.destructive + '15',
                };
            case 'pending':
            default:
                return {
                    icon: Send,
                    color: colors['muted-foreground'],
                    label: 'Pending',
                    bgColor: colors.muted,
                };
        }
    };

    const status = getStatusConfig();
    const StatusIcon = status.icon;

    const handleRetry = () => {
        if (onRetry) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onRetry(weave);
        }
    };

    const formatDate = (date?: Date) => {
        if (!date) return '';
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
        <View
            className="p-4 rounded-xl mb-3"
            style={{ backgroundColor: colors.card }}
        >
            <View className="flex-row items-start justify-between">
                <View className="flex-1">
                    {/* Title */}
                    <Text
                        className="font-semibold text-base"
                        style={{ color: colors.foreground }}
                        numberOfLines={1}
                    >
                        {weave.title || weave.category || 'Shared Weave'}
                    </Text>

                    {/* Date */}
                    {weave.weaveDate && (
                        <View className="flex-row items-center gap-1 mt-1">
                            <Calendar size={12} color={colors['muted-foreground']} />
                            <Text
                                className="text-xs"
                                style={{ color: colors['muted-foreground'] }}
                            >
                                {formatDate(weave.weaveDate)}
                            </Text>
                        </View>
                    )}
                </View>

                {/* Status Badge */}
                <View
                    className="flex-row items-center gap-1 px-2 py-1 rounded-full"
                    style={{ backgroundColor: status.bgColor }}
                >
                    <StatusIcon size={12} color={status.color} />
                    <Text
                        className="text-xs font-medium"
                        style={{ color: status.color }}
                    >
                        {status.label}
                    </Text>
                </View>
            </View>

            {/* Error message for failed items */}
            {weave.status === 'failed' && weave.error && (
                <View className="mt-2 p-2 rounded-lg" style={{ backgroundColor: colors.destructive + '10' }}>
                    <Text
                        className="text-xs"
                        style={{ color: colors.destructive }}
                        numberOfLines={2}
                    >
                        {weave.error}
                    </Text>
                </View>
            )}

            {/* Retry button for failed items */}
            {weave.status === 'failed' && onRetry && (
                <TouchableOpacity
                    className="flex-row items-center justify-center gap-2 mt-3 py-2 rounded-lg"
                    style={{ backgroundColor: colors.primary + '15' }}
                    onPress={handleRetry}
                    activeOpacity={0.7}
                >
                    <RefreshCw size={14} color={colors.primary} />
                    <Text
                        className="text-sm font-medium"
                        style={{ color: colors.primary }}
                    >
                        Retry
                    </Text>
                </TouchableOpacity>
            )}
        </View>
    );
}
