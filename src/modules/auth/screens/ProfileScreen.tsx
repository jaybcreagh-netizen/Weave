/**
 * Profile Screen - Consolidated Layout
 * 
 * Clean, section-based profile editing:
 * - Photo at top
 * - Identity section (username, display name)
 * - Personal section (birthday, archetype)
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { router } from 'expo-router';
import { User, AtSign, Edit3, Check, X, ChevronLeft, Camera, Cake, Sparkles, ChevronRight, Eye, LogOut } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { CachedImage } from '@/shared/ui/CachedImage';
import { useTheme } from '@/shared/hooks/useTheme';
import { getCurrentSession, getUserProfile } from '@/modules/auth/services/supabase-auth.service';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { ArchetypeCarouselPicker } from '@/modules/intelligence/components/archetypes/ArchetypeCarouselPicker';
import { archetypeData } from '@/shared/constants/constants';
import { unregisterPushToken } from '@/modules/notifications/services/push-token.service';
import type { Archetype } from '@/shared/types/common';

export function ProfileScreen() {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    // Profile fields
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [photoUrl, setPhotoUrl] = useState<string | undefined>();
    const [birthday, setBirthday] = useState<Date | undefined>();
    const [archetype, setArchetype] = useState<Archetype | undefined>();

    // Original values for change detection
    const [originalUsername, setOriginalUsername] = useState('');
    const [originalDisplayName, setOriginalDisplayName] = useState('');
    const [originalBirthday, setOriginalBirthday] = useState<string | undefined>();
    const [originalArchetype, setOriginalArchetype] = useState<string | undefined>();

    // UI State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showArchetypePicker, setShowArchetypePicker] = useState(false);

    // Username validation
    const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
    const [checkingUsername, setCheckingUsername] = useState(false);

    // Cleanup modals on unmount to prevent gesture blocking
    useEffect(() => {
        return () => {
            setShowDatePicker(false);
            setShowArchetypePicker(false);
        };
    }, []);

    // Debug: Track when archetype picker is shown
    useEffect(() => {
        if (showArchetypePicker) {
            console.log('[ProfileScreen] showArchetypePicker became true, stack:', new Error().stack);
        }
    }, [showArchetypePicker]);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        const session = await getCurrentSession();
        if (!session) {
            Alert.alert('Error', 'Not signed in');
            router.back();
            return;
        }

        setUserId(session.userId);

        const profile = await getUserProfile(session.userId);
        if (profile) {
            setUsername(profile.username);
            setDisplayName(profile.displayName);
            setPhotoUrl(profile.photoUrl);
            setOriginalUsername(profile.username);
            setOriginalDisplayName(profile.displayName);

            if (profile.birthday) {
                setBirthday(new Date(profile.birthday));
                setOriginalBirthday(profile.birthday);
            }

            if (profile.archetype) {
                setArchetype(profile.archetype as Archetype);
                setOriginalArchetype(profile.archetype);
            }
        }

        setLoading(false);
    };

    const handlePickPhoto = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Required', 'Please allow photo library access.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
            base64: true,
        });

        if (!result.canceled && result.assets[0].base64) {
            await uploadPhoto(result.assets[0].base64, result.assets[0].mimeType || 'image/jpeg');
        }
    };

    const uploadPhoto = async (base64: string, mimeType: string) => {
        if (!userId) return;

        setUploadingPhoto(true);

        const client = getSupabaseClient();
        if (!client) {
            Alert.alert('Error', 'Could not connect to server');
            setUploadingPhoto(false);
            return;
        }

        const extension = mimeType.split('/')[1] || 'jpeg';
        const filePath = `${userId}/avatar.${extension}`;

        const { error: uploadError } = await client.storage
            .from('profile-photos')
            .upload(filePath, decode(base64), {
                contentType: mimeType,
                upsert: true,
            });

        if (uploadError) {
            Alert.alert('Error', 'Could not upload photo');
            setUploadingPhoto(false);
            return;
        }

        const { data: urlData } = client.storage
            .from('profile-photos')
            .getPublicUrl(filePath);

        const newUrl = `${urlData.publicUrl}?t=${Date.now()}`;
        setPhotoUrl(newUrl);

        await client
            .from('user_profiles')
            .update({ photo_url: newUrl })
            .eq('id', userId);

        setUploadingPhoto(false);
    };

    const checkUsernameAvailability = async (newUsername: string) => {
        if (newUsername === originalUsername) {
            setUsernameAvailable(true);
            return;
        }

        if (newUsername.length < 3 || !/^[a-z0-9_]+$/.test(newUsername)) {
            setUsernameAvailable(null);
            return;
        }

        setCheckingUsername(true);
        const client = getSupabaseClient();
        if (!client) {
            setCheckingUsername(false);
            return;
        }

        const { data } = await client
            .from('user_profiles')
            .select('username')
            .eq('username', newUsername.toLowerCase())
            .single();

        setUsernameAvailable(!data);
        setCheckingUsername(false);
    };

    const handleUsernameChange = (text: string) => {
        const sanitized = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
        setUsername(sanitized);
        setUsernameAvailable(null);
        clearTimeout((handleUsernameChange as any).timeout);
        (handleUsernameChange as any).timeout = setTimeout(() => {
            checkUsernameAvailability(sanitized);
        }, 500);
    };

    const handleDateChange = (_event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (selectedDate) {
            setBirthday(selectedDate);
        }
    };

    const handleSignOut = async () => {
        Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out? Your data will remain on this device.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Sign Out',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await unregisterPushToken();
                            const client = getSupabaseClient();
                            if (client) {
                                await client.auth.signOut();
                            }
                            router.replace('/');
                        } catch (error) {
                            console.error('Sign out error:', error);
                            Alert.alert('Error', 'Failed to sign out. Please try again.');
                        }
                    },
                },
            ]
        );
    };

    const formatBirthday = (date?: Date) => {
        if (!date) return 'Not set';
        return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    };

    const handleSave = async () => {
        if (!userId) return;

        if (username.length < 3) {
            Alert.alert('Invalid Username', 'Username must be at least 3 characters');
            return;
        }

        if (usernameAvailable === false) {
            Alert.alert('Username Taken', 'Please choose a different username');
            return;
        }

        if (!displayName.trim()) {
            Alert.alert('Invalid Name', 'Please enter a display name');
            return;
        }

        setSaving(true);

        const client = getSupabaseClient();
        if (!client) {
            Alert.alert('Error', 'Could not connect to server');
            setSaving(false);
            return;
        }

        const profileData: Record<string, any> = {
            id: userId,
            username: username.toLowerCase(),
            display_name: displayName.trim(),
            updated_at: new Date().toISOString(),
            // Auto-detect timezone from device
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        if (birthday) {
            profileData.birthday = birthday.toISOString().split('T')[0];
        }

        if (archetype) {
            profileData.archetype = archetype;
        }

        const { error } = await client
            .from('user_profiles')
            .upsert(profileData, { onConflict: 'id' });

        setSaving(false);

        if (error) {
            Alert.alert('Error', 'Could not save profile. Please try again.');
            return;
        }

        setOriginalUsername(username);
        setOriginalDisplayName(displayName);
        if (birthday) setOriginalBirthday(birthday.toISOString().split('T')[0]);
        if (archetype) setOriginalArchetype(archetype);

        Alert.alert('Success', 'Profile saved!', [
            { text: 'OK', onPress: () => router.back() }
        ]);
    };

    const birthdayStr = birthday?.toISOString().split('T')[0];
    const hasChanges = username !== originalUsername ||
        displayName !== originalDisplayName ||
        birthdayStr !== originalBirthday ||
        archetype !== originalArchetype;

    if (loading) {
        return (
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Button
                    variant="ghost"
                    onPress={() => router.back()}
                    icon={<ChevronLeft size={24} color={colors.foreground} />}
                />
                <Text variant="h2" style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                style={styles.content}
                contentContainerStyle={styles.contentContainer}
                showsVerticalScrollIndicator={false}
            >
                {/* Photo Section */}
                <View style={styles.photoSection}>
                    <TouchableOpacity
                        onPress={handlePickPhoto}
                        disabled={uploadingPhoto}
                        style={[styles.photoContainer, { borderColor: colors.border }]}
                    >
                        {photoUrl ? (
                            <CachedImage source={{ uri: photoUrl }} style={styles.photo} />
                        ) : (
                            <View style={[styles.photoPlaceholder, { backgroundColor: colors.muted }]}>
                                <User size={48} color={colors['muted-foreground']} />
                            </View>
                        )}
                        {uploadingPhoto && (
                            <View style={styles.uploadingOverlay}>
                                <ActivityIndicator color="#FFFFFF" />
                            </View>
                        )}
                        <View style={[styles.cameraIcon, { backgroundColor: colors.primary }]}>
                            <Camera size={16} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Identity Section */}
                <View style={styles.section}>
                    <Text variant="caption" style={[styles.sectionTitle, { color: colors['muted-foreground'] }]}>
                        IDENTITY
                    </Text>

                    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {/* Username */}
                        <View style={styles.fieldRow}>
                            <View style={styles.fieldLabel}>
                                <AtSign size={18} color={colors['muted-foreground']} />
                                <Text style={{ color: colors['muted-foreground'] }}>Username</Text>
                            </View>
                            <View style={styles.fieldValue}>
                                <Input
                                    value={username}
                                    onChangeText={handleUsernameChange}
                                    placeholder="username"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    style={[styles.inlineInput, { color: colors.foreground }]}
                                />
                                {checkingUsername && (
                                    <ActivityIndicator size="small" color={colors['muted-foreground']} />
                                )}
                                {usernameAvailable === true && !checkingUsername && (
                                    <Check size={18} color="#22C55E" />
                                )}
                                {usernameAvailable === false && !checkingUsername && (
                                    <X size={18} color="#EF4444" />
                                )}
                            </View>
                        </View>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        {/* Display Name */}
                        <View style={styles.fieldRow}>
                            <View style={styles.fieldLabel}>
                                <Edit3 size={18} color={colors['muted-foreground']} />
                                <Text style={{ color: colors['muted-foreground'] }}>Display Name</Text>
                            </View>
                            <View style={styles.fieldValue}>
                                <Input
                                    value={displayName}
                                    onChangeText={setDisplayName}
                                    placeholder="Your Name"
                                    style={[styles.inlineInput, { color: colors.foreground }]}
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Personal Section */}
                <View style={styles.section}>
                    <Text variant="caption" style={[styles.sectionTitle, { color: colors['muted-foreground'] }]}>
                        PERSONAL
                    </Text>

                    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        {/* Birthday */}
                        <TouchableOpacity
                            style={styles.fieldRow}
                            onPress={() => setShowDatePicker(true)}
                        >
                            <View style={styles.fieldLabel}>
                                <Cake size={18} color={colors['muted-foreground']} />
                                <Text style={{ color: colors['muted-foreground'] }}>Birthday</Text>
                            </View>
                            <View style={styles.fieldValue}>
                                <Text style={{ color: birthday ? colors.foreground : colors['muted-foreground'] }}>
                                    {formatBirthday(birthday)}
                                </Text>
                                <ChevronRight size={18} color={colors['muted-foreground']} />
                            </View>
                        </TouchableOpacity>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        {/* Archetype */}
                        <TouchableOpacity
                            style={styles.fieldRow}
                            onPress={() => setShowArchetypePicker(true)}
                        >
                            <View style={styles.fieldLabel}>
                                <Sparkles size={18} color={colors['muted-foreground']} />
                                <Text style={{ color: colors['muted-foreground'] }}>Archetype</Text>
                            </View>
                            <View style={styles.fieldValue}>
                                <Text style={{ color: archetype ? colors.foreground : colors['muted-foreground'] }}>
                                    {archetype ? archetypeData[archetype]?.name || archetype : 'Not set'}
                                </Text>
                                <ChevronRight size={18} color={colors['muted-foreground']} />
                            </View>
                        </TouchableOpacity>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        {/* Take Quiz */}
                        <TouchableOpacity
                            style={styles.fieldRow}
                            onPress={() => router.push('/archetype-quiz')}
                        >
                            <View style={styles.fieldLabel}>
                                <Sparkles size={18} color={colors.primary} />
                                <Text style={{ color: colors.primary, fontWeight: '500' }}>
                                    {archetype ? 'Retake Quiz' : 'Take the Quiz'}
                                </Text>
                            </View>
                            <View style={styles.fieldValue}>
                                <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                    60 seconds
                                </Text>
                                <ChevronRight size={18} color={colors.primary} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Save Button */}
                <Button
                    variant="primary"
                    label={saving ? 'Saving...' : 'Save Changes'}
                    onPress={handleSave}
                    disabled={!hasChanges || saving || usernameAvailable === false}
                    style={styles.saveButton}
                />

                {/* Account Section */}
                <View style={[styles.section, { marginTop: 24 }]}>
                    <Text style={[styles.sectionTitle, { color: colors['muted-foreground'] }]}>
                        ACCOUNT
                    </Text>

                    <View style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        borderWidth: 1,
                        borderRadius: 12,
                        overflow: 'hidden',
                    }}>
                        {/* Profile Visibility */}
                        <TouchableOpacity
                            style={styles.fieldRow}
                            onPress={() => router.push('/visibility-settings')}
                        >
                            <View style={styles.fieldLabel}>
                                <Eye size={20} color={colors.primary} style={{ marginRight: 8 }} />
                                <Text style={{ color: colors.foreground }}>
                                    Profile Visibility
                                </Text>
                            </View>
                            <View style={styles.fieldValue}>
                                <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                    Control what friends see
                                </Text>
                                <ChevronRight size={18} color={colors['muted-foreground']} />
                            </View>
                        </TouchableOpacity>

                        <View style={[styles.divider, { backgroundColor: colors.border }]} />

                        {/* Sign Out */}
                        <TouchableOpacity
                            style={styles.fieldRow}
                            onPress={handleSignOut}
                        >
                            <View style={styles.fieldLabel}>
                                <LogOut size={20} color={colors.destructive} style={{ marginRight: 8 }} />
                                <Text style={{ color: colors.destructive }}>
                                    Sign Out
                                </Text>
                            </View>
                            <View style={styles.fieldValue}>
                                <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                    Data stays on device
                                </Text>
                                <ChevronRight size={18} color={colors['muted-foreground']} />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>

            {/* Date Picker Modal */}
            {showDatePicker && (
                <Modal
                    transparent
                    animationType="slide"
                    visible={showDatePicker}
                    onRequestClose={() => setShowDatePicker(false)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                            <View style={styles.modalHeader}>
                                <Text variant="h3">Select Birthday</Text>
                                <Button
                                    variant="primary"
                                    label="Done"
                                    onPress={() => setShowDatePicker(false)}
                                />
                            </View>
                            <DateTimePicker
                                value={birthday || new Date(1990, 0, 1)}
                                mode="date"
                                display="spinner"
                                onChange={handleDateChange}
                                maximumDate={new Date()}
                                minimumDate={new Date(1920, 0, 1)}
                            />
                        </View>
                    </View>
                </Modal>
            )}

            {/* Archetype Picker Modal */}
            <Modal
                visible={showArchetypePicker}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowArchetypePicker(false)}
            >
                <View style={[styles.archetypeModal, { backgroundColor: colors.background }]}>
                    <View style={styles.archetypeModalHeader}>
                        <Text variant="h2">Choose Your Archetype</Text>
                        <Button
                            variant="ghost"
                            label="Done"
                            onPress={() => setShowArchetypePicker(false)}
                        />
                    </View>
                    <ArchetypeCarouselPicker
                        selectedArchetype={archetype || 'Sun'}
                        onSelect={(selected) => {
                            setArchetype(selected);
                            setShowArchetypePicker(false);
                        }}
                    />
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        paddingTop: 60,
        paddingBottom: 16,
        borderBottomWidth: 1,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
        paddingBottom: 40,
    },
    photoSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    photoContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
        overflow: 'hidden',
    },
    photo: {
        width: '100%',
        height: '100%',
    },
    photoPlaceholder: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    cameraIcon: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 1,
        marginBottom: 8,
        marginLeft: 4,
    },
    sectionCard: {
        borderRadius: 12,
        borderWidth: 1,
        overflow: 'hidden',
    },
    fieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    fieldLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    fieldValue: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
        justifyContent: 'flex-end',
    },
    inlineInput: {
        flex: 1,
        textAlign: 'right',
        borderWidth: 0,
        backgroundColor: 'transparent',
        paddingVertical: 0,
        paddingHorizontal: 0,
    },
    divider: {
        height: 1,
        marginLeft: 44,
    },
    saveButton: {
        marginTop: 8,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        paddingBottom: 40,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    archetypeModal: {
        flex: 1,
        paddingTop: 60,
    },
    archetypeModalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
});

export default ProfileScreen;
