/**
 * Visibility Settings Route
 *
 * Thin wrapper for the VisibilitySettings component.
 * Controls what linked friends can see on your profile.
 */

import React from 'react';
import { View, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { useTheme } from '@/shared/hooks/useTheme';
import { VisibilitySettingsComponent } from '@/modules/auth/components/VisibilitySettings';

export default function VisibilitySettingsScreen() {
    const { colors } = useTheme();

    return (
        <View className="flex-1" style={{ backgroundColor: colors.background }}>
            {/* Header */}
            <View
                className="flex-row items-center justify-between px-2 pt-14 pb-4 border-b"
                style={{ borderColor: colors.border }}
            >
                <Button
                    variant="ghost"
                    onPress={() => router.back()}
                    icon={<ChevronLeft size={24} color={colors.foreground} />}
                />
                <Text variant="h2" className="flex-1 text-center">
                    Visibility Settings
                </Text>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                <VisibilitySettingsComponent />
            </ScrollView>
        </View>
    );
}
