import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Sparkles, X, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui/Text';
import { Card } from '@/shared/ui/Card';

interface NetworkObservationCardProps {
    observations: string[];
    onDismiss?: () => void;
    className?: string;
    defaultExpanded?: boolean;
}

/**
 * Displays AI-generated observations about the user's social network/week.
 * Modular component designed to be used in Weekly Reflection or Friend Profile.
 */
export function NetworkObservationCard({
    observations,
    onDismiss,
    className,
    defaultExpanded = false
}: NetworkObservationCardProps) {
    const { colors } = useTheme();
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    if (!observations || observations.length === 0) return null;

    const firstObservation = observations[0];
    const remainingObservations = observations.slice(1);
    const hasMore = remainingObservations.length > 0;

    return (
        <Card
            variant="default"
            className={`p-4 bg-primary/5 border border-primary/10 ${className || ''}`}
            style={{ backgroundColor: colors.primary + '08' }}
        >
            {/* Header */}
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => hasMore && setIsExpanded(!isExpanded)}
                disabled={!hasMore}
                className="flex-row items-center justify-between mb-3"
            >
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
            </TouchableOpacity>

            {/* Content */}
            <View className="gap-2">
                {/* First Observation - Always Visible */}
                <View className="flex-row gap-2">
                    <Text className="text-primary mt-1.5">•</Text>
                    <Text variant="body" className="text-foreground leading-6 flex-1">
                        {firstObservation}
                    </Text>
                </View>

                {/* Remaining Observations */}
                {isExpanded && remainingObservations.map((obs, index) => (
                    <View key={index} className="flex-row gap-2">
                        <Text className="text-primary mt-1.5">•</Text>
                        <Text variant="body" className="text-foreground leading-6 flex-1">
                            {obs}
                        </Text>
                    </View>
                ))}
            </View>

            {/* Footer / Toggle Button */}
            {hasMore && (
                <TouchableOpacity
                    onPress={() => setIsExpanded(!isExpanded)}
                    className="mt-3 pt-2 items-center justify-center"
                    hitSlop={8}
                >
                    <View className="flex-row items-center bg-primary/10 px-3 py-1.5 rounded-full">
                        <Text variant="caption" className="text-primary font-medium mr-1.5 text-xs">
                            {isExpanded ? 'Show less' : `Show ${remainingObservations.length} more`}
                        </Text>
                        {isExpanded ? (
                            <ChevronUp size={12} color={colors.primary} />
                        ) : (
                            <ChevronDown size={12} color={colors.primary} />
                        )}
                    </View>
                </TouchableOpacity>
            )}
        </Card>
    );
}
