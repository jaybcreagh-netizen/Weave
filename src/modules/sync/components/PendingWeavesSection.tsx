/**
 * PendingWeavesSection
 * 
 * Shows pending incoming shared weaves from a specific friend at the top of their profile.
 * Uses SharedWeaveCard for consistent styling with the inbox.
 */

import React from 'react';
import { View } from 'react-native';
import { Text } from '@/shared/ui';
import { useTheme } from '@/shared/hooks/useTheme';
import { SharedWeaveCard, type SharedWeaveData } from '@/modules/sync/components/SharedWeaveCard';
import { Bell } from 'lucide-react-native';

interface PendingWeavesSectionProps {
    pendingWeaves: SharedWeaveData[];
    onAccept: (weaveId: string) => Promise<void>;
    onDecline: (weaveId: string) => Promise<void>;
    processingId: string | null;
    friendName: string;
}

export function PendingWeavesSection({
    pendingWeaves,
    onAccept,
    onDecline,
    processingId,
    friendName
}: PendingWeavesSectionProps) {
    const { colors } = useTheme();

    if (pendingWeaves.length === 0) return null;

    return (
        <View className="px-5 pt-2 pb-4">
            {/* Section Header */}
            <View className="flex-row items-center gap-2 mb-3">
                <View
                    className="w-6 h-6 rounded-full items-center justify-center"
                    style={{ backgroundColor: '#F59E0B20' }}
                >
                    <Bell size={14} color="#F59E0B" />
                </View>
                <Text
                    className="text-sm font-semibold"
                    style={{ color: colors.foreground }}
                >
                    Pending from {friendName}
                </Text>
                <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: '#F59E0B20' }}
                >
                    <Text
                        className="text-xs font-medium"
                        style={{ color: '#F59E0B' }}
                    >
                        {pendingWeaves.length}
                    </Text>
                </View>
            </View>

            {/* Pending Weave Cards */}
            {pendingWeaves.map((weave) => (
                <SharedWeaveCard
                    key={weave.id}
                    weave={weave}
                    onAccept={onAccept}
                    onDecline={onDecline}
                    isProcessing={processingId === weave.id}
                />
            ))}
        </View>
    );
}
