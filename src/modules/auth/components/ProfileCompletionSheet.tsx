import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Phone, Users, Shield, AtSign } from 'lucide-react-native';
import { database } from '@/db';

import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUserProfile } from '../hooks/useUserProfile';
import { useAuth } from '../context/AuthContext';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { useUpdateUsername, SupabaseError } from '@/shared/api/mutations';

const SNOOZE_KEY = 'profile_completion_snoozed_until';
const SNOOZE_DAYS = 7;

type Step = 'username' | 'phone';

export function ProfileCompletionSheet() {
    const { colors } = useTheme();
    // const router = useRouter(); // Removed hook
    const { user } = useAuth();
    const { profile } = useUserProfile();

    const [isVisible, setIsVisible] = useState(false);
    const [hasChecked, setHasChecked] = useState(false);
    const [isCheckingEligibility, setIsCheckingEligibility] = useState(false);
    const [step, setStep] = useState<Step | null>(null);

    // Username state
    const [username, setUsername] = useState('');

    // Use React Query mutation for username update (automatic retry on network errors)
    const updateUsernameMutation = useUpdateUsername({
        onSuccess: () => {
            // Success! Move to next step or close
            if (!profile?.phone) {
                setStep('phone');
            } else {
                setIsVisible(false);
            }
        },
    });

    // Derive loading/error state from mutation
    const isSavingUsername = updateUsernameMutation.isPending;
    const usernameError = updateUsernameMutation.error
        ? (updateUsernameMutation.error as SupabaseError).userMessage
        : null;

    useEffect(() => {
        let isMounted = true;

        const checkEligibility = async () => {
            if (!user || !profile || hasChecked) return;

            setIsCheckingEligibility(true);

            // 1. Check Username Need
            // Get username from local profile first
            let currentUsername = profile.username || '';

            // If local username is empty, try fetching from Supabase
            // (This handles the case where WatermelonDB hasn't synced yet)
            if (!currentUsername) {
                try {
                    const client = getSupabaseClient();
                    if (client) {
                        const { data } = await client
                            .from('user_profiles')
                            .select('username')
                            .eq('id', user.id)
                            .single();
                        currentUsername = data?.username || '';
                        console.log('[ProfileCompletionSheet] Fetched username from Supabase:', currentUsername);
                    }
                } catch (e) {
                    console.warn('[ProfileCompletionSheet] Failed to fetch username:', e);
                }
            }

            console.log('[ProfileCompletionSheet] Username check:', { currentUsername, startsWithUser: currentUsername.startsWith('user_') });

            // Only prompt if username is missing OR starts with 'user_' (auto-assigned)
            const needsUsername = !currentUsername || currentUsername.startsWith('user_');

            if (needsUsername) {
                if (!isMounted) return;
                setStep('username');
                setUsername(currentUsername); // Pre-fill current (e.g. user_12345)
                await checkSnooze();
                return;
            }


            // 2. Check Phone Need (Secondary)
            // Only prompt if username is settled
            let currentPhone = profile.phone;

            // Check Auth User object (primary source of truth for phone-based logins)
            if (!currentPhone && user?.phone) {
                currentPhone = user.phone;
                console.log('[ProfileCompletionSheet] Found phone in Auth User:', currentPhone);

                // Self-heal: Update local profile (best effort, sync will fix if this fails)
                const localProfile = profile;
                database.write(async () => {
                    await localProfile.update((p: any) => {
                        p.phone = user.phone;
                    });
                    console.log('[ProfileCompletionSheet] Self-healed phone from Auth User');
                }).catch((err: any) => {
                    // This is expected to fail sometimes due to sync conflicts
                    // Sync will eventually fix it, so just log and continue
                    console.warn('[ProfileCompletionSheet] Self-heal phone failed (sync will fix):', err?.message);
                });
            }

            // Should we double check with Supabase?
            if (!currentPhone && !needsUsername) {
                try {
                    const client = getSupabaseClient();
                    if (client) {
                        const { data } = await client
                            .from('user_profiles')
                            .select('phone')
                            .eq('id', user.id)
                            .single();

                        if (data?.phone) {
                            currentPhone = data.phone;
                            console.log('[ProfileCompletionSheet] Fetched phone from Supabase:', currentPhone);

                            // Self-heal: Update local profile (best effort, sync will fix if this fails)
                            const localProfile = profile;
                            database.write(async () => {
                                await localProfile.update((p: any) => {
                                    p.phone = data.phone;
                                });
                                console.log('[ProfileCompletionSheet] Self-healed phone from Supabase');
                            }).catch((err: any) => {
                                // This is expected to fail sometimes due to sync conflicts
                                // Sync will eventually fix it, so just log and continue
                                console.warn('[ProfileCompletionSheet] Self-heal phone failed (sync will fix):', err?.message);
                            });
                        }
                    }
                } catch (e) {
                    console.warn('[ProfileCompletionSheet] Failed to fetch phone:', e);
                }
            }

            if (!currentPhone && !needsUsername) {
                if (!isMounted) return;
                setStep('phone');
                await checkSnooze();
                return;
            }

            // All good - profile is complete
            if (isMounted) {
                setHasChecked(true);
                setIsCheckingEligibility(false);
            }
        };

        const checkSnooze = async () => {
            try {
                const snoozedUntil = await AsyncStorage.getItem(SNOOZE_KEY);
                if (!isMounted) return;

                if (snoozedUntil) {
                    const snoozeDate = parseInt(snoozedUntil, 10);
                    if (Date.now() < snoozeDate) {
                        setHasChecked(true);
                        setIsVisible(false);
                        setIsCheckingEligibility(false);
                        return;
                    }
                }
                setIsVisible(true);
                setHasChecked(true);
                setIsCheckingEligibility(false);
            } catch (e) {
                console.warn('[ProfileCompletionSheet] Failed to read snooze key:', e);
                if (isMounted) {
                    setIsCheckingEligibility(false);
                }
            }
        };

        checkEligibility().catch((err) => {
            console.error('[ProfileCompletionSheet] Eligibility check failed:', err);
            if (isMounted) {
                setIsCheckingEligibility(false);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [user, profile, hasChecked]);

    const handleLater = async () => {
        const snoozeDate = Date.now() + (SNOOZE_DAYS * 24 * 60 * 60 * 1000);
        await AsyncStorage.setItem(SNOOZE_KEY, snoozeDate.toString());
        setIsVisible(false);
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // USERNAME LOGIC
    // ─────────────────────────────────────────────────────────────────────────────
    const handleSaveUsername = () => {
        if (!user || !username) return;

        // Reset any previous error before submitting
        updateUsernameMutation.reset();

        // Use the React Query mutation (handles validation, retry, error classification)
        updateUsernameMutation.mutate({
            userId: user.id,
            username: username,
        });
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // PHONE LOGIC
    // ─────────────────────────────────────────────────────────────────────────────
    const handleConnectPhone = () => {
        setIsVisible(false);
        router.push('/phone-auth?mode=link');
    };

    if (!isVisible || !step) return null;

    // ─────────────────────────────────────────────────────────────────────────────
    // RENDER: USERNAME STEP
    // ─────────────────────────────────────────────────────────────────────────────
    if (step === 'username') {
        return (
            <StandardBottomSheet
                visible={isVisible}
                onClose={handleLater} // Allow closing
                height="form" // Taller to fit input
                title="Choose your Handle"
            >
                <View style={styles.container}>
                    <View style={styles.iconRow}>
                        <View style={[styles.iconContainer, { backgroundColor: colors.primary }]}>
                            <AtSign size={24} color={colors['primary-foreground']} />
                        </View>
                    </View>

                    <Text variant="h3" style={styles.title}>
                        Claim your unique handle
                    </Text>

                    <Text variant="body" style={styles.description}>
                        You've been assigned a temporary username. Choose a handle so friends can find you easily.
                    </Text>

                    <View style={{ width: '100%', marginBottom: 24 }}>
                        <Input
                            placeholder="@username"
                            value={username}
                            onChangeText={(t) => {
                                setUsername(t);
                                // Clear error when user types
                                if (updateUsernameMutation.error) {
                                    updateUsernameMutation.reset();
                                }
                            }}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                        {usernameError && (
                            <Text style={{ color: colors.destructive, fontSize: 12, marginTop: 4, marginLeft: 4 }}>
                                {usernameError}
                            </Text>
                        )}
                    </View>

                    <View style={styles.actions}>
                        <Button
                            variant="primary"
                            label={isSavingUsername ? "Saving..." : "Claim Username"}
                            onPress={handleSaveUsername}
                            loading={isSavingUsername}
                            fullWidth
                        />
                        <Button
                            variant="ghost"
                            label="I'll do it later"
                            onPress={handleLater}
                            fullWidth
                            style={styles.laterButton}
                        />
                    </View>
                </View>
            </StandardBottomSheet>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // RENDER: PHONE STEP
    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <StandardBottomSheet
            visible={isVisible}
            onClose={handleLater}
            height="form"
            title="Complete Your Profile"
        >
            <View style={styles.container}>
                <View style={styles.iconRow}>
                    <View style={[styles.iconContainer, { backgroundColor: colors.secondary }]}>
                        <Users size={24} color={colors['secondary-foreground']} />
                    </View>
                </View>

                <Text variant="h3" style={styles.title}>
                    Find your friends on Weave
                </Text>

                <Text variant="body" style={styles.description}>
                    Add your phone number to see which of your contacts are already weaving.
                </Text>

                <View style={styles.benefitRow}>
                    <Shield size={16} color={colors['muted-foreground']} />
                    <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                        Your number is private and never shared visibly.
                    </Text>
                </View>

                <View style={styles.actions}>
                    <Button
                        variant="primary"
                        label="Add Phone Number"
                        icon={<Phone size={18} color={colors['primary-foreground']} />}
                        onPress={handleConnectPhone}
                        fullWidth
                    />
                    <Button
                        variant="ghost"
                        label="Not Now"
                        onPress={handleLater}
                        fullWidth
                        style={styles.laterButton}
                    />
                </View>
            </View>
        </StandardBottomSheet>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        alignItems: 'center',
    },
    iconRow: {
        marginBottom: 16,
    },
    iconContainer: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        textAlign: 'center',
        marginBottom: 8,
    },
    description: {
        textAlign: 'center',
        marginBottom: 16,
        opacity: 0.8,
        maxWidth: '90%',
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 24,
        opacity: 0.7,
    },
    actions: {
        width: '100%',
        gap: 8,
    },
    laterButton: {
        marginTop: 4,
    }
});
