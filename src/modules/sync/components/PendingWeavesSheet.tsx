/**
 * PendingWeavesSheet
 * 
 * Bottom sheet showing pending shared weaves from friends.
 */

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Inbox, RefreshCw } from 'lucide-react-native';
import { FlashList } from '@shopify/flash-list';

import { Text } from '@/shared/ui';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { useTheme } from '@/shared/hooks/useTheme';
import { SharedWeaveCard } from './SharedWeaveCard';
import { usePendingWeaves } from '../hooks/usePendingWeaves';
import { TouchableOpacity } from 'react-native';

interface PendingWeavesSheetProps {
    visible: boolean;
    onClose: () => void;
}

export function PendingWeavesSheet({ visible, onClose }: PendingWeavesSheetProps) {
    const { colors } = useTheme();
    const {
        pendingWeaves,
        isLoading,
        error,
        refresh,
        handleAccept,
        handleDecline,
        processingId,
    } = usePendingWeaves();

    // Filter to only show pending
    const actuallyPending = pendingWeaves.filter(w => w.status === 'pending');

    const renderContent = () => {
        if (isLoading) {
            return (
                <View className="flex-1 items-center justify-center py-12">
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text
                        className="mt-3"
                        style={{ color: colors['muted-foreground'] }}
                    >
                        Loading shared weaves...
                    </Text>
                </View>
            );
        }

        if (error) {
            return (
                <View className="flex-1 items-center justify-center py-12 px-6">
                    <Text
                        className="text-center"
                        style={{ color: colors.destructive }}
                    >
                        {error}
                    </Text>
                    <TouchableOpacity
                        className="mt-4 flex-row items-center gap-2"
                        onPress={refresh}
                    >
                        <RefreshCw size={16} color={colors.primary} />
                        <Text style={{ color: colors.primary }}>Try again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (actuallyPending.length === 0) {
            return (
                <View className="flex-1 items-center justify-center py-12">
                    <View
                        className="w-16 h-16 rounded-full items-center justify-center mb-4"
                        style={{ backgroundColor: colors.muted }}
                    >
                        <Inbox size={32} color={colors['muted-foreground']} />
                    </View>
                    <Text
                        className="text-lg font-semibold"
                        style={{ color: colors.foreground }}
                    >
                        No pending weaves
                    </Text>
                    <Text
                        className="text-center mt-1"
                        style={{ color: colors['muted-foreground'] }}
                    >
                        When friends share weaves with you, they'll appear here
                    </Text>
                </View>
            );
        }

        return (
            <FlashList
                data={actuallyPending}
                renderItem={({ item }) => (
                    <SharedWeaveCard
                        weave={item}
                        onAccept={handleAccept}
                        onDecline={handleDecline}
                        isProcessing={processingId === item.id}
                    />
                )}
                estimatedItemSize={180}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 16 }}
            />
        );
    };

    return (
        <StandardBottomSheet
            visible={visible}
            onClose={onClose}
            title="Shared Weaves"
            height="full"
            renderScrollContent={renderContent}
        >
            {null}
        </StandardBottomSheet>
    );
}
