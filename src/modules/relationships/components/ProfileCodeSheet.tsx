import React, { useState, useEffect } from 'react';
import { View, Share, ActivityIndicator } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { Icon } from '@/shared/ui/Icon';
import { useTheme } from '@/shared/hooks/useTheme';
import { useUIStore } from '@/shared/stores/uiStore';
import { database } from '@/db';

interface ProfileCodeSheetProps {
    visible: boolean;
    onClose: () => void;
}

export const ProfileCodeSheet: React.FC<ProfileCodeSheetProps> = ({
    visible,
    onClose,
}) => {
    const { colors } = useTheme();
    const [userId, setUserId] = useState<string | null>(null);
    const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [link, setLink] = useState<string | null>(null);

    // Get user info when sheet opens
    useEffect(() => {
        if (visible) {
            loadUserProfile();
        }
    }, [visible]);

    const loadUserProfile = async () => {
        setLoading(true);
        try {
            const supabase = getSupabaseClient();
            if (!supabase) return;

            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                setUserId(user.id);

                // Get display name from local DB
                try {
                    const userProfileCollection = database.get('user_profiles');
                    const profile = await userProfileCollection.find(user.id);
                    if (profile) {
                        setUserDisplayName((profile as any).displayName || (profile as any).username);
                    }
                } catch (e) {
                    // Fallback using user metadata if local DB fails
                    setUserDisplayName(user.user_metadata?.full_name || user.user_metadata?.display_name || 'Me');
                }

                // Generate Link
                const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
                if (supabaseUrl) {
                    const baseUrl = supabaseUrl.replace(/\/$/, '');
                    // Use the invite-proxy with userId param
                    const profileLink = `${baseUrl}/functions/v1/invite-proxy?userId=${user.id}`;
                    setLink(profileLink);
                }
            }
        } catch (error) {
            console.error('Error loading user profile for QR:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!link) return;
        try {
            await Share.share({
                message: `Connect with me on Weave: ${link}`,
                url: link,
            });
        } catch (error) {
            console.error('Error sharing profile:', error);
        }
    };

    const handleCopy = async () => {
        if (link) {
            await Clipboard.setStringAsync(link);
            // Ideally show toast
        }
    };

    return (
        <StandardBottomSheet
            visible={visible}
            onClose={onClose}
            title="My Weave Code"
            height="auto"
        >
            <View className="flex-col items-center p-6 gap-6">
                <Text className="text-center text-muted-foreground">
                    Share this code to let friends add you instantly.
                </Text>

                {/* QR Code Container */}
                <View
                    className="p-4 bg-white rounded-3xl items-center justify-center shadow-sm"
                    style={{
                        width: 200,
                        height: 200,
                        borderWidth: 1,
                        borderColor: colors.border
                    }}
                >
                    {loading ? (
                        <ActivityIndicator color={colors.primary} />
                    ) : (link ? (
                        <QRCode
                            value={link}
                            size={160}
                            color="black" // QR codes scan best with high contrast
                            backgroundColor="white"
                        />
                    ) : (
                        <Text>Error generating code</Text>
                    ))}
                </View>

                {/* User Info */}
                <View className="items-center">
                    <Text className="text-xl font-bold font-lora-bold">
                        {userDisplayName || 'Loading...'}
                    </Text>
                    <Text className="text-sm text-muted-foreground mt-1">
                        Weave Profile
                    </Text>
                </View>

                {/* Actions */}
                <View className="w-full flex-row gap-4 mt-2">
                    <Button
                        onPress={handleCopy}
                        variant="outline"
                        className="flex-1"
                        icon={<Icon name="Copy" size={18} />}
                    >
                        Copy
                    </Button>
                    <Button
                        onPress={handleShare}
                        className="flex-1"
                        icon={<Icon name="Share" size={18} color="white" />}
                    >
                        Share
                    </Button>
                </View>
            </View>
        </StandardBottomSheet>
    );
};
