import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@/shared/hooks/useTheme';
import { ArrowLeft, FileText } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsOfService() {
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
                    Terms of Service
                </Text>
            </View>

            <ScrollView className="flex-1 px-6 py-6">
                <View className="items-center mb-8">
                    <View className="w-16 h-16 rounded-2xl items-center justify-center mb-4" style={{ backgroundColor: colors.primary + '20' }}>
                        <FileText size={32} color={colors.primary} />
                    </View>
                    <Text className="text-2xl font-lora-bold text-center mb-2" style={{ color: colors.foreground }}>
                        Terms of Service
                    </Text>
                    <Text className="text-base font-inter-regular text-center" style={{ color: colors['muted-foreground'] }}>
                        Please read these terms carefully before using Weave.
                    </Text>
                </View>

                <View className="gap-8 pb-12">
                    <View>
                        <Text className="text-lg font-lora-bold mb-3" style={{ color: colors.foreground }}>
                            1. Acceptance of Terms
                        </Text>
                        <Text className="text-base font-inter-regular leading-6" style={{ color: colors['muted-foreground'] }}>
                            By accessing or using the Weave application, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the application.
                        </Text>
                    </View>

                    <View>
                        <Text className="text-lg font-lora-bold mb-3" style={{ color: colors.foreground }}>
                            2. Use of the Application
                        </Text>
                        <Text className="text-base font-inter-regular leading-6" style={{ color: colors['muted-foreground'] }}>
                            Weave is a personal relationship management tool designed to help you maintain and deepen your friendships. You are responsible for maintaining the confidentiality of your device and the data stored within the application.
                        </Text>
                    </View>

                    <View>
                        <Text className="text-lg font-lora-bold mb-3" style={{ color: colors.foreground }}>
                            3. User Content
                        </Text>
                        <Text className="text-base font-inter-regular leading-6" style={{ color: colors['muted-foreground'] }}>
                            All content you create within the app (notes, journal entries, contact details) is stored locally on your device. We do not claim ownership of your content, nor do we have access to it. You are solely responsible for the content you create and store.
                        </Text>
                    </View>

                    <View>
                        <Text className="text-lg font-lora-bold mb-3" style={{ color: colors.foreground }}>
                            4. Disclaimer of Warranties
                        </Text>
                        <Text className="text-base font-inter-regular leading-6" style={{ color: colors['muted-foreground'] }}>
                            The application is provided "as is" and "as available" without any warranties of any kind, express or implied. We do not guarantee that the application will be error-free or uninterrupted.
                        </Text>
                    </View>

                    <View>
                        <Text className="text-lg font-lora-bold mb-3" style={{ color: colors.foreground }}>
                            5. Limitation of Liability
                        </Text>
                        <Text className="text-base font-inter-regular leading-6" style={{ color: colors['muted-foreground'] }}>
                            In no event shall Weave or its creators be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or relating to your use of the application.
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
