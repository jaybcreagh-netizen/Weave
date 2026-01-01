import React, { useState, useEffect } from 'react';
import { View, Alert, KeyboardAvoidingView, Platform, TouchableOpacity, ScrollView, Modal, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Localization from 'expo-localization';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Card } from '@/shared/ui/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import { ArrowLeft, ChevronDown } from 'lucide-react-native';
import {
    signInWithPhone,
    verifyPhoneOtp,
    linkPhoneToUser,
    verifyAndLinkPhone
} from '@/modules/auth';

type AuthMode = 'signin' | 'link';

// Country codes with region codes for locale matching
const countryCodes = [
    { code: '+1', country: 'United States', flag: '🇺🇸', region: 'US' },
    { code: '+44', country: 'United Kingdom', flag: '🇬🇧', region: 'GB' },
    { code: '+61', country: 'Australia', flag: '🇦🇺', region: 'AU' },
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

    // Default to US (Changed from UK to align with most common user base, but detector will override)
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
        };

        detectCountry();
    }, []);

    // Simple validation
    const isValidPhone = phone.length >= 7; // Loosened slightly to allow for various formats
    const isValidOtp = otp.length === 6;

    const handleSendOtp = async () => {
        if (!isValidPhone) {
            Alert.alert('Invalid Phone', 'Please enter a valid phone number');
            return;
        }

        setLoading(true);
        // Format phone with selected country code
        let formattedPhone = phone.replace(/[^0-9]/g, ''); // Strip non-digits

        // Remove leading zero if present (common mistake when adding country code)
        if (formattedPhone.startsWith('0')) {
            formattedPhone = formattedPhone.substring(1);
        }

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
            // Show error with appropriate title based on error type
            const title = result.errorCode === 'RATE_LIMITED' ? 'Too Many Attempts'
                : result.errorCode === 'INVALID_PHONE' ? 'Invalid Phone Number'
                    : 'Error';
            Alert.alert(title, result.error || 'Failed to send code');
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
        <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
            <View className="flex-1 px-6">
                {/* Header with Back Button */}
                <View className="flex-row items-center pt-2 pb-8">
                    <TouchableOpacity
                        onPress={() => router.back()}
                        className="-ml-2 p-2"
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <ArrowLeft size={24} color={colors.foreground} />
                    </TouchableOpacity>
                </View>

                {/* Title Section */}
                <View className="items-center mb-8">
                    <Text variant="h1" className="mb-2 text-center">
                        {mode === 'link' ? 'Verify Phone' : 'Welcome Back'}
                    </Text>
                    <Text variant="body" className="text-center opacity-70 px-4">
                        {step === 'phone'
                            ? 'Enter your mobile number to receive a verification code'
                            : `Enter the 6-digit code sent to ${phone}`
                        }
                    </Text>
                </View>

                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        className="w-full flex-1"
                        keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
                    >
                        <Card className="p-5">
                            {step === 'phone' ? (
                                <>
                                    {/* Country Code + Phone Input Row */}
                                    <View className="flex-row gap-3 mb-4">
                                        {/* Country Code Picker */}
                                        <TouchableOpacity
                                            onPress={() => setShowCountryPicker(true)}
                                            className="flex-row items-center px-3 py-3 rounded-lg border h-[50px]"
                                            style={{
                                                backgroundColor: colors.muted,
                                                borderColor: colors.border,
                                            }}
                                        >
                                            <Text className="text-xl mr-2">
                                                {selectedCountry.flag}
                                            </Text>
                                            <Text className="font-medium mr-1" style={{ color: colors.foreground }}>
                                                {selectedCountry.code}
                                            </Text>
                                            <ChevronDown size={14} color={colors['muted-foreground']} />
                                        </TouchableOpacity>

                                        {/* Phone Number Input */}
                                        <View className="flex-1">
                                            <Input
                                                placeholder="Mobile Number"
                                                keyboardType="phone-pad"
                                                value={phone}
                                                onChangeText={setPhone}
                                                autoFocus
                                                style={{ height: 50 }}
                                            />
                                        </View>
                                    </View>

                                    <Button
                                        variant="primary"
                                        label="Send Code"
                                        onPress={handleSendOtp}
                                        loading={loading}
                                        disabled={!isValidPhone}
                                        className="mt-4"
                                    />

                                    {/* Country Picker Modal */}
                                    <Modal
                                        visible={showCountryPicker}
                                        transparent
                                        animationType="slide"
                                        onRequestClose={() => setShowCountryPicker(false)}
                                    >
                                        <View className="flex-1 justify-end bg-black/50">
                                            <View
                                                className="rounded-t-3xl pt-5 pb-10 max-h-[70%]"
                                                style={{ backgroundColor: colors.background }}
                                            >
                                                <View className="flex-row justify-between items-center px-5 mb-4 border-b pb-4" style={{ borderColor: colors.border }}>
                                                    <Text className="text-lg font-bold" style={{ color: colors.foreground }}>
                                                        Select Country
                                                    </Text>
                                                    <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                                                        <Text style={{ color: colors.primary, fontWeight: '600' }}>Done</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                <ScrollView className="px-2">
                                                    {countryCodes.map((country, index) => (
                                                        <TouchableOpacity
                                                            key={`${country.code}-${index}`}
                                                            onPress={() => {
                                                                setSelectedCountry(country);
                                                                setShowCountryPicker(false);
                                                            }}
                                                            className="flex-row items-center py-4 px-4 rounded-xl mb-1"
                                                            style={{
                                                                backgroundColor: selectedCountry.code === country.code && selectedCountry.country === country.country
                                                                    ? colors.primary + '15'
                                                                    : 'transparent',
                                                            }}
                                                        >
                                                            <Text className="text-2xl mr-4">
                                                                {country.flag}
                                                            </Text>
                                                            <View className="flex-1">
                                                                <Text className="font-medium text-base" style={{ color: colors.foreground }}>
                                                                    {country.country}
                                                                </Text>
                                                            </View>
                                                            <Text className="font-semibold" style={{ color: colors['muted-foreground'] }}>
                                                                {country.code}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                    <View className="h-10" />
                                                </ScrollView>
                                            </View>
                                        </View>
                                    </Modal>
                                </>
                            ) : (
                                <>
                                    <View className="items-center mb-6 mt-2">
                                        <Input
                                            placeholder="000000"
                                            keyboardType="number-pad"
                                            value={otp}
                                            onChangeText={setOtp}
                                            maxLength={6}
                                            autoFocus
                                            className="text-center text-3xl tracking-[8px] h-16 w-full"
                                            style={{
                                                fontSize: 32,
                                                letterSpacing: 8,
                                                textAlign: 'center'
                                            }}
                                        />
                                    </View>

                                    <Button
                                        variant="primary"
                                        label="Verify Code"
                                        onPress={handleVerify}
                                        loading={loading}
                                        disabled={!isValidOtp}
                                        className="mt-2"
                                    />

                                    <TouchableOpacity
                                        onPress={() => setStep('phone')}
                                        className="mt-6 items-center py-2"
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
                    className="mb-4"
                />
            </View>
        </SafeAreaView>
    );
}

export default PhoneAuthScreen;
