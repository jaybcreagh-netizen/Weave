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

interface NotesInputFieldProps {
    value: string;
    onChangeText: (text: string) => void;
    label?: string;
    placeholder?: string;
    maxLength?: number;
}

/**
 * NotesInputField - A compact notes input that expands into a focused modal.
 * 
 * Shows a single-line preview with the current notes value.
 * When tapped, opens a centered modal with a multiline text area for editing.
 * This pattern avoids keyboard/scroll issues in complex forms.
 */
export function NotesInputField({
    value,
    onChangeText,
    label = 'Notes',
    placeholder = 'Add a note...',
    maxLength = 500,
}: NotesInputFieldProps) {
    const { colors, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [localValue, setLocalValue] = useState(value);

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
        Keyboard.dismiss();
        onChangeText(localValue);
        setIsModalVisible(false);
    }, [localValue, onChangeText]);

    const handleCancel = useCallback(() => {
        Keyboard.dismiss();
        setLocalValue(value); // Reset to original
        setIsModalVisible(false);
    }, [value]);

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
                                    autoFocus
                                    textAlignVertical="top"
                                    className="text-base min-h-[150px] p-4 rounded-xl border"
                                    style={{
                                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                                        borderColor: colors.border,
                                        color: colors.foreground,
                                        fontFamily: 'Inter_400Regular',
                                    }}
                                />
                                <Text
                                    variant="caption"
                                    className="mt-2 text-right"
                                    style={{ color: colors['muted-foreground'] }}
                                >
                                    {localValue.length}/{maxLength}
                                </Text>
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
