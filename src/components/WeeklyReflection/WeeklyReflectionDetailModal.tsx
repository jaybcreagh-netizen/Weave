/**
 * WeeklyReflectionDetailModal
 * 
 * Shows details of a past reflection (history view)
 */

import React from 'react';
import { View, ScrollView } from 'react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { Quote, Sparkles } from 'lucide-react-native';
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

    // Parse story chips if they are generic objects, handle potential structure differences
    const chipsToDisplay = reflection.storyChips || [];

    return (
        <StandardBottomSheet
            visible={isOpen}
            onClose={onClose}
            title="Reflection Details"
            snapPoints={['85%']}
        >
            <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
                {/* Reflection Text */}
                {reflection.gratitudeText ? (
                    <View className="mb-6">
                        <View className="flex-row items-center gap-2 mb-3">
                            <Quote size={16} color={colors.primary} />
                            <Text variant="caption" className="font-bold uppercase tracking-wider text-muted-foreground">
                                Reflection
                            </Text>
                        </View>
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
            </ScrollView>
        </StandardBottomSheet>
    );
}
