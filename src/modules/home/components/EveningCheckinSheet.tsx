import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Moon, CheckCircle, Clock, Calendar, Sparkles, ChevronRight } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';

import { useTheme } from '@/shared/hooks/useTheme';
import { getTokens } from '@/shared/theme/tokens';
import { AnimatedBottomSheet } from '@/shared/ui/Sheet';
import { Card } from '@/shared/ui/Card';
import { Button } from '@/shared/ui/Button';
import { ListItem } from '@/shared/ui/ListItem';
import { WidgetHeader } from '@/shared/ui/WidgetHeader';
import { MoonPhaseIllustration } from '@/modules/intelligence';
import { EveningCheckinContent, DigestItem } from '@/modules/notifications';
import { useRouter } from 'expo-router';

interface EveningCheckinSheetProps {
    isVisible: boolean;
    onClose: () => void;
    content: EveningCheckinContent;
    onBatterySubmit: (value: number, note?: string) => void;
    onConfirmPlan?: (interactionId: string) => void;
    onDismissSuggestion?: (suggestionId: string) => void;
}

// Battery levels definition moved inside component to access theme colors

export const EveningCheckinSheet: React.FC<EveningCheckinSheetProps> = ({
    isVisible,
    onClose,
    content,
    onBatterySubmit,
    onConfirmPlan,
    onDismissSuggestion,
}) => {
    const { isDarkMode } = useTheme();
    const tokens = getTokens(isDarkMode);
    // Backward compatibility for existing code using 'colors' from legacy theme
    // We want to use 'tokens' for new semantic colors like warning/success
    const colors = tokens;
    const router = useRouter();

    // Battery state
    const [batteryLevel, setBatteryLevel] = useState(3);
    const [batterySubmitted, setBatterySubmitted] = useState(false);

    // Reset state when opening
    useEffect(() => {
        if (isVisible) {
            setBatteryLevel(3);
            setBatterySubmitted(content.hasBatteryCheckinToday);
        }
    }, [isVisible, content.hasBatteryCheckinToday]);

    // Battery level states with moon phases - Dynamic based on theme
    const batteryStates = React.useMemo(() => [
        { value: 1, label: 'Depleted', color: tokens.destructive, desc: 'Need complete solitude' },
        { value: 2, label: 'Low', color: tokens.warning, desc: 'Prefer quiet time' },
        { value: 3, label: 'Balanced', color: tokens.primary, desc: 'Open to connection' },
        { value: 4, label: 'Good', color: tokens.success, desc: 'Seeking connection' },
        { value: 5, label: 'High', color: tokens.celebrate, desc: 'Craving interaction' },
    ], [tokens]);

    const currentBatteryState = batteryStates.find(s => s.value === batteryLevel) || batteryStates[2];

    const handleSliderChange = (value: number) => {
        const rounded = Math.round(value);
        setBatteryLevel(rounded);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleBatterySubmit = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onBatterySubmit(batteryLevel);
        setBatterySubmitted(true);
    };

    const handleItemAction = (item: DigestItem) => {
        onClose();
        if (item.interactionId) {
            // Navigate to interaction or plan detail
            router.push('/dashboard');
        } else if (item.friendId) {
            router.push(`/friend-profile?friendId=${item.friendId}`);
        }
    };

    const handleDismissSuggestion = () => {
        if (content.topSuggestion?.data?.suggestionId && onDismissSuggestion) {
            onDismissSuggestion(content.topSuggestion.data.suggestionId);
        }
    };

    const hasTodaysWeaves = content.todaysWeaves.completed.length > 0 || content.todaysWeaves.unconfirmed.length > 0;
    const hasTomorrow = content.tomorrow.length > 0;

    // Show "All Quiet" if truly empty
    const showEmptyState = content.isEmpty && batterySubmitted;

    return (
        <AnimatedBottomSheet
            visible={isVisible}
            onClose={onClose}
            height="form"
            scrollable
        >
            {/* Header */}
            <View className="mb-6 px-1">
                <Text
                    className="text-[28px] font-lora-bold mb-1"
                    style={{ color: colors.foreground }}
                >
                    Evening Check-in
                </Text>
                <Text
                    className="text-base font-inter"
                    style={{ color: colors.foregroundMuted }}
                >
                    {format(new Date(), 'EEEE, MMMM d')}
                </Text>
            </View>

            {/* Battery Check-in Section */}
            {!batterySubmitted && (
                <View className="mb-6">
                    <WidgetHeader
                        title="How are you feeling?"
                        icon={<Moon size={20} color={colors.primary} />}
                    />
                    <Card padding="md">
                        {/* Moon Illustration */}
                        <View className="items-center mb-4">
                            <MoonPhaseIllustration
                                phase={0}
                                batteryLevel={currentBatteryState.value}
                                size={60}
                                color={currentBatteryState.color}
                                hasCheckin={true}
                            />
                            <Text
                                className="text-lg font-inter-semibold mt-2"
                                style={{ color: colors.foreground }}
                            >
                                {currentBatteryState.label}
                            </Text>
                            <Text
                                className="text-sm font-inter"
                                style={{ color: colors.foregroundMuted }}
                            >
                                {currentBatteryState.desc}
                            </Text>
                        </View>

                        {/* Slider */}
                        <View className="mb-4">
                            <Slider
                                style={{ width: '100%', height: 40 }}
                                minimumValue={1}
                                maximumValue={5}
                                step={1}
                                value={batteryLevel}
                                onValueChange={handleSliderChange}
                                minimumTrackTintColor={currentBatteryState.color}
                                maximumTrackTintColor={colors.border}
                                thumbTintColor={currentBatteryState.color}
                            />
                            <View className="flex-row justify-between px-1">
                                <Text className="text-xs font-inter" style={{ color: colors.foregroundMuted }}>
                                    Depleted
                                </Text>
                                <Text className="text-xs font-inter" style={{ color: colors.foregroundMuted }}>
                                    High
                                </Text>
                            </View>
                        </View>

                        {/* Submit Button */}
                        <Button
                            label="Check In"
                            onPress={handleBatterySubmit}
                            variant="primary"
                        />
                    </Card>
                </View>
            )}

            {/* Battery Submitted Confirmation */}
            {batterySubmitted && (
                <View
                    className="flex-row items-center gap-2 mb-4 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: colors.primary + '15' }}
                >
                    <CheckCircle size={18} color={colors.primary} />
                    <Text className="text-sm font-inter" style={{ color: colors.primary }}>
                        Battery check-in complete
                    </Text>
                </View>
            )}

            {/* Today's Weaves Section */}
            {hasTodaysWeaves && (
                <View className="mb-6">
                    <WidgetHeader
                        title="Today's Weaves"
                        icon={<CheckCircle size={20} color={colors.primary} />}
                    />
                    <Card padding="none">
                        {/* Completed */}
                        {content.todaysWeaves.completed.map((item, i) => (
                            <View key={`completed-${i}`} className="px-4">
                                <ListItem
                                    title={item.title}
                                    subtitle="Completed ✓"
                                    compact
                                    showDivider={i < content.todaysWeaves.completed.length - 1 || content.todaysWeaves.unconfirmed.length > 0}
                                    trailing={
                                        <ChevronRight size={18} color={colors.foregroundMuted} />
                                    }
                                    onPress={() => handleItemAction(item)}
                                />
                            </View>
                        ))}

                        {/* Unconfirmed */}
                        {content.todaysWeaves.unconfirmed.map((item, i) => (
                            <View key={`unconfirmed-${i}`} className="px-4">
                                <ListItem
                                    title={item.title}
                                    subtitle="Needs confirmation"
                                    compact
                                    showDivider={i < content.todaysWeaves.unconfirmed.length - 1}
                                    trailing={
                                        <TouchableOpacity
                                            onPress={() => onConfirmPlan?.(item.interactionId || '')}
                                            className="px-3 py-1.5 rounded-lg"
                                            style={{ backgroundColor: colors.primary }}
                                        >
                                            <Text className="text-xs font-inter-semibold" style={{ color: colors.primaryForeground }}>
                                                Confirm
                                            </Text>
                                        </TouchableOpacity>
                                    }
                                />
                            </View>
                        ))}
                    </Card>
                </View>
            )}

            {/* Tomorrow Section */}
            {hasTomorrow && (
                <View className="mb-6">
                    <WidgetHeader
                        title="Tomorrow"
                        icon={<Calendar size={20} color={colors.primary} />}
                    />
                    <Card padding="none">
                        {content.tomorrow.map((item, i) => (
                            <View key={`tomorrow-${i}`} className="px-4">
                                <ListItem
                                    title={item.title}
                                    subtitle={item.type === 'birthday' ? '🎂 Birthday' : (item.type === 'plan' ? 'Planned' : item.subtitle)}
                                    compact
                                    showDivider={i < content.tomorrow.length - 1}
                                    trailing={
                                        <ChevronRight size={18} color={colors.foregroundMuted} />
                                    }
                                    onPress={() => handleItemAction(item)}
                                />
                            </View>
                        ))}
                    </Card>
                </View>
            )}

            {/* Top Suggestion Section */}
            {content.topSuggestion && (
                <View className="mb-6">
                    <WidgetHeader
                        title="Consider"
                        icon={<Sparkles size={20} color={colors.primary} />}
                    />
                    <Card padding="md">
                        <Text
                            className="text-base font-inter-medium mb-1"
                            style={{ color: colors.foreground }}
                        >
                            {content.topSuggestion.title}
                        </Text>
                        <Text
                            className="text-sm font-inter mb-4"
                            style={{ color: colors.foregroundMuted }}
                        >
                            {content.topSuggestion.subtitle}
                        </Text>
                        <View className="flex-row gap-3">
                            <Button
                                label="Not Now"
                                onPress={handleDismissSuggestion}
                                variant="outline"
                                size="sm"
                                className="flex-1"
                            />
                            <Button
                                label="Plan"
                                onPress={() => handleItemAction(content.topSuggestion!)}
                                variant="primary"
                                size="sm"
                                className="flex-1"
                            />
                        </View>
                    </Card>
                </View>
            )}

            {/* Empty State */}
            {showEmptyState && (
                <View className="items-center justify-center py-12">
                    <Moon size={48} color={colors.primary + '60'} />
                    <Text
                        className="text-xl font-lora-bold mt-4 mb-2"
                        style={{ color: colors.foreground }}
                    >
                        All Quiet Tonight
                    </Text>
                    <Text
                        className="text-base font-inter text-center px-8"
                        style={{ color: colors.foregroundMuted }}
                    >
                        No pending plans or suggestions. Rest easy!
                    </Text>
                </View>
            )}

            {/* Done Button */}
            <View className="mt-4">
                <Button
                    label="Done"
                    onPress={onClose}
                    variant="secondary"
                />
            </View>
        </AnimatedBottomSheet>
    );
};
