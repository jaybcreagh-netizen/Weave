/**
 * NotesInputFieldWithVoice - Enhanced NotesInputField with voice dictation
 * 
 * PROTOTYPE SKETCH - Demonstrates integration pattern
 * 
 * This shows how to add voice input to your existing NotesInputField.
 * You could either:
 *   1. Replace NotesInputField with this (if you want voice everywhere)
 *   2. Keep both and use this where voice makes sense
 *   3. Add an optional prop to NotesInputField to enable voice
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    TouchableOpacity,
    Modal,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
} from 'react-native';
import { FileText, X, Check } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useTheme } from '@/shared/hooks/useTheme';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Voice components
import { useVoiceDictation } from '@/shared/hooks/useVoiceDictation';
import { VoiceDictationButton, VoiceDictationIndicator } from '@/shared/components/VoiceDictationButton';

interface NotesInputFieldWithVoiceProps {
    value: string;
    onChangeText: (text: string) => void;
    label?: string;
    placeholder?: string;
    maxLength?: number;
    /** Enable voice dictation button */
    enableVoice?: boolean;
}

export function NotesInputFieldWithVoice({
    value,
    onChangeText,
    label = 'Notes',
    placeholder = 'Add a note...',
    maxLength = 500,
    enableVoice = true,
}: NotesInputFieldWithVoiceProps) {
    const { colors, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [localValue, setLocalValue] = useState(value);

    // Voice dictation hook
    const {
        isRecording,
        isAvailable,
        partialText,
        startRecording,
        stopRecording,
        cancelRecording,
    } = useVoiceDictation({
        onPartialResult: (text) => {
            // Show real-time transcription preview
            console.log('[Voice] Partial:', text);
        },
        onResult: (text) => {
            // Append transcribed text to current value
            if (text) {
                const separator = localValue.trim() ? ' ' : '';
                setLocalValue(prev => prev + separator + text);
            }
        },
    });

    // Sync local value when modal opens
    useEffect(() => {
        if (isModalVisible) {
            setLocalValue(value);
        }
    }, [isModalVisible, value]);

    const handleOpen = useCallback(() => {
        setIsModalVisible(true);
    }, []);

    const handleSave = useCallback(() => {
        // Stop recording if active
        if (isRecording) {
            stopRecording();
        }
        Keyboard.dismiss();
        onChangeText(localValue);
        setIsModalVisible(false);
    }, [localValue, onChangeText, isRecording, stopRecording]);

    const handleCancel = useCallback(() => {
        // Cancel recording if active
        if (isRecording) {
            cancelRecording();
        }
        Keyboard.dismiss();
        setLocalValue(value);
        setIsModalVisible(false);
    }, [value, isRecording, cancelRecording]);

    const handleVoiceToggle = useCallback(async () => {
        if (isRecording) {
            await stopRecording();
        } else {
            await startRecording();
        }
    }, [isRecording, startRecording, stopRecording]);

    const hasNotes = value.trim().length > 0;
    const previewText = hasNotes
        ? (value.length > 50 ? value.substring(0, 50) + '...' : value)
        : placeholder;

    return (
        <>
            {/* Preview Field */}
            <View>
                {label && (
                    <Text variant="label" className="mb-2" style={{ color: colors.foreground }}>
                        {label}
                    </Text>
                )}
                <TouchableOpacity
                    onPress={handleOpen}
                    activeOpacity={0.7}
                    className="flex-row items-center gap-3 p-4 rounded-xl border"
                    style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    }}
                >
                    <FileText size={20} color={hasNotes ? colors.primary : colors['muted-foreground']} />
                    <Text
                        variant="body"
                        className="flex-1"
                        numberOfLines={1}
                        style={{ color: hasNotes ? colors.foreground : colors['muted-foreground'] }}
                    >
                        {previewText}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Modal */}
            <Modal
                visible={isModalVisible}
                transparent
                animationType="none"
                onRequestClose={handleCancel}
            >
                <Animated.View
                    entering={FadeIn.duration(200)}
                    exiting={FadeOut.duration(150)}
                    className="flex-1 justify-center items-center"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        className="w-full px-6"
                    >
                        <Animated.View
                            entering={SlideInDown.springify().damping(20)}
                            exiting={SlideOutDown.duration(150)}
                            className="rounded-2xl overflow-hidden"
                            style={{
                                backgroundColor: colors.card,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 10 },
                                shadowOpacity: 0.25,
                                shadowRadius: 20,
                                elevation: 20,
                            }}
                        >
                            {/* Header */}
                            <View
                                className="flex-row items-center justify-between px-5 py-4 border-b"
                                style={{ borderBottomColor: colors.border }}
                            >
                                <TouchableOpacity onPress={handleCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <X size={24} color={colors['muted-foreground']} />
                                </TouchableOpacity>
                                <Text variant="h4" weight="semibold" style={{ color: colors.foreground }}>
                                    {label}
                                </Text>
                                <TouchableOpacity onPress={handleSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Check size={24} color={colors.primary} />
                                </TouchableOpacity>
                            </View>

                            {/* Text Input */}
                            <View className="p-5">
                                <TextInput
                                    value={localValue}
                                    onChangeText={setLocalValue}
                                    placeholder={placeholder}
                                    placeholderTextColor={colors['muted-foreground']}
                                    multiline
                                    numberOfLines={6}
                                    maxLength={maxLength}
                                    autoFocus={!enableVoice} // Don't autofocus if voice available
                                    textAlignVertical="top"
                                    className="text-base min-h-[150px] p-4 rounded-xl border"
                                    style={{
                                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                        borderColor: colors.border,
                                        color: colors.foreground,
                                        fontFamily: 'Inter_400Regular',
                                    }}
                                />

                                {/* Voice Recording Indicator */}
                                {enableVoice && (
                                    <VoiceDictationIndicator
                                        isRecording={isRecording}
                                        partialText={partialText}
                                    />
                                )}

                                <View className="flex-row justify-between items-center mt-2">
                                    <Text
                                        variant="caption"
                                        style={{ color: colors['muted-foreground'] }}
                                    >
                                        {localValue.length}/{maxLength}
                                    </Text>

                                    {/* Voice Button */}
                                    {enableVoice && isAvailable && (
                                        <VoiceDictationButton
                                            isRecording={isRecording}
                                            onPress={handleVoiceToggle}
                                            size="md"
                                        />
                                    )}
                                </View>
                            </View>

                            {/* Footer */}
                            <View className="px-5 pb-5">
                                <Button onPress={handleSave} variant="primary" size="lg" className="w-full" label="Save Note" />
                            </View>
                        </Animated.View>
                    </KeyboardAvoidingView>
                </Animated.View>
            </Modal>
        </>
    );
}
