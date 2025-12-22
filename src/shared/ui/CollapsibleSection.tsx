import React, { useState } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { ChevronDown, ChevronUp, LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

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

    const handleToggle = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsExpanded(!isExpanded);
    };

    return (
        <View className="mb-2">
            {/* Header */}
            <TouchableOpacity
                onPress={handleToggle}
                className="flex-row items-center justify-between py-3 px-1"
                activeOpacity={0.7}
            >
                <View className="flex-row items-center gap-3 flex-1">
                    {Icon && (
                        <View
                            className="w-8 h-8 rounded-lg items-center justify-center"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <Icon color={colors.foreground} size={16} />
                        </View>
                    )}
                    <View className="flex-1">
                        <Text
                            className="text-sm font-inter-semibold uppercase tracking-wide"
                            style={{ color: colors['muted-foreground'] }}
                        >
                            {title}
                        </Text>
                        {subtitle && (
                            <Text
                                className="text-xs font-inter-regular"
                                style={{ color: colors['muted-foreground'], opacity: 0.7 }}
                            >
                                {subtitle}
                            </Text>
                        )}
                    </View>
                </View>
                {isExpanded ? (
                    <ChevronUp color={colors['muted-foreground']} size={20} />
                ) : (
                    <ChevronDown color={colors['muted-foreground']} size={20} />
                )}
            </TouchableOpacity>

            {/* Content */}
            {isExpanded && (
                <View className="gap-4 pb-2">
                    {children}
                </View>
            )}
        </View>
    );
}
