import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Phone, Users, Shield } from 'lucide-react-native';

import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUserProfile } from '../hooks/useUserProfile';
import { useAuth } from '../context/AuthContext';

const SNOOZE_KEY = 'phone_nudge_snoozed_until';
const SNOOZE_DAYS = 7;

export function ProfileCompletionSheet() {
    const { colors } = useTheme();
    const router = useRouter();
    const { user } = useAuth();
    const { profile } = useUserProfile();

    const [isVisible, setIsVisible] = useState(false);
    const [hasChecked, setHasChecked] = useState(false);

    useEffect(() => {
        const checkEligibility = async () => {
            if (!user || !profile || hasChecked) return;

            // If already verified, don't show
            if (profile.phone) {
                setHasChecked(true);
                return;
            }

            // Check snooze
            try {
                const snoozedUntil = await AsyncStorage.getItem(SNOOZE_KEY);
                if (snoozedUntil) {
                    const snoozeDate = parseInt(snoozedUntil, 10);
                    if (Date.now() < snoozeDate) {
                        setHasChecked(true);
                        return;
                    }
                }
            } catch (e) {
                console.warn('Failed to read snooze key', e);
            }

            // Show sheet
            setIsVisible(true);
            setHasChecked(true);
        };

        checkEligibility();
    }, [user, profile, hasChecked]);

    const handleLater = async () => {
        const snoozeDate = Date.now() + (SNOOZE_DAYS * 24 * 60 * 60 * 1000);
        await AsyncStorage.setItem(SNOOZE_KEY, snoozeDate.toString());
        setIsVisible(false);
    };

    const handleConnect = () => {
        setIsVisible(false);
        router.push('/phone-auth?mode=link');
    };

    if (!isVisible) return null;

    return (
        <StandardBottomSheet
            visible={isVisible}
            onClose={handleLater}
            height="action"
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
                        onPress={handleConnect}
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
