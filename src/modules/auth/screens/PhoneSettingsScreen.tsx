import React, { useState, useEffect } from 'react';
import { View, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Phone, CheckCircle, ChevronLeft, Edit3, Trash2 } from 'lucide-react-native';

import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { formatPhoneDisplay } from '@/modules/auth/services/auth-utils';
import { unlinkPhone } from '@/modules/auth/services/supabase-auth.service';

export function PhoneSettingsScreen() {
    const { colors } = useTheme();
    const router = useRouter();
    const [phone, setPhone] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [unlinking, setUnlinking] = useState(false);

    useEffect(() => {
        loadPhone();
    }, []);

    const loadPhone = async () => {
        const client = getSupabaseClient();
        if (!client) return;

        const { data: { user } } = await client.auth.getUser();
        if (user?.phone) {
            setPhone(user.phone);
        }
        setLoading(false);
    };

    const handleChangePhone = () => {
        router.push('/phone-auth?mode=change');
    };

    const handleRemovePhone = () => {
        Alert.alert(
            'Remove Phone Number',
            'Are you sure? You won\'t be able to sign in with this phone number or be found by contacts.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        setUnlinking(true);
                        const result = await unlinkPhone();
                        setUnlinking(false);

                        if (result.success) {
                            Alert.alert('Success', 'Phone number removed');
                            router.back();
                        } else {
                            Alert.alert('Error', result.error || 'Failed to remove phone number');
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            {/* Header */}
            <View className="flex-row items-center px-4 py-3 border-b" style={{ borderColor: colors.border }}>
                <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
                    <ChevronLeft size={24} color={colors.foreground} />
                </TouchableOpacity>
                <Text variant="h2" className="ml-2">Phone Number</Text>
            </View>

            <View className="p-5">
                {/* Current Phone Display */}
                <Card className="p-4 mb-6">
                    <View className="flex-row items-center gap-3">
                        <View className="w-12 h-12 rounded-full items-center justify-center" style={{ backgroundColor: colors.primary + '20' }}>
                            <Phone size={24} color={colors.primary} />
                        </View>
                        <View className="flex-1">
                            <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                                Verified Phone
                            </Text>
                            <Text variant="h3">{formatPhoneDisplay(phone)}</Text>
                        </View>
                        <CheckCircle size={20} color="#22c55e" />
                    </View>
                </Card>

                {/* Actions */}
                <View className="gap-3">
                    <Button
                        variant="outline"
                        label="Change Phone Number"
                        icon={<Edit3 size={18} color={colors.foreground} />}
                        onPress={handleChangePhone}
                        disabled={unlinking}
                    />
                    <Button
                        variant="ghost"
                        label="Remove Phone Number"
                        icon={<Trash2 size={18} color={colors.destructive} />}
                        onPress={handleRemovePhone}
                        style={{ borderColor: colors.destructive }}
                        loading={unlinking}
                    />
                </View>

                {/* Info */}
                <View className="mt-6 p-4 rounded-lg" style={{ backgroundColor: colors.muted }}>
                    <Text variant="caption" style={{ color: colors['muted-foreground'] }}>
                        Your phone number is used for:
                    </Text>
                    <View className="mt-2 gap-1">
                        <Text variant="caption" style={{ color: colors['muted-foreground'] }}>• Sign in to your account</Text>
                        <Text variant="caption" style={{ color: colors['muted-foreground'] }}>• Let friends find you by phone</Text>
                        <Text variant="caption" style={{ color: colors['muted-foreground'] }}>• Account recovery</Text>
                    </View>
                </View>
            </View>
        </SafeAreaView>
    );
}
