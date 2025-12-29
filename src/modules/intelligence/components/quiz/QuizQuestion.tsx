/**
 * QuizQuestion
 * 
 * Single quiz question with scenario and slider between two options.
 * Layout: Central question, slider, dynamic label, small option anchors below.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Slider from '@react-native-community/slider';

import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { QuizQuestion as QuizQuestionType, SliderPosition } from '../../services/quiz';

interface QuizQuestionProps {
    question: QuizQuestionType;
    onAnswer: (sliderValue: SliderPosition) => void;
    onBack?: () => void;
    isFirst: boolean;
}

/**
 * Get descriptive label based on slider position from question's bespoke labels
 */
function getSliderLabel(position: number, labels: [string, string, string, string, string]): string {
    if (position >= 0 && position <= 4) {
        return labels[position];
    }
    return 'Move the slider';
}

export function QuizQuestion({ question, onAnswer, onBack, isFirst }: QuizQuestionProps) {
    const { colors } = useTheme();
    const [sliderValue, setSliderValue] = useState<number>(2); // Start at center
    const [hasMoved, setHasMoved] = useState(false); // Track for UI styling only

    const handleSliderChange = (value: number) => {
        setSliderValue(value);
        if (!hasMoved) {
            setHasMoved(true);
        }
    };

    const handleNext = () => {
        onAnswer(Math.round(sliderValue) as SliderPosition);
    };

    // Calculate opacity for labels based on slider position
    const leftOpacity = 0.5 + (1 - sliderValue / 4) * 0.5;
    const rightOpacity = 0.5 + (sliderValue / 4) * 0.5;

    return (
        <View className="flex-1 justify-between">
            {/* Central Content Area */}
            <View className="flex-1 px-6 justify-center">
                {/* Scenario - Prominent and Central */}
                <Text
                    variant="h2"
                    className="text-center mb-8 leading-8"
                >
                    {question.scenario}
                </Text>

                {/* Slider Section */}
                <View className="mb-6">
                    {/* Slider */}
                    <View className="py-2 px-2">
                        <Slider
                            style={{ width: '100%', height: 44 }}
                            minimumValue={0}
                            maximumValue={4}
                            step={1}
                            value={sliderValue}
                            onValueChange={handleSliderChange}
                            minimumTrackTintColor={colors.primary}
                            maximumTrackTintColor={colors.muted}
                            thumbTintColor={colors.primary}
                        />
                    </View>

                    {/* Dynamic Position Label */}
                    <View className="items-center mt-3 mb-6">
                        <Text
                            variant="body"
                            className="text-center font-medium"
                            style={{
                                color: hasMoved ? colors.primary : colors['muted-foreground'],
                            }}
                        >
                            {getSliderLabel(Math.round(sliderValue), question.sliderLabels)}
                        </Text>
                    </View>

                    {/* Side-by-side Options - Small text anchors */}
                    <View className="flex-row justify-between gap-3">
                        {/* Option A */}
                        <TouchableOpacity
                            className="flex-1 py-2 px-2 rounded-lg"
                            style={{ backgroundColor: colors.muted + '30' }}
                            onPress={() => { setSliderValue(0); setHasMoved(true); }}
                            activeOpacity={0.7}
                        >
                            <Text
                                className="text-center text-xs leading-4"
                                style={{
                                    color: colors['muted-foreground'],
                                    opacity: leftOpacity,
                                }}
                            >
                                {question.optionA.text}
                            </Text>
                        </TouchableOpacity>

                        {/* Option B */}
                        <TouchableOpacity
                            className="flex-1 py-2 px-2 rounded-lg"
                            style={{ backgroundColor: colors.muted + '30' }}
                            onPress={() => { setSliderValue(4); setHasMoved(true); }}
                            activeOpacity={0.7}
                        >
                            <Text
                                className="text-center text-xs leading-4"
                                style={{
                                    color: colors['muted-foreground'],
                                    opacity: rightOpacity,
                                }}
                            >
                                {question.optionB.text}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Navigation */}
            <View className="px-6 pb-10">
                <View className="flex-row gap-3">
                    {!isFirst && (
                        <Button
                            variant="ghost"
                            label="Back"
                            onPress={onBack}
                            className="flex-1"
                        />
                    )}
                    <Button
                        variant="primary"
                        label="Next"
                        onPress={handleNext}
                        className={isFirst ? "flex-1" : "flex-[2]"}
                    />
                </View>
            </View>
        </View>
    );
}