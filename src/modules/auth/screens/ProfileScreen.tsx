/**
 * Profile Screen
 * 
 * Allows users to view and edit their profile:
 * - Username (unique, for friend discovery)
 * - Display name
 * - Profile photo
 * - Birthday
 * - Archetype
 */

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { router } from 'expo-router';
import { User, AtSign, Edit3, Check, X, ChevronLeft, Camera, Cake, Sparkles } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import DateTimePicker from '@react-native-community/datetimepicker';

import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { Input } from '@/shared/ui/Input';
import { CachedImage } from '@/shared/ui/CachedImage';
import { useTheme } from '@/shared/hooks/useTheme';
import { getCurrentSession, getUserProfile } from '@/modules/auth/services/supabase-auth.service';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { ArchetypeCarouselPicker } from '@/modules/intelligence/components/archetypes/ArchetypeCarouselPicker';
import { archetypeData } from '@/shared/constants/constants';
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

            // Birthday
            if (profile.birthday) {
                setBirthday(new Date(profile.birthday));
                setOriginalBirthday(profile.birthday);
            }

            // Archetype
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
            Alert.alert('Permission Required', 'Please allow access to your photo library to upload a profile photo.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (result.canceled || !result.assets[0]) {
            return;
        }

        const asset = result.assets[0];

        // Import manipulator dynamically
        const ImageManipulator = await import('expo-image-manipulator');

        // Resize and compress the image
        const manipulated = await ImageManipulator.manipulateAsync(
            asset.uri,
            [{ resize: { width: 400 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        if (!manipulated.base64) {
            Alert.alert('Error', 'Could not process the image');
            return;
        }

        console.log('[Profile] Image resized, size:', Math.round(manipulated.base64.length / 1024), 'KB');

        await uploadPhoto(manipulated.base64, 'image/jpeg');
    };

    const uploadPhoto = async (base64: string, mimeType: string) => {
        if (!userId) return;

        const client = getSupabaseClient();
        if (!client) {
            Alert.alert('Error', 'Could not connect to server');
            return;
        }

        setUploadingPhoto(true);

        try {
            const ext = mimeType === 'image/png' ? 'png' : 'jpg';
            const filePath = `${userId}/avatar.${ext}`;

            const { error: uploadError } = await client.storage
                .from('profile-photos')
                .upload(filePath, decode(base64), {
                    contentType: mimeType,
                    upsert: true,
                });

            if (uploadError) {
                console.error('[Profile] Upload error:', uploadError);
                Alert.alert('Upload Failed', 'Could not upload photo. Please try again.');
                setUploadingPhoto(false);
                return;
            }

            const { data: urlData } = client.storage
                .from('profile-photos')
                .getPublicUrl(filePath);

            const newPhotoUrl = urlData.publicUrl + `?t=${Date.now()}`;

            const { error: updateError } = await client
                .from('user_profiles')
                .update({ photo_url: newPhotoUrl, updated_at: new Date().toISOString() })
                .eq('id', userId);

            if (updateError) {
                console.error('[Profile] Update error:', updateError);
                Alert.alert('Error', 'Photo uploaded but could not update profile.');
            } else {
                setPhotoUrl(newPhotoUrl);
            }
        } catch (error) {
            console.error('[Profile] Photo upload error:', error);
            Alert.alert('Error', 'Something went wrong. Please try again.');
        }

        setUploadingPhoto(false);
    };

    const checkUsernameAvailability = async (newUsername: string) => {
        if (newUsername === originalUsername) {
            setUsernameAvailable(true);
            return;
        }

        if (newUsername.length < 3) {
            setUsernameAvailable(null);
            return;
        }

        setCheckingUsername(true);
        const client = getSupabaseClient();

        if (client) {
            const { data } = await client
                .from('user_profiles')
                .select('id')
                .eq('username', newUsername.toLowerCase())
                .single();

            setUsernameAvailable(!data);
        }

        setCheckingUsername(false);
    };

    const handleUsernameChange = (text: string) => {
        const sanitized = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
        setUsername(sanitized);
        setUsernameAvailable(null);

        if (sanitized.length >= 3) {
            setTimeout(() => checkUsernameAvailability(sanitized), 500);
        }
    };

    const handleDateChange = (_event: any, selectedDate?: Date) => {
        if (Platform.OS === 'android') {
            setShowDatePicker(false);
        }
        if (selectedDate) {
            setBirthday(selectedDate);
        }
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
        };

        // Only set birthday if provided
        if (birthday) {
            profileData.birthday = birthday.toISOString().split('T')[0];
        }

        // Only set archetype if provided
        if (archetype) {
            profileData.archetype = archetype;
        }

        console.log('[Profile] Saving profile with upsert:', profileData);

        // Use upsert - creates if not exists, updates if exists
        const { error } = await client
            .from('user_profiles')
            .upsert(profileData, { onConflict: 'id' });

        setSaving(false);

        if (error) {
            console.error('[Profile] Save error:', error);
            Alert.alert('Error', 'Could not save profile. Please try again.');
            return;
        }

        // Update original values so hasChanges resets
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
                <Text>Loading...</Text>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Header */}
            <View style={styles.header}>
                <Button
                    variant="ghost"
                    onPress={() => router.back()}
                    icon={<ChevronLeft size={24} color={colors.foreground} />}
                />
                <Text variant="h2" style={styles.headerTitle}>Edit Profile</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Profile Photo */}
                <View style={styles.photoSection}>
                    <TouchableOpacity
                        onPress={handlePickPhoto}
                        disabled={uploadingPhoto}
                        style={[styles.photoContainer, { borderColor: colors.border }]}
                    >
                        {photoUrl ? (
                            <CachedImage
                                source={{ uri: photoUrl }}
                                style={styles.photo}
                            />
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
                    <Text variant="caption" style={{ color: colors['muted-foreground'], marginTop: 8 }}>
                        Tap to change photo
                    </Text>
                </View>

                {/* Username */}
                <Card style={styles.fieldCard}>
                    <View style={styles.fieldHeader}>
                        <AtSign size={20} color={colors['muted-foreground']} />
                        <Text variant="caption" style={styles.fieldLabel}>Username</Text>
                        {checkingUsername && (
                            <Text variant="caption" style={{ color: colors['muted-foreground'] }}>Checking...</Text>
                        )}
                        {usernameAvailable === true && !checkingUsername && (
                            <Check size={16} color="#22C55E" />
                        )}
                        {usernameAvailable === false && !checkingUsername && (
                            <X size={16} color="#EF4444" />
                        )}
                    </View>
                    <Input
                        value={username}
                        onChangeText={handleUsernameChange}
                        placeholder="your_username"
                        autoCapitalize="none"
                        autoCorrect={false}
                        style={styles.input}
                    />
                    <Text variant="caption" style={[styles.hint, { color: colors['muted-foreground'] }]}>
                        3+ characters. Letters, numbers, underscores only.
                    </Text>
                </Card>

                {/* Display Name */}
                <Card style={styles.fieldCard}>
                    <View style={styles.fieldHeader}>
                        <Edit3 size={20} color={colors['muted-foreground']} />
                        <Text variant="caption" style={styles.fieldLabel}>Display Name</Text>
                    </View>
                    <Input
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="Your Name"
                        style={styles.input}
                    />
                    <Text variant="caption" style={[styles.hint, { color: colors['muted-foreground'] }]}>
                        How your name appears to friends.
                    </Text>
                </Card>

                {/* Birthday */}
                <Card style={styles.fieldCard}>
                    <View style={styles.fieldHeader}>
                        <Cake size={20} color={colors['muted-foreground']} />
                        <Text variant="caption" style={styles.fieldLabel}>Birthday</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowDatePicker(true)}
                        style={[styles.selectButton, { borderColor: colors.border }]}
                    >
                        <Text style={{ color: birthday ? colors.foreground : colors['muted-foreground'] }}>
                            {formatBirthday(birthday)}
                        </Text>
                    </TouchableOpacity>
                    <Text variant="caption" style={[styles.hint, { color: colors['muted-foreground'] }]}>
                        Friends will see this when you link with them.
                    </Text>
                </Card>

                {/* Archetype */}
                <Card style={styles.fieldCard}>
                    <View style={styles.fieldHeader}>
                        <Sparkles size={20} color={colors['muted-foreground']} />
                        <Text variant="caption" style={styles.fieldLabel}>Your Archetype</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => setShowArchetypePicker(true)}
                        style={[styles.selectButton, { borderColor: colors.border }]}
                    >
                        <Text style={{ color: archetype ? colors.foreground : colors['muted-foreground'] }}>
                            {archetype ? archetypeData[archetype]?.name || archetype : 'Not set'}
                        </Text>
                    </TouchableOpacity>
                    <Text variant="caption" style={[styles.hint, { color: colors['muted-foreground'] }]}>
                        How you prefer to connect with friends.
                    </Text>
                </Card>

                {/* Save Button */}
                <Button
                    variant="primary"
                    label={saving ? 'Saving...' : 'Save Changes'}
                    onPress={handleSave}
                    disabled={!hasChanges || saving || usernameAvailable === false}
                    style={styles.saveButton}
                />
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
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 24,
        paddingBottom: 100,
    },
    photoSection: {
        alignItems: 'center',
        marginBottom: 32,
    },
    photoContainer: {
        position: 'relative',
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 3,
    },
    photo: {
        width: '100%',
        height: '100%',
        borderRadius: 57,
    },
    photoPlaceholder: {
        width: '100%',
        height: '100%',
        borderRadius: 57,
        alignItems: 'center',
        justifyContent: 'center',
    },
    uploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 57,
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
    fieldCard: {
        padding: 16,
        marginBottom: 16,
    },
    fieldHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    fieldLabel: {
        flex: 1,
    },
    input: {
        marginBottom: 4,
    },
    hint: {
        marginTop: 4,
    },
    selectButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
    },
    saveButton: {
        marginTop: 16,
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
