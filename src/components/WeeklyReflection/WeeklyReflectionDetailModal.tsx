import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Activity, Heart, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { format } from 'date-fns';
import { STORY_CHIPS } from '@/modules/reflection';

interface WeeklyReflectionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    reflection: WeeklyReflection | null;
}

export function WeeklyReflectionDetailModal({ isOpen, onClose, reflection }: WeeklyReflectionDetailModalProps) {
    const { colors } = useTheme();

    if (!reflection) return null;

    const formatDateRange = (start: number, end: number) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
    };

    return (
        <StandardBottomSheet
            visible={isOpen}
            onClose={onClose}
            height="full"
            title="Weekly Reflection"
        >
            {/* Date Range Subtitle */}
            <View className="px-5 pb-3" style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text
                    className="text-sm"
                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_400Regular' }}
                >
                    {formatDateRange(reflection.weekStartDate, reflection.weekEndDate)}
                </Text>
            </View>

            <ScrollView className="flex-1 px-5 py-6" showsVerticalScrollIndicator={false}>
                    {/* Stats Grid */}
                    <View className="flex-row flex-wrap gap-3 mb-8">
                        <View className="flex-1 min-w-[45%] p-4 rounded-2xl" style={{ backgroundColor: colors.muted }}>
                            <View className="flex-row items-center gap-2 mb-2">
                                <Activity size={16} color={colors.primary} />
                                <Text className="text-xs font-medium" style={{ color: colors['muted-foreground'] }}>Total Weaves</Text>
                            </View>
                            <Text className="text-2xl font-bold" style={{ color: colors.foreground }}>{reflection.totalWeaves}</Text>
                        </View>

                        <View className="flex-1 min-w-[45%] p-4 rounded-2xl" style={{ backgroundColor: colors.muted }}>
                            <View className="flex-row items-center gap-2 mb-2">
                                <Users size={16} color={colors.primary} />
                                <Text className="text-xs font-medium" style={{ color: colors['muted-foreground'] }}>Friends Contacted</Text>
                            </View>
                            <Text className="text-2xl font-bold" style={{ color: colors.foreground }}>{reflection.friendsContacted}</Text>
                        </View>

                        {reflection.topActivity && (
                            <View className="w-full p-4 rounded-2xl" style={{ backgroundColor: colors.muted }}>
                                <View className="flex-row items-center gap-2 mb-2">
                                    <Heart size={16} color={colors.primary} />
                                    <Text className="text-xs font-medium" style={{ color: colors['muted-foreground'] }}>Top Activity</Text>
                                </View>
                                <Text className="text-lg font-medium" style={{ color: colors.foreground }}>
                                    {reflection.topActivity} <Text style={{ color: colors['muted-foreground'] }}>({reflection.topActivityCount})</Text>
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Gratitude Section */}
                    <View className="mb-8">
                        <Text
                            className="text-sm font-medium mb-3 uppercase tracking-wider"
                            style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
                        >
                            Reflection
                        </Text>

                        <View className="p-5 rounded-2xl" style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                            <Text
                                className="text-base font-medium mb-3"
                                style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                            >
                                {reflection.gratitudePrompt || "What are you grateful for this week?"}
                            </Text>
                            <Text
                                className="text-base leading-relaxed"
                                style={{ color: colors.foreground, fontFamily: 'Lora_400Regular' }}
                            >
                                {reflection.gratitudeText || "No entry written."}
                            </Text>
                        </View>
                    </View>

                    {/* Story Chips */}
                    {reflection.storyChips.length > 0 && (
                        <View className="mb-8">
                            <View className="flex-row items-center gap-2 mb-3">
                                <Sparkles size={16} color={colors.primary} />
                                <Text
                                    className="text-sm font-medium uppercase tracking-wider"
                                    style={{ color: colors['muted-foreground'], fontFamily: 'Inter_600SemiBold' }}
                                >
                                    Highlights
                                </Text>
                            </View>

                            <View className="flex-row flex-wrap gap-2">
                                {reflection.storyChips.map((chipData, index) => {
                                    const chipDef = STORY_CHIPS.find(c => c.id === chipData.chipId);
                                    if (!chipDef) return null;

                                    return (
                                        <View
                                            key={index}
                                            className="px-3 py-1.5 rounded-full"
                                            style={{ backgroundColor: colors.primary + '15' }}
                                        >
                                            <Text
                                                className="text-sm"
                                                style={{ color: colors.primary, fontFamily: 'Inter_500Medium' }}
                                            >
                                                {chipDef.plainText}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* Footer Info */}
                    <View className="items-center mt-4 mb-8">
                        <Text className="text-xs" style={{ color: colors['muted-foreground'] }}>
                            Completed on {format(new Date(reflection.completedAt), 'MMMM d, yyyy')}
                        </Text>
                </View>
            </ScrollView>
        </StandardBottomSheet>
    );
}
