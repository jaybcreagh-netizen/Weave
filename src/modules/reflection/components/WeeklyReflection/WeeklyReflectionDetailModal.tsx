/**
 * WeeklyReflectionDetailModal
 * 
 * Shows details of a past reflection (history view)
 * Includes week stats, reflection text, and story chips
 */

import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { Quote, Sparkles, BarChart3 } from 'lucide-react-native';
import { format, addDays } from 'date-fns';
import { STORY_CHIPS } from '@/modules/reflection';
import { StatsDetailSheet, StatType } from './StatsDetailSheet';
import * as Haptics from 'expo-haptics';

interface WeeklyReflectionDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    reflection: WeeklyReflection | null;
}

export function WeeklyReflectionDetailModal({ isOpen, onClose, reflection }: WeeklyReflectionDetailModalProps) {
    const { colors } = useTheme();
    const [statsSheetOpen, setStatsSheetOpen] = useState(false);
    const [statsSheetType, setStatsSheetType] = useState<StatType>('weaves');

    if (!reflection) return null;

    // Parse story chips if they are generic objects, handle potential structure differences
    const chipsToDisplay = reflection.storyChips || [];

    // Format week date range
    const weekStart = new Date(reflection.weekStartDate);
    const weekEnd = addDays(weekStart, 6);
    const weekRange = `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;

    const handleStatPress = (type: StatType) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setStatsSheetType(type);
        setStatsSheetOpen(true);
    };

    return (
        <>
            <StandardBottomSheet
                visible={isOpen}
                onClose={onClose}
                title={`Week of ${format(weekStart, 'MMM d')}`}
                snapPoints={['85%']}
                scrollable
            >
                {/* Week Stats Card */}
                <Card className="p-5 mb-6">
                    <View className="flex-row items-center gap-2 mb-4">
                        <BarChart3 size={16} color={colors.primary} />
                        <Text variant="caption" className="font-bold uppercase tracking-wider text-muted-foreground">
                            Week Snapshot
                        </Text>
                    </View>

                    {/* Stats Row - Tappable */}
                    <View className="flex-row items-center justify-around">
                        <TouchableOpacity
                            onPress={() => handleStatPress('weaves')}
                            activeOpacity={0.7}
                            className="items-center px-4 py-2"
                        >
                            <Text variant="h1" className="font-lora-bold text-3xl">
                                {reflection.totalWeaves}
                            </Text>
                            <Text variant="caption" className="text-muted-foreground mt-1 uppercase tracking-wide text-xs">
                                weaves
                            </Text>
                        </TouchableOpacity>

                        <View className="w-px h-10 bg-border" />

                        <TouchableOpacity
                            onPress={() => handleStatPress('friends')}
                            activeOpacity={0.7}
                            className="items-center px-4 py-2"
                        >
                            <Text variant="h1" className="font-lora-bold text-3xl">
                                {reflection.friendsContacted}
                            </Text>
                            <Text variant="caption" className="text-muted-foreground mt-1 uppercase tracking-wide text-xs">
                                friends
                            </Text>
                        </TouchableOpacity>

                        {reflection.topActivity && (
                            <>
                                <View className="w-px h-10 bg-border" />

                                <TouchableOpacity
                                    onPress={() => handleStatPress('activity')}
                                    activeOpacity={0.7}
                                    className="items-center px-4 py-2"
                                >
                                    <Text variant="h2" className="font-lora-bold">
                                        {reflection.topActivityCount}×
                                    </Text>
                                    <Text variant="caption" className="text-muted-foreground mt-1 text-xs text-center" numberOfLines={2}>
                                        {reflection.topActivity}
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </Card>

                {/* Reflection Text */}
                {reflection.gratitudeText ? (
                    <View className="mb-6">
                        <View className="flex-row items-center gap-2 mb-3">
                            <Quote size={16} color={colors.primary} />
                            <Text variant="caption" className="font-bold uppercase tracking-wider text-muted-foreground">
                                Reflection
                            </Text>
                        </View>
                        {/* Show the prompt if available */}
                        {reflection.gratitudePrompt && (
                            <Text variant="body" className="text-muted-foreground mb-3 italic">
                                {reflection.gratitudePrompt}
                            </Text>
                        )}
                        <Card className="p-4 bg-muted/30 border-0">
                            <Text variant="body" className="italic text-foreground">
                                "{reflection.gratitudeText}"
                            </Text>
                        </Card>
                    </View>
                ) : null}

                {/* Story Chips */}
                {chipsToDisplay.length > 0 && (
                    <View className="mb-8">
                        <View className="flex-row items-center gap-2 mb-3">
                            <Sparkles size={16} color={colors.primary} />
                            <Text variant="caption" className="font-bold uppercase tracking-wider text-muted-foreground">
                                Highlights
                            </Text>
                        </View>

                        <View className="flex-row flex-wrap gap-2">
                            {chipsToDisplay.map((chipData: any, index: number) => {
                                // Handle potential different data structures for chip ID
                                const chipId = chipData.chipId || chipData.id || chipData;
                                const chipDef = STORY_CHIPS.find(c => c.id === chipId);

                                if (!chipDef) return null;

                                return (
                                    <View
                                        key={index}
                                        className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
                                    >
                                        <Text variant="caption" className="font-medium text-primary">
                                            {chipDef.plainText}
                                        </Text>
                                    </View>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Footer Info */}
                <View className="items-center mt-4 mb-12">
                    <Text variant="caption" className="text-muted-foreground">
                        Completed on {reflection.completedAt ? format(new Date(reflection.completedAt), 'MMMM d, yyyy') : 'Unknown date'}
                    </Text>
                </View>

            </StandardBottomSheet>

            {/* Stats Detail Sheet */}
            <StatsDetailSheet
                isOpen={statsSheetOpen}
                onClose={() => setStatsSheetOpen(false)}
                statType={statsSheetType}
                weekStartDate={weekStart}
                weekEndDate={weekEnd}
            />
        </>
    );
}
