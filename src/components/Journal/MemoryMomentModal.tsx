
/**
 * MemoryMomentModal
 * A dedicated, emotionally resonant modal for surfacing memories.
 */

import React from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    SafeAreaView,
    Dimensions,
} from 'react-native';
import Animated, {
    FadeIn,
    FadeInDown,
} from 'react-native-reanimated';
import { Sparkles, X, ChevronRight, Calendar, User } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import JournalEntry from '@/db/models/JournalEntry';
import WeeklyReflection from '@/db/models/WeeklyReflection';
import { Memory } from '@/modules/journal';
import { trackEvent } from '@/shared/services/analytics.service';

interface MemoryMomentModalProps {
    visible: boolean;
    onClose: () => void;
    memory: Memory | null;
    entry?: JournalEntry | WeeklyReflection | null;
    friendName?: string;
    onReadEntry: () => void;
    onWriteAbout: () => void;
}

export function MemoryMomentModal({
    visible,
    onClose,
    memory,
    entry,
    friendName,
    onReadEntry,
    onWriteAbout,
}: MemoryMomentModalProps) {
    const { colors } = useTheme();

    React.useEffect(() => {
        if (visible && memory) {
            trackEvent('memory_moment_opened', { memoryId: memory.id, type: memory.type });
        }
    }, [visible, memory]);

    if (!memory || !entry) return null;

    const date = 'entryDate' in entry
        ? new Date(entry.entryDate)
        : new Date(entry.weekStartDate);

    const formattedDate = format(date, 'MMMM d, yyyy');

    const previewText = 'content' in entry
        ? entry.content
        : entry.gratitudeText || 'No text found.';

    const handleClose = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
    };

    const handleRead = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        trackEvent('memory_moment_action', { action: 'read', memoryId: memory.id });
        onReadEntry();
    };

    const handleWrite = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        trackEvent('memory_moment_action', { action: 'write', memoryId: memory.id });
        onWriteAbout();
    };

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent
            onRequestClose={handleClose}
        >
            <View className="flex-1 justify-center items-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                <Animated.View
                    entering={FadeInDown.springify().damping(15)}
                    className="w-full rounded-3xl overflow-hidden" // Removed max-w-sm to be responsive
                    style={{ width: '100%', maxWidth: 380, backgroundColor: colors.background }} // Added width constraint manually
                >
                    {/* Header Image / Pattern Area */}
                    <View
                        className="h-32 w-full items-center justify-center relative"
                        style={{ backgroundColor: colors.primary + '15' }}
                    >
                        <View className="absolute top-4 right-4">
                            <TouchableOpacity onPress={handleClose} className="p-2 rounded-full bg-black/5">
                                <X size={20} color={colors.foreground} />
                            </TouchableOpacity>
                        </View>

                        <Animated.View
                            entering={FadeIn.delay(200)}
                            className="items-center"
                        >
                            <Sparkles size={40} color={colors.primary} />
                            <Text
                                className="text-sm font-semibold mt-2 uppercase tracking-widest"
                                style={{ color: colors.primary, fontFamily: 'Inter_600SemiBold' }}
                            >
                                On this day
                            </Text>
                        </Animated.View>
                    </View>

                    {/* Content Body */}
                    <View className="p-6">
                        <Text
                            className="text-2xl text-center mb-6"
                            style={{ color: colors.foreground, fontFamily: 'Lora_600SemiBold' }}
                        >
                            {memory.title}
                        </Text>

                        {/* Entry Card */}
                        <View
                            className="p-5 rounded-xl mb-6"
                            style={{ backgroundColor: colors.muted }}
                        >
                            <View className="flex-row items-center mb-3 opacity-60">
                                <Calendar size={14} color={colors.foreground} />
                                <Text
                                    className="text-xs ml-1.5"
                                    style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                                >
                                    {formattedDate}
                                </Text>

                                {friendName && (
                                    <>
                                        <Text className="mx-2" style={{ color: colors.foreground }}>·</Text>
                                        <User size={14} color={colors.foreground} />
                                        <Text
                                            className="text-xs ml-1.5"
                                            style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                                        >
                                            {friendName}
                                        </Text>
                                    </>
                                )}
                            </View>

                            <Text
                                className="text-base leading-6 italic"
                                style={{ color: colors.foreground, fontFamily: 'Lora_400Regular_Italic' }}
                                numberOfLines={4}
                            >
                                "{previewText}"
                            </Text>
                        </View>

                        {/* Actions */}
                        <View className="flex-row gap-3 mb-2">
                            <TouchableOpacity
                                onPress={handleRead}
                                className="flex-1 py-3.5 rounded-xl items-center flex-row justify-center"
                                style={{ backgroundColor: colors.muted }}
                            >
                                <Text
                                    className="font-semibold mr-1"
                                    style={{ color: colors.foreground, fontFamily: 'Inter_600SemiBold' }}
                                >
                                    Read entry
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleWrite}
                                className="flex-1 py-3.5 rounded-xl items-center flex-row justify-center"
                                style={{ backgroundColor: colors.primary }}
                            >
                                <Text
                                    className="font-semibold mr-1"
                                    style={{ color: colors['primary-foreground'], fontFamily: 'Inter_600SemiBold' }}
                                >
                                    Write now
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={handleClose}
                            className="py-3 items-center mt-2"
                        >
                            <Text
                                className="text-sm opacity-50"
                                style={{ color: colors.foreground, fontFamily: 'Inter_500Medium' }}
                            >
                                Maybe later
                            </Text>
                        </TouchableOpacity>

                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}
