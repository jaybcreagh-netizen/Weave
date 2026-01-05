/**
 * Onboarding Auth Screen
 * 
 * Beautiful, emotional auth screen shown after onboarding completion.
 * Features logo, Lora typography, FadeInDown animations, and phone-first auth.
 * Skippable - users can continue without an account.
 */

import React, { useState, useEffect } from 'react';
import { View, Platform, Alert, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Phone, Mail, ChevronRight, X } from 'lucide-react-native';

import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { useTheme } from '@/shared/hooks/useTheme';
import { WeaveIcon } from '@/shared/components/WeaveIcon';
import {
    signInWithApple,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    isAppleSignInAvailable,
} from '@/modules/auth/services/supabase-auth.service';

export function OnboardingAuthScreen() {
    const { colors, isDarkMode } = useTheme();
    const { source } = useLocalSearchParams<{ source: string }>();
    const [appleAvailable, setAppleAvailable] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showEmailForm, setShowEmailForm] = useState(false);
    const [emailMode, setEmailMode] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    useEffect(() => {
        isAppleSignInAvailable().then(setAppleAvailable);
    }, []);

    const handlePhoneAuth = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        if (source) {
            router.push(`/phone-auth?source=${source}`);
        } else {
            router.push('/phone-auth');
        }
    };

    const handleSuccessNavigation = () => {
        if (source === 'settings') {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/dashboard');
            }
        } else {
            router.replace('/permissions');
        }
    };

    const handleAppleSignIn = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setLoading(true);
        const result = await signInWithApple();
        setLoading(false);

        if (result.success) {
            handleSuccessNavigation();
        } else if (result.error !== 'cancelled') {
            Alert.alert('Sign In Failed', result.error);
        }
    };

    const handleGoogleSignIn = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setLoading(true);
        const result = await signInWithGoogle();
        setLoading(false);

        if (result.success) {
            handleSuccessNavigation();
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
        const result = emailMode === 'signup'
            ? await signUpWithEmail(email, password, 'Weave User')
            : await signInWithEmail(email, password);
        setLoading(false);

        if (result.success) {
            if (emailMode === 'signup') {
                Alert.alert('Check Your Email', 'Please verify your email to continue');
            } else {
                handleSuccessNavigation();
            }
        } else {
            // Show context-aware error title based on error code
            const title = result.errorCode === 'ALREADY_EXISTS' ? 'Account Exists'
                : result.errorCode === 'WEAK_PASSWORD' ? 'Password Too Weak'
                    : result.errorCode === 'WRONG_PASSWORD' ? 'Sign In Failed'
                        : result.errorCode === 'INVALID_EMAIL' ? 'Invalid Email'
                            : result.errorCode === 'EMAIL_NOT_CONFIRMED' ? 'Email Not Verified'
                                : result.errorCode === 'RATE_LIMITED' ? 'Too Many Attempts'
                                    : 'Error';
            Alert.alert(title, result.error);
        }
    };

    const handleSkip = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        handleSuccessNavigation();
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Close Button */}
            <TouchableOpacity
                onPress={handleSkip}
                className="absolute top-14 right-6 z-10 p-2"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <X size={24} color={colors['muted-foreground']} />
            </TouchableOpacity>

            <View className="flex-1 px-6 pt-8">
                {/* Logo */}
                <Animated.View
                    entering={FadeInDown.delay(100).duration(600)}
                    className="items-center mb-8"
                >
                    <WeaveIcon size={80} color={colors.primary} />
                </Animated.View>

                {/* Title & Subtitle */}
                <Animated.View
                    entering={FadeInDown.delay(200).duration(600)}
                    className="items-center mb-10"
                >
                    <Text
                        className="text-3xl text-center mb-3"
                        style={{
                            fontFamily: 'Lora_700Bold',
                            color: colors.foreground
                        }}
                    >
                        Keep your connections safe
                    </Text>
                    <Text
                        className="text-base text-center"
                        style={{ color: colors['muted-foreground'] }}
                    >
                        Sign in to sync across devices and share weaves with friends
                    </Text>
                </Animated.View>

                {/* Primary: Phone Auth */}
                <Animated.View entering={FadeInDown.delay(300).duration(600)}>
                    <Button
                        variant="primary"
                        label="Continue with Phone"
                        icon={<Phone size={20} color={colors['primary-foreground']} />}
                        onPress={handlePhoneAuth}
                        style={{ marginBottom: 12 }}
                    />
                </Animated.View>

                {/* Secondary: Apple & Google */}
                <Animated.View
                    entering={FadeInDown.delay(400).duration(600)}
                    className="gap-3 mb-6"
                >
                    {appleAvailable && Platform.OS === 'ios' && (
                        <AppleAuthentication.AppleAuthenticationButton
                            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                            buttonStyle={isDarkMode
                                ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                                : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                            }
                            cornerRadius={12}
                            style={{ width: '100%', height: 50 }}
                            onPress={handleAppleSignIn}
                        />
                    )}
                    {/* Custom Google Button matching app design */}
                    <TouchableOpacity
                        onPress={handleGoogleSignIn}
                        className="flex-row items-center justify-center rounded-xl"
                        style={{
                            width: '100%',
                            height: 50,
                            backgroundColor: isDarkMode ? '#FFFFFF' : '#FFFFFF',
                            borderWidth: 1,
                            borderColor: colors.border,
                        }}
                        activeOpacity={0.8}
                    >
                        <Image
                            source={{ uri: 'https://www.google.com/favicon.ico' }}
                            style={{ width: 20, height: 20, marginRight: 10 }}
                        />
                        <Text
                            style={{
                                fontSize: 17,
                                fontWeight: '500',
                                color: '#1F1F1F',
                            }}
                        >
                            Sign in with Google
                        </Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Tertiary: Email (expandable) */}
                <Animated.View entering={FadeInDown.delay(500).duration(600)}>
                    {!showEmailForm ? (
                        <TouchableOpacity
                            onPress={() => setShowEmailForm(true)}
                            className="flex-row items-center justify-center py-3"
                        >
                            <Mail size={18} color={colors.primary} />
                            <Text
                                className="ml-2 font-medium"
                                style={{ color: colors.primary }}
                            >
                                Sign in with email
                            </Text>
                            <ChevronRight size={16} color={colors.primary} />
                        </TouchableOpacity>
                    ) : (
                        <View
                            className="p-4 rounded-xl"
                            style={{ backgroundColor: colors.card }}
                        >
                            {/* Tab Switcher */}
                            <View className="flex-row mb-4 gap-2">
                                <TouchableOpacity
                                    onPress={() => setEmailMode('signin')}
                                    className="flex-1 py-2 rounded-lg"
                                    style={{
                                        backgroundColor: emailMode === 'signin'
                                            ? colors.primary
                                            : 'transparent'
                                    }}
                                >
                                    <Text
                                        className="text-center font-medium"
                                        style={{
                                            color: emailMode === 'signin'
                                                ? colors['primary-foreground']
                                                : colors['muted-foreground']
                                        }}
                                    >
                                        Sign In
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setEmailMode('signup')}
                                    className="flex-1 py-2 rounded-lg"
                                    style={{
                                        backgroundColor: emailMode === 'signup'
                                            ? colors.primary
                                            : 'transparent'
                                    }}
                                >
                                    <Text
                                        className="text-center font-medium"
                                        style={{
                                            color: emailMode === 'signup'
                                                ? colors['primary-foreground']
                                                : colors['muted-foreground']
                                        }}
                                    >
                                        Sign Up
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <Input
                                placeholder="Email"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                                style={{ marginBottom: 12 }}
                            />
                            <Input
                                placeholder="Password"
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                                style={{ marginBottom: 16 }}
                            />
                            <Button
                                variant="primary"
                                label={emailMode === 'signin' ? 'Sign In' : 'Create Account'}
                                onPress={handleEmailSubmit}
                                loading={loading}
                            />
                            <TouchableOpacity
                                onPress={() => setShowEmailForm(false)}
                                className="mt-3"
                            >
                                <Text
                                    className="text-center text-sm"
                                    style={{ color: colors['muted-foreground'] }}
                                >
                                    Cancel
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>

                {/* Spacer */}
                <View className="flex-1" />

                {/* Skip Button */}
                <Animated.View
                    entering={FadeInDown.delay(600).duration(600)}
                    className="pb-4"
                >
                    <Button
                        variant="ghost"
                        label={source === 'settings' ? "Cancel" : "Skip for now"}
                        onPress={handleSkip}
                    />
                </Animated.View>
            </View>
        </SafeAreaView>
    );
}

export default OnboardingAuthScreen;
