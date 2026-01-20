import React, { useState, useEffect } from 'react';
import { View, Share, ActivityIndicator } from 'react-native';
import { Text } from '@/shared/ui/Text';
import { Button } from '@/shared/ui/Button';
import { StandardBottomSheet } from '@/shared/ui/Sheet/StandardBottomSheet';
import { getSupabaseClient } from '@/shared/services/supabase-client';
import { Icon } from '@/shared/ui/Icon';
import { useUIStore } from '@/shared/stores/uiStore';
import { database } from '@/db';

// Define the RPC response type locally or in a shared types file
interface CreateInviteResponse {
    code: string;
    expires_at: string;
}

interface InviteFriendSheetProps {
    visible: boolean;
    onClose: () => void;
    weaveId?: string;
    friendName: string;
    friendLocalId: string; // The local ID of the friend being invited
    weaveSnapshot?: any; // The JSON snapshot of the weave to be shared
}

export const InviteFriendSheet: React.FC<InviteFriendSheetProps> = ({
    visible,
    onClose,
    weaveId,
    friendName,
    friendLocalId,
    weaveSnapshot,
}) => {
    const [code, setCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Note: Toast functionality was intended here, but keeping it simple for MVP 
    // without external Clipboard dependency for now.
    // const showToast = useUIStore((state) => state.showToast);

    // Reset state when sheet opens
    useEffect(() => {
        if (visible) {
            setCode(null);
            setIsLoading(false);
            setError(null);
            generateInvite();
        }
    }, [visible]);

    const generateInvite = async () => {
        setIsLoading(true);
        setError(null);
        const supabase = getSupabaseClient();

        if (!supabase) {
            setError('Supabase is not configured');
            setIsLoading(false);
            return;
        }

        try {
            // Get local user profile to pass as display name if needed (for anonymous users)
            let displayName = undefined;
            try {
                const userProfileCollection = database.get('user_profiles');
                // We assume there's one active profile or use a query if needed. 
                // For now, let's try to get the first one or default.
                // In a real app, we might check the auth store or a singleton.
                const profiles = await userProfileCollection.query().fetch();
                if (profiles.length > 0) {
                    displayName = (profiles[0] as any).displayName || (profiles[0] as any).username;
                }
            } catch (e) {
                // Ignore, just fallback
            }

            const { data, error: rpcError } = await supabase.rpc('create_invite', {
                p_weave_snapshot: weaveSnapshot || null,
                p_friend_name: friendName,
                p_creator_friend_local_id: friendLocalId,
                p_display_name: displayName,
            });

            if (rpcError) throw rpcError;

            // The RPC returns a table, so data is an array. We expect one row.
            const inviteData = data as CreateInviteResponse[];
            if (inviteData && inviteData.length > 0) {
                setCode(inviteData[0].code);
            } else {
                throw new Error('No invite code returned');
            }
        } catch (err: any) {
            console.error('Error generating invite:', err);
            setError(err.message || 'Failed to generate invite');
        } finally {
            setIsLoading(false);
        }
    };

    const handleShare = async () => {
        if (!code) return;

        try {
            // Updated message based on whether it's a weave invite or just a friend link
            let message = '';
            if (weaveId) {
                message = `Hey ${friendName}! Join me on Weave to plan our hangout. Download the app and use my invite code: ${code}\n\nDownload Weave: https://apps.apple.com/app/weave/id6475656675`;
            } else {
                message = `Hey ${friendName}! Let's connect on Weave to track our friendship. Download the app and use my invite code: ${code}\n\nDownload Weave: https://apps.apple.com/app/weave/id6475656675`;
            }

            await Share.share({
                message,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    return (
        <StandardBottomSheet
            visible={visible}
            onClose={onClose}
            title={`Invite ${friendName}`}
            snapPoints={['45%'] as any}
        >
            <View className="flex-1 px-6 pt-2 pb-8 items-center justify-between">

                {/* Header / Intro */}
                <View className="items-center w-full space-y-4">
                    <Text variant="body" className="text-center text-gray-500 mb-2">
                        Share this code with {friendName} to add them to this Weave. When they join, they'll see all the details instantly.
                    </Text>

                    {/* Code Display Area */}
                    <View className="w-full">
                        {isLoading ? (
                            <View className="h-32 w-full bg-gray-50 dark:bg-gray-800 rounded-2xl items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700">
                                <ActivityIndicator size="small" color="#6B7280" />
                                <Text variant="caption" className="text-gray-400 mt-2">Generating...</Text>
                            </View>
                        ) : error ? (
                            <View className="h-32 w-full bg-red-50 dark:bg-red-900/20 rounded-2xl items-center justify-center px-4">
                                <Text variant="caption" className="text-red-500 text-center">{error}</Text>
                                <Button
                                    label="Try Again"
                                    variant="ghost"
                                    size="sm"
                                    onPress={generateInvite}
                                    className="mt-2"
                                />
                            </View>
                        ) : (
                            <View className="flex-col items-center w-full space-y-3">
                                <View className="h-32 w-full bg-secondary/10 rounded-2xl items-center justify-center border border-secondary/20 relative overflow-hidden">
                                    {/* Background pattern could go here */}
                                    <Text variant="h1" className="text-4xl font-bold tracking-widest text-primary font-serif">
                                        {code}
                                    </Text>
                                    <Text variant="caption" className="text-gray-400 mt-1 uppercase tracking-wider text-[10px]">
                                        Invite Code
                                    </Text>
                                </View>
                            </View>
                        )}
                    </View>
                </View>

                {/* Action Buttons */}
                <View className="w-full space-y-3 safe-mb">
                    <Button
                        label="Share Invite"
                        onPress={handleShare}
                        variant="primary"
                        size="lg"
                        fullWidth
                        disabled={!code || isLoading}
                        icon={<Icon name="Share" size={18} color="white" />}
                    />
                    <Button
                        label="Done"
                        onPress={onClose}
                        variant="ghost"
                        fullWidth
                    />
                </View>
            </View>
        </StandardBottomSheet>
    );
};
