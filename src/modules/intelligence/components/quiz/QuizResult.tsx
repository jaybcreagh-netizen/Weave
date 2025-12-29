/**
 * QuizResult
 * 
 * Result reveal with large archetype card artwork, description, and tappable alignment breakdown.
 * Layout pushes buttons to bottom of screen with card artwork taking prominent space.
 */

import React, { useEffect } from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';

import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { QuizResult as QuizResultType, getTopThreeArchetypes } from '../../services/quiz';
import { ARCHETYPE_RESULTS } from '../../services/quiz/quiz.constants';
import { archetypeData, ARCHETYPE_GRADIENTS } from '@/shared/constants/constants';
import { ArchetypeIcon } from '../archetypes/ArchetypeIcon';
import { ArchetypeDetailModal } from '../archetypes/ArchetypeDetailModal';
import { useUIStore } from '@/shared/stores/uiStore';
import type { Archetype } from '@/shared/types/common';

interface QuizResultProps {
    result: QuizResultType;
    onSaveToProfile: () => void;
    onRetake?: () => void;
    onClose?: () => void;
}

export function QuizResult({ result, onSaveToProfile, onRetake, onClose }: QuizResultProps) {
    const { colors } = useTheme();
    const { setArchetypeModal } = useUIStore();

    const archetype = result.primary;
    const archetypeInfo = ARCHETYPE_RESULTS[archetype];
    const gradientColors = ARCHETYPE_GRADIENTS[archetype] || ['#6366f1', '#4f46e5'];
    const topThree = getTopThreeArchetypes(result);

    // Animations
    const iconScale = useSharedValue(0);
    const titleOpacity = useSharedValue(0);
    const contentOpacity = useSharedValue(0);

    useEffect(() => {
        // Trigger haptic on reveal
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        // Staggered animations
        iconScale.value = withTiming(1, {
            duration: 600,
            easing: Easing.out(Easing.back(1.5))
        });
        titleOpacity.value = withDelay(300, withTiming(1, { duration: 400 }));
        contentOpacity.value = withDelay(600, withTiming(1, { duration: 400 }));
    }, []);

    const iconStyle = useAnimatedStyle(() => ({
        transform: [{ scale: iconScale.value }],
    }));

    const titleStyle = useAnimatedStyle(() => ({
        opacity: titleOpacity.value,
    }));

    const contentStyle = useAnimatedStyle(() => ({
        opacity: contentOpacity.value,
    }));

    const handleArchetypeTap = (tappedArchetype: Archetype) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setArchetypeModal(tappedArchetype);
    };

    return (
        <>
            <View className="flex-1">
                {/* Close button */}
                {onClose && (
                    <TouchableOpacity
                        className="absolute top-14 right-4 z-10 p-2"
                        onPress={onClose}
                        activeOpacity={0.7}
                    >
                        <X size={24} color={colors['muted-foreground']} />
                    </TouchableOpacity>
                )}

                {/* Scrollable Content */}
                <ScrollView
                    className="flex-1"
                    contentContainerClassName="px-6 pt-24 pb-4 flex-grow"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Large Hero Card Artwork - 30% bigger */}
                    <Animated.View className="items-center mb-6" style={iconStyle}>
                        <View
                            className="w-60 h-60 rounded-3xl items-center justify-center"
                            style={{ backgroundColor: gradientColors[0] + '12' }}
                        >
                            <ArchetypeIcon
                                archetype={archetype}
                                size={180}
                                color={gradientColors[0]}
                            />
                        </View>
                    </Animated.View>

                    {/* Title & One-liner */}
                    <Animated.View className="items-center mb-3" style={titleStyle}>
                        <Text variant="h1" className="text-center mb-1">
                            {archetypeInfo.title}
                        </Text>
                        <Text
                            variant="body"
                            className="text-center font-semibold"
                            style={{ color: gradientColors[0] }}
                        >
                            {archetypeInfo.oneLiner}
                        </Text>
                    </Animated.View>

                    {/* Content */}
                    <Animated.View className="flex-1" style={contentStyle}>
                        {/* Description */}
                        <Text
                            variant="body"
                            className="text-center leading-6 mb-6 px-2"
                            style={{ color: colors['muted-foreground'] }}
                        >
                            {archetypeInfo.description}
                        </Text>

                        {/* Alignment breakdown - Tappable */}
                        <View className="mb-4">
                            <Text
                                variant="caption"
                                className="text-center tracking-widest mb-3"
                                style={{ color: colors['muted-foreground'] }}
                            >
                                YOUR ALIGNMENT
                            </Text>
                            <View className="flex-row justify-center gap-3">
                                {topThree.map((item, index) => {
                                    const itemColors = ARCHETYPE_GRADIENTS[item.archetype] || ['#6366f1', '#4f46e5'];
                                    return (
                                        <TouchableOpacity
                                            key={item.archetype}
                                            className="items-center p-2.5 rounded-xl min-w-[90px]"
                                            style={{ backgroundColor: itemColors[0] + '10' }}
                                            onPress={() => handleArchetypeTap(item.archetype)}
                                            activeOpacity={0.7}
                                        >
                                            <ArchetypeIcon
                                                archetype={item.archetype}
                                                size={26}
                                                color={itemColors[0]}
                                            />
                                            <Text
                                                variant="body"
                                                className="mt-0.5 font-semibold"
                                                style={index === 0 ? { color: itemColors[0] } : undefined}
                                            >
                                                {item.percentage}%
                                            </Text>
                                            <Text
                                                className="text-center text-xs"
                                                style={{ color: colors['muted-foreground'] }}
                                            >
                                                {archetypeData[item.archetype]?.name?.replace('The ', '') || item.archetype}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <Text
                                variant="caption"
                                className="text-center mt-2 italic"
                                style={{ color: colors['muted-foreground'] }}
                            >
                                Tap to learn more
                            </Text>
                        </View>
                    </Animated.View>
                </ScrollView>

                {/* Fixed Bottom Actions */}
                <View className="px-6 pb-10 pt-3" style={{ backgroundColor: colors.background }}>
                    <Button
                        variant="primary"
                        label="Save to Profile"
                        onPress={onSaveToProfile}
                        className="w-full"
                    />
                    {onRetake && (
                        <Button
                            variant="ghost"
                            label="Retake Quiz"
                            onPress={onRetake}
                            className="mt-2"
                        />
                    )}
                </View>
            </View>

            {/* Archetype Detail Modal */}
            <ArchetypeDetailModal />
        </>
    );
}
