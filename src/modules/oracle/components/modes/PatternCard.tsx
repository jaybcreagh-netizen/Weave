import React from 'react';
import { View } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';
import { CheckCircle2, AlertCircle, LayoutGrid } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';

interface PatternCardProps {
    patternName: string;
    analysis: string;
    confidence: number;
}

export const PatternCard: React.FC<PatternCardProps> = ({ patternName, analysis, confidence }) => {
    const { colors } = useTheme();

    const isHighConfidence = confidence > 0.7;
    const alertColor = isHighConfidence ? colors.primary : colors.warning;

    return (
        <Animated.View entering={FadeInDown.delay(300).springify()}>
            <Card
                className="mb-4 overflow-hidden border-0"
                style={{ backgroundColor: colors.card }}
            >
                {/* Header Strip */}
                <View
                    className="h-1 w-full absolute top-0 left-0 right-0"
                    style={{ backgroundColor: alertColor }}
                />

                <View className="p-4 pt-5">
                    {/* Pattern Validated Badge */}
                    <View className="flex-row items-center mb-2">
                        <View
                            className="rounded-full px-2 py-0.5 mr-2 flex-row items-center"
                            style={{ backgroundColor: isHighConfidence ? colors.primary + '20' : colors.warning + '20' }}
                        >
                            {isHighConfidence ? (
                                <CheckCircle2 size={12} color={alertColor} style={{ marginRight: 4 }} />
                            ) : (
                                <AlertCircle size={12} color={alertColor} style={{ marginRight: 4 }} />
                            )}
                            <Text
                                variant="caption"
                                className="font-medium uppercase tracking-wider"
                                style={{ color: alertColor }}
                            >
                                {isHighConfidence ? 'Pattern Detected' : 'Possible Dynamic'}
                            </Text>
                        </View>
                    </View>

                    {/* Pattern Name */}
                    <Text variant="h3" className="mb-2 text-foreground font-serif">
                        {patternName}
                    </Text>

                    {/* Analysis Body */}
                    <Text variant="body" className="text-muted-foreground leading-6">
                        {analysis}
                    </Text>
                </View>

                {/* Decorative Grid Background (Subtle) */}
                <View className="absolute inset-0 z-[-1] opacity-5">
                    <LayoutGrid size={200} color={colors.foreground} />
                </View>
            </Card>
        </Animated.View>
    );
};
