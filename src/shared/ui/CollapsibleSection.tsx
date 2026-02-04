import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
    interpolate,
    Layout,
    interpolateColor,
    LinearTransition
} from 'react-native-reanimated';
import { ChevronDown, LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

interface CollapsibleSectionProps {
    title: string;
    subtitle?: string;
    icon?: LucideIcon;
    defaultExpanded?: boolean;
    children: React.ReactNode;
}

export function CollapsibleSection({
    title,
    subtitle,
    icon: Icon,
    defaultExpanded = false,
    children,
}: CollapsibleSectionProps) {
    const { colors } = useTheme();
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);

    // Animation shared values
    const progress = useSharedValue(defaultExpanded ? 1 : 0);

    const handleToggle = () => {
        const nextState = !isExpanded;
        setIsExpanded(nextState);
        progress.value = withTiming(nextState ? 1 : 0, { duration: 300 });
    };

    const headerStyle = useAnimatedStyle(() => {
        const backgroundColor = interpolateColor(
            progress.value,
            [0, 1],
            ['transparent', `${colors.primary}10`]
        );
        return {
            backgroundColor,
            borderRadius: 12,
        };
    });

    const chevronStyle = useAnimatedStyle(() => {
        const rotate = interpolate(progress.value, [0, 1], [0, 180]);
        return {
            transform: [{ rotate: `${rotate}deg` }],
        };
    });

    const textStyle = useAnimatedStyle(() => {
        const opacity = interpolate(progress.value, [0, 1], [0.6, 1]);
        return { opacity };
    });

    return (
        <View className="mb-2">
            {/* Header */}
            <TouchableOpacity
                onPress={handleToggle}
                activeOpacity={0.7}
            >
                <Animated.View
                    style={headerStyle}
                    className="flex-row items-center justify-between py-3 px-2"
                >
                    <View className="flex-row items-center gap-3 flex-1">
                        {Icon && (
                            <Animated.View
                                className="w-8 h-8 rounded-lg items-center justify-center"
                                style={[{ backgroundColor: colors.muted }, textStyle]}
                            >
                                <Icon color={colors.foreground} size={16} />
                            </Animated.View>
                        )}
                        <View className="flex-1">
                            <Animated.Text
                                className="text-sm font-inter-semibold uppercase tracking-wide"
                                style={[{ color: colors['muted-foreground'] }, textStyle]}
                            >
                                {title}
                            </Animated.Text>
                            {subtitle && (
                                <Animated.Text
                                    className="text-xs font-inter-regular"
                                    style={[{ color: colors['muted-foreground'] }, textStyle]}
                                >
                                    {subtitle}
                                </Animated.Text>
                            )}
                        </View>
                    </View>
                    <Animated.View style={[chevronStyle, textStyle]}>
                        <ChevronDown color={colors['muted-foreground']} size={20} />
                    </Animated.View>
                </Animated.View>
            </TouchableOpacity>

            {/* Content */}
            {isExpanded && (
                <Animated.View
                    layout={LinearTransition.duration(300)}
                    style={{ overflow: 'hidden' }}
                >
                    <View
                        className="ml-4 pl-4 border-l border-border mt-2 gap-4 pb-2"
                        style={{ borderLeftColor: `${colors.primary}30` }}
                    >
                        {children}
                    </View>
                </Animated.View>
            )}
        </View>
    );
}
