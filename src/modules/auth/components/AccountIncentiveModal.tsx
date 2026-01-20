import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Users, Zap, Cloud, ArrowRight } from 'lucide-react-native';

import { StandardBottomSheet } from '@/shared/ui/Sheet';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/hooks/useTheme';

interface AccountIncentiveModalProps {
    isOpen: boolean;
    onDismiss: () => void;
}

/**
 * Account Incentive Modal
 * 
 * Shown to non-authenticated users after they've added friends and used the app
 * for a few days. Encourages them to create an account.
 */
export function AccountIncentiveModal({ isOpen, onDismiss }: AccountIncentiveModalProps) {
    const { colors } = useTheme();
    const router = useRouter();

    const handleCreateAccount = () => {
        onDismiss();
        router.push('/auth');
    };

    const benefits = [
        { icon: Users, text: 'Share weaves with friends' },
        { icon: Cloud, text: 'Sync across all your devices' },
        { icon: Zap, text: 'Unlock social features' },
    ];

    return (
        <StandardBottomSheet
            visible={isOpen}
            onClose={onDismiss}
            height="full"
            title="Connect the Threads"
        >
            <View style={styles.container}>
                {/* Header Illustration */}
                <View style={[styles.illustrationContainer, { backgroundColor: colors.primary + '15' }]}>
                    <Users size={48} color={colors.primary} />
                </View>

                {/* Tagline */}
                <Text variant="h2" style={styles.title}>
                    Weave is better with friends
                </Text>

                <Text variant="body" style={[styles.subtitle, { color: colors['muted-foreground'] }]}>
                    Create an account to unlock the full experience and connect with your circle.
                </Text>

                {/* Benefits List */}
                <View style={styles.benefitsList}>
                    {benefits.map((benefit, index) => (
                        <View key={index} style={styles.benefitRow}>
                            <View style={[styles.benefitIcon, { backgroundColor: colors.secondary + '20' }]}>
                                <benefit.icon size={18} color={colors.secondary} />
                            </View>
                            <Text variant="body" style={{ flex: 1 }}>
                                {benefit.text}
                            </Text>
                        </View>
                    ))}
                </View>

                {/* Actions */}
                <View style={styles.actions}>
                    <Button
                        variant="primary"
                        label="Create Account"
                        icon={<ArrowRight size={18} color={colors['primary-foreground']} />}
                        onPress={handleCreateAccount}
                        fullWidth
                    />
                    <Button
                        variant="ghost"
                        label="Not Now"
                        onPress={onDismiss}
                        fullWidth
                        style={styles.dismissButton}
                    />
                </View>
            </View>
        </StandardBottomSheet>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 20,
        alignItems: 'center',
    },
    illustrationContainer: {
        width: 88,
        height: 88,
        borderRadius: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
    },
    title: {
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        textAlign: 'center',
        marginBottom: 24,
        maxWidth: '90%',
    },
    benefitsList: {
        width: '100%',
        gap: 12,
        marginBottom: 28,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    benefitIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actions: {
        width: '100%',
        gap: 8,
    },
    dismissButton: {
        marginTop: 4,
    },
});
