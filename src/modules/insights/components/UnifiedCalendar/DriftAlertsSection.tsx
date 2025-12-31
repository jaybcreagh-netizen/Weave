/**
 * DriftAlertsSection Component
 * Shows friends who are drifting (need attention) - only appears when there are alerts
 */

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { AlertCircle, Calendar, ChevronRight } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/shared/hooks/useTheme';
import { Card } from '@/shared/ui/Card';
import { DriftAlert } from '@/modules/insights/services/drift-detection.service';

interface DriftAlertsSectionProps {
    alerts: DriftAlert[];
    onPlanWeave: (friendId: string, friendName: string) => void;
    onViewFriend: (friendId: string) => void;
}

const TIER_LABELS = {
    InnerCircle: 'Inner Circle',
    CloseFriends: 'Close Friends',
    Community: 'Community',
};

export function DriftAlertsSection({
    alerts,
    onPlanWeave,
    onViewFriend,
}: DriftAlertsSectionProps) {
    const { tokens } = useTheme();

    // Only render if there are alerts
    if (alerts.length === 0) {
        return null;
    }

    const handlePlanWeave = (alert: DriftAlert) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPlanWeave(alert.friendId, alert.friendName);
    };

    return (
        <Animated.View
            entering={FadeInDown.duration(400).springify()}
            className="px-4 mb-4"
        >
            {/* Section Header */}
            <View className="flex-row items-center gap-2 mb-3">
                <AlertCircle size={18} color={tokens.warning} />
                <Text
                    className="text-base font-inter-semibold"
                    style={{ color: tokens.foreground }}
                >
                    Needs Attention
                </Text>
                <View
                    className="px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: tokens.warning + '20' }}
                >
                    <Text
                        className="text-xs font-inter-medium"
                        style={{ color: tokens.warning }}
                    >
                        {alerts.length}
                    </Text>
                </View>
            </View>

            {/* Alert Cards */}
            <Card padding="none">
                {alerts.slice(0, 5).map((alert, index) => (
                    <TouchableOpacity
                        key={alert.friendId}
                        onPress={() => onViewFriend(alert.friendId)}
                        className="flex-row items-center px-4 py-3"
                        style={{
                            borderBottomWidth: index < Math.min(alerts.length - 1, 4) ? 1 : 0,
                            borderBottomColor: tokens.border,
                        }}
                    >
                        {/* Status Indicator */}
                        <View
                            className="w-2.5 h-2.5 rounded-full mr-3"
                            style={{
                                backgroundColor:
                                    alert.status === 'alert' ? tokens.destructive : tokens.warning,
                            }}
                        />

                        {/* Friend Info */}
                        <View className="flex-1">
                            <Text
                                className="text-base font-inter-medium"
                                style={{ color: tokens.foreground }}
                            >
                                {alert.friendName}
                            </Text>
                            <Text
                                className="text-sm font-inter"
                                style={{ color: tokens.foregroundMuted }}
                            >
                                {TIER_LABELS[alert.tier]} · Score: {Math.round(alert.weaveScore)}
                            </Text>
                        </View>

                        {/* Quick Action */}
                        <TouchableOpacity
                            onPress={() => handlePlanWeave(alert)}
                            className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg"
                            style={{ backgroundColor: tokens.primary + '15' }}
                        >
                            <Calendar size={14} color={tokens.primary} />
                            <Text
                                className="text-sm font-inter-medium"
                                style={{ color: tokens.primary }}
                            >
                                Plan
                            </Text>
                        </TouchableOpacity>
                    </TouchableOpacity>
                ))}

                {/* Show more if there are many alerts */}
                {alerts.length > 5 && (
                    <TouchableOpacity
                        className="flex-row items-center justify-center py-3"
                        style={{ borderTopWidth: 1, borderTopColor: tokens.border }}
                    >
                        <Text
                            className="text-sm font-inter-medium mr-1"
                            style={{ color: tokens.primary }}
                        >
                            View all {alerts.length} alerts
                        </Text>
                        <ChevronRight size={14} color={tokens.primary} />
                    </TouchableOpacity>
                )}
            </Card>
        </Animated.View>
    );
}
