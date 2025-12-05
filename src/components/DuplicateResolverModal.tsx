import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { Check, X, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/shared/hooks/useTheme';
import * as Contacts from 'expo-contacts';

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
            <BlurView intensity={20} style={StyleSheet.absoluteFill}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.container}
                >
                    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>

                        <View style={styles.header}>
                            <View style={[styles.iconContainer, { backgroundColor: '#fef3c7' }]}>
                                <AlertCircle size={32} color="#d97706" />
                            </View>
                            <Text style={[styles.title, { color: colors.foreground }]}>
                                Duplicate Found ({currentIndex + 1}/{conflicts.length})
                            </Text>
                            <Text style={[styles.description, { color: colors['muted-foreground'] }]}>
                                {currentConflict.type === 'existing_friend'
                                    ? `You already have a friend named "${currentConflict.originalName}".`
                                    : `You selected multiple contacts named "${currentConflict.originalName}".`
                                }
                            </Text>
                        </View>

                        <View style={[styles.contactPreview, { backgroundColor: colors.background }]}>
                            <View style={styles.avatarContainer}>
                                {currentConflict.contact.imageAvailable && currentConflict.contact.image ? (
                                    <Image
                                        source={{ uri: currentConflict.contact.image.uri }}
                                        style={styles.avatar}
                                    />
                                ) : (
                                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                                        <Text style={styles.avatarInitials}>
                                            {currentConflict.originalName.charAt(0)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.inputContainer}>
                                <Text style={[styles.label, { color: colors['muted-foreground'] }]}>
                                    Save as:
                                </Text>
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: colors.input,
                                        color: colors.foreground,
                                        borderColor: colors.border
                                    }]}
                                    value={currentName}
                                    onChangeText={setCurrentName}
                                    autoFocus
                                    selectTextOnFocus
                                />
                            </View>
                        </View>

                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.button, styles.skipButton, { borderColor: colors.border }]}
                                onPress={() => handleNext(true)}
                            >
                                <X size={20} color={colors['muted-foreground']} />
                                <Text style={[styles.buttonText, { color: colors['muted-foreground'] }]}>Don't Add</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.button, styles.saveButton, { backgroundColor: colors.primary }]}
                                onPress={() => handleNext(false)}
                                disabled={!currentName.trim()}
                            >
                                <Check size={20} color={colors['primary-foreground']} />
                                <Text style={[styles.buttonText, { color: colors['primary-foreground'] }]}>Save</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.cancelLink}
                            onPress={onCancel}
                        >
                            <Text style={[styles.cancelText, { color: colors['muted-foreground'] }]}>Cancel Import</Text>
                        </TouchableOpacity>

                    </View>
                </KeyboardAvoidingView>
            </BlurView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    card: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 8,
        textAlign: 'center',
    },
    description: {
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 22,
    },
    contactPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        marginBottom: 24,
        gap: 16,
    },
    avatarContainer: {
        width: 56,
        height: 56,
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarInitials: {
        color: 'white',
        fontSize: 24,
        fontWeight: '600',
    },
    inputContainer: {
        flex: 1,
    },
    label: {
        fontSize: 12,
        marginBottom: 4,
        fontWeight: '500',
    },
    input: {
        height: 44,
        borderRadius: 10,
        paddingHorizontal: 12,
        fontSize: 16,
        borderWidth: 1,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    button: {
        flex: 1,
        height: 48,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    skipButton: {
        borderWidth: 1,
        backgroundColor: 'transparent',
    },
    saveButton: {

    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
    },
    cancelLink: {
        alignItems: 'center',
    },
    cancelText: {
        fontSize: 14,
        fontWeight: '500',
        textDecorationLine: 'underline',
    },
});
