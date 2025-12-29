import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, Modal, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Localization from 'expo-localization';

import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Card } from '@/shared/ui/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import { ArrowLeft } from 'lucide-react-native';
import {
    signInWithPhone,
    verifyPhoneOtp,
    linkPhoneToUser,
    verifyAndLinkPhone
} from '@/modules/auth/services/supabase-auth.service';

type AuthMode = 'signin' | 'link';

// Country codes with region codes for locale matching
const countryCodes = [
    { code: '+44', country: 'United Kingdom', flag: '🇬🇧', region: 'GB' },
    { code: '+61', country: 'Australia', flag: '🇦🇺', region: 'AU' },
    { code: '+1', country: 'United States', flag: '🇺🇸', region: 'US' },
    { code: '+64', country: 'New Zealand', flag: '🇳🇿', region: 'NZ' },
    { code: '+1', country: 'Canada', flag: '🇨🇦', region: 'CA' },
    { code: '+353', country: 'Ireland', flag: '🇮🇪', region: 'IE' },
    { code: '+91', country: 'India', flag: '🇮🇳', region: 'IN' },
    { code: '+49', country: 'Germany', flag: '🇩🇪', region: 'DE' },
    { code: '+33', country: 'France', flag: '🇫🇷', region: 'FR' },
    { code: '+81', country: 'Japan', flag: '🇯🇵', region: 'JP' },
    { code: '+65', country: 'Singapore', flag: '🇸🇬', region: 'SG' },
    { code: '+852', country: 'Hong Kong', flag: '🇭🇰', region: 'HK' },
];

