import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';

interface NetworkObservationCardProps {
    observations: string[];
    onDismiss?: () => void;
    className?: string;
}

/**
 * Displays AI-generated observations about the user's social network/week.
 * Modular component designed to be used in Weekly Reflection or Friend Profile.
 */
export function NetworkObservationCard({
    observations,
    onDismiss,
    className
}: NetworkObservationCardProps) {
    const { colors } = useTheme();

    if (!observations || observations.length === 0) return null;

    return (
        <Card
            variant="default"
            className={`p-4 bg-primary/5 border border-primary/10 ${className || ''}`}
            style={{ backgroundColor: colors.primary + '08' }} // Fallback/extra styling
        >
            <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                    <Sparkles size={16} color={colors.primary} />
                    <Text variant="label" className="text-primary font-bold tracking-wide uppercase text-xs">
                        Oracle Observations
                    </Text>
                </View>

                {onDismiss && (
                    <TouchableOpacity onPress={onDismiss} hitSlop={8}>
                        <X size={16} color={colors.muted} />
                    </TouchableOpacity>
                )}
            </View>

            <View className="gap-2">
                {observations.map((obs, index) => (
                    <View key={index} className="flex-row gap-2">
                        <Text className="text-primary mt-1.5">•</Text>
                        <Text variant="body" className="text-foreground leading-6 flex-1">
                            {obs}
                        </Text>
                    </View>
                ))}
            </View>
        </Card>
    );
}
