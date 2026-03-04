/**
 * BatteryCheckinOverlay
 * Inline check-in composer rendered inside UnifiedCalendarModal.
 * Avoids opening a second modal bottom sheet on top of iOS pageSheet.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { X } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/shared/hooks/useTheme';
import { MoonPhaseIllustration } from '@/modules/intelligence/components/social-season/YearInMoons/MoonPhaseIllustration';
import { BATTERY_STATES } from '@/modules/home/components/widgets/SocialBatterySheet';

interface BatteryCheckinOverlayProps {
    visible: boolean;
    date: Date | null;
    onDismiss: () => void;
    onSubmit: (value: number, note?: string) => Promise<void> | void;
}

export function BatteryCheckinOverlay({
    visible,
    date,
    onDismiss,
    onSubmit,
}: BatteryCheckinOverlayProps) {
    const { tokens } = useTheme();
    const insets = useSafeAreaInsets();
    const [batteryLevel, setBatteryLevel] = useState(3);
    const [note, setNote] = useState('');
    const [showNoteInput, setShowNoteInput] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!visible) return;
        setBatteryLevel(3);
        setNote('');
        setShowNoteInput(false);
        setIsSubmitting(false);
    }, [visible, date?.getTime()]);

    const currentState = useMemo(
        () => BATTERY_STATES.find((state) => state.value === batteryLevel) || BATTERY_STATES[2],
        [batteryLevel]
    );

    const handleSliderChange = (value: number) => {
        const rounded = Math.round(value);
        setBatteryLevel(rounded);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleDismiss = () => {
        if (isSubmitting) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onDismiss();
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await onSubmit(batteryLevel, note || undefined);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!visible || !date) return null;

    return (
        <View className="absolute inset-0 justify-end">
            <TouchableOpacity
                activeOpacity={1}
                onPress={handleDismiss}
                className="absolute inset-0"
                style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
            />

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <View
                    className="rounded-t-3xl px-4 pt-4"
                    style={{
                        backgroundColor: tokens.card.background,
                        borderTopWidth: 1,
                        borderColor: tokens.border,
                        paddingBottom: Math.max(insets.bottom + 16, 24),
                    }}
                >
                    <View className="mb-4 flex-row items-start justify-between">
                        <View className="flex-1 pr-3">
                            <Text
                                className="text-lg font-lora-bold"
                                style={{ color: tokens.foreground }}
                            >
                                Check in for {format(date, 'EEE, MMM d')}
                            </Text>
                            <Text
                                className="mt-1 text-sm font-inter"
                                style={{ color: tokens.foregroundMuted }}
                            >
                                Backdate your social battery without leaving this calendar.
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={handleDismiss}
                            className="rounded-full p-2"
                            style={{ backgroundColor: tokens.backgroundMuted }}
                            disabled={isSubmitting}
                        >
                            <X size={16} color={tokens.foregroundMuted} />
                        </TouchableOpacity>
                    </View>

                    <View className="mb-4 items-center">
                        <MoonPhaseIllustration
                            phase={0}
                            batteryLevel={currentState.value}
                            size={76}
                            color={currentState.color}
                            hasCheckin={true}
                        />
                        <Text
                            className="mt-2 text-xl font-inter-semibold"
                            style={{ color: tokens.foreground }}
                        >
                            {currentState.shortDesc}
                        </Text>
                        <Text
                            className="mt-1 text-sm font-inter"
                            style={{ color: tokens.foregroundMuted }}
                        >
                            {currentState.description}
                        </Text>
                    </View>

                    <View className="mb-4">
                        <Slider
                            style={{ width: '100%', height: 40 }}
                            minimumValue={1}
                            maximumValue={5}
                            step={1}
                            value={batteryLevel}
                            onValueChange={handleSliderChange}
                            minimumTrackTintColor={currentState.color}
                            maximumTrackTintColor={tokens.border}
                            thumbTintColor={currentState.color}
                        />
                        <View className="flex-row justify-between px-2">
                            <Text className="text-xs font-inter" style={{ color: tokens.foregroundMuted }}>
                                Depleted
                            </Text>
                            <Text className="text-xs font-inter" style={{ color: tokens.foregroundMuted }}>
                                High
                            </Text>
                        </View>
                    </View>

                    {!showNoteInput ? (
                        <TouchableOpacity
                            onPress={() => setShowNoteInput(true)}
                            className="mb-4 items-center rounded-xl border border-dashed p-4"
                            style={{ borderColor: tokens.border }}
                        >
                            <Text className="text-sm font-inter" style={{ color: tokens.foregroundMuted }}>
                                + Add a note (optional)
                            </Text>
                        </TouchableOpacity>
                    ) : (
                        <TextInput
                            style={{
                                backgroundColor: tokens.backgroundMuted,
                                color: tokens.foreground,
                                borderColor: tokens.border,
                            }}
                            className="mb-4 min-h-[80px] rounded-xl border p-3 font-inter text-sm"
                            placeholder="How were you feeling that day?"
                            placeholderTextColor={tokens.foregroundMuted}
                            value={note}
                            onChangeText={setNote}
                            multiline
                            maxLength={200}
                            textAlignVertical="top"
                            editable={!isSubmitting}
                        />
                    )}

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={handleDismiss}
                            className="flex-1 items-center rounded-xl py-3.5"
                            style={{ backgroundColor: tokens.backgroundMuted }}
                            disabled={isSubmitting}
                        >
                            <Text className="font-inter-semibold" style={{ color: tokens.foregroundMuted }}>
                                Cancel
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSubmit}
                            className="flex-[1.6] items-center rounded-xl py-3.5"
                            style={{ backgroundColor: tokens.primary, opacity: isSubmitting ? 0.7 : 1 }}
                            disabled={isSubmitting}
                        >
                            <Text className="font-inter-semibold" style={{ color: tokens.primaryForeground }}>
                                {isSubmitting ? 'Saving...' : 'Save Check-In'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}
