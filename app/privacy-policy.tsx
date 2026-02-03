import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/useTheme';
import { ArrowLeft, Shield } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyPolicy() {
    const { colors } = useTheme();
    const router = useRouter();

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="px-6 py-4 flex-row items-center gap-4 border-b" style={{ borderColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                    <ArrowLeft size={24} color={colors.foreground} />
                </TouchableOpacity>
                <Text className="text-xl font-lora-bold" style={{ color: colors.foreground }}>
                    Privacy Policy
                </Text>
            </View>

            <ScrollView className="flex-1 px-6 py-6">
                <View className="items-center mb-8">
                    <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: colors.primary + '20' }}>
                        <Shield size={32} color={colors.primary} />
                    </View>
                    <Text className="text-2xl font-lora-bold text-center mb-2" style={{ color: colors.foreground }}>
                        Your Privacy First
                    </Text>
                    <Text className="text-base font-inter-regular text-center" style={{ color: colors['muted-foreground'] }}>
                        Weave is designed to be a private sanctuary for your relationships.
                    </Text>
                </View>

                <View className="gap-8 pb-12">
                    <View>
                        <Text className="text-lg font-lora-bold mb-3" style={{ color: colors.foreground }}>
                            1. Local-First Architecture
                        </Text>
                        <Text className="text-base font-inter-regular leading-6" style={{ color: colors['muted-foreground'] }}>
                            Weave is a local-first application. Your data is stored on-device first. If you enable an account, selected data (like profile, linked friends, shared weaves, and sync metadata) may also be stored in our Supabase backend so features like cross-device sync and sharing can work.
                        </Text>
                    </View>

                    <View>
                        <Text className="text-lg font-lora-bold mb-3" style={{ color: colors.foreground }}>
                            2. Data Collection & Usage
                        </Text>
                        <Text className="text-base font-inter-regular leading-6 mb-4" style={{ color: colors['muted-foreground'] }}>
                            We do not sell your data. We process only what is needed to run core features you choose to use. Sensitive private content remains local-first, while account/sync features process cloud data you opt into.
                        </Text>
                        <Text className="text-base font-inter-regular leading-6 mb-4" style={{ color: colors['muted-foreground'] }}>
                            Local-first data includes:
                        </Text>
                        <View className="gap-2 pl-2 mb-4">
                            <Text className="text-base font-inter-regular" style={{ color: colors['muted-foreground'] }}>• Journal content and private notes by default</Text>
                            <Text className="text-base font-inter-regular" style={{ color: colors['muted-foreground'] }}>• Device contact list contents (processed on-device before matching)</Text>
                        </View>
                        <Text className="text-base font-inter-regular leading-6 mb-4" style={{ color: colors['muted-foreground'] }}>
                            Cloud-stored data (when account features are enabled) can include:
                        </Text>
                        <View className="gap-2 pl-2">
                            <Text className="text-base font-inter-regular" style={{ color: colors['muted-foreground'] }}>• Account/profile details (username, display name, optional photo)</Text>
                            <Text className="text-base font-inter-regular" style={{ color: colors['muted-foreground'] }}>• Shared weave and friend-linking records</Text>
                            <Text className="text-base font-inter-regular" style={{ color: colors['muted-foreground'] }}>• Sync metadata and push token registration</Text>
                        </View>
                    </View>

                    <View>
                        <Text className="text-lg font-lora-bold mb-3" style={{ color: colors.foreground }}>
                            3. Crash Reporting & Analytics
                        </Text>
                        <Text className="text-base font-inter-regular leading-6" style={{ color: colors['muted-foreground'] }}>
                            To help us improve the app and fix bugs, we use Sentry and PostHog to collect anonymous crash reports and usage data. This data is strictly technical (e.g., "App crashed on screen X") and does not contain any of your personal content or identifiable information.
                        </Text>
                    </View>

                    <View>
                        <Text className="text-lg font-lora-bold mb-3" style={{ color: colors.foreground }}>
                            4. Third-Party Services
                        </Text>
                        <Text className="text-base font-inter-regular leading-6" style={{ color: colors['muted-foreground'] }}>
                            We do not sell, trade, or transfer your data to outside parties. The app may link to third-party services (like your calendar or contacts app) only when you explicitly grant permission to do so.
                        </Text>
                    </View>

                    <View>
                        <Text className="text-lg font-lora-bold mb-3" style={{ color: colors.foreground }}>
                            5. Changes to This Policy
                        </Text>
                        <Text className="text-base font-inter-regular leading-6" style={{ color: colors['muted-foreground'] }}>
                            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page.
                        </Text>
                    </View>

                    <View className="mt-4 pt-6 border-t" style={{ borderColor: colors.border }}>
                        <Text className="text-sm font-inter-regular text-center" style={{ color: colors['muted-foreground'] }}>
                            Last updated: December 2025
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
