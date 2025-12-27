/**
 * Auth Screen
 * 
 * Simple authentication screen with Apple Sign-In and email options.
 * Only rendered when ACCOUNTS_ENABLED feature flag is true.
 */

import React, { useState } from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';

import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import {
    signInWithApple,
    signInWithEmail,
    signUpWithEmail,
    isAppleSignInAvailable,
} from '@/modules/auth/services/supabase-auth.service';

type AuthMode = 'signin' | 'signup';

export function AuthScreen() {
    const { colors } = useTheme();
    const [mode, setMode] = useState<AuthMode>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [loading, setLoading] = useState(false);
    const [appleAvailable, setAppleAvailable] = useState(false);

    React.useEffect(() => {
        isAppleSignInAvailable().then(setAppleAvailable);
    }, []);

    const handleAppleSignIn = async () => {
        setLoading(true);
        const result = await signInWithApple();
        setLoading(false);

        if (result.success) {
            // Navigate to main app or profile setup
            router.replace('/dashboard');
        } else if (result.error !== 'cancelled') {
            Alert.alert('Sign In Failed', result.error);
        }
    };

    const handleEmailSubmit = async () => {
        if (!email || !password) {
            Alert.alert('Missing Fields', 'Please enter email and password');
            return;
        }

        setLoading(true);

        const result = mode === 'signup'
            ? await signUpWithEmail(email, password, displayName || 'Weave User')
            : await signInWithEmail(email, password);

        setLoading(false);

        if (result.success) {
            if (mode === 'signup') {
                Alert.alert('Check Your Email', 'Please verify your email to continue');
            } else {
                router.replace('/dashboard');
            }
        } else {
            Alert.alert('Error', result.error);
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <Text variant="h1" style={styles.title}>Welcome to Weave</Text>
                <Text variant="body" style={styles.subtitle}>
                    Sign in to sync your data and share weaves with friends
                </Text>
            </View>

            {/* Apple Sign-In Button */}
            {appleAvailable && Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                    buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                    buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                    cornerRadius={12}
                    style={styles.appleButton}
                    onPress={handleAppleSignIn}
                />
            )}

            <View style={styles.divider}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text variant="caption" style={styles.dividerText}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Email Form */}
            <Card style={styles.formCard}>
                <View style={styles.tabs}>
                    <Button
                        variant={mode === 'signin' ? 'primary' : 'ghost'}
                        onPress={() => setMode('signin')}
                        style={styles.tab}
                        label="Sign In"
                    />
                    <Button
                        variant={mode === 'signup' ? 'primary' : 'ghost'}
                        onPress={() => setMode('signup')}
                        style={styles.tab}
                        label="Sign Up"
                    />
                </View>

                {mode === 'signup' && (
                    <View style={styles.inputContainer}>
                        <Text variant="caption">Display Name</Text>
                        <View style={[styles.input, { borderColor: colors.border }]}>
                            <Text
                                style={{ color: colors.foreground }}
                                // @ts-expect-error - using Text as placeholder for now
                                editable
                                onChangeText={setDisplayName}
                                value={displayName}
                            >
                                {displayName || 'Enter your name'}
                            </Text>
                        </View>
                    </View>
                )}

                <View style={styles.inputContainer}>
                    <Text variant="caption">Email</Text>
                    <View style={[styles.input, { borderColor: colors.border }]}>
                        <Text style={{ color: colors.foreground }}>
                            {email || 'Enter email address'}
                        </Text>
                    </View>
                </View>

                <View style={styles.inputContainer}>
                    <Text variant="caption">Password</Text>
                    <View style={[styles.input, { borderColor: colors.border }]}>
                        <Text style={{ color: colors.foreground }}>
                            {'•'.repeat(password.length) || 'Enter password'}
                        </Text>
                    </View>
                </View>

                <Button
                    variant="primary"
                    onPress={handleEmailSubmit}
                    loading={loading}
                    style={styles.submitButton}
                    label={mode === 'signin' ? 'Sign In' : 'Create Account'}
                />
            </Card>

            {/* Skip option */}
            <Button
                variant="ghost"
                onPress={() => router.back()}
                style={styles.skipButton}
                label="Continue without account"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        paddingTop: 80,
    },
    header: {
        marginBottom: 32,
        alignItems: 'center',
    },
    title: {
        marginBottom: 8,
    },
    subtitle: {
        textAlign: 'center',
        opacity: 0.7,
    },
    appleButton: {
        width: '100%',
        height: 50,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
    },
    dividerText: {
        marginHorizontal: 16,
        opacity: 0.5,
    },
    formCard: {
        padding: 16,
    },
    tabs: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 8,
    },
    tab: {
        flex: 1,
    },
    inputContainer: {
        marginBottom: 16,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        marginTop: 4,
    },
    submitButton: {
        marginTop: 8,
    },
    skipButton: {
        marginTop: 16,
    },
});

export default AuthScreen;
