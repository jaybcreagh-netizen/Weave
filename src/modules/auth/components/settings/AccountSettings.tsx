/**
 * AccountSettings
 * 
 * Settings section for Weave account management.
 * Shows signed-in status, sync status, and sign out/create account options.
 * User info is tappable to navigate to profile editing.
 */

import React, { useState, useEffect } from 'react';
import { View, Alert, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LogOut, LogIn, RefreshCw, CheckCircle, AlertCircle, Cloud, ChevronRight, Phone } from 'lucide-react-native';
import { router } from 'expo-router';

import { Text, CachedImage } from '@/shared/ui';
import { useTheme } from '@/shared/hooks/useTheme';
import { SettingsItem } from './SettingsItem';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { useSyncStatus } from '@/modules/sync';
import { logger } from '@/shared/services/logger.service';
import { unregisterPushToken } from '@/modules/notifications/services/push-token.service';
import { formatPhoneDisplay } from '@/modules/auth';

interface AccountSettingsProps {
    onClose: () => void;
    onOpenAuth?: () => void;
}

interface UserInfo {
    email: string;
    username?: string;
    displayName?: string;
    photoUrl?: string;
    phone?: string;
}

export function AccountSettings({ onClose, onOpenAuth }: AccountSettingsProps) {
    const { colors, isDarkMode } = useTheme();
    const { pendingCount, failedCount, isProcessing } = useSyncStatus();

    const [isLoading, setIsLoading] = useState(true);
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const [isSigningOut, setIsSigningOut] = useState(false);

    // Fetch user info on mount
    useEffect(() => {
        const fetchUserInfo = async () => {
            try {
                const client = getSupabaseClient();
                if (!client) {
                    setIsLoading(false);
                    return;
                }

                // Create a promise that rejects after 5 seconds
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Profile fetch timeout')), 5000);
                });

                // Race the user fetch against the timeout
                const userPromise = client.auth.getUser();
                const { data: { user } } = await Promise.race([userPromise, timeoutPromise]) as any;

                if (!user) {
                    setIsLoading(false);
                    return;
                }

                // Race the profile fetch against the timeout
                // Note: using user_profiles (plural) as established in auth service, even if schema says singular
                const profilePromise = client
                    .from('user_profiles')
                    .select('username, display_name, photo_url, phone')
                    .eq('id', user.id)
                    .single();

                const { data: profile } = await Promise.race([profilePromise, timeoutPromise]) as any;

                setUserInfo({
                    email: user.email || '',
                    username: profile?.username,
                    displayName: profile?.display_name,
                    photoUrl: profile?.photo_url,
                    phone: user.phone, // STRICT source of truth. Ignore profile.phone if this is empty.
                });
            } catch (error) {
                // If it's a timeout or other error, log it but don't crash
                // The UI will show the "Sign In" state which is safer than spinning
                if (error instanceof Error && error.message === 'Profile fetch timeout') {
                    logger.warn('AccountSettings', 'Profile fetch timed out - showing signed out state');
                } else {
                    logger.error('AccountSettings', 'Failed to fetch user info:', error);
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        let mounted = true;
        fetchUserInfo();

        return () => {
            mounted = false;
        };
    }, []);

    const handleOpenProfile = () => {
        onClose();
        setTimeout(() => {
            router.push('/profile');
        }, 300);
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
                            setIsSigningOut(true);

                            // Unregister push token
                            await unregisterPushToken();

                            // Sign out from Supabase
                            const client = getSupabaseClient();
                            if (client) {
                                await client.auth.signOut();
                            }

                            setUserInfo(null);
                            onClose();
                        } catch (error) {
                            logger.error('AccountSettings', 'Sign out failed:', error);
                            Alert.alert('Error', 'Failed to sign out. Please try again.');
                        } finally {
                            setIsSigningOut(false);
                        }
                    },
                },
            ]
        );
    };

    // Get sync status display
    const getSyncStatus = () => {
        if (!userInfo) return null;

        if (isProcessing) {
            return {
                icon: RefreshCw,
                text: 'Syncing...',
                color: colors.primary,
            };
        }

        if (failedCount > 0) {
            return {
                icon: AlertCircle,
                text: `${failedCount} failed`,
                color: colors.destructive,
            };
        }

        if (pendingCount > 0) {
            return {
                icon: Cloud,
                text: `${pendingCount} pending`,
                color: colors['muted-foreground'],
            };
        }

        return {
            icon: CheckCircle,
            text: 'Synced',
            color: '#22c55e', // green
        };
    };

    const syncStatus = getSyncStatus();

    if (isLoading) {
        return (
            <View className="py-4 items-center">
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    }

    // Signed in state
    if (userInfo) {
        return (
            <View>
                {/* Tappable User Info Header */}
                <TouchableOpacity
                    className="px-4 py-3"
                    onPress={handleOpenProfile}
                    activeOpacity={0.7}
                >
                    <View className="flex-row items-center gap-3">
                        {/* Profile Photo */}
                        <View
                            className="w-12 h-12 rounded-full items-center justify-center overflow-hidden"
                            style={{
                                backgroundColor: colors.primary + '20',
                                borderWidth: 2,
                                borderColor: colors.primary + '30',
                            }}
                        >
                            {userInfo.photoUrl ? (
                                <CachedImage
                                    source={{ uri: userInfo.photoUrl }}
                                    style={{ width: '100%', height: '100%' }}
                                    contentFit="cover"
                                />
                            ) : (
                                <Text
                                    className="text-xl font-bold"
                                    style={{ color: colors.primary }}
                                >
                                    {(userInfo.displayName || userInfo.username || 'W').charAt(0).toUpperCase()}
                                </Text>
                            )}
                        </View>

                        {/* Name & Username */}
                        <View className="flex-1">
                            <Text
                                className="font-semibold text-base"
                                style={{ color: colors.foreground }}
                            >
                                {userInfo.displayName || userInfo.username || 'Weave User'}
                            </Text>
                            {userInfo.username && (
                                <Text
                                    className="text-sm"
                                    style={{ color: colors.primary }}
                                >
                                    @{userInfo.username}
                                </Text>
                            )}
                            {!userInfo.username && (
                                <Text
                                    className="text-sm"
                                    style={{ color: colors['muted-foreground'] }}
                                >
                                    Tap to set up your profile
                                </Text>
                            )}
                        </View>

                        {/* Sync Status Badge + Chevron */}
                        <View className="flex-row items-center gap-2">
                            {syncStatus && (
                                <View
                                    className="flex-row items-center gap-1 px-2 py-1 rounded-full"
                                    style={{ backgroundColor: syncStatus.color + '15' }}
                                >
                                    <syncStatus.icon size={12} color={syncStatus.color} />
                                    <Text
                                        className="text-xs"
                                        style={{ color: syncStatus.color }}
                                    >
                                        {syncStatus.text}
                                    </Text>
                                </View>
                            )}
                            <ChevronRight size={20} color={colors['muted-foreground']} />
                        </View>
                    </View>
                </TouchableOpacity>

                {/* Phone Section - Always show */}
                <View className="border-t border-border mx-4" style={{ borderColor: colors.border }} />
                {userInfo.phone ? (
                    <SettingsItem
                        icon={Phone}
                        title="Phone Number"
                        subtitle={formatPhoneDisplay(userInfo.phone)}
                        rightElement={
                            <View className="flex-row items-center gap-1">
                                <CheckCircle size={16} color="#22c55e" />
                                <Text variant="caption" style={{ color: '#22c55e' }}>Verified</Text>
                            </View>
                        }
                        onPress={() => {
                            onClose();
                            setTimeout(() => router.push('/phone-settings'), 300);
                        }}
                    />
                ) : (
                    <SettingsItem
                        icon={Phone}
                        title="Link Phone Number"
                        subtitle="Enable contact matching & backup auth"
                        onPress={() => {
                            onClose();
                            setTimeout(() => router.push('/phone-auth?mode=link'), 300);
                        }}
                    />
                )}
            </View>
        );
    }

    // Signed out state
    return (
        <View>
            <View className="px-4 py-3">
                <Text
                    className="text-sm"
                    style={{ color: colors['muted-foreground'] }}
                >
                    Sign in to share weaves with friends and sync across devices.
                </Text>
            </View>

            <View className="border-t border-border" style={{ borderColor: colors.border }} />

            <SettingsItem
                icon={LogIn}
                title="Sign In or Create Account"
                subtitle="Enable sharing and backup"
                onPress={() => {
                    onClose();
                    if (onOpenAuth) {
                        setTimeout(() => onOpenAuth(), 300);
                    }
                }}
            />
        </View>
    );
}