export function PhoneAuthScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const params = useLocalSearchParams();

    // Mode defaults to 'signin', but can be passed as param
    const mode: AuthMode = (params.mode as AuthMode) || 'signin';

    const [step, setStep] = useState<'phone' | 'otp'>('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [showCountryPicker, setShowCountryPicker] = useState(false);

    // Default to UK, will update based on locale
    const [selectedCountry, setSelectedCountry] = useState(countryCodes[0]);

    // Detect user's locale and set appropriate country code
    useEffect(() => {
        const detectCountry = () => {
            // Get device region (e.g., 'en-GB' -> 'GB', 'en-AU' -> 'AU')
            const locales = Localization.getLocales();
            const region = locales?.[0]?.regionCode;

            if (region) {
                const matchedCountry = countryCodes.find(c => c.region === region);
                if (matchedCountry) {
                    setSelectedCountry(matchedCountry);
                    return;
                }
            }
            // Default to UK if no match
            setSelectedCountry(countryCodes[0]);
        };

        detectCountry();
    }, []);

    // Simple validation
    const isValidPhone = phone.length >= 10;
    const isValidOtp = otp.length === 6;

    const handleSendOtp = async () => {
        if (!isValidPhone) {
            Alert.alert('Invalid Phone', 'Please enter a valid phone number');
            return;
        }

        setLoading(true);
        // Format phone with selected country code
        let formattedPhone = phone.replace(/[^0-9]/g, ''); // Strip non-digits
        formattedPhone = `${selectedCountry.code}${formattedPhone}`;

        const result = mode === 'link'
            ? await linkPhoneToUser(formattedPhone)
            : await signInWithPhone(formattedPhone);

        setLoading(false);

        if (result.success) {
            setStep('otp');
            // Store formatted phone for verification
            setPhone(formattedPhone);
        } else {
            Alert.alert('Error', result.error || 'Failed to send code');
        }
    };

    const handleVerify = async () => {
        if (!isValidOtp) return;
        setLoading(true);

        const result = mode === 'link'
            ? await verifyAndLinkPhone(phone, otp)
            : await verifyPhoneOtp(phone, otp);

        setLoading(false);

        if (result.success) {
            if (mode === 'link') {
                Alert.alert('Success', 'Phone number verified!', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
            } else {
                router.navigate('/dashboard');
            }
        } else {
            Alert.alert('Verify Failed', result.error || 'Invalid code');
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Back Button */}
            <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <ArrowLeft size={24} color={colors.foreground} />
            </TouchableOpacity>

            <View style={styles.header}>
                <Text variant="h1" style={styles.title}>
                    {mode === 'link' ? 'Verify Phone' : 'Welcome Back'}
                </Text>
                <Text variant="body" style={styles.subtitle}>
                    {step === 'phone'
                        ? 'Enter your mobile number to continue'
                        : `Enter the code sent to ${phone}`
                    }
                </Text>
            </View>

            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.content}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
                >
                    <Card style={styles.card}>
                        {step === 'phone' ? (
                            <>
                                {/* Country Code + Phone Input Row */}
                                <View className="flex-row gap-2 mb-4">
                                    {/* Country Code Picker */}
                                    <TouchableOpacity
                                        onPress={() => setShowCountryPicker(true)}
                                        className="flex-row items-center px-3 py-3 rounded-lg"
                                        style={{
                                            backgroundColor: colors.muted,
                                            borderWidth: 1,
                                            borderColor: colors.border,
                                        }}
                                    >
                                        <Text style={{ fontSize: 20, marginRight: 4 }}>
                                            {selectedCountry.flag}
                                        </Text>
                                        <Text style={{ color: colors.foreground, fontWeight: '500' }}>
                                            {selectedCountry.code}
                                        </Text>
                                    </TouchableOpacity>

                                    {/* Phone Number Input */}
                                    <View style={{ flex: 1 }}>
                                        <Input
                                            placeholder="412 345 678"
                                            keyboardType="phone-pad"
                                            value={phone}
                                            onChangeText={setPhone}
                                            autoFocus
                                        />
                                    </View>
                                </View>

                                <Button
                                    variant="primary"
                                    label="Send Code"
                                    onPress={handleSendOtp}
                                    loading={loading}
                                    disabled={!isValidPhone}
                                    style={styles.button}
                                />

                                {/* Country Picker Modal */}
                                <Modal
                                    visible={showCountryPicker}
                                    transparent
                                    animationType="slide"
                                    onRequestClose={() => setShowCountryPicker(false)}
                                >
                                    <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                                        <View
                                            className="rounded-t-3xl p-4"
                                            style={{ backgroundColor: colors.background, maxHeight: '60%' }}
                                        >
                                            <Text
                                                className="text-lg font-bold mb-4 text-center"
                                                style={{ color: colors.foreground }}
                                            >
                                                Select Country
                                            </Text>
                                            <ScrollView>
                                                {countryCodes.map((country, index) => (
                                                    <TouchableOpacity
                                                        key={`${country.code}-${index}`}
                                                        onPress={() => {
                                                            setSelectedCountry(country);
                                                            setShowCountryPicker(false);
                                                        }}
                                                        className="flex-row items-center py-3 px-2 rounded-lg mb-1"
                                                        style={{
                                                            backgroundColor: selectedCountry.code === country.code && selectedCountry.country === country.country
                                                                ? colors.primary + '20'
                                                                : 'transparent',
                                                        }}
                                                    >
                                                        <Text style={{ fontSize: 24, marginRight: 12 }}>
                                                            {country.flag}
                                                        </Text>
                                                        <Text
                                                            className="flex-1"
                                                            style={{ color: colors.foreground }}
                                                        >
                                                            {country.country}
                                                        </Text>
                                                        <Text style={{ color: colors['muted-foreground'] }}>
                                                            {country.code}
                                                        </Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                            <Button
                                                variant="ghost"
                                                label="Cancel"
                                                onPress={() => setShowCountryPicker(false)}
                                                style={{ marginTop: 8 }}
                                            />
                                        </View>
                                    </View>
                                </Modal>
                            </>
                        ) : (
                            <>
                                <Input
                                    placeholder="000000"
                                    keyboardType="number-pad"
                                    value={otp}
                                    onChangeText={setOtp}
                                    maxLength={6}
                                    autoFocus
                                    style={styles.otpInput}
                                />
                                <Button
                                    variant="primary"
                                    label="Verify"
                                    onPress={handleVerify}
                                    loading={loading}
                                    disabled={!isValidOtp}
                                    style={styles.button}
                                />
                                <TouchableOpacity
                                    onPress={() => setStep('phone')}
                                    style={styles.changeNumber}
                                >
                                    <Text variant="caption" style={{ color: colors.primary }}>
                                        Change phone number
                                    </Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </Card>
                </KeyboardAvoidingView>
            </TouchableWithoutFeedback>

            <Button
                variant="ghost"
                label="Cancel"
                onPress={() => router.back()}
                style={styles.cancelButton}
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
    backButton: {
        position: 'absolute' as const,
        top: 50,
        left: 24,
        zIndex: 10,
        padding: 8,
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
    content: {
        width: '100%',
    },
    card: {
        padding: 20,
    },
    button: {
        marginTop: 16,
    },
    cancelButton: {
        marginTop: 16,
    },
    otpInput: {
        fontSize: 24,
        letterSpacing: 4,
        textAlign: 'center',
    },
    changeNumber: {
        marginTop: 16,
        alignItems: 'center',
    }
});
