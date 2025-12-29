/**
 * Profile Screen - Consolidated Layout
 * 
 * Clean, section-based profile editing:
 * - Photo at top
 * - Identity section (username, display name)
 * - Personal section (birthday, archetype)
 */

import React, { useState, useEffect } from 'react';
import { View, Alert, ScrollView, KeyboardAvoidingView, Platform, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
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
import { getCurrentSession, getUserProfile } from '@/modules/auth';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { ArchetypeCarouselPicker } from '@/modules/intelligence';
import { archetypeData } from '@/shared/constants/constants';
import { unregisterPushToken } from '@/modules/notifications';
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
            <View className="flex-1 items-center justify-center" style={{ backgroundColor: colors.background }}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            className="flex-1"
            style={{ backgroundColor: colors.background }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            {/* Header */}
            <View className="flex-row items-center justify-between px-2 pt-14 pb-4 border-b" style={{ borderColor: colors.border }}>
                <Button
                    variant="ghost"
                    onPress={() => router.back()}
                    icon={<ChevronLeft size={24} color={colors.foreground} />}
                />
                <Text variant="h2" className="flex-1 text-center">Edit Profile</Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Photo Section */}
                <View className="items-center mb-8">
                    <TouchableOpacity
                        onPress={handlePickPhoto}
                        disabled={uploadingPhoto}
                        className="w-32 h-32 rounded-full border-4 overflow-hidden relative"
                        style={{ borderColor: colors.border }}
                    >
                        {photoUrl ? (
                            <CachedImage source={{ uri: photoUrl }} className="w-full h-full" />
                        ) : (
                            <View className="w-full h-full items-center justify-center" style={{ backgroundColor: colors.muted }}>
                                <User size={48} color={colors['muted-foreground']} />
                            </View>
                        )}
                        {uploadingPhoto && (
                            <View className="absolute inset-0 bg-black/50 items-center justify-center">
                                <ActivityIndicator color="#FFFFFF" />
                            </View>
                        )}
                        <View className="absolute bottom-0 right-0 w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary }}>
                            <Camera size={16} color="#FFFFFF" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Identity Section */}
                <View className="mb-6">
                    <Text variant="caption" className="text-xs font-semibold tracking-widest mb-2 ml-1" style={{ color: colors['muted-foreground'] }}>
                        IDENTITY
                    </Text>

                    <View className="rounded-xl border overflow-hidden" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                        {/* Username */}
                        <View className="flex-row items-center justify-between py-3.5 px-4">
                            <View className="flex-row items-center gap-2.5">
                                <AtSign size={18} color={colors['muted-foreground']} />
                                <Text style={{ color: colors['muted-foreground'] }}>Username</Text>
                            </View>
                            <View className="flex-row items-center gap-2 flex-1 justify-end">
                                <Input
                                    value={username}
                                    onChangeText={handleUsernameChange}
                                    placeholder="username"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    className="flex-1 text-right border-0 bg-transparent p-0"
                                    style={{ color: colors.foreground }}
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

                        <View className="h-px ml-11" style={{ backgroundColor: colors.border }} />

                        {/* Display Name */}
                        <View className="flex-row items-center justify-between py-3.5 px-4">
                            <View className="flex-row items-center gap-2.5">
                                <Edit3 size={18} color={colors['muted-foreground']} />
                                <Text style={{ color: colors['muted-foreground'] }}>Display Name</Text>
                            </View>
                            <View className="flex-row items-center gap-2 flex-1 justify-end">
                                <Input
                                    value={displayName}
                                    onChangeText={setDisplayName}
                                    placeholder="Your Name"
                                    className="flex-1 text-right border-0 bg-transparent p-0"
                                    style={{ color: colors.foreground }}
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Personal Section */}
                <View className="mb-6">
                    <Text variant="caption" className="text-xs font-semibold tracking-widest mb-2 ml-1" style={{ color: colors['muted-foreground'] }}>
                        PERSONAL
                    </Text>

                    <View className="rounded-xl border overflow-hidden" style={{ backgroundColor: colors.card, borderColor: colors.border }}>
                        {/* Birthday */}
                        <TouchableOpacity
                            className="flex-row items-center justify-between py-3.5 px-4"
                            onPress={() => setShowDatePicker(true)}
                        >
                            <View className="flex-row items-center gap-2.5">
                                <Cake size={18} color={colors['muted-foreground']} />
                                <Text style={{ color: colors['muted-foreground'] }}>Birthday</Text>
                            </View>
                            <View className="flex-row items-center gap-2 flex-1 justify-end">
                                <Text style={{ color: birthday ? colors.foreground : colors['muted-foreground'] }}>
                                    {formatBirthday(birthday)}
                                </Text>
                                <ChevronRight size={18} color={colors['muted-foreground']} />
                            </View>
                        </TouchableOpacity>

                        <View className="h-px ml-11" style={{ backgroundColor: colors.border }} />

                        {/* Archetype */}
                        <TouchableOpacity
                            className="flex-row items-center justify-between py-3.5 px-4"
                            onPress={() => setShowArchetypePicker(true)}
                        >
                            <View className="flex-row items-center gap-2.5">
                                <Sparkles size={18} color={colors['muted-foreground']} />
                                <Text style={{ color: colors['muted-foreground'] }}>Archetype</Text>
                            </View>
                            <View className="flex-row items-center gap-2 flex-1 justify-end">
                                <Text style={{ color: archetype ? colors.foreground : colors['muted-foreground'] }}>
                                    {archetype ? archetypeData[archetype]?.name || archetype : 'Not set'}
                                </Text>
                                <ChevronRight size={18} color={colors['muted-foreground']} />
                            </View>
                        </TouchableOpacity>

                        <View className="h-px ml-11" style={{ backgroundColor: colors.border }} />

                        {/* Take Quiz */}
                        <TouchableOpacity
                            className="flex-row items-center justify-between py-3.5 px-4"
                            onPress={() => router.push('/archetype-quiz')}
                        >
                            <View className="flex-row items-center gap-2.5">
                                <Sparkles size={18} color={colors.primary} />
                                <Text style={{ color: colors.primary, fontWeight: '500' }}>
                                    {archetype ? 'Retake Quiz' : 'Take the Quiz'}
                                </Text>
                            </View>
                            <View className="flex-row items-center gap-2 flex-1 justify-end">
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
                    className="mt-2"
                />

                {/* Account Section */}
                <View className="mt-6 mb-6">
                    <Text className="text-xs font-semibold tracking-widest mb-2 ml-1" style={{ color: colors['muted-foreground'] }}>
                        ACCOUNT
                    </Text>

                    <View className="rounded-xl border overflow-hidden" style={{
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                    }}>
                        {/* Profile Visibility */}
                        <TouchableOpacity
                            className="flex-row items-center justify-between py-3.5 px-4"
                            onPress={() => router.push('/visibility-settings')}
                        >
                            <View className="flex-row items-center gap-2">
                                <Eye size={20} color={colors.primary} style={{ marginRight: 8 }} />
                                <Text style={{ color: colors.foreground }}>
                                    Profile Visibility
                                </Text>
                            </View>
                            <View className="flex-row items-center gap-2 flex-1 justify-end">
                                <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                    Control what friends see
                                </Text>
                                <ChevronRight size={18} color={colors['muted-foreground']} />
                            </View>
                        </TouchableOpacity>

                        <View className="h-px ml-11" style={{ backgroundColor: colors.border }} />

                        {/* Sign Out */}
                        <TouchableOpacity
                            className="flex-row items-center justify-between py-3.5 px-4"
                            onPress={handleSignOut}
                        >
                            <View className="flex-row items-center gap-2">
                                <LogOut size={20} color={colors.destructive} style={{ marginRight: 8 }} />
                                <Text style={{ color: colors.destructive }}>
                                    Sign Out
                                </Text>
                            </View>
                            <View className="flex-row items-center gap-2 flex-1 justify-end">
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
                    <View className="flex-1 justify-end bg-black/50">
                        <View className="rounded-t-3xl p-5 pb-10" style={{ backgroundColor: colors.card }}>
                            <View className="flex-row justify-between items-center mb-4">
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
                <View className="flex-1 pt-14" style={{ backgroundColor: colors.background }}>
                    <View className="flex-row justify-between items-center px-5 mb-5">
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

export default ProfileScreen;
