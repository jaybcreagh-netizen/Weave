/**
 * DayDetailSheet Component
 * Shows detailed information for a selected day including energy, weaves, and quick actions
 */

import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { X, Zap, Users, Plus, Calendar, ChevronRight } from 'lucide-react-native';
import { format } from 'date-fns';
import Animated, { FadeInDown, SlideInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/shared/hooks/useTheme';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { MoonPhaseIllustration } from '@/modules/intelligence/components/social-season/YearInMoons/MoonPhaseIllustration';

export interface DayWeave {
    id: string;
    title: string;
    activity?: string;
    status: 'completed' | 'planned';
    time?: string;
    friends: { id: string; name: string }[];
    vibeRating?: number;
}

export interface DayDetailData {
    date: Date;
    batteryLevel: number | null;
    batteryNote?: string;
    weaves: DayWeave[];
}

interface DayDetailSheetProps {
    isVisible: boolean;
    onClose: () => void;
    data: DayDetailData | null;
    onLogWeave: (date: Date) => void;
    onCheckIn: (date: Date) => void;
    onViewWeave?: (weaveId: string) => void;
}

const ENERGY_LABELS: Record<number, string> = {
    1: 'Depleted',
    2: 'Low',
    3: 'Balanced',
    4: 'Good',
    5: 'High',
};

export function DayDetailSheet({
    isVisible,
    onClose,
    data,
    onLogWeave,
    onCheckIn,
    onViewWeave,
}: DayDetailSheetProps) {
    const { tokens } = useTheme();

    if (!data) return null;

    const handleLogWeave = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLogWeave(data.date);
        onClose();
    };

    const handleCheckIn = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Close the sheet first
        onClose();
        // Wait for modal to close before triggering battery sheet
        // This prevents two modals from transitioning simultaneously
        setTimeout(() => {
            onCheckIn(data.date);
        }, 300);
    };

    const completedWeaves = data.weaves.filter((w) => w.status === 'completed');
    const plannedWeaves = data.weaves.filter((w) => w.status === 'planned');

    return (
        <AnimatedBottomSheet
            visible={isVisible}
            onClose={onClose}
            height="form"
            scrollable
        >
            {/* Header */}
            <Text
                className="text-xl font-lora-bold mb-4"
                style={{ color: tokens.foreground }}
            >
                {format(data.date, 'EEEE, MMMM d')}
            </Text>

            {/* Energy Section */}
            <Animated.View entering={FadeInDown.delay(100).springify()}>
                <Card padding="md" className="mb-4">
                    <View className="flex-row items-center">
                        <View className="mr-4">
                            <MoonPhaseIllustration
                                phase={0}
                                batteryLevel={data.batteryLevel ?? undefined}
                                size={60}
                                hasCheckin={data.batteryLevel !== null}
                            />
                        </View>
                        <View className="flex-1">
                            <View className="flex-row items-center gap-2 mb-1">
                                <Zap size={16} color={tokens.primary} />
                                <Text
                                    className="text-base font-inter-semibold"
                                    style={{ color: tokens.foreground }}
                                >
                                    Energy
                                </Text>
                            </View>
                            {data.batteryLevel !== null ? (
                                <>
                                    <Text
                                        className="text-2xl font-lora-bold"
                                        style={{ color: tokens.foreground }}
                                    >
                                        {data.batteryLevel}/5
                                    </Text>
                                    <Text
                                        className="text-sm font-inter"
                                        style={{ color: tokens.foregroundMuted }}
                                    >
                                        {ENERGY_LABELS[data.batteryLevel]}
                                    </Text>
                                </>
                            ) : (
                                <Text
                                    className="text-sm font-inter"
                                    style={{ color: tokens.foregroundMuted }}
                                >
                                    No check-in recorded
                                </Text>
                            )}
                        </View>
                    </View>
                    {data.batteryNote && (
                        <View
                            className="mt-3 pt-3"
                            style={{ borderTopWidth: 1, borderTopColor: tokens.border }}
                        >
                            <Text
                                className="text-sm font-inter italic"
                                style={{ color: tokens.foregroundMuted }}
                            >
                                "{data.batteryNote}"
                            </Text>
                        </View>
                    )}
                </Card>
            </Animated.View>

            {/* Connections Section */}
            {data.weaves.length > 0 && (
                <Animated.View entering={FadeInDown.delay(200).springify()}>
                    <View className="flex-row items-center gap-2 mb-3">
                        <Users size={16} color={tokens.primary} />
                        <Text
                            className="text-base font-inter-semibold"
                            style={{ color: tokens.foreground }}
                        >
                            Connections
                        </Text>
                    </View>

                    <Card padding="none" className="mb-4">
                        {completedWeaves.map((weave, index) => (
                            <TouchableOpacity
                                key={weave.id}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onViewWeave?.(weave.id);
                                }}
                                activeOpacity={0.7}
                                className="flex-row items-center px-4 py-3"
                                style={{
                                    borderBottomWidth:
                                        index < completedWeaves.length - 1 || plannedWeaves.length > 0
                                            ? 1
                                            : 0,
                                    borderBottomColor: tokens.border,
                                }}
                            >
                                <View
                                    className="w-2 h-2 rounded-full mr-3"
                                    style={{ backgroundColor: tokens.success }}
                                />
                                <View className="flex-1">
                                    <Text
                                        className="text-base font-inter-medium"
                                        style={{ color: tokens.foreground }}
                                        numberOfLines={1}
                                    >
                                        {weave.title || weave.activity || 'Weave'}
                                    </Text>
                                    <Text
                                        className="text-sm font-inter"
                                        style={{ color: tokens.foregroundMuted }}
                                        numberOfLines={1}
                                    >
                                        {weave.friends.map((f) => f.name).join(', ')}
                                        {weave.vibeRating ? ` · ✨ ${weave.vibeRating}/5` : ''}
                                    </Text>
                                </View>
                                <ChevronRight size={18} color={tokens.foregroundMuted} />
                            </TouchableOpacity>
                        ))}

                        {plannedWeaves.map((weave, index) => (
                            <TouchableOpacity
                                key={weave.id}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    onViewWeave?.(weave.id);
                                }}
                                activeOpacity={0.7}
                                className="flex-row items-center px-4 py-3"
                                style={{
                                    borderBottomWidth: index < plannedWeaves.length - 1 ? 1 : 0,
                                    borderBottomColor: tokens.border,
                                }}
                            >
                                <View
                                    className="w-2 h-2 rounded-full mr-3"
                                    style={{
                                        backgroundColor: 'transparent',
                                        borderWidth: 1.5,
                                        borderColor: tokens.primary,
                                    }}
                                />
                                <View className="flex-1">
                                    <Text
                                        className="text-base font-inter-medium"
                                        style={{ color: tokens.foreground }}
                                        numberOfLines={1}
                                    >
                                        {weave.title || weave.activity || 'Planned Weave'}
                                    </Text>
                                    <Text
                                        className="text-sm font-inter"
                                        style={{ color: tokens.foregroundMuted }}
                                        numberOfLines={1}
                                    >
                                        {weave.friends.map((f) => f.name).join(', ')}
                                        {weave.time ? ` · ${weave.time}` : ''}
                                    </Text>
                                </View>
                                <ChevronRight size={18} color={tokens.foregroundMuted} />
                            </TouchableOpacity>
                        ))}
                    </Card>
                </Animated.View>
            )}

            {/* Quick Actions */}
            <Animated.View
                entering={FadeInDown.delay(300).springify()}
                className="flex-row gap-3 mt-2"
            >
                <Button
                    label="Log Weave"
                    onPress={handleLogWeave}
                    variant="outline"
                    size="md"
                    icon={<Plus size={16} color={tokens.foreground} />}
                    className="flex-1"
                />
                {data.batteryLevel === null && (
                    <Button
                        label="Check In"
                        onPress={handleCheckIn}
                        variant="primary"
                        size="md"
                        icon={<Zap size={16} color={tokens.primaryForeground} />}
                        className="flex-1"
                    />
                )}
            </Animated.View>
        </AnimatedBottomSheet>
    );
}
