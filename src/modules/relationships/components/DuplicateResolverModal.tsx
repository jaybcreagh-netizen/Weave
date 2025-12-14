import React, { useState } from 'react';
import { View, Modal, TouchableOpacity, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Check, X, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import * as Contacts from 'expo-contacts';
import { Text } from '@/shared/ui/Text';
import { Input } from '@/shared/ui/Input';

interface DuplicateResolverModalProps {
    isVisible: boolean;
    conflicts: Array<{
        contact: Contacts.Contact;
        type: 'existing_friend' | 'batch_duplicate';
        originalName: string;
        suggestedName?: string;
    }>;
    onResolve: (resolutions: Array<{ contactId: string; newName: string; skipped: boolean }>) => void;
    onCancel: () => void;
}

export function DuplicateResolverModal({ isVisible, conflicts, onResolve, onCancel }: DuplicateResolverModalProps) {
    const { colors, isDarkMode } = useTheme();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentName, setCurrentName] = useState('');
    const [resolutions, setResolutions] = useState<Array<{ contactId: string; newName: string; skipped: boolean }>>([]);

    // Initialize current name when index changes
    React.useEffect(() => {
        if (conflicts[currentIndex]) {
            setCurrentName(conflicts[currentIndex].suggestedName || conflicts[currentIndex].originalName);
        }
    }, [currentIndex, conflicts]);

    const currentConflict = conflicts[currentIndex];

    const handleNext = (skipped: boolean) => {
        const newResolution = {
            contactId: currentConflict.contact.id || '',
            newName: currentName.trim(),
            skipped,
        };

        const newResolutions = [...resolutions, newResolution];
        setResolutions(newResolutions);

        if (currentIndex < conflicts.length - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            // All done
            onResolve(newResolutions);
            // Reset for next time (though component usually unmounts/hides)
            setCurrentIndex(0);
            setResolutions([]);
        }
    };

    if (!currentConflict) return null;

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <BlurView intensity={20} className="flex-1 justify-center items-center p-5 bg-black/40">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    className="flex-1 justify-center items-center w-full"
                >
                    <View
                        className="w-full max-w-sm rounded-3xl p-6 border shadow-xl"
                        style={{
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            elevation: 8
                        }}
                    >

                        <View className="items-center mb-6">
                            <View className="w-16 h-16 rounded-full justify-center items-center mb-4 bg-amber-100">
                                <AlertCircle size={32} color="#d97706" />
                            </View>
                            <Text variant="h3" weight="bold" className="mb-2 text-center">
                                Duplicate Found ({currentIndex + 1}/{conflicts.length})
                            </Text>
                            <Text align="center" color="muted" className="leading-6">
                                {currentConflict.type === 'existing_friend'
                                    ? `You already have a friend named "${currentConflict.originalName}".`
                                    : `You selected multiple contacts named "${currentConflict.originalName}".`
                                }
                            </Text>
                        </View>

                        <View
                            className="flex-row items-center p-4 rounded-2xl mb-6 gap-4"
                            style={{ backgroundColor: colors.background }}
                        >
                            <View className="w-14 h-14">
                                {currentConflict.contact.imageAvailable && currentConflict.contact.image ? (
                                    <Image
                                        source={{ uri: currentConflict.contact.image.uri }}
                                        className="w-full h-full rounded-full"
                                    />
                                ) : (
                                    <View
                                        className="w-full h-full rounded-full justify-center items-center"
                                        style={{ backgroundColor: colors.primary }}
                                    >
                                        <Text weight="bold" className="text-xl text-white">
                                            {currentConflict.originalName.charAt(0)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <View className="flex-1">
                                <Input
                                    label="Save as:"
                                    value={currentName}
                                    onChangeText={setCurrentName}
                                    autoFocus
                                    selectTextOnFocus
                                    containerClassName="mb-0"
                                />
                            </View>
                        </View>

                        <View className="flex-row gap-3 mb-4">
                            <TouchableOpacity
                                className="flex-1 h-12 rounded-xl flex-row justify-center items-center gap-2 border"
                                style={{ borderColor: colors.border }}
                                onPress={() => handleNext(true)}
                            >
                                <X size={20} color={colors['muted-foreground']} />
                                <Text color="muted" weight="semibold">Don't Add</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                className="flex-1 h-12 rounded-xl flex-row justify-center items-center gap-2"
                                style={{ backgroundColor: colors.primary, opacity: !currentName.trim() ? 0.5 : 1 }}
                                onPress={() => handleNext(false)}
                                disabled={!currentName.trim()}
                            >
                                <Check size={20} color={colors['primary-foreground']} />
                                <Text style={{ color: colors['primary-foreground'] }} weight="semibold">Save</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            className="items-center"
                            onPress={onCancel}
                        >
                            <Text color="muted" weight="medium" className="underline">Cancel Import</Text>
                        </TouchableOpacity>

                    </View>
                </KeyboardAvoidingView>
            </BlurView>
        </Modal>
    );
}
