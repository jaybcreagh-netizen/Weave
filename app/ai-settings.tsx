import React from 'react'
import { View, TouchableOpacity } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import { ArrowLeft, Sparkles } from 'lucide-react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import AISettings from '@/modules/auth/components/settings/AISettings'
import { useTheme } from '@/shared/hooks/useTheme'
import { Text } from '@/shared/ui/Text'

export default function AISettingsScreen() {
    const { colors } = useTheme()
    const router = useRouter()

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <Stack.Screen options={{ headerShown: false }} />

            <View
                className="px-6 py-4 flex-row items-center gap-4 border-b"
                style={{ borderColor: colors.border }}
            >
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                    <ArrowLeft size={24} color={colors.foreground} />
                </TouchableOpacity>

                <View className="flex-row items-center flex-1">
                    <Sparkles size={18} color={colors.primary} />
                    <Text className="ml-3 text-xl font-lora-bold" style={{ color: colors.foreground }}>
                        AI Features
                    </Text>
                </View>
            </View>

            <AISettings />
        </SafeAreaView>
    )
}
